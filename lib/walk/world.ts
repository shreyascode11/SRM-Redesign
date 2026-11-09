/**
 * Walk SRM: the world data (public/walk/ktr-world.json, built by scripts/build-campus-walk.mjs from OpenStreetMap),
 * collision against real building footprints, and path-finding along real roads and footpaths. Pure maths, no three.js,
 * so it is cheap to load and easy to test.
 */

export type XZ = [number, number];
export type World = {
  origin: [number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: string;
  /** k = kind: 0 other · 1 academic · 2 hostel · 3 food · 4 tech · 5 health · 6 faith · 7 workshop · 8 admin/events · 9 homes */
  buildings: { p: XZ[]; h: number; k: number; n?: string }[];
  roads: { p: XZ[]; w: number; f?: 1 }[];
  water: { p: XZ[] }[];
  green: { p: XZ[] }[];
  trees: [number, number, number][];
  /** Bus stops (OpenStreetMap), for shelters. */
  stops?: XZ[];
  /** island: the radius of a roundabout's island, for a landmark that stands on one (the clock tower). */
  places: Record<string, { x: number; z: number; door: XZ; b?: number; island?: number }>;
  /** The arch gate across the entrance avenue: centre, facing (along the avenue) and the gap between its two roads. */
  gate?: { x: number; z: number; ry: number; span: number };
  /** The world is drawn at this fraction of real size (distances and footprints; heights stay real). */
  scale?: number;
};

export const inside = (x: number, z: number, poly: XZ[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

const closestOnSeg = (x: number, z: number, a: XZ, b: XZ): XZ => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return [a[0] + t * dx, a[1] + t * dz];
};

/** Polygons (buildings and ponds) bucketed into a grid, so a step only tests the few nearby. */
export class Collider {
  private cells = new Map<string, XZ[][]>();
  constructor(
    polys: XZ[][],
    private bounds: World["bounds"],
    private size = 24,
  ) {
    for (const p of polys) {
      let x0 = Infinity,
        x1 = -Infinity,
        z0 = Infinity,
        z1 = -Infinity;
      for (const [x, z] of p) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
      for (let cx = Math.floor(x0 / size); cx <= Math.floor(x1 / size); cx++)
        for (let cz = Math.floor(z0 / size); cz <= Math.floor(z1 / size); cz++) {
          const k = `${cx},${cz}`;
          const list = this.cells.get(k) ?? [];
          list.push(p);
          this.cells.set(k, list);
        }
    }
  }

  private near(x: number, z: number) {
    const out = new Set<XZ[]>();
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of this.cells.get(`${cx + i},${cz + j}`) ?? []) out.add(p);
    return out;
  }

  blocked(x: number, z: number, r = 0) {
    for (const p of this.near(x, z)) {
      if (inside(x, z, p)) return true;
      if (r > 0)
        for (let i = 0; i < p.length; i++) {
          const q = closestOnSeg(x, z, p[i]!, p[(i + 1) % p.length]!);
          if (Math.hypot(q[0] - x, q[1] - z) < r) return true;
        }
    }
    return false;
  }

  /** Push a circle of radius r out of any footprint it overlaps, so the walker slides along walls. */
  resolve(x: number, z: number, r = 0.55): XZ {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const p of this.near(x, z)) {
        const isIn = inside(x, z, p);
        let best: XZ | null = null;
        let bd = Infinity;
        for (let i = 0; i < p.length; i++) {
          const q = closestOnSeg(x, z, p[i]!, p[(i + 1) % p.length]!);
          const d = Math.hypot(q[0] - x, q[1] - z);
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
        if (!best) continue;
        if (isIn || bd < r) {
          let nx = isIn ? best[0] - x : x - best[0];
          let nz = isIn ? best[1] - z : z - best[1];
          const len = Math.hypot(nx, nz) || 1;
          nx /= len;
          nz /= len;
          x = best[0] + nx * r;
          z = best[1] + nz * r;
          moved = true;
        }
      }
      if (!moved) break;
    }
    const b = this.bounds;
    return [Math.min(b.maxX + 60, Math.max(b.minX - 60, x)), Math.min(b.maxZ + 60, Math.max(b.minZ - 60, z))];
  }

  /** Can you walk straight from a to b? (Sampled every 2 m.) */
  clear(a: XZ, b: XZ, r = 0.5) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.blocked(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r)) return false;
    }
    return true;
  }
}

/** Roads and footpaths as a graph (OSM ways share nodes at junctions, so equal coordinates join up). */
export class Paths {
  private nodes: XZ[] = [];
  private edges: number[][] = [];
  private index = new Map<string, number>();

  constructor(
    roads: World["roads"],
    private collider: Collider,
  ) {
    const id = (p: XZ) => {
      const k = `${p[0]},${p[1]}`;
      let i = this.index.get(k);
      if (i === undefined) {
        i = this.nodes.length;
        this.nodes.push(p);
        this.edges.push([]);
        this.index.set(k, i);
      }
      return i;
    };
    for (const { p } of roads)
      for (let i = 0; i < p.length - 1; i++) {
        const a = id(p[i]!);
        const b = id(p[i + 1]!);
        if (a !== b) {
          this.edges[a]!.push(b);
          this.edges[b]!.push(a);
        }
      }
  }

  private nearest(x: number, z: number, max = 80) {
    let best = -1;
    let bd = max;
    this.nodes.forEach(([nx, nz], i) => {
      const d = Math.hypot(nx - x, nz - z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** A walkable route from a to b: along roads where needed, cutting straight across where nothing is in the way. */
  route(a: XZ, b: XZ): XZ[] {
    if (this.collider.clear(a, b)) return [b];
    const s = this.nearest(a[0], a[1]);
    const t = this.nearest(b[0], b[1]);
    if (s < 0 || t < 0) return [b];
    // A* over the road graph.
    const n = this.nodes.length;
    const g = new Float64Array(n).fill(Infinity);
    const f = new Float64Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const open = new Set<number>([s]);
    const h = (i: number) => Math.hypot(this.nodes[i]![0] - this.nodes[t]![0], this.nodes[i]![1] - this.nodes[t]![1]);
    g[s] = 0;
    f[s] = h(s);
    while (open.size) {
      let cur = -1;
      let cf = Infinity;
      for (const i of open)
        if (f[i]! < cf) {
          cf = f[i]!;
          cur = i;
        }
      if (cur === t) break;
      open.delete(cur);
      for (const nb of this.edges[cur]!) {
        const step = Math.hypot(this.nodes[cur]![0] - this.nodes[nb]![0], this.nodes[cur]![1] - this.nodes[nb]![1]);
        const tg = g[cur]! + step;
        if (tg < g[nb]!) {
          g[nb] = tg;
          f[nb] = tg + h(nb);
          from[nb] = cur;
          open.add(nb);
        }
      }
    }
    if (from[t] === -1 && s !== t) return [b];
    const chain: XZ[] = [];
    for (let i = t; i !== -1; i = from[i]!) chain.unshift(this.nodes[i]!);
    const pts: XZ[] = [a, ...chain, b];
    // String-pulling: skip corners whenever the straight line is clear.
    const out: XZ[] = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.collider.clear(pts[i]!, pts[j]!)) j--;
      out.push(pts[j]!);
      i = j;
    }
    return out;
  }
}

/** Chennai's hour right now (the campus clock), for the time-of-day light. */
export const chennaiHour = () => {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "numeric", hourCycle: "h23" }).format(new Date());
  const [hh, mm] = s.split(":").map(Number);
  return (hh ?? 12) + (mm ?? 0) / 60;
};
