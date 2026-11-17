"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { World, XZ } from "@/lib/walk/world";
import { addGeo, newBuf, toGeo } from "./buildings";
import { toon } from "./curve";
import { obb } from "./Grounds";

/**
 * The Dr T.R. Paarivendhar Aquatic Complex, behind the sports ground, after photos of it: a ten-lane 50 m pool
 * beside a stand of blue seats, a diving pool under a blue-and-white diving tower, a training pool with lane ropes,
 * a tiled deck behind railings, the light-blue complex building with its name, and a scoreboard. Lengths are scaled
 * like the rest of the campus (0.65); heights, seats and the diving platforms are real size.
 */

const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat?: [number, number]) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
};

/** Pool water seen from above: the lane lines and their T-ends on the floor, `lanes` across. */
function poolTexture(lanes: number, colour: string) {
  return tex(1024, 512, (x) => {
    x.fillStyle = colour;
    x.fillRect(0, 0, 1024, 512);
    x.fillStyle = "rgba(20, 40, 90, 0.55)";
    const lw = 512 / lanes;
    for (let i = 0; i < lanes; i++) {
      const cy = lw * (i + 0.5);
      x.fillRect(60, cy - 4, 1024 - 120, 8);
      for (const ex of [52, 1024 - 60]) x.fillRect(ex, cy - 18, 8, 36);
    }
  });
}
const DECK = () =>
  tex(
    128,
    128,
    (x) => {
      x.fillStyle = "#e6dccb";
      x.fillRect(0, 0, 128, 128);
      x.strokeStyle = "rgba(120, 105, 85, 0.35)";
      x.lineWidth = 2;
      for (let i = 0; i <= 128; i += 32) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, 128);
        x.moveTo(0, i);
        x.lineTo(128, i);
        x.stroke();
      }
    },
    [14, 9],
  );
function nameSign(text: string) {
  return tex(1024, 192, (x) => {
    x.fillStyle = "#eaf6fb";
    x.fillRect(0, 0, 1024, 192);
    x.fillStyle = "#1f4f8f";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = "bold 64px system-ui, sans-serif";
    x.fillText(text.split(" Aquatic")[0]!, 512, 66);
    x.font = "bold 52px system-ui, sans-serif";
    x.fillText("Aquatic Complex", 512, 140);
  });
}
const SCREEN = () =>
  tex(256, 160, (x) => {
    x.fillStyle = "#101418";
    x.fillRect(0, 0, 256, 160);
    x.fillStyle = "#7fd3ff";
    x.font = "bold 22px monospace";
    x.textAlign = "center";
    x.fillText("SRM AQUATICS", 128, 46);
    x.fillStyle = "#ffd166";
    x.font = "bold 30px monospace";
    x.fillText("50 m", 128, 96);
    x.fillStyle = "#ffffff";
    x.font = "16px monospace";
    x.fillText("LANE 1-10", 128, 132);
  });

