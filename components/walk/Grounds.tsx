"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { World, XZ } from "@/lib/walk/world";
import { addGeo, newBuf, toGeo } from "./buildings";
import { toon } from "./curve";

/**
 * What OpenStreetMap maps on the campus grounds besides buildings and roads: the tennis and basketball courts and
 * the play areas north of the gate avenue, the car park by Tech Park, and the foot overbridge (with its two flights
 * of steps) across the tracks at Potheri station. Sizes follow the mapped outlines; markings follow each sport.
 */

/** A box around a mapped area: centre, half length and half width, and the turn of its long side. */
export function obb(p: XZ[]) {
  let best = 0;
  let dx = 1;
  let dz = 0;
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > best) {
      best = d;
      dx = (b[0] - a[0]) / d;
      dz = (b[1] - a[1]) / d;
    }
  });
  const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
  const cz = p.reduce((s, q) => s + q[1], 0) / p.length;
  let l0 = Infinity;
  let l1 = -Infinity;
  let s0 = Infinity;
  let s1 = -Infinity;
  for (const q of p) {
    const l = (q[0] - cx) * dx + (q[1] - cz) * dz;
    const s = (q[0] - cx) * -dz + (q[1] - cz) * dx;
    l0 = Math.min(l0, l);
    l1 = Math.max(l1, l);
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
  }
  const ml = (l0 + l1) / 2;
  const ms = (s0 + s1) / 2;
  return { x: cx + dx * ml - dz * ms, z: cz + dz * ml + dx * ms, L: (l1 - l0) / 2, W: (s1 - s0) / 2, yaw: Math.atan2(-dz, dx) };
}

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const lines = (x: CanvasRenderingContext2D) => {
  x.strokeStyle = "#ffffff";
  x.lineWidth = 5;
  x.lineCap = "square";
};

// 512 × 256, the long side across.
const TEX = {
  tennis: () =>
    tex(512, 256, (x) => {
      x.fillStyle = "#4b8f58";
      x.fillRect(0, 0, 512, 256);
      // The doubles court takes about two thirds of the fenced area.
      const [l, t, w, h] = [90, 50, 332, 156];
      x.fillStyle = "#3b77b3";
      x.fillRect(l, t, w, h);
      lines(x);
      x.strokeRect(l, t, w, h);
      const alley = h * 0.125;
      x.strokeRect(l, t + alley, w, h - alley * 2);
      const service = w * 0.27;
      x.beginPath();
      x.moveTo(l + w / 2 - service, t + alley);
      x.lineTo(l + w / 2 - service, t + h - alley);
      x.moveTo(l + w / 2 + service, t + alley);
      x.lineTo(l + w / 2 + service, t + h - alley);
      x.moveTo(l + w / 2 - service, t + h / 2);
      x.lineTo(l + w / 2 + service, t + h / 2);
      x.stroke();
    }),
  basketball: () =>
    tex(512, 256, (x) => {
      x.fillStyle = "#b9623c";
      x.fillRect(0, 0, 512, 256);
      const [l, t, w, h] = [20, 16, 472, 224];
      lines(x);
      x.strokeRect(l, t, w, h);
      x.beginPath();
      x.moveTo(256, t);
      x.lineTo(256, t + h);
      x.stroke();
      x.beginPath();
      x.arc(256, 128, 30, 0, Math.PI * 2);
      x.stroke();
      for (const side of [0, 1]) {
        const ex = side ? l + w : l;
        const d = side ? -1 : 1;
        x.fillStyle = "#9c4f30";
        x.fillRect(Math.min(ex, ex + d * 96), 128 - 40, 96, 80);
        x.strokeRect(Math.min(ex, ex + d * 96), 128 - 40, 96, 80);
        x.beginPath();
        x.arc(ex + d * 96, 128, 30, -Math.PI / 2, Math.PI / 2, side === 1);
        x.stroke();
        x.beginPath();
        x.arc(ex + d * 26, 128, 104, -Math.PI / 2 + 0.25, Math.PI / 2 - 0.25, side === 1);
        x.stroke();
      }
    }),
  play: () =>
    tex(512, 256, (x) => {
      x.fillStyle = "#d3ad80";
      x.fillRect(0, 0, 512, 256);
      lines(x);
      x.strokeRect(34, 26, 444, 204);
      x.beginPath();
      x.moveTo(256, 26);
      x.lineTo(256, 230);
      x.stroke();
    }),
  parking: () =>
    tex(512, 384, (x) => {
      x.fillStyle = "#5d6468";
      x.fillRect(0, 0, 512, 384);
      x.strokeStyle = "#e9e6dc";
      x.lineWidth = 3;
      // Four rows of bays: one along each long edge and a double row down the middle.
      for (const [y0, y1] of [
        [6, 70],
        [128, 192],
        [192, 256],
        [314, 378],
      ] as const)
        for (let i = 0; i <= 16; i++) {
          x.beginPath();
          x.moveTo(8 + i * 31, y0);
          x.lineTo(8 + i * 31, y1);
          x.stroke();
        }
      x.beginPath();
      x.moveTo(8, 192);
      x.lineTo(504, 192);
      x.stroke();
    }),
};

