import { EXPERIMENTS } from "./ab";

export type Counts = Record<string, Record<string, { views: number; goals: number }>>;

/** Smallest sample per variant before we call a result; below this, "keep running". */
export const MIN_VIEWS = 100;

/** Standard normal CDF (Abramowitz–Stegun 7.1.26), accurate to ~1e-7: enough for a p-value. */
const phi = (z: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
};

/**
 * Two-proportion z-test of variant B against A (two-sided). Returns rates, the relative lift of B over A, the p-value
 * and a plain verdict: "keep running" until both variants have MIN_VIEWS views, then B/A wins at p < 0.05, else no difference.
 */
function compare(a: { views: number; goals: number }, b: { views: number; goals: number }) {
  const ra = a.views ? a.goals / a.views : 0;
  const rb = b.views ? b.goals / b.views : 0;
  const pooled = a.views + b.views ? (a.goals + b.goals) / (a.views + b.views) : 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / (a.views || 1) + 1 / (b.views || 1)));
  const z = se ? (rb - ra) / se : 0;
  const p = se ? 2 * (1 - phi(Math.abs(z))) : 1;
  const enough = a.views >= MIN_VIEWS && b.views >= MIN_VIEWS;
  const verdict = !enough ? "keep running" : p < 0.05 ? (rb > ra ? "B wins" : "A wins") : "no clear difference";
  return { rateA: ra, rateB: rb, lift: ra ? (rb - ra) / ra : null, z, p, verdict };
}

export function abSummary(counts: Counts) {
  return Object.entries(EXPERIMENTS).map(([id, x]) => {
    const a = counts[id]?.a ?? { views: 0, goals: 0 };
    const b = counts[id]?.b ?? { views: 0, goals: 0 };
    return { id, question: x.question, a: { ...a, label: x.a }, b: { ...b, label: x.b }, goal: x.goal, ...compare(a, b) };
  });
}
