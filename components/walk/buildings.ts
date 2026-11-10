import * as THREE from "three";
import type { World, XZ } from "@/lib/walk/world";

/**
 * Buildings that look like their real selves, in an anime style. Walls are built edge by edge, so windows line up
 * with each wall; a window style (aStyle) and the distance along the wall (aU) go to the shader (curve.ts), which
 * draws framed windows with ink lines. Real geometry adds what gives a building its character: floor bands, roof
 * parapets and caps, black rooftop water tanks, AC units, entrance canopies and awnings, signboards, and the
 * signature facades of SRM's best-known buildings (from SRM's own photos):
 *  - SRM Tech Park: a yellow frame around blue glass, red and blue stripes, a maroon roof cap
 *  - SRM University Building: an orange tower, punched windows, a tall bronze glass panel, an arch at the foot
 *  - Hostels: cream walls with white floor bands, framed windows with grills, a blue name plate, a green awning
 */

/** Window styles read by the shader: 0 none · 1 punched · 2 grid · 3 hostel · 4 curtain glass · 5 corrugated. */
type Style = { wall: string; roof: string; win: number; bands?: string; parapet?: string; cap?: string; tanks?: number };

const STYLES: Record<string, Style> = {
  techPark: { wall: "#f1efe8", roof: "#d8d4c8", win: 2, cap: "#8b2d32", parapet: "#e9e6dc" },
  // Tech Park 2: the orange tower beside Tech Park (SRM's campus photo): punched windows, a bronze glass panel, an arch.
  orangeTower: { wall: "#e8935a", roof: "#cfc6b4", win: 1, cap: "#4a3a32" },
  // The University Building: white and cream, with blue-grey glass.
  ub: { wall: "#f2efe7", roof: "#d6d2c8", win: 2, bands: "#e4dfd2", parapet: "#ebe7dd", cap: "#cfd8de" },
  hostel: { wall: "#ecd29c", roof: "#d9d0bd", win: 3, bands: "#f6f4ee", parapet: "#f2efe6", tanks: 3 },
  academic: { wall: "#eeebe3", roof: "#d3cdbf", win: 2, bands: "#dcd6c8", parapet: "#e4dfd3", tanks: 2 },
  food: { wall: "#f3dfb8", roof: "#cfc6b4", win: 2, parapet: "#e7dcc4", tanks: 1 },
  health: { wall: "#f4f5f2", roof: "#d6d8d2", win: 2, bands: "#9cc3d8", parapet: "#e8ebe6", tanks: 2 },
  faith: { wall: "#f1e2c0", roof: "#d9a35a", win: 0, parapet: "#e8c98f" },
  workshop: { wall: "#b9c2c4", roof: "#9aa5a8", win: 5 },
  homes: { wall: "#e7d8cc", roof: "#cdbfb2", win: 3, bands: "#f3eee8", parapet: "#efe8e0", tanks: 2 },
  other: { wall: "#e3ddd2", roof: "#cbc3b5", win: 2, parapet: "#ddd6ca", tanks: 1 },
};
const BY_KIND = ["other", "academic", "hostel", "food", "academic", "health", "faith", "workshop", "academic", "homes"];

const styleOf = (b: World["buildings"][number]): Style => {
  if (b.n === "tech-park") return STYLES.techPark!;
  if (b.n === "tech-park-2") return STYLES.orangeTower!;
  if (b.n === "university-building") return STYLES.ub!;
  return STYLES[BY_KIND[b.k] ?? "other"]!;
};

// ── Geometry helpers (all non-indexed, position + normal + color [+ aStyle + aU]) ──
export type Buf = { pos: number[]; nrm: number[]; col: number[]; sty: number[]; u: number[] };
export const newBuf = (): Buf => ({ pos: [], nrm: [], col: [], sty: [], u: [] });
export const toGeo = (b: Buf, withWindows = false) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  if (withWindows) {
    g.setAttribute("aStyle", new THREE.Float32BufferAttribute(b.sty, 1));
    g.setAttribute("aU", new THREE.Float32BufferAttribute(b.u, 1));
  }
  return g;
};
const tri = (b: Buf, c: THREE.Color, n: number[], style: number, ...v: [number, number, number, number][]) => {
  for (const [x, y, z, u] of v) {
    b.pos.push(x, y, z);
    b.nrm.push(n[0]!, n[1]!, n[2]!);
    b.col.push(c.r, c.g, c.b);
    b.sty.push(style);
    b.u.push(u);
  }
};
/** Append any three.js geometry (moved by `m`) to a buffer, in one colour. */
export const addGeo = (b: Buf, geo: THREE.BufferGeometry, m: THREE.Matrix4, c: THREE.Color) => {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
  g.computeVertexNormals();
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  for (let i = 0; i < p.count; i++) {
    b.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    b.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
    b.col.push(c.r, c.g, c.b);
    b.sty.push(0);
    b.u.push(0);
  }
};