const CAR_COLOURS = ["#f1f1ee", "#c8323d", "#2c3e74", "#8a8f96", "#23262e", "#d9b23c", "#3f7d5a"];
const col = (c: string) => new THREE.Color(c);
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const UPV = new THREE.Vector3(0, 1, 0);
/** A matrix: at (x, y, z), turned `yaw` about the vertical, then tilted `pitch` about its own sideways axis. */
const place = (x: number, y: number, z: number, yaw = 0, pitch = 0) =>
  M.clone().compose(new THREE.Vector3(x, y, z), Q.clone().setFromAxisAngle(UPV, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch)), new THREE.Vector3(1, 1, 1));

export function Grounds({ world }: { world: World }) {
  const built = useMemo(() => {
    const b = newBuf();
    const flats: { key: string; geo: THREE.BufferGeometry; mat: THREE.Material; x: number; z: number; yaw: number }[] = [];
    let seed = 23;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const steel = col("#59657a");
    const white = col("#f1f1ee");

    // ── Courts and play areas ──
    const mats: Record<string, THREE.Material> = {};
    world.green.forEach((g, i) => {
      const kind = g.s === "tennis" || g.s === "basketball" ? g.s : g.s === "play" ? "play" : null;
      if (!kind) return;
      const o = obb(g.p);
      mats[kind] ??= toon({ map: TEX[kind]() });
      const geo = new THREE.PlaneGeometry(o.L * 2, o.W * 2, 6, 3);
      geo.rotateX(-Math.PI / 2);
      flats.push({ key: `court${i}`, geo, mat: mats[kind]!, x: o.x, z: o.z, yaw: o.yaw });
      const at = (l: number, s: number): [number, number] => [o.x + Math.cos(o.yaw) * l + Math.sin(o.yaw) * s, o.z - Math.sin(o.yaw) * l + Math.cos(o.yaw) * s];
      if (kind === "tennis") {
        // The net across the middle, between two posts.
        const half = o.W * 0.7;
        for (const s of [-half, half]) {
          const [x, z] = at(0, s);
          addGeo(b, new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), place(x, 0.55, z), col("#2f3a34"));
        }
        const [nx, nz] = at(0, 0);
        addGeo(b, new THREE.BoxGeometry(0.03, 0.82, half * 2), place(nx, 0.5, nz, o.yaw), col("#3d4744"));
        addGeo(b, new THREE.BoxGeometry(0.05, 0.08, half * 2), place(nx, 0.95, nz, o.yaw), white);
      } else if (kind === "basketball") {
        // A hoop at each end: pole, arm, backboard and ring.
        for (const d of [-1, 1]) {
          const [px, pz] = at(d * (o.L - 0.3), 0);
          const [bx, bz] = at(d * (o.L - 1.5), 0);
          const [rx, rz] = at(d * (o.L - 1.9), 0);
          const [ax, az] = at(d * (o.L - 0.9), 0);
          addGeo(b, new THREE.BoxGeometry(0.14, 3.6, 0.14), place(px, 1.8, pz, o.yaw), steel);
          addGeo(b, new THREE.BoxGeometry(1.3, 0.1, 0.1), place(ax, 3.45, az, o.yaw), steel);
          addGeo(b, new THREE.BoxGeometry(0.06, 1.05, 1.8), place(bx, 3.4, bz, o.yaw), white);
          const ring = new THREE.TorusGeometry(0.23, 0.025, 6, 16);
          ring.rotateX(Math.PI / 2);
          addGeo(b, ring, place(rx, 3.05, rz), col("#e2622d"));
        }
      }
    });

    // ── Park lawns: round flower beds ringed by a low hedge, as in the gardens in front of Tech Park ──
    const inside = (x: number, z: number, poly: XZ[]) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i]!;
        const [xj, zj] = poly[j]!;
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    const nearRoad = (x: number, z: number) =>
      world.roads.some((r) =>
        r.p.some((a, i) => {
          const c = r.p[i + 1];
          if (!c) return false;
          const dx = c[0] - a[0];
          const dz = c[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
          return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < r.w / 2 + 4;
        }),
      );
    const FLOWERS = ["#f25c7a", "#ffd166", "#ffffff", "#e63946", "#c77dff"].map(col);
    const beds: XZ[] = [];
    for (const g of world.green) {
      if (g.s && g.s !== "park") continue;
      const xs = g.p.map((q) => q[0]);
      const zs = g.p.map((q) => q[1]);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const want = Math.min(7, Math.max(1, Math.round(((x1 - x0) * (z1 - z0)) / 900)));
      for (let tries = 0, made = 0; made < want && tries < 80; tries++) {
        const x = x0 + rnd() * (x1 - x0);
        const z = z0 + rnd() * (z1 - z0);
        if (!inside(x, z, g.p) || nearRoad(x, z) || world.buildings.some((bl) => inside(x, z, bl.p) || bl.p.some((q) => Math.hypot(q[0] - x, q[1] - z) < 6))) continue;
        if (beds.some((q) => Math.hypot(q[0] - x, q[1] - z) < 9) || world.trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 3.5)) continue;
        if (Object.values(world.places).some((pl) => Math.hypot(pl.door[0] - x, pl.door[1] - z) < 8)) continue;
        beds.push([x, z]);
        made++;
        const hedge = new THREE.TorusGeometry(2.3, 0.32, 6, 20);
        hedge.rotateX(Math.PI / 2);
        addGeo(b, hedge, place(x, 0.3, z), col("#3f7f43"));
        addGeo(b, new THREE.CylinderGeometry(2.1, 2.1, 0.14, 20), place(x, 0.07, z), col("#7a5a3c"));
        addGeo(b, new THREE.SphereGeometry(0.62, 10, 8), place(x, 0.55, z), col("#4c8f4a"));
        for (let k = 0; k < 9; k++) {
          const ang = (k / 9) * Math.PI * 2 + rnd();
          const rr = 0.95 + rnd() * 0.75;
          addGeo(b, new THREE.SphereGeometry(0.2 + rnd() * 0.08, 7, 5), place(x + Math.cos(ang) * rr, 0.3, z + Math.sin(ang) * rr), FLOWERS[Math.floor(rnd() * FLOWERS.length)]!);
        }
      }
    }

    // ── Car parks: painted bays and a few parked cars ──
    for (const [i, lot] of (world.parking ?? []).entries()) {
      const o = obb(lot.p);
      const geo = new THREE.PlaneGeometry(o.L * 2, o.W * 2, 8, 6);
      geo.rotateX(-Math.PI / 2);
      flats.push({ key: `lot${i}`, geo, mat: toon({ map: TEX.parking() }), x: o.x, z: o.z, yaw: o.yaw });
      const bay = (o.L * 2 - 0.7) / 16;
      for (const row of [-0.83, -0.17, 0.17, 0.83])
        for (let k = 0; k < 16; k++) {
          if (rnd() > 0.5) continue;
          const l = -o.L + 0.35 + bay * (k + 0.5);
          const s = row * o.W;
          const x = o.x + Math.cos(o.yaw) * l + Math.sin(o.yaw) * s;
          const z = o.z - Math.sin(o.yaw) * l + Math.cos(o.yaw) * s;
          const yaw = o.yaw + Math.PI / 2 + (rnd() > 0.5 ? Math.PI : 0);
          const paint = col(CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)]!);
          // Scaled to fit the bays (the campus is drawn at 0.65 of its real size).
          const k2 = Math.min(1, bay / 2.2);
          addGeo(b, new THREE.BoxGeometry(3.9 * k2, 0.62, 1.7 * k2), place(x, 0.62, z, yaw), paint);
          addGeo(b, new THREE.BoxGeometry(2.0 * k2, 0.5, 1.5 * k2), place(x - Math.cos(yaw) * 0.15, 1.16, z + Math.sin(yaw) * 0.15, yaw), col("#2b3340"));
          for (const [wl, wsd] of [
            [1.25, 0.8],
            [1.25, -0.8],
            [-1.25, 0.8],
            [-1.25, -0.8],
          ] as const) {
            const wheel = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 10);
            wheel.rotateX(Math.PI / 2);
            addGeo(b, wheel, place(x + Math.cos(yaw) * wl * k2 + Math.sin(yaw) * wsd * k2, 0.31, z - Math.sin(yaw) * wl * k2 + Math.cos(yaw) * wsd * k2, yaw), col("#1b1c20"));
          }
        }
    }

    // ── Foot overbridges and the flights of steps that reach them ──
    const DECK = 7.1; // clear of the overhead wires
    const concrete = col("#bdb8ad");
    const bridgeEnds: XZ[] = [];
    for (const br of world.footbridges ?? []) {
      const a = br.p[0]!;
      const c = br.p.at(-1)!;
      bridgeEnds.push(a, c);
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const yaw = Math.atan2(-(c[1] - a[1]), c[0] - a[0]);
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[1] + c[1]) / 2;
      addGeo(b, new THREE.BoxGeometry(len + 2.6, 0.32, 3, 8, 1, 1), place(mx, DECK - 0.16, mz, yaw), concrete);
      for (const s of [-1.45, 1.45]) {
        const ox = Math.sin(yaw) * s;
        const oz = Math.cos(yaw) * s;
        addGeo(b, new THREE.BoxGeometry(len + 2.6, 0.08, 0.08, 8, 1, 1), place(mx + ox, DECK + 1.1, mz + oz, yaw), steel);
        addGeo(b, new THREE.BoxGeometry(len + 2.6, 0.5, 0.05, 8, 1, 1), place(mx + ox, DECK + 0.3, mz + oz, yaw), steel);
        for (let t = -len / 2 - 1.2; t <= len / 2 + 1.21; t += (len + 2.4) / 10)
          addGeo(b, new THREE.BoxGeometry(0.07, 1.1, 0.07), place(mx + Math.cos(yaw) * t + ox, DECK + 0.55, mz - Math.sin(yaw) * t + oz, yaw), steel);
      }
      // Piers at both ends and either side of the tracks.
      for (const t of [-len / 2 - 0.6, -8.4, 8.4, len / 2 + 0.6])
        addGeo(b, new THREE.BoxGeometry(0.55, DECK - 0.3, 0.55, 1, 4, 1), place(mx + Math.cos(yaw) * t, (DECK - 0.3) / 2, mz - Math.sin(yaw) * t, yaw), concrete);
    }
    for (const st of world.steps ?? []) {
      const a = st.p[0]!;
      const c = st.p.at(-1)!;
      // The end that meets a bridge is the top.
      const topIsA = bridgeEnds.some((e) => Math.hypot(e[0] - a[0], e[1] - a[1]) < 1.5);
      const topIsC = bridgeEnds.some((e) => Math.hypot(e[0] - c[0], e[1] - c[1]) < 1.5);
      if (!topIsA && !topIsC) continue; // steps on the ground (at a building) belong to that building
      const [lo, hi] = topIsA ? [c, a] : [a, c];
      const run = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]);
      const yaw = Math.atan2(-(hi[1] - lo[1]), hi[0] - lo[0]);
      const N = 18;
      for (let k = 0; k < N; k++) {
        const t = (k + 0.5) / N;
        const h = ((k + 1) / N) * (DECK - 0.32);
        addGeo(b, new THREE.BoxGeometry(run / N + 0.02, h, 2.5), place(lo[0] + (hi[0] - lo[0]) * t, h / 2, lo[1] + (hi[1] - lo[1]) * t, yaw), concrete);
      }
      const slope = Math.atan2(DECK - 0.32, run);
      const span = Math.hypot(run, DECK - 0.32);
      for (const s of [-1.22, 1.22])
        addGeo(b, new THREE.BoxGeometry(span, 0.08, 0.08, 6, 1, 1), place((lo[0] + hi[0]) / 2 + Math.sin(yaw) * s, (DECK - 0.32) / 2 + 1.05, (lo[1] + hi[1]) / 2 + Math.cos(yaw) * s, yaw, slope), steel);
    }
    return { flats, solid: b.pos.length ? toGeo(b) : null };
  }, [world]);
  useEffect(
    () => () => {
      built.flats.forEach((f) => f.geo.dispose());
      built.solid?.dispose();
    },
    [built],
  );
  return (
    <group>
      {built.flats.map((f) => (
        <mesh key={f.key} geometry={f.geo} material={f.mat} position={[f.x, 0.06, f.z]} rotation-y={f.yaw} receiveShadow userData={{ noInk: true }} />
      ))}
      {built.solid ? <mesh geometry={built.solid} material={toon({ vertexColors: true })} castShadow receiveShadow /> : null}
    </group>
  );
}
