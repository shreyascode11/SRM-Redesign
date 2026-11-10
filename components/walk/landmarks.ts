import * as THREE from "three";
import type { World } from "@/lib/walk/world";
import { addGeo, type Buf, type Clock, newBuf, type Sign, toGeo } from "./buildings";

/**
 * Two SRM landmarks, modelled on footage of the real things (the site's intro video of the main gate, and a video of
 * the clock tower), simplified into the walk's toon style:
 *  - the arch gate across the entrance avenue: pink, two white-trimmed arches (one over each one-way road), white
 *    columns, "SRM UNIVERSITY" on the frieze, a balustrade, gabled outer piers with lattice panels and balconies,
 *    blue iron gates standing open, potted plants, and a statue on a round pedestal in front
 *  - the clock tower on the roundabout: a balustraded island with stepped stone planters and flowers, a pale yellow
 *    tower with an open pillared stage, a white cornice with urns, a clock on every side and a ribbed dome
 */

const M = new THREE.Matrix4();
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const E = new THREE.Euler();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const BALL = new THREE.SphereGeometry(1, 12, 8);
const col = (h: string) => new THREE.Color(h);

/** Place `geo` in a local frame (origin ox, oz, turned by ry), at local (x, y, z), scaled, turned ly about local up. */
const frame = (ox: number, oz: number, ry: number) => {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (x: number, z: number): [number, number] => [ox + c * x + s * z, oz - s * x + c * z];
  const put = (b: Buf, geo: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color, ly = 0) => {
    const [wx, wz] = at(x, z);
    addGeo(b, geo, M.compose(P.set(wx, y, wz), Q.setFromEuler(E.set(0, ry + ly, 0)), S.set(sx, sy, sz)), color);
  };
  /** A shape drawn in the local x-y plane, extruded `depth` along local z, centred on z. */
  const extrude = (b: Buf, shape: THREE.Shape, z: number, depth: number, color: THREE.Color) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, z - depth / 2);
    const [wx, wz] = at(0, 0);
    addGeo(b, g, M.compose(P.set(wx, 0, wz), Q.setFromEuler(E.set(0, ry, 0)), S.set(1, 1, 1)), color);
    g.dispose();
  };
  return { at, put, extrude };
};

/** A rectangle with a round top (an arched opening or panel), standing on y0. */
const archShape = (cx: number, y0: number, w: number, spring: number) => {
  const s = new THREE.Shape();
  s.moveTo(cx - w / 2, y0);
  s.lineTo(cx + w / 2, y0);
  s.lineTo(cx + w / 2, spring);
  s.absarc(cx, spring, w / 2, 0, Math.PI, false);
  s.lineTo(cx - w / 2, y0);
  return s;
};
/** A half ring (the archivolt round an arch). */
const archRing = (cx: number, cy: number, ri: number, ro: number) => {
  const s = new THREE.Shape();
  s.moveTo(cx + ro, cy);
  s.absarc(cx, cy, ro, 0, Math.PI, false);
  s.lineTo(cx - ri, cy);
  s.absarc(cx, cy, ri, Math.PI, 0, true);
  s.lineTo(cx + ro, cy);
  return s;
};