const inside = (x: number, z: number, poly: XZ[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
/** Outward unit normal of edge i (tested against the footprint, so winding doesn't matter). */
const outward = (p: XZ[], i: number): XZ => {
  const a = p[i]!;
  const b = p[(i + 1) % p.length]!;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  let nx = dz / len;
  let nz = -dx / len;
  if (inside((a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + nz * 0.2, p)) {
    nx = -nx;
    nz = -nz;
  }
  return [nx, nz];
};
/** The footprint pushed out (or in, d < 0) by d metres, with mitred corners. */
const offset = (p: XZ[], d: number): XZ[] =>
  p.map((v, i) => {
    const n0 = outward(p, (i - 1 + p.length) % p.length);
    const n1 = outward(p, i);
    let mx = n0[0] + n1[0];
    let mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cos = Math.max(0.35, mx * n1[0] + mz * n1[1]);
    return [v[0] + (mx * d) / cos, v[1] + (mz * d) / cos];
  });

/** A projecting slab round a building (a chajja / sunshade or floor ledge): the footprint pushed out by `depth`, with
 *  the building cut out of it, `t` metres thick, its top at `y`. */
function ledge(b: Buf, p: XZ[], depth: number, y: number, t: number, c: THREE.Color) {
  const outer = offset(p, depth).map(([x, z]) => new THREE.Vector2(x, -z));
  const inner = p.map(([x, z]) => new THREE.Vector2(x, -z));
  if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
  if (!THREE.ShapeUtils.isClockWise(inner)) inner.reverse();
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - t, 0);
  addGeo(b, g, M.identity(), c);
  g.dispose();
}

/** Walls (one quad per edge, windows aligned to that wall) and a flat roof. */
function shell(b: Buf, p: XZ[], y0: number, y1: number, wall: THREE.Color, roof: THREE.Color | null, style: number) {
  let along = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const c = p[(i + 1) % p.length]!;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const [nx, nz] = outward(p, i);
    const n = [nx, 0, nz];
    const u0 = along;
    const u1 = along + len;
    // Wind each wall so it faces out, whichever way round the footprint was drawn (OSM outlines go either way; a
    // wall wound the wrong way is culled from outside and the building looks hollow, just its ledges and columns).
    const out = -(c[1] - a[1]) * nx + (c[0] - a[0]) * nz > 0;
    if (out) {
      tri(b, wall, n, style, [a[0], y0, a[1], u0], [c[0], y0, c[1], u1], [c[0], y1, c[1], u1]);
      tri(b, wall, n, style, [a[0], y0, a[1], u0], [c[0], y1, c[1], u1], [a[0], y1, a[1], u0]);
    } else {
      tri(b, wall, n, style, [a[0], y0, a[1], u0], [c[0], y1, c[1], u1], [c[0], y0, c[1], u1]);
      tri(b, wall, n, style, [a[0], y0, a[1], u0], [a[0], y1, a[1], u0], [c[0], y1, c[1], u1]);
    }
    along = u1 + 1.3; // a little offset per wall, so corners don't line up a window on both sides
  }
  if (roof) {
    const shape = new THREE.ShapeGeometry(new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))));
    shape.rotateX(-Math.PI / 2);
    shape.translate(0, y1, 0);
    const g = shape.toNonIndexed();
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      // Make sure each roof triangle faces up.
      const v = [0, 1, 2].map((k) => [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)] as [number, number, number]);
      const ux = v[1]![0] - v[0]![0];
      const uz = v[1]![2] - v[0]![2];
      const wx = v[2]![0] - v[0]![0];
      const wz = v[2]![2] - v[0]![2];
      const up = uz * wx - ux * wz > 0;
      const order = up ? [0, 1, 2] : [0, 2, 1];
      tri(b, roof, [0, 1, 0], 0, ...order.map((k) => [v[k]![0], v[k]![1], v[k]![2], 0] as [number, number, number, number]));
    }
  }
}

let seed = 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
/** A wheel, axle along local x: for the ambulance, scooters and bicycles. */
const WHEEL = (() => {
  const g = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 12);
  g.rotateZ(Math.PI / 2);
  return g;
})();
const CLOTHES = ["#d8353f", "#2f6fd8", "#f2c42e", "#3f8f6b", "#f1f1ec", "#8a4fbf", "#ef8a3a"];
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const E = new THREE.Euler();
const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  M.compose(P.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S.set(sx, sy, sz));

