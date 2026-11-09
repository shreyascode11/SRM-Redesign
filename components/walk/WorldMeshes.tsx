"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { World, XZ } from "@/lib/walk/world";
import { useFrame } from "@react-three/fiber";
import { chennaiHour } from "@/lib/walk/world";
import { buildCampus, buildStreets, type Clock, isLandmark, type Sign } from "./buildings";
import { buildLandmarks } from "./landmarks";
import { toon } from "./curve";

/**
 * The world: ground, roads, ponds, buildings (buildings.ts), street furniture, signboards, trees and coconut palms.
 * Static things are merged into a handful of meshes, so the whole campus draws in a few calls.
 */

/**
 * The world is drawn bent (curve.ts), and a flat triangle can only bend at its corners, so long triangles (a big pond,
 * a long road, the ground) are split until no edge is longer than `max` metres.
 */
function tessellate(g: THREE.BufferGeometry, max: number) {
  const src = (g.index ? g.toNonIndexed() : g).getAttribute("position");
  const out: number[] = [];
  const v = (i: number) => [src.getX(i), src.getY(i), src.getZ(i)] as const;
  const split = (a: readonly number[], b: readonly number[], c: readonly number[], depth: number) => {
    const ab = Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);
    const bc = Math.hypot(b[0]! - c[0]!, b[2]! - c[2]!);
    const ca = Math.hypot(c[0]! - a[0]!, c[2]! - a[2]!);
    const m = Math.max(ab, bc, ca);
    if (m <= max || depth > 10) {
      out.push(...a, ...b, ...c);
      return;
    }
    const mid = (p: readonly number[], q: readonly number[]) => [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2, (p[2]! + q[2]!) / 2];
    if (m === ab) {
      const d = mid(a, b);
      split(a, d, c, depth + 1);
      split(d, b, c, depth + 1);
    } else if (m === bc) {
      const d = mid(b, c);
      split(a, b, d, depth + 1);
      split(a, d, c, depth + 1);
    } else {
      const d = mid(c, a);
      split(a, b, d, depth + 1);
      split(d, b, c, depth + 1);
    }
  };
  for (let i = 0; i < src.count; i += 3) split(v(i), v(i + 1), v(i + 2), 0);
  const res = new THREE.BufferGeometry();
  res.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  res.computeVertexNormals();
  return res;
}
function ribbon(p: XZ[], w: number, y: number) {
  const pos: number[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i]!;
    const [bx, bz] = p[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / len) * (w / 2);
    const nz = ((bx - ax) / len) * (w / 2);
    pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  }
  for (const [x, z] of p) {
    const segs = 8;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      pos.push(x, y, z, x + Math.cos(a1) * (w / 2), y, z + Math.sin(a1) * (w / 2), x + Math.cos(a0) * (w / 2), y, z + Math.sin(a0) * (w / 2));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/**
 * A road or path surface, split into pieces no bigger than 4 m each way (the world bends per vertex, and a long
 * flat triangle sags between its corners, letting the verge underneath show through), with three attributes for the
 * surface shaders (curve.ts): aLat (−1…1 across), aLen (metres along) and aW (width).
 */
function lane(p: XZ[], w: number, y: number) {
  const pos: number[] = [];
  const lat: number[] = [];
  const len: number[] = [];
  const across = Math.max(1, Math.ceil(w / 4));
  let along = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i]!;
    const [bx, bz] = p[i + 1]!;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.01) continue;
    const nx = (-(bz - az) / L) * (w / 2);
    const nz = ((bx - ax) / L) * (w / 2);
    const n = Math.max(1, Math.ceil(L / 4));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const l0 = along + L * t0;
      const l1 = along + L * t1;
      for (let s = 0; s < across; s++) {
        const u0 = 1 - (2 * s) / across;
        const u1 = 1 - (2 * (s + 1)) / across;
        pos.push(
          x0 + nx * u0, y, z0 + nz * u0,
          x1 + nx * u0, y, z1 + nz * u0,
          x1 + nx * u1, y, z1 + nz * u1,
          x0 + nx * u0, y, z0 + nz * u0,
          x1 + nx * u1, y, z1 + nz * u1,
          x0 + nx * u1, y, z0 + nz * u1,
        );
        lat.push(u0, u0, u1, u0, u1, u1);
        len.push(l0, l1, l1, l0, l1, l0);
      }
    }
    along += L;
    // A round joint at the bend, in rings so it bends too (plain asphalt: no lines painted on it).
    const segs = 16;
    const rings = Math.max(1, Math.ceil(w / 2 / 4));
    for (let ring = 0; ring < rings; ring++) {
      const r0 = ((w / 2) * ring) / rings;
      const r1 = ((w / 2) * (ring + 1)) / rings;
      for (let sgm = 0; sgm < segs; sgm++) {
        const a0 = (sgm / segs) * Math.PI * 2;
        const a1 = ((sgm + 1) / segs) * Math.PI * 2;
        const q = (r: number, a: number) => [bx + Math.cos(a) * r, y - 0.002, bz + Math.sin(a) * r];
        pos.push(...q(r0, a0), ...q(r1, a1), ...q(r1, a0));
        if (ring > 0) pos.push(...q(r0, a0), ...q(r0, a1), ...q(r1, a1));
        const verts = ring > 0 ? 6 : 3;
        for (let v = 0; v < verts; v++) {
          lat.push(0.5);
          len.push(along);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 3).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute("aLat", new THREE.Float32BufferAttribute(lat, 1));
  g.setAttribute("aLen", new THREE.Float32BufferAttribute(len, 1));
  g.setAttribute("aW", new THREE.Float32BufferAttribute(new Array(lat.length).fill(w), 1));
  return g;
}

/** Raised kerb stones along both sides of a road (top and the face towards the road), painted by the kerb shader. */
function kerbs(p: XZ[], w: number) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const len: number[] = [];
  const H = 0.18;
  const T = 0.28;
  let along = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i]!;
    const [bx, bz] = p[i + 1]!;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.5) continue;
    const ux = (bx - ax) / L;
    const uz = (bz - az) / L;
    const n = Math.max(1, Math.ceil(L / 6));
    for (const side of [-1, 1]) {
      const nx = -uz * side;
      const nz = ux * side;
      const off0 = w / 2;
      const off1 = w / 2 + T;
      for (let k = 0; k < n; k++) {
        // Leave a gap near each end, where side roads come in.
        const t0 = Math.max(k / n, 3 / L);
        const t1 = Math.min((k + 1) / n, 1 - 3 / L);
        if (t1 <= t0) continue;
        const x0 = ax + (bx - ax) * t0;
        const z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1;
        const z1 = az + (bz - az) * t1;
        const l0 = along + L * t0;
        const l1 = along + L * t1;
        const q = (o: number, yy: number, t: 0 | 1) => [t ? x1 + nx * o : x0 + nx * o, yy, t ? z1 + nz * o : z0 + nz * o];
        // Top
        const top = [q(off0, H, 0), q(off0, H, 1), q(off1, H, 1), q(off0, H, 0), q(off1, H, 1), q(off1, H, 0)];
        for (const v of top) pos.push(...(v as number[]));
        for (let j = 0; j < 6; j++) nrm.push(0, 1, 0);
        len.push(l0, l1, l1, l0, l1, l0);
        // Face towards the road
        const face = [q(off0, 0, 0), q(off0, 0, 1), q(off0, H, 1), q(off0, 0, 0), q(off0, H, 1), q(off0, H, 0)];
        for (const v of face) pos.push(...(v as number[]));
        for (let j = 0; j < 6; j++) nrm.push(-nx, 0, -nz);
        len.push(l0, l1, l1, l0, l1, l0);
      }
    }
    along += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aLat", new THREE.Float32BufferAttribute(new Array(len.length).fill(0), 1));
  g.setAttribute("aLen", new THREE.Float32BufferAttribute(len, 1));
  g.setAttribute("aW", new THREE.Float32BufferAttribute(new Array(len.length).fill(0), 1));
  return g;
}

