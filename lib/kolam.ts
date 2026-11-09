/**
 * Kolam crests for "Level Up at SRM": original line drawings on a dot grid, after the rice-flour kolam drawn on
 * thresholds across Tamil Nadu. One pattern per stat, generated (never traced), so every crest is SRM's own.
 * Returns plain geometry; components/grail/Kolam.tsx draws it.
 */
export type KolamVariant = "lattice" | "rings" | "petals" | "flower";
type KolamShape = { size: number; dots: { x: number; y: number }[]; paths: string[] };

const S = 20; // dot spacing
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A lens (two arcs) between two dots: the basic kolam loop. */
function lens(x1: number, y1: number, x2: number, y2: number, bulge = 0.55) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const radius = len / (2 * Math.sin(Math.PI * bulge * 0.5)) || len;
  return `M${r1(x1)} ${r1(y1)}A${r1(radius)} ${r1(radius)} 0 0 1 ${r1(x2)} ${r1(y2)}A${r1(radius)} ${r1(radius)} 0 0 1 ${r1(x1)} ${r1(y1)}`;
}

export function kolam(variant: KolamVariant): KolamShape {
  if (variant === "lattice") {
    // Interlocking diamonds around a 4 × 4 grid of dots.
    const n = 4;
    const size = n * S + S;
    const dots = Array.from({ length: n * n }, (_, i) => ({ x: S + (i % n) * S, y: S + Math.floor(i / n) * S }));
    const h = S * 0.62;
    const paths = dots.map((d) => `M${d.x} ${r1(d.y - h)}L${r1(d.x + h)} ${d.y}L${d.x} ${r1(d.y + h)}L${r1(d.x - h)} ${d.y}Z`);
    paths.push(`M${S * 0.5} ${S * 0.5}H${size - S * 0.5}V${size - S * 0.5}H${S * 0.5}Z`);
    return { size, dots, paths };
  }
  if (variant === "rings") {
    // Rings around dots set in a diamond, inside one large ring.
    const c = 2.5 * S;
    const size = 5 * S;
    const dots: { x: number; y: number }[] = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) dots.push({ x: c + i * S * 0.8, y: c + j * S * 0.8 });
    const paths = dots.map((d) => `M${r1(d.x - 7)} ${r1(d.y)}a7 7 0 1 0 14 0a7 7 0 1 0 -14 0`);
    paths.push(`M${r1(c - 2.3 * S)} ${c}a${r1(2.3 * S)} ${r1(2.3 * S)} 0 1 0 ${r1(4.6 * S)} 0a${r1(2.3 * S)} ${r1(2.3 * S)} 0 1 0 ${r1(-4.6 * S)} 0`);
    return { size, dots, paths };
  }
  if (variant === "petals") {
    // A 3 × 3 grid, every neighbouring pair joined by a lens: a woven mesh.
    const n = 3;
    const size = (n + 1) * S + S;
    const off = S * 1.5;
    const dots = Array.from({ length: n * n }, (_, i) => ({ x: off + (i % n) * S * 1.2, y: off + Math.floor(i / n) * S * 1.2 }));
    const paths: string[] = [];
    dots.forEach((d, i) => {
      if (i % n < n - 1) paths.push(lens(d.x, d.y, dots[i + 1]!.x, dots[i + 1]!.y));
      if (i + n < dots.length) paths.push(lens(d.x, d.y, dots[i + n]!.x, dots[i + n]!.y));
    });
    const c = off + S * 1.2;
    paths.push(`M${r1(c - S * 2.2)} ${r1(c)}Q${r1(c)} ${r1(c - S * 3)} ${r1(c + S * 2.2)} ${r1(c)}Q${r1(c)} ${r1(c + S * 3)} ${r1(c - S * 2.2)} ${r1(c)}Z`);
    return { size, dots, paths };
  }
  // Flower: eight petals from a centre dot to a ring of dots, with a ring round the centre.
  const size = 5 * S;
  const c = size / 2;
  const dots = [{ x: c, y: c }];
  const paths: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const x = c + Math.cos(a) * S * 1.6;
    const y = c + Math.sin(a) * S * 1.6;
    dots.push({ x: r1(x), y: r1(y) });
    paths.push(lens(c, c, x, y, 0.42));
  }
  paths.push(`M${c - 6} ${c}a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`);
  paths.push(`M${r1(c - S * 2.15)} ${c}a${r1(S * 2.15)} ${r1(S * 2.15)} 0 1 0 ${r1(S * 4.3)} 0a${r1(S * 2.15)} ${r1(S * 2.15)} 0 1 0 ${r1(-S * 4.3)} 0`);
  return { size, dots, paths };
}

/** Which crest belongs to which stat. */
export const STAT_KOLAM = { build: "lattice", think: "rings", connect: "petals", grow: "flower" } as const satisfies Record<string, KolamVariant>;