export type Sign = { text: string; sub?: string; bg: string; fg: string; x: number; y: number; z: number; ry: number; w: number; h: number };
/** Footprints drawn by landmarks.ts (the arch gate's piers and statue, the clock tower's island, the auditorium). */
export const isLandmark = (n?: string) => !!n && (n.startsWith("gate-") || n === "clock-tower" || n === "auditorium");
/** A clock face on the tower: centre, facing, radius. */
export type Clock = { x: number; y: number; z: number; ry: number; r: number };

/**
 * Everything for the buildings, as a few merged meshes:
 *  walls  — walls and roofs with window styles (one draw call)
 *  trim   — bands, parapets, caps, tanks, AC units, canopies, facades (one draw call)
 *  glass  — big glass panels (one draw call)
 *  signs  — where each signboard goes (drawn separately with its own text)
 */
export function buildCampus(world: World, names: Record<string, string>) {
  seed = 3;
  const walls = newBuf();
  const trim = newBuf();
  const glass = newBuf();
  const signs: Sign[] = [];
  const col = (h: string) => new THREE.Color(h);
  const doorOf = new Map<number, { id: string; door: XZ }>();
  for (const [id, pl] of Object.entries(world.places)) if (pl.b !== undefined && !doorOf.has(pl.b)) doorOf.set(pl.b, { id, door: pl.door });

  world.buildings.forEach((bld, bi) => {
    const st = styleOf(bld);
    const p = bld.p;
    const h = bld.h;
    const wall = col(st.wall);
    const roof = col(st.roof);
    // Small sheds and huts: plain walls, no windows.
    const tiny = h < 7;
    // The arch gate and the clock tower are drawn by landmarks.ts; their footprints are only for walking round.
    if (isLandmark(bld.n)) return;
    shell(walls, p, 0, h, wall, roof, tiny ? 0 : st.win);

    // Structure: floor ledges (hostels, homes, hospitals), sunshades over the windows (teaching blocks), corner
    // columns and pilasters, and a plinth. These give the outlines and shadows that make a block read as built.
    if (!tiny && st.win !== 4 && st.win !== 5) {
      const floors = Math.max(1, Math.round(h / 3.4));
      const trimC = col(st.bands ?? st.parapet ?? st.wall).offsetHSL(0, 0, -0.02);
      if (st.bands) {
        for (let f = 1; f < floors; f++) ledge(trim, p, st.win === 3 ? 0.42 : 0.3, f * 3.4 + 0.12, 0.22, col(st.bands));
      } else if (st.win === 2) {
        for (let f = 0; f < floors; f++) ledge(trim, p, 0.6, f * 3.4 + 2.85, 0.1, trimC);
      }
      ledge(trim, p, 0.25, 0.55, 0.55, col("#b9b1a2")); // plinth
      const colC = col(st.wall).offsetHSL(0, -0.03, -0.06);
      for (let i = 0; i < p.length; i++) {
        const a = p[i]!;
        const c = p[(i + 1) % p.length]!;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const ry = Math.atan2(c[0] - a[0], c[1] - a[1]);
        // Corner column.
        addGeo(trim, BOX, place(a[0], h / 2, a[1], 0.9, h + 0.2, 0.9, ry), colC);
        // Pilasters every ~9 m on long walls.
        if (len > 14 && st.win !== 1) {
          const [nx, nz] = outward(p, i);
          const n = Math.floor(len / 9);
          for (let k = 1; k < n; k++) {
            const t = k / n;
            addGeo(trim, BOX, place(a[0] + (c[0] - a[0]) * t + nx * 0.12, h / 2, a[1] + (c[1] - a[1]) * t + nz * 0.12, 0.5, h, 0.3, Math.atan2(nx, nz)), colC);
          }
        }
      }
    }
    // Roof: a parapet (low wall round the edge) or a cap that overhangs.
    if (st.cap) {
      const capRing = offset(p, 0.55);
      shell(trim, capRing, h, h + 0.9, col(st.cap), col(st.cap), 0);
    } else if (st.parapet && !tiny) {
      const par = col(st.parapet);
      const outer = offset(p, 0.05);
      shell(trim, outer, h, h + 0.9, par, null, 0);
    }
    // Rooftop: black water tanks (a very Indian roofline), AC units and a stair room.
    if (st.tanks && !tiny) {
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
      const inner = offset(p, -2.2);
      const spots: XZ[] = [];
      for (let tries = 0; spots.length < st.tanks + 3 && tries < 80; tries++) {
        const x = x0 + rnd() * (x1 - x0);
        const z = z0 + rnd() * (z1 - z0);
        if (inside(x, z, inner) && spots.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > 3)) spots.push([x, z]);
      }
      spots.forEach(([x, z], i) => {
        if (i < (st.tanks ?? 0)) {
          addGeo(trim, CYL, place(x, h + 1.35, z, 0.75, 1.5, 0.75), col("#2b2e33"));
          addGeo(trim, CYL, place(x, h + 2.2, z, 0.5, 0.18, 0.5), col("#3a3e45"));
          addGeo(trim, BOX, place(x, h + 0.3, z, 1.8, 0.6, 1.8), col("#a59d90"));
        } else if (i === (st.tanks ?? 0) && h > 12) {
          addGeo(trim, BOX, place(x, h + 1.4, z, 3.2, 2.8, 2.6, rnd() * 3), col(st.wall));
        } else {
          addGeo(trim, BOX, place(x, h + 0.45, z, 0.9, 0.7, 0.45, rnd() * 3), col("#dfe2e2"));
        }
      });
    }
    // AC units on the walls of hostels and homes, here and there under a window.
    if ((st.win === 3 || st.win === 2) && !tiny && h > 7) {
      for (let i = 0; i < p.length; i++) {
        const a = p[i]!;
        const c = p[(i + 1) % p.length]!;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 8) continue;
        const [nx, nz] = outward(p, i);
        const ry = Math.atan2(nx, nz);
        const count = Math.floor(len / 9);
        for (let k = 0; k < count; k++) {
          if (rnd() > 0.45) continue;
          const t = (k + 0.5 + (rnd() - 0.5) * 0.4) / count;
          const floor = 1 + Math.floor(rnd() * Math.max(1, Math.floor(h / 3.4) - 1));
          const x = a[0] + (c[0] - a[0]) * t + nx * 0.3;
          const z = a[1] + (c[1] - a[1]) * t + nz * 0.3;
          addGeo(trim, BOX, place(x, floor * 3.4 + 0.25, z, 0.85, 0.6, 0.35, ry), col("#e9ecea"));
        }
      }
    }

    // Hostels (from SRM's photos): white balconies with railings stacked up the long walls between yellow piers, white
    // fins, and washing hung out to dry on a few railings.
    if (bld.k === 2 && !tiny && h > 9) {
      const floors = Math.max(1, Math.round(h / 3.3));
      for (let i = 0; i < p.length; i++) {
        const a = p[i]!;
        const c = p[(i + 1) % p.length]!;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 14) continue;
        const [nx, nz] = outward(p, i);
        const ry = Math.atan2(nx, nz);
        const bays = Math.floor(len / 4.6);
        for (let k = 1; k < bays; k++) {
          const t = (k + 0.5) / bays;
          const bx = a[0] + (c[0] - a[0]) * t;
          const bz = a[1] + (c[1] - a[1]) * t;
          if (k % 2 === 0) {
            // A white fin between bays.
            addGeo(trim, BOX, place(bx + nx * 0.55, h / 2, bz + nz * 0.55, 0.28, h - 0.4, 1.1, ry), col("#f7f5ef"));
            continue;
          }
          for (let f = 1; f < floors; f++) {
            const y = f * 3.3;
            addGeo(trim, BOX, place(bx + nx * 0.6, y, bz + nz * 0.6, 3.4, 0.16, 1.2, ry), col("#f4f1e8"));
            addGeo(trim, BOX, place(bx + nx * 1.17, y + 0.5, bz + nz * 1.17, 3.4, 0.85, 0.07, ry), col("#f7f5ef"));
            if (rnd() < 0.3) {
              // Washing on the railing.
              const n = 1 + Math.floor(rnd() * 3);
              for (let j = 0; j < n; j++) {
                const off = (j - (n - 1) / 2) * 0.9;
                const ox = Math.cos(ry) * off;
                const oz = -Math.sin(ry) * off;
                addGeo(trim, BOX, place(bx + ox + nx * 1.22, y + 0.6, bz + oz + nz * 1.22, 0.6, 0.75, 0.05, ry), col(CLOTHES[Math.floor(rnd() * CLOTHES.length)]!));
              }
            }
          }
        }
      }
    }

    // ── Signature facades and entrances ──
    const entry = doorOf.get(bi);
    if (!entry) return;
    // The wall the door is on.
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const c = p[(i + 1) % p.length]!;
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[1] + c[1]) / 2;
      const d = Math.hypot(mx - entry.door[0], mz - entry.door[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const a = p[best]!;
    const c = p[(best + 1) % p.length]!;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const [nx, nz] = outward(p, best);
    const ry = Math.atan2(nx, nz);
    // Project the door onto that wall.
    const dx = (c[0] - a[0]) / (len || 1);
    const dz = (c[1] - a[1]) / (len || 1);
    const tDoor = Math.max(3, Math.min(len - 3, (entry.door[0] - a[0]) * dx + (entry.door[1] - a[1]) * dz));
    const at = (t: number, out: number) => [a[0] + dx * t + nx * out, a[1] + dz * t + nz * out] as XZ;
    // The entrance: a glass double door in a dark frame, and two steps up to it.
    {
      const [ex, ez] = at(tDoor, 0.06);
      addGeo(trim, BOX, M.compose(P.set(ex, 1.6, ez), Q.setFromEuler(E.set(0, ry, 0)), S.set(3.1, 3.2, 0.12)), col("#3a4048"));
      addGeo(glass, BOX, M.compose(P.set(...withY(at(tDoor, 0.14), 1.45)), Q.setFromEuler(E.set(0, ry, 0)), S.set(2.6, 2.75, 0.06)), col("#3d5d78"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(tDoor, 0.16), 1.45)), Q.setFromEuler(E.set(0, ry, 0)), S.set(0.08, 2.75, 0.06)), col("#2a2f36"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(tDoor, 0.9), 0.1)), Q.setFromEuler(E.set(0, ry, 0)), S.set(4.2, 0.2, 1.8)), col("#cfc8b8"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(tDoor, 0.55), 0.3)), Q.setFromEuler(E.set(0, ry, 0)), S.set(3.6, 0.2, 1.1)), col("#d9d3c5"));
    }

    if (bld.n === "tech-park") {
      // Yellow frame round a tall blue glass panel, with red and blue stripes either side.
      const w = Math.min(len * 0.45, 22);
      const t0 = Math.max(w / 2 + 1, Math.min(len - w / 2 - 1, tDoor));
      const [cx, cz] = at(t0, 0.25);
      addGeo(glass, BOX, place(cx, h / 2 + 1, cz, w - 1.4, h - 4, 0.12, ry), col("#2f5fae"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 - w / 2, 0.4), h / 2)), Q.setFromEuler(E.set(0, ry, 0)), S.set(1.2, h - 1, 0.6)), col("#f2c42e"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 + w / 2, 0.4), h / 2)), Q.setFromEuler(E.set(0, ry, 0)), S.set(1.2, h - 1, 0.6)), col("#f2c42e"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(t0, 0.4), h - 1.2)), Q.setFromEuler(E.set(0, ry, 0)), S.set(w + 1.2, 1.6, 0.6)), col("#f2c42e"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 - w / 2 - 1.6, 0.3), h / 2)), Q.setFromEuler(E.set(0, ry, 0)), S.set(1.4, h - 2, 0.3)), col("#c8323d"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 + w / 2 + 1.6, 0.3), h / 2)), Q.setFromEuler(E.set(0, ry, 0)), S.set(1.4, h - 2, 0.3)), col("#2b55b0"));
      signs.push({ text: "SRM Tech Park", bg: "#2f5fae", fg: "#ffffff", ...pos3(at(t0, 0.5), 5.5), ry, w: 8, h: 1.8 });
    } else if (bld.n === "tech-park-2") {
      // The orange tower: a tall bronze glass panel and an arch at the foot.
      const w = Math.min(len * 0.42, 18);
      const t0 = Math.max(w / 2 + 1, Math.min(len - w / 2 - 1, tDoor));
      addGeo(glass, BOX, M.compose(P.set(...withY(at(t0, 0.2), h / 2 + 3)), Q.setFromEuler(E.set(0, ry, 0)), S.set(w, h - 9, 0.14)), col("#8f7d48"));
      const arch = new THREE.TorusGeometry(w / 2, 0.55, 8, 24, Math.PI);
      addGeo(trim, arch, M.compose(P.set(...withY(at(t0, 0.9), 0)), Q.setFromEuler(E.set(0, ry, 0)), S.set(1, 0.55, 1)), col("#e8935a"));
      signs.push({ text: "SRM Tech Park 2", bg: "#fbf3e6", fg: "#7a3b1f", ...pos3(at(t0, 1.0), 3.6), ry, w: 7, h: 1.3 });
    } else if (bld.n === "university-building") {
      // White and cream, with tall blue-grey glass bays framed in white, and a deep entrance portico.
      const w = Math.min(len * 0.5, 22);
      const t0 = Math.max(w / 2 + 1, Math.min(len - w / 2 - 1, tDoor));
      for (const k of [-1, 0, 1]) {
        const bw = w / 3 - 0.8;
        addGeo(glass, BOX, M.compose(P.set(...withY(at(t0 + k * (w / 3), 0.22), h / 2 + 2.5)), Q.setFromEuler(E.set(0, ry, 0)), S.set(bw, h - 7, 0.14)), col("#6d8fa8"));
        for (let y = 6.4; y < h - 1; y += 3.4) addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 + k * (w / 3), 0.32), y)), Q.setFromEuler(E.set(0, ry, 0)), S.set(bw, 0.14, 0.14)), col("#f7f5ef"));
      }
      for (const k of [-1.5, -0.5, 0.5, 1.5]) addGeo(trim, BOX, M.compose(P.set(...withY(at(t0 + k * (w / 3), 0.45), h / 2 + 1)), Q.setFromEuler(E.set(0, ry, 0)), S.set(0.8, h - 2, 0.9)), col("#fbfaf6"));
      const [cx, cz] = at(t0, 3.2);
      addGeo(trim, BOX, M.compose(P.set(cx, 5.2, cz), Q.setFromEuler(E.set(0, ry, 0)), S.set(w * 0.6, 0.5, 6.4)), col("#f7f5ef"));
      for (const k of [-1, -0.33, 0.33, 1]) {
        const [px, pz] = at(t0 + k * w * 0.28, 6.0);
        addGeo(trim, CYL, place(px, 2.5, pz, 0.35, 5, 0.35), col("#fbfaf6"));
      }
      signs.push({ text: "SRM University Building", bg: "#1f3a5f", fg: "#ffffff", ...pos3(at(t0, 6.45), 5.75), ry, w: 9, h: 0.9 });
    } else if (bld.k === 5) {
      // Hospital: a drop-off porch on columns, a red cross, a big name board and an ambulance at the door.
      const [cx, cz] = at(tDoor, 3.4);
      addGeo(trim, BOX, M.compose(P.set(cx, 4.2, cz), Q.setFromEuler(E.set(0, ry, 0)), S.set(10, 0.45, 6.6)), col("#f4f5f2"));
      addGeo(trim, BOX, M.compose(P.set(cx, 4.5, cz), Q.setFromEuler(E.set(0, ry, 0)), S.set(10.2, 0.2, 6.8)), col("#2f7fb5"));
      for (const k of [-1, 1])
        for (const o of [1.2, 6.2]) {
          const [px, pz] = at(tDoor + k * 4.4, o);
          addGeo(trim, CYL, place(px, 2.1, pz, 0.22, 4.2, 0.22), col("#e9ecea"));
        }
      const [rx, rz] = at(tDoor, 0.2);
      addGeo(trim, BOX, M.compose(P.set(rx, h - 2.5, rz), Q.setFromEuler(E.set(0, ry, 0)), S.set(3, 3, 0.3)), col("#ffffff"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(tDoor, 0.4), h - 2.5)), Q.setFromEuler(E.set(0, ry, 0)), S.set(2.2, 0.7, 0.1)), col("#d8353f"));
      addGeo(trim, BOX, M.compose(P.set(...withY(at(tDoor, 0.4), h - 2.5)), Q.setFromEuler(E.set(0, ry, 0)), S.set(0.7, 2.2, 0.1)), col("#d8353f"));
      // Ambulance: white van, red stripe, blue light.
      const [ax, az] = at(tDoor + 8, 4.5);
      addGeo(trim, BOX, place(ax, 1.25, az, 2.0, 1.9, 4.6, ry), col("#f7f7f4"));
      addGeo(trim, BOX, place(ax, 1.05, az, 2.04, 0.3, 4.62, ry), col("#d8353f"));
      addGeo(trim, BOX, place(ax, 2.3, az, 0.6, 0.2, 0.3, ry), col("#2f6fd8"));
      for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) {
        const ox = Math.cos(ry) * sx * 0.9 + Math.sin(ry) * sz;
        const oz = -Math.sin(ry) * sx * 0.9 + Math.cos(ry) * sz;
        addGeo(trim, WHEEL, place(ax + ox, 0.35, az + oz, 1, 1, 1, ry), col("#22252b"));
      }
      const label = (names[entry.id] ?? "").toUpperCase();
      if (label) signs.push({ text: label, bg: "#ffffff", fg: "#1f5f99", ...pos3(at(tDoor, 0.75), Math.min(h - 6, 9)), ry, w: Math.min(16, 2 + label.length * 0.5), h: 1.6 });
    } else if (bld.k === 2) {
      // Hostel: blue name plate over a green curved awning.
      const name = entry.id.replace(/-/g, " ").toUpperCase().replace(" BLOCK", "");
      const awning = new THREE.CylinderGeometry(1.4, 1.4, Math.min(len - 2, 16), 14, 1, true, 0, Math.PI);
      awning.rotateZ(Math.PI / 2);
      addGeo(trim, awning, M.compose(P.set(...withY(at(tDoor, 1.0), 3.0)), Q.setFromEuler(E.set(0, ry - Math.PI / 2, 0)), S.set(1, 1, 0.75)), col("#3f8f6b"));
      signs.push({ text: name, bg: "#2d4f8f", fg: "#ffffff", ...pos3(at(tDoor, 0.2), 5.6), ry, w: Math.min(6, 1.2 + name.length * 0.55), h: 1.2 });
      // Bikes and scooters parked along the wall beside the door, and a notice board.
      for (let j = 0; j < 7; j++) {
        const side = j < 4 ? 1 : -1;
        const tt = tDoor + side * (5.8 + (j % 4) * 1.1);
        if (tt < 1 || tt > len - 1) continue;
        const [vx, vz] = at(tt, 1.15);
        const vry = ry + Math.PI / 2;
        if (j % 2 === 0) {
          // Scooter: body, seat, handlebar, two wheels.
          const body = col(["#d8353f", "#2f6fd8", "#f1f1ec", "#22252b"][j % 4]!);
          addGeo(trim, BOX, place(vx, 0.62, vz, 0.55, 0.5, 1.3, vry), body);
          addGeo(trim, BOX, place(vx, 0.95, vz, 0.42, 0.12, 0.7, vry), col("#22252b"));
          for (const o of [-0.62, 0.62]) addGeo(trim, WHEEL, place(vx + Math.sin(vry) * o, 0.3, vz + Math.cos(vry) * o, 0.7, 0.85, 0.85, vry), col("#22252b"));
          addGeo(trim, BOX, place(vx + Math.sin(vry) * 0.62, 1.15, vz + Math.cos(vry) * 0.62, 0.7, 0.08, 0.08, vry), col("#3a3e45"));
        } else {
          // Bicycle: two thin wheels and a frame.
          for (const o of [-0.5, 0.5]) addGeo(trim, WHEEL, place(vx + Math.sin(vry) * o, 0.35, vz + Math.cos(vry) * o, 0.3, 0.95, 0.95, vry), col("#2b2e33"));
          addGeo(trim, BOX, place(vx, 0.62, vz, 0.06, 0.06, 1.0, vry), col(["#3f8f6b", "#d8353f", "#2f6fd8"][j % 3]!));
          addGeo(trim, BOX, place(vx, 0.85, vz, 0.06, 0.4, 0.06, vry), col("#3a3e45"));
        }
      }
      const [nbx, nbz] = at(tDoor - 2.6, 0.12);
      addGeo(trim, BOX, place(nbx, 1.6, nbz, 1.2, 0.9, 0.06, ry), col("#7a5a3c"));
      addGeo(trim, BOX, place(nbx, 1.6, nbz, 1.05, 0.75, 0.08, ry), col("#efe8d4"));
    } else {
      // Others: a flat entrance canopy on two posts and a name board.
      const [cx, cz] = at(tDoor, 1.6);
      addGeo(trim, BOX, M.compose(P.set(cx, 3.2, cz), Q.setFromEuler(E.set(0, ry, 0)), S.set(4.6, 0.25, 3.2)), col("#d7d2c6"));
      for (const s of [-1, 1]) {
        const [px, pz] = at(tDoor + s * 2, 2.9);
        addGeo(trim, BOX, M.compose(P.set(px, 1.6, pz), Q.setFromEuler(E.set(0, ry, 0)), S.set(0.2, 3.2, 0.2)), col("#c9c2b4"));
      }
      const label = names[entry.id];
      if (label) signs.push({ text: label, bg: "#fbfaf5", fg: "#22303c", ...pos3(at(tDoor, 0.15), 4.4), ry, w: Math.min(9, 1.4 + label.length * 0.32), h: 0.95 });
    }
  });

  return {
    walls: toGeo(walls, true),
    trim: toGeo(trim),
    glass: glass.pos.length ? toGeo(glass) : null,
    signs,
  };
}