function flat(p: XZ[], y: number) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** A signboard: the text drawn on a canvas, with a thin frame. */
function signTexture(s: Sign) {
  const W = 1024;
  const H = Math.round((W * s.h) / s.w);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = s.bg;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = s.fg;
  x.lineWidth = Math.max(6, H * 0.05);
  x.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
  let size = H * 0.56;
  x.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  while (x.measureText(s.text).width > W * 0.86 && size > 10) {
    size *= 0.92;
    x.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  }
  x.fillStyle = s.fg;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(s.text, W / 2, H / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Signs({ signs }: { signs: Sign[] }) {
  const items = useMemo(() => signs.map((s) => ({ s, mat: toon({ map: signTexture(s) }) })), [signs]);
  useEffect(() => () => items.forEach(({ mat }) => (mat as THREE.MeshToonMaterial).map?.dispose()), [items]);
  return (
    <>
      {items.map(({ s, mat }, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry} material={mat}>
          <planeGeometry args={[s.w, s.h]} />
        </mesh>
      ))}
    </>
  );
}

/** The clock dial (our own design): cream face, maroon ring, bold hour bars and minute ticks, "SRM" under the centre. */
let dial: THREE.CanvasTexture | null = null;
function dialTexture() {
  if (dial) return dial;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const R = S / 2;
  // Like the real tower's dials: a white face, a black rim, black Roman numerals and minute ticks.
  x.fillStyle = "#1f2226";
  x.beginPath();
  x.arc(R, R, R, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#fbfaf4";
  x.beginPath();
  x.arc(R, R, R * 0.92, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = "#1f2226";
  x.lineWidth = 5;
  x.beginPath();
  x.arc(R, R, R * 0.86, 0, Math.PI * 2);
  x.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    x.lineWidth = i % 5 === 0 ? 9 : 4;
    x.beginPath();
    x.moveTo(R + Math.sin(a) * R * 0.8, R - Math.cos(a) * R * 0.8);
    x.lineTo(R + Math.sin(a) * R * 0.86, R - Math.cos(a) * R * 0.86);
    x.stroke();
  }
  x.fillStyle = "#1f2226";
  x.font = `700 ${S * 0.1}px Georgia, "Times New Roman", serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  const ROMAN = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  ROMAN.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2;
    x.save();
    x.translate(R + Math.sin(a) * R * 0.66, R - Math.cos(a) * R * 0.66);
    x.rotate(a);
    x.fillText(n, 0, 0);
    x.restore();
  });
  dial = new THREE.CanvasTexture(c);
  dial.colorSpace = THREE.SRGBColorSpace;
  dial.anisotropy = 4;
  return dial;
}

function ClockFaces({ clocks }: { clocks: Clock[] }) {
  const hours = useRef<(THREE.Mesh | null)[]>([]);
  const minutes = useRef<(THREE.Mesh | null)[]>([]);
  const face = useMemo(() => toon({ map: dialTexture() }), []);
  const hand = useMemo(() => toon({ color: "#1d2330" }), []);
  useFrame(() => {
    const h = chennaiHour(); // the campus's own time
    const hA = -((h % 12) / 12) * Math.PI * 2;
    const mA = -((h % 1) * Math.PI * 2);
    hours.current.forEach((m) => m && (m.rotation.z = hA));
    minutes.current.forEach((m) => m && (m.rotation.z = mA));
  });
  return (
    <>
      {clocks.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} rotation-y={c.ry}>
          <mesh material={face}>
            <circleGeometry args={[c.r, 40]} />
          </mesh>
          <group ref={(m) => void (hours.current[i] = m as unknown as THREE.Mesh)} position-z={0.03}>
            <mesh position-y={c.r * 0.26} material={hand}>
              <planeGeometry args={[c.r * 0.1, c.r * 0.6]} />
            </mesh>
          </group>
          <group ref={(m) => void (minutes.current[i] = m as unknown as THREE.Mesh)} position-z={0.05}>
            <mesh position-y={c.r * 0.38} material={hand}>
              <planeGeometry args={[c.r * 0.06, c.r * 0.86]} />
            </mesh>
          </group>
          <mesh position-z={0.07} material={hand}>
            <circleGeometry args={[c.r * 0.08, 12]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Trees of a Chennai campus ──
const hash = (x: number, y: number, z: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return v - Math.floor(v);
};
/** Shade a crown lighter on top and darker underneath (multiplied by each tree's own colour). */
function shadeByHeight(g: THREE.BufferGeometry, lo: number, hi: number) {
  const p = g.getAttribute("position");
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, (p.getY(i) - lo) / (hi - lo)));
    const v = 0.78 + 0.32 * t;
    c.set([v, v, v], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}
const clean = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k);
  return n;
};
/** Rain tree / gulmohar: a wide umbrella of lumpy blobs. */
const UMBRELLA = (() => {
  const parts = [
    [0, 0.4, 0, 2.6],
    [2.3, -0.1, 0.6, 2.0],
    [-2.2, 0, -0.4, 2.1],
    [0.6, -0.2, 2.2, 1.9],
    [-0.5, 0.1, -2.3, 2.0],
    [1.4, 0.9, -1.3, 1.6],
    [-1.3, 0.8, 1.4, 1.6],
  ].map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const pp = g.getAttribute("position");
    for (let i = 0; i < pp.count; i++) {
      const vx = pp.getX(i);
      const vy = pp.getY(i);
      const vz = pp.getZ(i);
      const k = 1 + (hash(vx + x!, vy + y!, vz + z!) - 0.5) * 0.28;
      pp.setXYZ(i, vx * k, vy * k * 0.72, vz * k);
    }
    g.translate(x!, y!, z!);
    return clean(g);
  });
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return shadeByHeight(g, -1.8, 2.4);
})();
/** Trunk with three branches reaching into the crown. */
const BRANCHED = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7);
  trunk.translate(0, 1.6, 0);
  parts.push(clean(trunk));
  for (let k = 0; k < 3; k++) {
    const br = new THREE.CylinderGeometry(0.1, 0.16, 2.4, 6);
    br.translate(0, 1.2, 0);
    br.rotateZ(0.7);
    br.rotateY((k / 3) * Math.PI * 2 + 0.4);
    br.translate(0, 2.9, 0);
    parts.push(clean(br));
  }
  return mergeGeometries(parts);
})();
/** Ashoka: tall and slim, drooping layers. */
const ASHOKA = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const c = new THREE.ConeGeometry(1.25 - k * 0.22, 2.6, 8);
    c.translate(0, 1.8 + k * 1.55, 0);
    parts.push(clean(c));
  }
  const t = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6);
  t.translate(0, 0.8, 0);
  parts.push(clean(t));
  const g = mergeGeometries(parts);
  return shadeByHeight(g, 0, 8.5);
})();
/** Coconut palm crown: ten fronds that arch out and droop, each a chain of tapering leaf segments. */
const FRONDS = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 10; f++) {
    let x = 0;
    let y = 0;
    let pitch = 0.25 + (f % 3) * 0.1;
    for (let k = 0; k < 6; k++) {
      const segL = 0.7;
      const wid = 0.9 - k * 0.12;
      const g = new THREE.BoxGeometry(wid, 0.04, segL);
      g.rotateX(pitch);
      g.translate(0, y - Math.sin(pitch) * segL * 0.5, x + Math.cos(pitch) * segL * 0.5);
      g.rotateY((f / 10) * Math.PI * 2 + (f % 2) * 0.2);
      parts.push(clean(g));
      x += Math.cos(pitch) * segL;
      y -= Math.sin(pitch) * segL;
      pitch += 0.18;
    }
  }
  const nut = new THREE.SphereGeometry(0.32, 8, 6);
  nut.translate(0, -0.25, 0);
  parts.push(clean(nut));
  const g = mergeGeometries(parts);
  return shadeByHeight(g, -2.5, 0.3);
})();
const PALM_TRUNK = (() => {
  // Slightly bulging rings up the trunk.
  const g = new THREE.CylinderGeometry(0.17, 0.25, 1, 8, 12);
  const pp = g.getAttribute("position");
  for (let i = 0; i < pp.count; i++) {
    const y = pp.getY(i);
    const ring = 1 + 0.06 * Math.abs(Math.sin((y + 0.5) * Math.PI * 12));
    pp.setX(i, pp.getX(i) * ring);
    pp.setZ(i, pp.getZ(i) * ring);
  }
  g.computeVertexNormals();
  return clean(g);
})();
/** Hedges: low clipped shrubs along building fronts. */
function hedges(world: World) {
  const parts: THREE.BufferGeometry[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1, 2, 1, 2);
  const doors = Object.values(world.places).map((p) => p.door);
  for (const b of world.buildings) {
    if (!b.n || isLandmark(b.n) || b.h < 7) continue;
    const p = b.p;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const c = p[(i + 1) % p.length]!;
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 8) continue;
      const ux = (c[0] - a[0]) / L;
      const uz = (c[1] - a[1]) / L;
      // Outward: test a point off the middle of the wall.
      let nx = uz;
      let nz = -ux;
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[1] + c[1]) / 2;
      let inside = false;
      for (let k = 0, j = p.length - 1; k < p.length; j = k++) {
        const [xi, zi] = p[k]!;
        const [xj, zj] = p[j]!;
        if (zi > mz + nz !== zj > mz + nz && mx + nx < ((xj - xi) * (mz + nz - zi)) / (zj - zi) + xi) inside = !inside;
      }
      if (inside) {
        nx = -nx;
        nz = -nz;
      }
      for (let t = 2; t < L - 2; t += 2.2) {
        const x = a[0] + ux * t + nx * 2.2;
        const z = a[1] + uz * t + nz * 2.2;
        if (doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 4)) continue;
        const g = box.clone();
        g.scale(2.1, 0.75 + hash(x, 0, z) * 0.3, 0.9);
        g.rotateY(Math.atan2(ux, uz) + Math.PI / 2);
        g.translate(x, 0.45, z);
        parts.push(clean(g));
      }
    }
  }
  return parts.length ? mergeGeometries(parts) : null;
}

export function WorldMeshes({ world, highlight, names }: { world: World; highlight: string | null; names: Record<string, string> }) {
  const statics = useMemo(() => {
    const roads = world.roads.filter((r) => !r.f);
    const paths = world.roads.filter((r) => r.f);
    const campus = buildCampus(world, names);
    const marks = buildLandmarks(world);
    const b = world.bounds;
    const ground = new THREE.PlaneGeometry(b.maxX - b.minX + 900, b.maxZ - b.minZ + 900, 120, 100);
    ground.rotateX(-Math.PI / 2);
    ground.translate((b.minX + b.maxX) / 2, -0.02, (b.minZ + b.maxZ) / 2);
    return {
      ...campus,
      signs: [...campus.signs, ...marks.signs],
      clocks: marks.clocks,
      landmarks: marks.geo,
      streets: buildStreets(world),
      ground,
      roads: roads.length ? mergeGeometries(roads.map((r) => lane(r.p, r.w, 0.05))) : null,
      edges: roads.length ? tessellate(mergeGeometries(roads.map((r) => ribbon(r.p, r.w + 2.4, 0.035))), 8) : null,
      kerbs: roads.length ? mergeGeometries(roads.filter((r) => r.w >= 5).map((r) => kerbs(r.p, r.w))) : null,
      paths: paths.length ? mergeGeometries(paths.map((r) => lane(r.p, r.w, 0.07))) : null,
      hedges: hedges(world),
      water: world.water.length ? tessellate(mergeGeometries(world.water.map((w) => flat(w.p, 0.12))), 12) : null,
      green: world.green.length ? tessellate(mergeGeometries(world.green.map((w) => flat(w.p, 0.02))), 12) : null,
    };
  }, [world, names]);
  useEffect(
    () => () => {
      for (const v of Object.values(statics)) if (v && typeof v === "object" && "dispose" in v) (v as THREE.BufferGeometry).dispose();
    },
    [statics],
  );

  // Trees: rain trees, flowering gulmohars, slim ashokas and coconut palms.
  const kinds = useMemo(() => {
    const out = { rain: [] as typeof world.trees, gul: [] as typeof world.trees, ashoka: [] as typeof world.trees, palm: [] as typeof world.trees };
    world.trees.forEach((t, i) => {
      const r = hash(t[0], 1, t[1]);
      if (r < 0.22) out.palm.push(t);
      else if (r < 0.34) out.ashoka.push(t);
      else if (r < 0.46) out.gul.push(t);
      else out.rain.push(t);
      void i;
    });
    return out;
  }, [world]);
  const rainTrunks = useRef<THREE.InstancedMesh>(null);
  const rainCrowns = useRef<THREE.InstancedMesh>(null);
  const gulTrunks = useRef<THREE.InstancedMesh>(null);
  const gulCrowns = useRef<THREE.InstancedMesh>(null);
  const ashokas = useRef<THREE.InstancedMesh>(null);
  const palmTrunks = useRef<THREE.InstancedMesh>(null);
  const palmTops = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const fill = (trunks: THREE.InstancedMesh | null, crowns: THREE.InstancedMesh | null, list: [number, number, number][], colors: string[]) => {
      if (!trunks || !crowns) return;
      list.forEach(([x, z, s], i) => {
        const k = 0.85 + s * 0.4;
        o.position.set(x, 0, z);
        o.scale.set(k, k, k);
        o.rotation.set(0, hash(x, 2, z) * 6.28, 0);
        o.updateMatrix();
        trunks.setMatrixAt(i, o.matrix);
        o.position.set(x, 5.3 * k, z);
        o.scale.set(k * (0.9 + hash(x, 3, z) * 0.3), k * (0.85 + hash(x, 4, z) * 0.3), k * (0.9 + hash(x, 5, z) * 0.3));
        o.updateMatrix();
        crowns.setMatrixAt(i, o.matrix);
        crowns.setColorAt(i, c.set(colors[Math.floor(hash(x, 6, z) * colors.length)]!));
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    };
    fill(rainTrunks.current, rainCrowns.current, kinds.rain, ["#4f8f4a", "#5d9b50", "#46834a", "#6aa457", "#3f7a45"]);
    fill(gulTrunks.current, gulCrowns.current, kinds.gul, ["#e0603a", "#e8733f", "#d9502f", "#6f9e4c"]);
    const a = ashokas.current;
    if (a) {
      kinds.ashoka.forEach(([x, z, s], i) => {
        const k = 0.9 + s * 0.35;
        o.position.set(x, 0, z);
        o.scale.set(k, k * 1.15, k);
        o.rotation.set(0, hash(x, 7, z) * 6.28, 0);
        o.updateMatrix();
        a.setMatrixAt(i, o.matrix);
        a.setColorAt(i, c.set(hash(x, 8, z) > 0.5 ? "#2f6b3d" : "#3a7a44"));
      });
      a.instanceMatrix.needsUpdate = true;
      if (a.instanceColor) a.instanceColor.needsUpdate = true;
    }
    const pt = palmTrunks.current;
    const pp = palmTops.current;
    if (pt && pp) {
      kinds.palm.forEach(([x, z, s], i) => {
        const tall = 7 + s * 3.5;
        const lean = 0.05 + hash(x, 9, z) * 0.12;
        const dir = hash(x, 10, z) * 6.28;
        o.position.set(x + Math.sin(dir) * lean * tall * 0.5, tall / 2, z + Math.cos(dir) * lean * tall * 0.5);
        o.scale.set(1, tall, 1);
        o.rotation.set(Math.cos(dir) * lean, 0, -Math.sin(dir) * lean);
        o.updateMatrix();
        pt.setMatrixAt(i, o.matrix);
        o.position.set(x + Math.sin(dir) * lean * tall, tall, z + Math.cos(dir) * lean * tall);
        o.scale.set(1.1, 1.1, 1.1);
        o.rotation.set(0, dir, 0);
        o.updateMatrix();
        pp.setMatrixAt(i, o.matrix);
        pp.setColorAt(i, c.set(hash(x, 11, z) > 0.5 ? "#5c9a4a" : "#6aa652"));
      });
      pt.instanceMatrix.needsUpdate = true;
      pp.instanceMatrix.needsUpdate = true;
      if (pp.instanceColor) pp.instanceColor.needsUpdate = true;
    }
  }, [kinds]);

  const hi = highlight !== null ? world.buildings.findIndex((b) => b.n === highlight) : -1;
  const hiGeo = useMemo(() => {
    if (hi < 0) return null;
    const b = world.buildings[hi]!;
    const shape = new THREE.Shape(b.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, b.h + 1.1, 0);
    return g;
  }, [hi, world]);

  return (
    <group>
      <mesh geometry={statics.ground} material={toon({ color: "#7fb267", grass: true })} receiveShadow />
      {statics.green ? <mesh geometry={statics.green} material={toon({ color: "#6ea85a", grass: true })} receiveShadow /> : null}
      {statics.water ? <mesh geometry={statics.water} material={toon({ color: "#5fb6c2" })} /> : null}
      {statics.edges ? <mesh geometry={statics.edges} material={toon({ color: "#c2bfb4" })} receiveShadow /> : null}
      {statics.roads ? <mesh geometry={statics.roads} material={toon({ color: "#6f7779", surface: 1 })} receiveShadow /> : null}
      {statics.kerbs ? <mesh geometry={statics.kerbs} material={toon({ color: "#ffffff", surface: 2 })} receiveShadow /> : null}
      {statics.paths ? <mesh geometry={statics.paths} material={toon({ color: "#c9a98a", surface: 3 })} receiveShadow /> : null}
      {statics.hedges ? <mesh geometry={statics.hedges} material={toon({ color: "#4e8a45" })} castShadow receiveShadow /> : null}
      <ClockFaces clocks={statics.clocks} />
      <mesh geometry={statics.walls} material={toon({ vertexColors: true, windows: true })} castShadow receiveShadow />
      <mesh geometry={statics.trim} material={toon({ vertexColors: true })} castShadow receiveShadow />
      {statics.landmarks ? <mesh geometry={statics.landmarks} material={toon({ vertexColors: true })} castShadow receiveShadow /> : null}
      {statics.glass ? <mesh geometry={statics.glass} material={toon({ vertexColors: true })} receiveShadow /> : null}
      <mesh geometry={statics.streets} material={toon({ vertexColors: true })} castShadow receiveShadow />
      <Signs signs={statics.signs} />
      {hiGeo ? <mesh geometry={hiGeo} material={toon({ color: "#ffd166", transparent: true, opacity: 0.45 })} userData={{ noInk: true }} /> : null}
      <instancedMesh ref={rainTrunks} args={[BRANCHED, undefined, kinds.rain.length]} material={toon({ color: "#7a5b45" })} castShadow />
      <instancedMesh ref={rainCrowns} args={[UMBRELLA, undefined, kinds.rain.length]} material={toon({ color: "#ffffff", vertexColors: true, sway: true })} castShadow receiveShadow />
      <instancedMesh ref={gulTrunks} args={[BRANCHED, undefined, kinds.gul.length]} material={toon({ color: "#6e5240" })} castShadow />
      <instancedMesh ref={gulCrowns} args={[UMBRELLA, undefined, kinds.gul.length]} material={toon({ color: "#ffffff", vertexColors: true, sway: true })} castShadow receiveShadow />
      <instancedMesh ref={ashokas} args={[ASHOKA, undefined, kinds.ashoka.length]} material={toon({ color: "#ffffff", vertexColors: true, sway: true })} castShadow receiveShadow />
      <instancedMesh ref={palmTrunks} args={[PALM_TRUNK, undefined, kinds.palm.length]} material={toon({ color: "#8d7457" })} castShadow />
      <instancedMesh ref={palmTops} args={[FRONDS, undefined, kinds.palm.length]} material={toon({ color: "#ffffff", vertexColors: true, sway: true })} castShadow />
    </group>
  );
}