function archGate(b: Buf, signs: Sign[], g: NonNullable<World["gate"]>) {
  const { put, extrude, at } = frame(g.x, g.z, g.ry);
  const pink = col("#efb4c0");
  const pinkDark = col("#e3a2b0");
  const white = col("#fbf7f1");
  const stone = col("#d9d2cb");
  const gold = col("#c9a64a");
  const span = g.span;
  const A = 5.4; // arch opening
  const pier = 4.6; // outer pier width
  const W = span + A + 2 * pier;
  const D = 3.0; // depth of the gate
  const D2 = 3.8; // the outer piers stand a little proud
  const spring = 5.6; // where the arches start to curve
  const Hb = 9.8; // top of the arcade
  const xs = [-span / 2, span / 2]; // arch centres, one over each road
  const outer = [-(W / 2 - pier / 2), W / 2 - pier / 2]; // outer pier centres

  // The arcade: one pink wall with two arches cut out of it.
  {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    for (const cx of xs) {
      s.lineTo(cx - A / 2, 0);
      s.lineTo(cx - A / 2, spring);
      s.absarc(cx, spring, A / 2, Math.PI, 0, true);
      s.lineTo(cx + A / 2, 0);
    }
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, Hb);
    s.lineTo(-W / 2, Hb);
    s.lineTo(-W / 2, 0);
    extrude(b, s, 0, D, pink);
  }
  for (const cx of xs) {
    // White archivolt, keystone, and white columns either side, front and back.
    extrude(b, archRing(cx, spring, A / 2, A / 2 + 0.38), 0, D + 0.16, white);
    put(b, BOX, cx, spring + A / 2 + 0.25, 0, 0.55, 0.75, D + 0.3, gold);
    for (const side of [-1, 1])
      for (const f of [-1, 1]) {
        const x = cx + side * (A / 2 + 0.42);
        const z = f * (D / 2 + 0.3);
        put(b, BOX, x, 0.25, z, 0.85, 0.5, 0.85, stone);
        put(b, CYL, x, spring / 2 + 0.2, z, 0.3, spring - 0.6, 0.3, white);
        put(b, BOX, x, spring - 0.2, z, 0.85, 0.35, 0.85, white);
      }
    // The blue iron gates, standing open against the inside of the arch.
    for (const side of [-1, 1]) {
      const x = cx + side * (A / 2 - 0.15);
      put(b, BOX, x, 1.5, D / 2 + 1.35, 0.08, 2.9, 2.6, col("#2d4f8f"));
      put(b, BOX, x, 2.95, D / 2 + 1.35, 0.14, 0.14, 2.7, col("#21396b"));
      for (let k = 0; k < 6; k++) put(b, BOX, x + side * 0.05, 1.5, D / 2 + 0.25 + k * 0.44, 0.06, 2.8, 0.06, col("#21396b"));
    }
  }
  // The round emblem over the middle pier, both faces.
  for (const f of [-1, 1]) {
    const disc = new THREE.CylinderGeometry(1, 1, 1, 28);
    disc.rotateX(Math.PI / 2);
    put(b, disc, 0, 7.6, f * (D / 2 + 0.06), 1.05, 1.05, 0.1, col("#2b3a8c"));
    put(b, disc, 0, 7.6, f * (D / 2 + 0.12), 0.9, 0.9, 0.06, white);
    put(b, disc, 0, 7.6, f * (D / 2 + 0.16), 0.5, 0.5, 0.04, col("#3f8f6b"));
    disc.dispose();
  }

  // Entablature, the frieze with the name, the cornice and the balustrade.
  put(b, BOX, 0, Hb + 0.25, 0, W + 0.3, 0.5, D + 0.5, white);
  put(b, BOX, 0, Hb + 1.25, 0, W - 2 * pier + 0.4, 1.5, D, pinkDark);
  put(b, BOX, 0, Hb + 2.15, 0, W + 0.5, 0.35, D + 0.7, white);
  const inner = W / 2 - pier;
  for (let x = -inner + 0.3; x <= inner - 0.3; x += 0.45)
    for (const f of [-1, 1]) put(b, BOX, x, Hb + 2.75, f * (D / 2 + 0.1), 0.16, 0.8, 0.16, white);
  for (const f of [-1, 1]) {
    put(b, BOX, 0, Hb + 3.2, f * (D / 2 + 0.1), inner * 2, 0.16, 0.32, white);
    // Little white panels along the frieze, either side of the name.
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) put(b, BOX, side * (5.6 + k * 0.9), Hb + 1.25, f * (D / 2 + 0.03), 0.6, 0.55, 0.06, white);
    signs.push({ text: "SRM UNIVERSITY", bg: "#fbf7f1", fg: "#2b3a8c", ...xyz(at(0, f * (D / 2 + 0.09)), Hb + 1.25), ry: g.ry + (f < 0 ? Math.PI : 0), w: 8.6, h: 1.15 });
  }

  // The outer piers: taller, gabled, with a lattice panel, a little balcony and an arched door on each face.
  for (const ox of outer) {
    const top = 12.6;
    put(b, BOX, ox, top / 2, 0, pier, top, D2, pink);
    put(b, BOX, ox, 0.2, 0, pier + 0.4, 0.4, D2 + 0.4, stone);
    put(b, BOX, ox, top + 0.15, 0, pier + 0.5, 0.3, D2 + 0.5, white);
    for (const [hw, hh, d, c] of [
      [pier / 2 + 0.35, 1.9, D2 + 0.1, white],
      [pier / 2 + 0.05, 1.55, D2 + 0.35, pink],
    ] as const) {
      const s = new THREE.Shape();
      s.moveTo(ox - hw, top + 0.3);
      s.lineTo(ox + hw, top + 0.3);
      s.lineTo(ox, top + 0.3 + hh);
      s.lineTo(ox - hw, top + 0.3);
      extrude(b, s, 0, d, c);
    }
    put(b, BALL, ox, top + 2.35, 0, 0.22, 0.22, 0.22, white);
    for (const f of [-1, 1]) {
      const z = f * (D2 / 2);
      // White pilasters at the pier's edges.
      for (const side of [-1, 1]) put(b, BOX, ox + side * (pier / 2 - 0.25), top / 2, z + f * 0.05, 0.5, top, 0.12, white);
      // Lattice panel: a white frame, dark wood, a grid of light bars.
      extrude(b, archShape(ox, 4.0, 2.4, 8.2), z + f * 0.04, 0.08, white);
      extrude(b, archShape(ox, 4.15, 2.1, 8.2), z + f * 0.08, 0.08, col("#7a5a3c"));
      for (let x = -0.8; x <= 0.81; x += 0.4) put(b, BOX, ox + x, 6.15, z + f * 0.13, 0.06, 4.0, 0.04, col("#b89a70"));
      for (let y = 4.4; y < 8.2; y += 0.4) put(b, BOX, ox, y, z + f * 0.13, 2.0, 0.06, 0.04, col("#b89a70"));
      // Balcony.
      put(b, BOX, ox, 3.75, z + f * 0.35, 2.9, 0.16, 0.7, white);
      for (let x = -1.3; x <= 1.31; x += 0.26) put(b, BOX, ox + x, 4.1, z + f * 0.65, 0.09, 0.55, 0.09, white);
      put(b, BOX, ox, 4.42, z + f * 0.65, 2.9, 0.1, 0.12, white);
      // Arched door at the foot.
      extrude(b, archShape(ox, 0.4, 1.8, 2.2), z + f * 0.03, 0.06, white);
      extrude(b, archShape(ox, 0.4, 1.4, 2.2), z + f * 0.06, 0.06, col("#3b3f4a"));
      // Potted plants either side.
      for (const side of [-1, 1]) pot(b, put, ox + side * 1.6, z + f * 0.9);
    }
  }
  // Plants in front of the middle pier too, and a paved forecourt.
  for (const f of [-1, 1]) for (const side of [-1, 1]) pot(b, put, side * ((span - A) / 2 - 0.4), f * (D / 2 + 0.9));
  {
    const pave = new THREE.PlaneGeometry(W + 1, 11, 10, 4);
    pave.rotateX(-Math.PI / 2);
    put(b, pave, 0, 0.1, -D / 2 - 5.3, 1, 1, 1, col("#c9c3bb"));
    pave.dispose();
  }

  // The statue on its round pedestal, out in front between the two roads.
  {
    const z = -7;
    const bronze = col("#8a6a3a");
    put(b, CYL, 0, 0.18, z, 1.3, 0.36, 1.3, stone);
    put(b, CYL, 0, 0.95, z, 0.95, 1.2, 0.95, white);
    put(b, CYL, 0, 1.62, z, 1.08, 0.16, 1.08, white);
    put(b, new THREE.CylinderGeometry(0.28, 0.42, 1, 12), 0, 2.45, z, 1, 1.5, 1, bronze);
    put(b, new THREE.CylinderGeometry(0.24, 0.3, 1, 12), 0, 3.45, z, 1, 0.6, 1, bronze);
    put(b, BOX, 0.12, 3.3, z - 0.05, 0.62, 0.9, 0.3, bronze, 0.3);
    put(b, BALL, 0, 3.98, z, 0.17, 0.2, 0.17, bronze);
    put(b, BOX, -0.33, 3.1, z - 0.12, 0.13, 0.75, 0.13, bronze);
  }
}