const withY = (xz: XZ, y: number) => [xz[0], y, xz[1]] as [number, number, number];
const pos3 = (xz: XZ, y: number) => ({ x: xz[0], y, z: xz[1] });


// ── Street furniture: lamp posts, road dashes, bus shelters, benches ──
export function buildStreets(world: World) {
  seed = 9;
  const b = newBuf();
  const pole = col("#4b555a");
  const lamp = col("#f4efd8");
  const white = col("#f2f2ec");
  const doors = Object.values(world.places).map((pl) => pl.door);
  const nearDoor = (x: number, z: number, d: number) => doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < d);
  // Keep the arch gate's forecourt clear of lamp posts and shelters.
  const nearGate = (x: number, z: number) => !!world.gate && Math.hypot(world.gate.x - x, world.gate.z - z) < 22;
  for (const r of world.roads) {
    if (r.f || r.w < 5) continue;
    let carry = 0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i]!;
      const [bx, bz] = r.p[i + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const nx = -dz;
      const nz = dx;
      const ry = Math.atan2(dx, dz);
      void ry;
      // Lamp posts every 30 m, alternating sides.
      for (let t = 30 - carry; t < len; t += 30) {
        const side = rnd() > 0.5 ? 1 : -1;
        const x = ax + dx * t + nx * side * (r.w / 2 + 1.4);
        const z = az + dz * t + nz * side * (r.w / 2 + 1.4);
        if (nearDoor(x, z, 6) || nearGate(x, z)) continue;
        addGeo(b, CYL, place(x, 3, z, 0.07, 6, 0.07), pole);
        addGeo(b, BOX, place(x - nx * side * 0.6, 6, z - nz * side * 0.6, 1.3, 0.1, 0.12, Math.atan2(nx, nz) + Math.PI / 2), pole);
        addGeo(b, BOX, place(x - nx * side * 1.2, 5.88, z - nz * side * 1.2, 0.5, 0.14, 0.26, Math.atan2(nx, nz) + Math.PI / 2), lamp);
      }
      carry = (carry + len) % 30;
    }
  }
  // Zebra crossings where roads meet (OSM junctions: points shared by three or more road ends or bends).
  const degree = new Map<string, number>();
  for (const r of world.roads) if (!r.f) for (const [x, z] of r.p) degree.set(`${x},${z}`, (degree.get(`${x},${z}`) ?? 0) + 1);
  const crossed = new Set<string>();
  for (const r of world.roads) {
    if (r.f || r.w < 6) continue;
    for (const end of [0, r.p.length - 1]) {
      const [jx, jz] = r.p[end]!;
      const key = `${jx},${jz}`;
      if ((degree.get(key) ?? 0) < 2) continue;
      const nb = r.p[end === 0 ? 1 : r.p.length - 2]!;
      const len = Math.hypot(nb[0] - jx, nb[1] - jz);
      if (len < 14 || crossed.has(`${key}|${nb[0]},${nb[1]}`)) continue;
      crossed.add(`${key}|${nb[0]},${nb[1]}`);
      const ux = (nb[0] - jx) / len;
      const uz = (nb[1] - jz) / len;
      const cx = jx + ux * (r.w / 2 + 4);
      const cz = jz + uz * (r.w / 2 + 4);
      const ry = Math.atan2(ux, uz);
      for (let k = -r.w / 2 + 0.6; k <= r.w / 2 - 0.4; k += 1.0)
        addGeo(b, BOX, place(cx + -uz * k, 0.075, cz + ux * k, 0.5, 0.02, 2.8, ry), white);
    }
  }
  // Bus shelters at real bus stops.
  for (const [x, z] of world.stops ?? []) {
    if (nearGate(x, z)) continue;
    const ry = rnd() * Math.PI;
    addGeo(b, BOX, place(x, 2.6, z, 4.2, 0.18, 2, ry), col("#2f6b5e"));
    for (const s of [-1, 1]) addGeo(b, BOX, M.compose(P.set(x + Math.cos(ry) * s * 1.9, 1.3, z - Math.sin(ry) * s * 1.9), Q.setFromEuler(E.set(0, ry, 0)), S.set(0.12, 2.6, 0.12)), pole);
    addGeo(b, BOX, place(x, 0.5, z, 3, 0.1, 0.5, ry), col("#c9a37a"));
  }
  // A bench and a bin beside every named door, set against the wall it is on so they never block the way in.
  for (const pl of Object.values(world.places)) {
    const bp = pl.b === undefined ? undefined : world.buildings[pl.b]?.p;
    if (!bp) continue;
    const [x, z] = pl.door;
    let wi = 0;
    let wd = Infinity;
    for (let i = 0; i < bp.length; i++) {
      const a = bp[i]!;
      const c = bp[(i + 1) % bp.length]!;
      const ex = c[0] - a[0];
      const ez = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1)));
      const d = Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z);
      if (d < wd) {
        wd = d;
        wi = i;
      }
    }
    const [ox, oz] = outward(bp, wi);
    const tx = -oz;
    const tz = ox;
    const ry = Math.atan2(-tz, tx);
    const bx = x + tx * 4.2 + ox * 1.1;
    const bz = z + tz * 4.2 + oz * 1.1;
    addGeo(b, BOX, place(bx, 0.45, bz, 1.8, 0.1, 0.5, ry), col("#b0784a"));
    addGeo(b, BOX, place(bx, 0.22, bz, 1.6, 0.44, 0.08, ry), pole);
    addGeo(b, CYL, place(x - tx * 3.6 + ox * 1.1, 0.45, z - tz * 3.6 + oz * 1.1, 0.26, 0.9, 0.26), col("#2f8f6b"));
  }
  return toGeo(b);
}

function col(h: string) {
  return new THREE.Color(h);
}

