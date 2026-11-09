/**
 * The Living Tree: an original, procedurally generated tree — never a trace of SRM's emblem.
 * Deterministic (seeded), generated on the server, so the client only receives static SVG.
 *
 * Every piece carries the scroll-progress window [s, e] in which it draws in (p ∈ 0..1 across the three acts):
 *   roots    → Act I   (0    – 0.33)
 *   trunk    → Act II  (0.33 – 0.45)
 *   branches → Act II  (0.42 – 0.66)
 *   leaves   → Act III (0.66 – 1)
 */

export type TreeSegment = { d: string; width: number; s: number; e: number };
export type TreeLeaf = { cx: number; cy: number; rx: number; ry: number; rotate: number; s: number; opacity: number };
export type TreeShape = {
  viewBox: string;
  ground: number;
  base: { x: number; y: number };
  roots: TreeSegment[];
  trunk: TreeSegment[];
  branches: TreeSegment[];
  leaves: TreeLeaf[];
  /** Where each outermost branch ends (the canopy hangs its leaves off these). */
  tips: { x: number; y: number; angle: number }[];
};

const W = 200;
const H = 260;
const GROUND = 196;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Quadratic curve from a to b, bowed sideways by `bend` (fraction of length) for an organic line. */
function curve(x0: number, y0: number, x1: number, y1: number, bend: number) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  return `M${r1(x0)} ${r1(y0)}Q${r1(mx - dy * bend)} ${r1(my + dx * bend)} ${r1(x1)} ${r1(y1)}`;
}

export function generateTree(seed = 2026): TreeShape {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const base = { x: W / 2, y: GROUND };

  // ── Roots: a fan of main roots with one or two rootlets each, drawn through Act I ──
  const roots: TreeSegment[] = [];
  const rootCount = 6;
  for (let i = 0; i < rootCount; i++) {
    const angle = (Math.PI * (i + 0.5)) / rootCount; // spread across the lower half-circle
    const len = between(26, 46);
    const x1 = base.x + Math.cos(angle) * len * 1.35;
    const y1 = base.y + Math.sin(angle) * len;
    const s = 0.02 + (i / rootCount) * 0.12;
    roots.push({ d: curve(base.x, base.y, x1, y1, between(-0.25, 0.25)), width: 2.2, s, e: s + 0.14 });
    const rootlets = rand() > 0.4 ? 2 : 1;
    for (let k = 0; k < rootlets; k++) {
      const a2 = angle + between(-0.6, 0.6);
      const l2 = len * between(0.35, 0.55);
      const x2 = x1 + Math.cos(a2) * l2;
      const y2 = Math.min(H - 4, y1 + Math.abs(Math.sin(a2)) * l2);
      roots.push({ d: curve(x1, y1, x2, y2, between(-0.3, 0.3)), width: 1.2, s: s + 0.12, e: Math.min(0.33, s + 0.24) });
    }
  }

  // ── Trunk ──
  const trunkTop = { x: base.x + between(-4, 4), y: GROUND - 74 };
  const trunk: TreeSegment[] = [
    { d: curve(base.x, base.y, trunkTop.x, trunkTop.y, 0.06), width: 6, s: 0.33, e: 0.45 },
  ];

  // ── Branches: recursive, depth 4; deeper = thinner + later ──
  const branches: TreeSegment[] = [];
  const tips: { x: number; y: number; angle: number }[] = [];
  const MAX_DEPTH = 4;
  // Keep every branch pointing upward (between ~20° and ~160° above horizontal) so the canopy stays a crown.
  const UP_MIN = -Math.PI + 0.35;
  const UP_MAX = -0.35;
  const grow = (x: number, y: number, rawAngle: number, len: number, depth: number, start: number) => {
    const angle = Math.min(Math.max(rawAngle, UP_MIN), UP_MAX);
    const x1 = x + Math.cos(angle) * len;
    const y1 = y + Math.sin(angle) * len;
    const span = 0.24 / MAX_DEPTH;
    branches.push({ d: curve(x, y, x1, y1, between(-0.18, 0.18)), width: 4.2 - depth * 0.85, s: start, e: start + span });
    if (depth === MAX_DEPTH) {
      tips.push({ x: x1, y: y1, angle });
      return;
    }
    const children = depth < 2 ? 2 + (rand() > 0.55 ? 1 : 0) : 2;
    for (let c = 0; c < children; c++) {
      const spread = children === 3 ? (c - 1) * 0.55 : (c === 0 ? -1 : 1) * between(0.35, 0.6);
      grow(x1, y1, angle + spread + between(-0.12, 0.12), len * between(0.66, 0.8), depth + 1, start + span * 0.85);
    }
  };
  grow(trunkTop.x, trunkTop.y, -Math.PI / 2 + between(-0.08, 0.08), 30, 1, 0.42);

  // ── Leaves: clusters around each tip, unfolding through Act III ──
  const leaves: TreeLeaf[] = [];
  tips.forEach((tip, i) => {
    const per = 4;
    for (let k = 0; k < per; k++) {
      const a = tip.angle + between(-1.2, 1.2);
      const dist = between(0.5, 5.5);
      leaves.push({
        cx: r1(tip.x + Math.cos(a) * dist),
        cy: r1(tip.y + Math.sin(a) * dist),
        rx: r1(between(4, 6.2)),
        ry: r1(between(2.2, 3.2)),
        rotate: Math.round((a * 180) / Math.PI),
        s: r3(0.66 + ((i * per + k) / (tips.length * per)) * 0.3),
        opacity: r3(between(0.55, 1)),
      });
    }
  });

  // Crop the viewBox to what was actually drawn (+ padding) so the widget stays as small as possible.
  const nums = [...roots, ...trunk, ...branches].flatMap((sg) => [...sg.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])));
  const xs = [...nums.filter((_, i) => i % 2 === 0), ...leaves.flatMap((l) => [l.cx - l.rx, l.cx + l.rx])];
  const ys = [...nums.filter((_, i) => i % 2 === 1), ...leaves.flatMap((l) => [l.cy - l.rx, l.cy + l.rx])];
  const pad = 4;
  const minX = Math.floor(Math.min(...xs) - pad);
  const minY = Math.floor(Math.min(...ys) - pad);
  const viewBox = `${minX} ${minY} ${Math.ceil(Math.max(...xs) + pad) - minX} ${Math.ceil(Math.max(...ys) + pad) - minY}`;

  return { viewBox, ground: GROUND, base, roots, trunk, branches, leaves, tips };
}