function pot(b: Buf, put: ReturnType<typeof frame>["put"], x: number, z: number) {
  put(b, new THREE.CylinderGeometry(0.32, 0.24, 1, 10), x, 0.25, z, 1, 0.5, 1, col("#b5452e"));
  put(b, BALL, x, 0.72, z, 0.38, 0.32, 0.38, col("#3f8a3f"));
  put(b, BALL, x + 0.12, 0.92, z - 0.1, 0.12, 0.12, 0.12, col("#d8353f"));
}

function clockTower(b: Buf, clocks: Clock[], cx: number, cz: number, ri: number) {
  const { put } = frame(cx, cz, 0);
  const yellow = col("#efe5b0");
  const white = col("#fbf8ee");
  const grey = col("#a39e95");
  const ring = (r0: number, r1: number, y0: number, y1: number, c: THREE.Color) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, r0, 0, Math.PI * 2, true);
    s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(cx, y0, cz);
    addGeo(b, g, M.identity(), c);
    g.dispose();
  };
  // The island: a plinth, a balustrade wall with its white panels, a coping, and a lawn inside.
  ring(ri - 0.45, ri + 0.15, 0, 0.25, col("#b4ada4"));
  ring(ri - 0.35, ri, 0.25, 1.05, col("#d3ccc5"));
  ring(ri - 0.42, ri + 0.06, 1.05, 1.18, col("#e6e0d9"));
  const n = Math.floor((2 * Math.PI * ri) / 0.75);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    put(b, BOX, Math.cos(a) * (ri + 0.01), 0.66, Math.sin(a) * (ri + 0.01), 0.2, 0.42, 0.04, white, Math.atan2(Math.cos(a), Math.sin(a)));
  }
  put(b, new THREE.CylinderGeometry(1, 1, 1, 40), 0, 0.45, 0, ri - 0.35, 0.9, ri - 0.35, col("#6fae57"));
  // Stepped stone planters, flowers round them.
  const r1 = Math.min(3.4, ri - 1.1);
  put(b, OCT, 0, 1.35, 0, r1, 0.9, r1, grey);
  put(b, OCT, 0, 2.1, 0, r1 - 0.7, 0.6, r1 - 0.7, col("#b0aba2"));
  const flowers = 18;
  for (let i = 0; i < flowers; i++) {
    const a = (i / flowers) * Math.PI * 2 + 0.1;
    const r = (r1 + ri - 0.35) / 2;
    put(b, BALL, Math.cos(a) * r, 1.05, Math.sin(a) * r, 0.42, 0.35, 0.42, col("#3f8a3f"));
    put(b, BALL, Math.cos(a) * r + 0.12, 1.32, Math.sin(a) * r, 0.15, 0.15, 0.15, col(i % 3 ? "#d8353f" : "#f08a3a"));
  }
  // The tower.
  const B = 3.0;
  put(b, BOX, 0, 2.55, 0, B + 0.25, 0.3, B + 0.25, white);
  put(b, BOX, 0, 3.55, 0, B, 2.1, B, yellow);
  put(b, BOX, 0, 4.6, 0, B + 0.3, 0.25, B + 0.3, white);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    put(b, BOX, Math.sin(a) * (B / 2 + 0.02), 3.5, Math.cos(a) * (B / 2 + 0.02), 0.9, 0.45, 0.06, white, a);
  }
  // The open pillared stage.
  const pc = B / 2 - 0.45;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      put(b, BOX, sx * pc, 6.95, sz * pc, 0.9, 4.5, 0.9, yellow);
      put(b, BOX, sx * (pc + 0.36), 6.95, sz * (pc + 0.36), 0.3, 4.5, 0.3, white);
    }
  put(b, BOX, 0, 9.3, 0, B + 0.4, 0.25, B + 0.4, white);
  put(b, BOX, 0, 9.6, 0, B + 1.0, 0.35, B + 1.0, white);
  // Balustrade and urns on the cornice.
  const e = (B + 0.9) / 2;
  for (let t = -e + 0.2; t <= e - 0.2; t += 0.3)
    for (const [x, z] of [
      [t, e],
      [t, -e],
      [e, t],
      [-e, t],
    ] as const)
      put(b, BOX, x, 10.0, z, 0.1, 0.45, 0.1, white);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      put(b, CYL, sx * e, 10.05, sz * e, 0.13, 0.5, 0.13, white);
      put(b, BALL, sx * e, 10.45, sz * e, 0.19, 0.22, 0.19, white);
    }
  // The clock stage, a clock on every side.
  const C = 2.3;
  put(b, BOX, 0, 11.3, 0, C, 3.0, C, yellow);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, BOX, sx * (C / 2), 11.3, sz * (C / 2), 0.3, 3.0, 0.3, white);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const nx = Math.sin(a);
    const nz = Math.cos(a);
    put(b, BOX, nx * (C / 2 + 0.01), 11.3, nz * (C / 2 + 0.01), 1.85, 1.85, 0.04, col("#3a3a36"), a);
    put(b, BOX, nx * (C / 2 + 0.03), 11.3, nz * (C / 2 + 0.03), 1.72, 1.72, 0.04, col("#f3ecd0"), a);
    clocks.push({ x: cx + nx * (C / 2 + 0.07), y: 11.3, z: cz + nz * (C / 2 + 0.07), ry: a, r: 0.74 });
  }
  put(b, BOX, 0, 12.97, 0, C + 0.6, 0.35, C + 0.6, white);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      put(b, CYL, sx * (C / 2 + 0.2), 13.3, sz * (C / 2 + 0.2), 0.1, 0.3, 0.1, white);
      put(b, BALL, sx * (C / 2 + 0.2), 13.55, sz * (C / 2 + 0.2), 0.14, 0.17, 0.14, white);
    }
  // A ribbed dome (its 16 facets read as ribs) and a lantern on top.
  put(b, OCT, 0, 13.32, 0, 1.0, 0.35, 1.0, yellow);
  put(b, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 13.5, 0, 1.1, 1.25, 1.1, col("#f2e9bd"));
  put(b, CYL, 0, 14.95, 0, 0.24, 0.4, 0.24, white);
  put(b, BALL, 0, 15.25, 0, 0.27, 0.27, 0.27, col("#f2e9bd"));
  put(b, new THREE.ConeGeometry(1, 1, 8), 0, 15.7, 0, 0.08, 0.5, 0.08, white);
}