export function Aquatic({ world, name }: { world: World; name: string }) {
  const built = useMemo(() => {
    const area = world.green.find((g) => g.s === "pool");
    if (!area) return null;
    const o = obb(area.p);
    const cos = Math.cos(o.yaw);
    const sin = Math.sin(o.yaw);
    const at = (l: number, s: number): XZ => [o.x + cos * l + sin * s, o.z - sin * l + cos * s];
    const L = o.L * 2;
    const W = o.W * 2;
    const b = newBuf();
    const M = new THREE.Matrix4();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const col = (c: string) => new THREE.Color(c);
    /** A box at (l, y, s) in the complex's frame, sized along l, up and along s. */
    const put = (l: number, y: number, s: number, sl: number, sy: number, ss: number, c: THREE.Color, geo: THREE.BufferGeometry = box, tilt = 0) => {
      const [x, z] = at(l, s);
      addGeo(b, geo, M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, o.yaw, tilt, "YZX")), new THREE.Vector3(sl, sy, ss)), c);
    };
    const flats: { key: string; geo: THREE.BufferGeometry; map: THREE.Texture; water: boolean; x: number; z: number; y: number }[] = [];
    const flat = (key: string, l: number, s: number, sl: number, ss: number, y: number, map: THREE.Texture, water: boolean) => {
      const g = new THREE.PlaneGeometry(sl, ss, Math.ceil(sl / 2), Math.ceil(ss / 2));
      g.rotateX(-Math.PI / 2);
      const [x, z] = at(l, s);
      flats.push({ key, geo: g, map, water, x, z, y });
    };
    const steel = col("#b9c2c8");
    const coping = col("#3a4048");
    const blueWhite = col("#cfe9f2");

    // The tiled deck over the whole complex.
    flat("deck", 0, 0, L, W, 0.07, DECK(), false);

    // The 50 m pool: ten lanes, a dark coping all round, starting blocks at one end.
    const P = { l: -L / 2 + 2.5 + 16.25, s: -W / 2 + 7.5 + 8.1, L: 32.5, W: 16.2 };
    flat("main", P.l, P.s, P.L, P.W, 0.1, poolTexture(10, "#5cc6ea"), true);
    for (const d of [-1, 1]) {
      put(P.l + d * (P.L / 2 + 0.25), 0.12, P.s, 0.5, 0.1, P.W + 1, coping);
      put(P.l, 0.12, P.s + d * (P.W / 2 + 0.25), P.L + 1, 0.1, 0.5, coping);
    }
    for (let i = 0; i < 10; i++) {
      const s = P.s - P.W / 2 + (P.W / 10) * (i + 0.5);
      put(P.l - P.L / 2 - 0.75, 0.35, s, 0.6, 0.5, 0.55, col("#f2f4f5"));
      put(P.l - P.L / 2 - 0.75, 0.62, s, 0.6, 0.06, 0.55, col("#2c3e74"));
    }

    // A stand of blue seats along the long side, three rows, behind a glass-and-steel railing.
    const stand = { l0: P.l - P.L / 2 - 1, l1: P.l + P.L / 2 + 1 };
    const standLen = stand.l1 - stand.l0;
    const standMid = (stand.l0 + stand.l1) / 2;
    for (let row = 0; row < 3; row++) {
      const y = 0.5 * (row + 1);
      const s = -W / 2 + 1.2 + (2 - row) * 1.0;
      put(standMid, y / 2, s, standLen, y, 1.0, col("#3f9fd8"));
      for (let k = 0; k < Math.floor(standLen / 1.1); k++) put(stand.l0 + 0.6 + k * 1.1, y + 0.22, s + 0.15, 0.55, 0.44, 0.45, col("#46b3f0"));
    }
    put(standMid, 0.55, -W / 2 + 4.1, standLen, 1.1, 0.05, col("#cde3ea"));
    put(standMid, 1.1, -W / 2 + 4.1, standLen, 0.06, 0.08, steel);

    // The diving pool, deeper blue, with the diving tower at its far end.
    const D = { l: L / 2 - 2.5 - 7, s: 3.5, L: 14, W: 13 };
    flat("diving", D.l, D.s, D.L, D.W, 0.1, poolTexture(1, "#3aa6d6"), true);
    for (const d of [-1, 1]) {
      put(D.l + d * (D.L / 2 + 0.25), 0.12, D.s, 0.5, 0.1, D.W + 1, coping);
      put(D.l, 0.12, D.s + d * (D.W / 2 + 0.25), D.L + 1, 0.1, 0.5, coping);
    }
    {
      const tl = D.l + D.L / 2 + 1.6;
      for (const ds of [-1.6, 1.6]) put(tl, 5.2, D.s + ds, 1.1, 10.4, 1.1, blueWhite);
      put(tl, 10.5, D.s, 1.4, 0.4, 4.6, blueWhite);
      // Platforms at 3, 5, 7.5 and 10 m, reaching out over the water, each with a rail.
      for (const [h, reach, ds] of [
        [3, 5.5, -1.4],
        [5, 6.5, 1.4],
        [7.5, 7.5, -1.2],
        [10, 8.5, 0.6],
      ] as const) {
        put(tl - reach / 2, h, D.s + ds, reach, 0.35, 2.2, blueWhite);
        put(tl - reach / 2, h + 0.55, D.s + ds + 1.05, reach, 0.06, 0.06, steel);
      }
      // The stair up the back.
      for (let k = 0; k < 20; k++) put(tl + 1.4, 0.25 + k * 0.5, D.s - 2.2 + (k % 2) * 1.2, 1.0, 0.12, 1.1, blueWhite);
      put(tl + 1.9, 5.2, D.s - 1.6, 0.08, 10.4, 0.08, steel);
      // Springboards at the pool's side.
      for (const ds of [-4, -1.5]) put(D.l + D.L / 2 - 1.5, 1, D.s + ds, 4, 0.1, 0.5, col("#f1f4f6"));
    }

    // The training pool, with red lane ropes.
    const T = { l: L / 2 - 2.5 - 8, s: -W / 2 + 6.8, L: 16, W: 8 };
    flat("training", T.l, T.s, T.L, T.W, 0.1, poolTexture(5, "#62cbee"), true);
    for (const d of [-1, 1]) {
      put(T.l + d * (T.L / 2 + 0.25), 0.12, T.s, 0.5, 0.1, T.W + 1, coping);
      put(T.l, 0.12, T.s + d * (T.W / 2 + 0.25), T.L + 1, 0.1, 0.5, coping);
    }
    for (let i = 1; i < 5; i++) {
      const s = T.s - T.W / 2 + (T.W / 5) * i;
      for (let k = 0; k < 20; k++) put(T.l - T.L / 2 + 0.4 + k * ((T.L - 0.8) / 19), 0.16, s, 0.35, 0.12, 0.12, col(k % 4 === 0 ? "#ffffff" : "#d8353f"));
    }

    // The complex building on the far side, light blue, with its name over the windows.
    const B = { l: -L / 2 + 2 + 12, s: W / 2 - 3.2, L: 24, W: 5.2, H: 4.6 };
    put(B.l, B.H / 2, B.s, B.L, B.H, B.W, col("#bfe3ef"));
    put(B.l, B.H + 0.15, B.s, B.L + 0.6, 0.3, B.W + 0.6, col("#4e6a84"));
    for (let k = 0; k < 6; k++) put(B.l - B.L / 2 + 2.2 + k * 3.9, 1.8, B.s - B.W / 2 - 0.02, 2.4, 1.4, 0.05, col("#2f4a5f"));
    // A scoreboard by the diving pool.
    const SB = { l: D.l - 2, s: W / 2 - 2.2 };
    for (const dl of [-1.4, 1.4]) put(SB.l + dl, 1.2, SB.s, 0.15, 2.4, 0.15, col("#4b555a"));
    put(SB.l, 3.3, SB.s, 3.4, 2.2, 0.3, col("#1b1f24"));

    // Railings round the deck, flags on the far side, a floodlight in the corner.
    const rail = (l0: number, s0: number, l1: number, s1: number) => {
      const len = Math.hypot(l1 - l0, s1 - s0);
      const n = Math.max(2, Math.round(len / 2.5));
      for (let k = 0; k <= n; k++) put(l0 + ((l1 - l0) * k) / n, 0.55, s0 + ((s1 - s0) * k) / n, 0.07, 1.1, 0.07, steel);
      const [x0, z0] = at(l0, s0);
      const [x1, z1] = at(l1, s1);
      const yaw = Math.atan2(-(z1 - z0), x1 - x0);
      addGeo(b, box, M.compose(new THREE.Vector3((x0 + x1) / 2, 1.1, (z0 + z1) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(len, 0.06, 0.06)), steel);
    };
    const e = 0.4;
    rail(-L / 2 + e, W / 2 - e, L / 2 - e, W / 2 - e);
    rail(L / 2 - e, -W / 2 + e, L / 2 - e, W / 2 - e);
    rail(-L / 2 + e, -W / 2 + e, -L / 2 + e, W / 2 - e);
    rail(-L / 2 + e, -W / 2 + e, L / 2 - 6, -W / 2 + e); // a gap by the door
    ["#f2c42e", "#d8353f", "#2f6fd8", "#3f8f6b", "#c77dff", "#ef8a3a"].forEach((c, k) => {
      const l = -L / 2 + 3 + k * ((L - 6) / 5);
      put(l, 2.5, W / 2 - 0.2, 0.05, 5, 0.05, steel);
      put(l + 0.45, 4.6, W / 2 - 0.2, 0.9, 0.6, 0.03, col(c));
    });
    put(L / 2 - 1.2, 9, -W / 2 + 1.2, 0.45, 18, 0.45, col("#7d8590"));
    put(L / 2 - 1.2, 18.3, -W / 2 + 1.2, 2.8, 1.8, 0.35, col("#3b4048"));

    const sign = nameSign(name);
    const signGeo = new THREE.PlaneGeometry(9, 1.7);
    const [sx, sz] = at(B.l, B.s - B.W / 2 - 0.06);
    const screen = SCREEN();
    const screenGeo = new THREE.PlaneGeometry(3.2, 2.0);
    const [scx, scz] = at(SB.l, SB.s - 0.17);
    return { flats, solid: toGeo(b), yaw: o.yaw, sign, signGeo, signAt: [sx, 3.6, sz] as const, screen, screenGeo, screenAt: [scx, 3.3, scz] as const };
  }, [world, name]);
  useEffect(
    () => () => {
      if (!built) return;
      built.flats.forEach((f) => {
        f.geo.dispose();
        f.map.dispose();
      });
      built.solid.dispose();
      built.signGeo.dispose();
      built.sign.dispose();
      built.screenGeo.dispose();
      built.screen.dispose();
    },
    [built],
  );
  if (!built) return null;
  // Both boards face the pool: their front is the frame's -s side.
  const face = built.yaw + Math.PI;
  return (
    <group>
      {built.flats.map((f) => (
        <mesh key={f.key} geometry={f.geo} material={toon({ map: f.map, water: f.water })} position={[f.x, f.y, f.z]} rotation-y={built.yaw} receiveShadow userData={{ noInk: true }} />
      ))}
      <mesh geometry={built.solid} material={toon({ vertexColors: true })} castShadow receiveShadow />
      <mesh geometry={built.signGeo} material={toon({ map: built.sign })} position={built.signAt} rotation-y={face} userData={{ noInk: true }} />
      <mesh geometry={built.screenGeo} material={toon({ map: built.screen })} position={built.screenAt} rotation-y={face} userData={{ noInk: true }} />
    </group>
  );
}