export type Canopy = {
  viewBox: string;
  trunk: TreeSegment[];
  branches: TreeSegment[];
  /** A thin stalk from the nearest branch tip to each leaf. */
  stems: string[];
  /** Leaf positions as fractions (0..1) of the viewBox, in the order filled (centre of the crown outward). */
  slots: { x: number; y: number }[];
  /** The visitor's leaf: above the crown, where there's room for a label. */
  apex: { x: number; y: number };
};

/**
 * The same tree as the corner widget (same seed), fully grown, with `slots` leaf positions spread over its crown.
 * Leaves sit on a hexagonal grid inside an ellipse around the branch tips, so they're evenly spaced and each gets
 * room for a 44 px tap target, with a little seeded jitter so it doesn't read as a grid. Deterministic, built on the server, original: never a trace of SRM's emblem.
 */
export function generateCanopy(slots: number, seed = 2026): Canopy {
  const tree = generateTree(seed);
  const xs = tree.tips.map((t) => t.x);
  const ys = tree.tips.map((t) => t.y);
  // A full, rounded crown sitting on the branches: wider and much taller than the bare branch tips, so 27 leaves each
  // get room for a 44 px target. Stems reach from the nearest tip to each leaf.
  const rx = ((Math.max(...xs) - Math.min(...xs)) / 2) * 1.7 + 22;
  const ry = Math.max(((Math.max(...ys) - Math.min(...ys)) / 2) * 2.4 + 30, rx * 0.62);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = Math.max(...ys) - ry * 0.78;
  const rand = mulberry32(seed + 1);
  let points: { x: number; y: number }[] = [];
  // Spacing for `slots` hex cells to fill the ellipse; tightened slightly until enough cells fall inside it.
  for (let d = Math.sqrt((Math.PI * rx * ry) / (slots * 0.866)); points.length < slots; d *= 0.95) {
    const cells: { x: number; y: number; r: number }[] = [];
    for (let row = 0, y = cy - ry; y <= cy + ry; row++, y += d * 0.866)
      for (let x = cx - rx + (row % 2 ? d / 2 : 0); x <= cx + rx; x += d) {
        const r = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (r <= 1) cells.push({ x, y, r });
      }
    points = cells
      .sort((a, b) => a.r - b.r)
      .slice(0, slots)
      .map((c) => ({ x: c.x + (rand() - 0.5) * d * 0.16, y: c.y + (rand() - 0.5) * d * 0.16 }));
  }
  const apex = { x: cx, y: cy - ry - 14 };
  const stems = points.map((p) => {
    const tip = tree.tips.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
    return curve(tip.x, tip.y, p.x, p.y, 0.15);
  });

  // Crown and trunk only: the roots belonged to Act I, and leaving them out gives the crown the height.
  const nums = [...tree.trunk, ...tree.branches].flatMap((sg) => [...sg.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])));
  const allX = [...nums.filter((_, i) => i % 2 === 0), ...points.map((p) => p.x), apex.x];
  const allY = [...nums.filter((_, i) => i % 2 === 1), ...points.map((p) => p.y), apex.y];
  const pad = 10;
  const minX = Math.floor(Math.min(...allX) - pad);
  const minY = Math.floor(Math.min(...allY) - pad);
  const w = Math.ceil(Math.max(...allX) + pad) - minX;
  const h = Math.ceil(Math.max(...allY) + pad) - minY;
  const frac = (p: { x: number; y: number }) => ({ x: r3((p.x - minX) / w), y: r3((p.y - minY) / h) });

  return {
    viewBox: `${minX} ${minY} ${w} ${h}`,
    trunk: tree.trunk,
    branches: tree.branches,
    stems,
    slots: points.map(frac),
    apex: frac(apex),
  };
}