/**
 * TP Ganesan Auditorium, from what SRM publishes about it (its estate office lists a main hall of about 206 × 121.5 ft
 * seating some 3,000, and two mini halls of 250 seats "under the ramp portion"); the look itself is our own. A tall
 * main hall with fins and a vaulted roof; in front, two ramps rise from the sides to a landing with a columned porch and
 * the name board; Mini Hall I and II sit under the ramps, and the ground-floor entrance is between them.
 */
function auditorium(b: Buf, signs: Sign[], poly: [number, number][]) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const W = Math.hypot(poly[1]![0] - poly[0]![0], poly[1]![1] - poly[0]![1]);
  const D = Math.hypot(poly[3]![0] - poly[0]![0], poly[3]![1] - poly[0]![1]);
  // Local frame: +z runs from the front (the road side) to the back.
  const dx = (poly[3]![0] - poly[0]![0]) / D;
  const dz = (poly[3]![1] - poly[0]![1]) / D;
  const ry = Math.atan2(dx, dz);
  const { put, at } = frame(cx, cz, ry);
  const tilt = (x: number, y: number, z: number, sx: number, sy: number, sz: number, roll: number, color: THREE.Color) => {
    const [wx, wz] = at(x, z);
    addGeo(b, BOX, M.compose(P.set(wx, y, wz), Q.setFromEuler(E.set(0, ry, roll, "YXZ")), S.set(sx, sy, sz)), color);
  };
  const cream = col("#ead9bd");
  const fin = col("#f7f1e6");
  const terracotta = col("#c4643d");
  const stone = col("#cfc6b8");
  const glass = col("#3d5d78");
  const dark = col("#2c2f36");
  const roofC = col("#9fb0ba");
  const H = 17; // the main hall
  const front = -D / 2; // the front wall's z
  const zone = 7; // the ramps and mini halls take the front 7 m
  const hallZ0 = front + zone;
  const hallD = D / 2 - hallZ0;
  const hallMid = (hallZ0 + D / 2) / 2;

  // Main hall: walls, a terracotta band at the top, white fins all round, a vaulted metal roof.
  put(b, BOX, 0, H / 2, hallMid, W, H, hallD, cream);
  put(b, BOX, 0, H - 0.8, hallMid, W + 0.3, 1.6, hallD + 0.3, terracotta);
  for (let x = -W / 2 + 1.5; x <= W / 2 - 1.4; x += 2.6) {
    put(b, BOX, x, H / 2 - 0.8, hallZ0 - 0.25, 0.5, H - 1.6, 0.6, fin);
    put(b, BOX, x, H / 2 - 0.8, D / 2 + 0.25, 0.5, H - 1.6, 0.6, fin);
  }
  for (let z = hallZ0 + 1.5; z <= D / 2 - 1.4; z += 2.6)
    for (const sx of [-1, 1]) put(b, BOX, sx * (W / 2 + 0.25), H / 2 - 0.8, z, 0.6, H - 1.6, 0.5, fin);
  {
    const vault = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false, 0, Math.PI);
    vault.rotateZ(Math.PI / 2);
    vault.rotateX(-Math.PI / 2);
    put(b, vault, 0, H, hallMid, W + 0.6, 3.2, hallD / 2 + 0.3, roofC);
    vault.dispose();
  }
  // The upper entrance: tall glass on the hall front, behind the landing.
  put(b, BOX, 0, 9.4, hallZ0 - 0.06, 10.5, 7.6, 0.12, glass);
  for (const x of [-3.5, 0, 3.5]) put(b, BOX, x, 9.4, hallZ0 - 0.14, 0.18, 7.6, 0.08, dark);

  // The landing, its porch and the name board.
  const landY = 5.6;
  const landW = 12;
  put(b, BOX, 0, landY - 0.3, front + zone / 2, landW, 0.6, zone - 0.4, stone);
  for (const x of [-landW / 2 + 0.6, -2, 2, landW / 2 - 0.6]) {
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    put(b, cyl, x, landY + 3.2, front + 0.8, 0.38, 6.4, 0.38, fin);
    cyl.dispose();
  }
  put(b, BOX, 0, landY + 6.6, front + zone / 2 - 0.2, landW + 1.4, 0.6, zone + 0.4, fin);
  put(b, BOX, 0, landY + 6.6, front + 0.25, landW + 1.4, 1.3, 0.3, col("#7a1f2b"));
  signs.push({ text: "Dr. T. P. Ganesan Auditorium", bg: "#7a1f2b", fg: "#fbf3e6", ...xyz(at(0, front + 0.05), landY + 6.6), ry: ry + Math.PI, w: 11, h: 1.15 });
  // Railings along the landing's front.
  for (let x = -landW / 2 + 0.4; x <= landW / 2 - 0.3; x += 0.55) put(b, BOX, x, landY + 0.5, front + 0.35, 0.07, 1, 0.07, fin);
  put(b, BOX, 0, landY + 1, front + 0.35, landW, 0.1, 0.12, fin);

  // Two ramps, rising from the sides to the landing, each with a mini hall under it.
  const rampLen = W / 2 - landW / 2;
  const roll = Math.atan2(landY - 0.3, rampLen);
  const slope = Math.hypot(rampLen, landY - 0.3);
  ["I", "II"].forEach((name, i) => {
    const sx = i === 0 ? -1 : 1;
    const mid = sx * (landW / 2 + rampLen / 2);
    tilt(mid, (landY + 0.3) / 2, front + zone / 2, slope, 0.45, zone - 1.4, sx * roll, stone);
    // Railing along the ramp's outer edge.
    tilt(mid, (landY + 0.3) / 2 + 1, front + 0.45, slope, 0.1, 0.12, sx * roll, fin);
    for (let k = 0.05; k < 1; k += 0.08) {
      const x = sx * (W / 2 - k * rampLen);
      const y = 0.3 + k * (landY - 0.3);
      put(b, BOX, x, y + 0.5, front + 0.45, 0.07, 1, 0.07, fin);
    }
    // The mini hall under the ramp: walls, doors, a name plate.
    const hallX = sx * (landW / 2 + rampLen / 2 + 0.6);
    const hallW = rampLen - 2.6;
    put(b, BOX, hallX, 1.6, front + zone / 2 + 0.6, hallW, 3.2, zone - 2.4, cream);
    put(b, BOX, hallX, 1.3, front + 1.78, 2.6, 2.4, 0.1, glass);
    put(b, BOX, hallX, 1.3, front + 1.72, 0.12, 2.4, 0.08, dark);
    signs.push({ text: `Mini Hall ${name}`, bg: "#fbf3e6", fg: "#7a1f2b", ...xyz(at(hallX, front + 1.68), 3.0), ry: ry + Math.PI, w: 3.4, h: 0.6 });
  });
  // The ground-floor entrance under the landing, and lamps on either side.
  put(b, BOX, 0, 1.5, front + zone - 0.2, 5, 3, 0.12, glass);
  put(b, BOX, 0, 1.5, front + zone - 0.26, 0.14, 3, 0.08, dark);
  for (const x of [-landW / 2 - 0.4, landW / 2 + 0.4]) {
    const pole = new THREE.CylinderGeometry(1, 1, 1, 8);
    put(b, pole, x, 2.2, front - 1.2, 0.08, 4.4, 0.08, dark);
    pole.dispose();
    put(b, BALL, x, 4.5, front - 1.2, 0.32, 0.32, 0.32, col("#fff3c4"));
  }
  // Event banners on the hall front, either side of the porch.
  for (const [x, c] of [
    [-landW / 2 - 3.2, "#f2b632"],
    [landW / 2 + 3.2, "#2e8b57"],
  ] as const) put(b, BOX, x, 11, hallZ0 - 0.5, 1.6, 6, 0.08, col(c));
}

const xyz = (xz: [number, number], y: number) => ({ x: xz[0], y, z: xz[1] });

/** Everything for the landmarks: one merged mesh, signs and clock faces. */
export function buildLandmarks(world: World) {
  const b = newBuf();
  const signs: Sign[] = [];
  const clocks: Clock[] = [];
  if (world.gate) archGate(b, signs, world.gate);
  const ct = world.places["clock-tower"];
  if (ct?.island) clockTower(b, clocks, ct.x, ct.z, ct.island);
  const aud = world.buildings.find((x) => x.n === "auditorium");
  if (aud && aud.p.length === 4) auditorium(b, signs, aud.p as [number, number][]);
  return { geo: b.pos.length ? toGeo(b) : null, signs, clocks };
}
