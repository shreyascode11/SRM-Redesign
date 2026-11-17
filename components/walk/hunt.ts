/**
 * The Daily Campus Hunt: the same five places for everyone on a given day (chosen from the date, so there's no
 * server), found against the clock from the main gate. Results are shared like a Wordle score: the hunt number,
 * the time and a row of emoji, one per place. Best times and the streak stay in this browser.
 */

/** Hunt #1 was 1 November 2026 (Chennai). */
const EPOCH_DAY = Math.floor((Date.UTC(2026, 10, 1) / 1000 + 19800) / 86400);
const dayOf = (ms: number) => Math.floor((ms / 1000 + 19800) / 86400);
export const huntNumber = (now = Date.now()) => dayOf(now) - EPOCH_DAY + 1;

export const KIND_EMOJI: Record<string, string> = {
  arrival: "🚉",
  admin: "🏛️",
  library: "📚",
  landmark: "🕰️",
  food: "🍛",
  other: "🏨",
  tech: "💻",
  events: "🎭",
  academic: "🏫",
  workshop: "🔧",
  health: "🏥",
  homes: "🏠",
  hostel: "🛏️",
  shop: "🛍️",
  faith: "🛕",
  park: "🌳",
  sports: "🏟️",
};

/** Five places for hunt `n`: different kinds where possible, and none within 40 m of the gate or of each other. */
export function huntPlaces(n: number, places: { id: string; kind: string; door: [number, number] }[], gate: [number, number]): string[] {
  let s = (n * 2654435761) >>> 0 || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = places.filter((p) => Math.hypot(p.door[0] - gate[0], p.door[1] - gate[1]) > 40);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const out: typeof pool = [];
  const far = (p: (typeof pool)[number]) => out.every((q) => Math.hypot(q.door[0] - p.door[0], q.door[1] - p.door[1]) > 40);
  for (const strict of [true, false]) for (const p of pool) if (out.length < 5 && !out.includes(p) && far(p) && (!strict || !out.some((q) => q.kind === p.kind))) out.push(p);
  return out.map((p) => p.id);
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Saved = { best: Record<string, number> };
const KEY = "srm-walk-hunt";
const load = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    if (v && typeof v.best === "object") return v;
  } catch {
    // Nothing saved, or no storage.
  }
  return { best: {} };
};
/** Save a finished hunt; returns the best time for that hunt (this one if it's faster). */
export function saveHunt(n: number, ms: number) {
  const v = load();
  const old = v.best[n];
  v.best[n] = old === undefined ? ms : Math.min(old, ms);
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Not saved; the result still shows.
  }
  return v.best[n]!;
}
export const bestFor = (n: number) => load().best[n] ?? null;
/** Days in a row with a finished hunt, ending today (or yesterday, if today's isn't done yet). */
export function streak(now = Date.now()) {
  const best = load().best;
  let n = huntNumber(now);
  if (best[n] === undefined) n--;
  let k = 0;
  while (best[n - k] !== undefined) k++;
  return k;
}
