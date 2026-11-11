"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "@/lib/walk/world";
import { toon } from "./curve";
import type { Game } from "./state";

/**
 * The railway past Potheri, from OpenStreetMap's main line: three electrified tracks on ballast (sleepers, rails,
 * masts and overhead wires), the Potheri platform with its canopy, benches and yellow name boards, and a suburban
 * train that pulls in, waits and pulls out again, every hundred seconds, in alternating directions. People, the
 * platform and the train are real size; only distances are scaled, like the rest of the campus.
 */

const GAP = 4.8; // between track centres
const HALF_GAUGE = 0.84; // broad gauge, 1676 mm
const PLATFORM = { len: 92, w: 7, h: 0.32 };
const COACH = { len: 20, gap: 0.9, w: 3.2, h: 2.85, floor: 1.15, n: 4 };
const CYCLE = 100; // seconds between trains
const T_IN = 36;
const T_STOP = 14;
const T_OUT = 36;
const RUN = 460; // metres from the platform where a train appears or vanishes (beyond the fog)

/** The centre line resampled every metre, clipped to the ground, with tangents. */
function sampleLine(world: World) {
  const b = world.bounds;
  const pad = 430;
  const pts = world.rail!.line.filter(([x, z]) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const len = curve.getLength();
  const n = Math.floor(len);
  const px = new Float32Array(n + 1);
  const pz = new Float32Array(n + 1);
  const tx = new Float32Array(n + 1);
  const tz = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    px[i] = p.x;
    pz[i] = p.z;
    tx[i] = t.x;
    tz[i] = t.z;
  }
  return { n, px, pz, tx, tz };
}
type Line = ReturnType<typeof sampleLine>;

/** A point beside the line: `s` metres along it, `off` metres to its right (negative: left). */
function at(L: Line, s: number, off = 0): { x: number; z: number; tx: number; tz: number } {
  const c = Math.max(0, Math.min(L.n, s));
  const i = Math.min(L.n - 1, Math.floor(c));
  const f = c - i;
  const tx = L.tx[i]! + (L.tx[i + 1]! - L.tx[i]!) * f;
  const tz = L.tz[i]! + (L.tz[i + 1]! - L.tz[i]!) * f;
  const x = L.px[i]! + (L.px[i + 1]! - L.px[i]!) * f;
  const z = L.pz[i]! + (L.pz[i + 1]! - L.pz[i]!) * f;
  // Right of the direction of travel (x, z) is (-tz, tx).
  return { x: x - tz * off, z: z + tx * off, tx, tz };
}

/** A strip along the line between two offsets, at a height, from s0 to s1 (a vertex every 2 m, so it bends). */
function ribbon(L: Line, s0: number, s1: number, offs: [number, number][], step = 2) {
  const pos: number[] = [];
  const idx: number[] = [];
  const cols = offs.length;
  let rows = 0;
  for (let s = s0; s <= s1 + 0.001; s += step, rows++) for (const [off, y] of offs) {
    const p = at(L, s, off);
    pos.push(p.x, y, p.z);
  }
  for (let r = 0; r + 1 < rows; r++)
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c;
      const b = a + cols;
      idx.push(a, a + 1, b, a + 1, b + 1, b); // offsets run left to right: this way round faces up
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Many copies of one box laid along the line. */
function laid(geo: THREE.BufferGeometry, mat: THREE.Material, items: { x: number; y: number; z: number; yaw: number; sx?: number }[], ink = false) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(0, it.yaw, 0);
    o.scale.set(it.sx ?? 1, 1, 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.frustumCulled = false;
  if (!ink) m.userData.noInk = true;
  return m;
}
const yawOf = (tx: number, tz: number) => Math.atan2(-tz, tx); // local +x along the track

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function nameBoard(name: string, ref: string) {
  return tex(512, 160, (x) => {
    x.fillStyle = "#f5c518";
    x.fillRect(0, 0, 512, 160);
    x.strokeStyle = "#1b1b1b";
    x.lineWidth = 8;
    x.strokeRect(6, 6, 500, 148);
    x.fillStyle = "#111";
    x.textAlign = "center";
    x.font = "bold 64px system-ui, sans-serif";
    x.fillText(name.toUpperCase(), 256, 84);
    x.font = "bold 30px system-ui, sans-serif";
    x.fillText(ref, 256, 132);
  });
}

function coachSide(front: boolean) {
  return tex(1024, 146, (x) => {
    x.fillStyle = "#ebe7de";
    x.fillRect(0, 0, 1024, 146);
    x.fillStyle = "#6b2d5c";
    x.fillRect(0, 104, 1024, 16);
    x.fillStyle = "#24305e";
    x.fillRect(0, 120, 1024, 26);
    // Windows with bars, and two pairs of open doorways.
    for (let i = 0; i < 14; i++) {
      const wx = 40 + i * 70;
      if ([3, 4, 10, 11].includes(i)) continue;
      x.fillStyle = "#33415a";
      x.fillRect(wx, 30, 46, 44);
      x.fillStyle = "#c9d2dc";
      for (let k = 1; k < 4; k++) x.fillRect(wx, 30 + k * 11, 46, 2);
    }
    for (const dx of [250, 740]) {
      x.fillStyle = "#3a3a40";
      x.fillRect(dx, 18, 76, 104);
      x.fillStyle = "#f5c518";
      x.fillRect(dx - 6, 18, 6, 104);
      x.fillRect(dx + 76, 18, 6, 104);
    }
    if (front) {
      x.fillStyle = "#24305e";
      x.fillRect(0, 0, 20, 146);
    }
  });
}

function cabFace() {
  return tex(256, 230, (x) => {
    x.fillStyle = "#ebe7de";
    x.fillRect(0, 0, 256, 230);
    x.fillStyle = "#24305e";
    x.fillRect(0, 186, 256, 44);
    x.fillStyle = "#f5c518";
    x.fillRect(0, 150, 256, 30);
    x.fillStyle = "#2b3346";
    x.fillRect(22, 34, 96, 70);
    x.fillRect(138, 34, 96, 70);
    x.fillStyle = "#3a3a40";
    x.fillRect(108, 112, 40, 118);
  });
}

export function Railway({ world, game, onTrain }: { world: World; game: React.RefObject<Game>; onTrain: () => void }) {
  const rail = world.rail!;
  const L = useMemo(() => sampleLine(world), [world]);
  // Where the station is along the line, and which side of the line it stands on.
  const station = useMemo(() => {
    const [sx, sz] = rail.station.at;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= L.n; i++) {
      const d = Math.hypot(L.px[i]! - sx, L.pz[i]! - sz);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const side = (sx - L.px[best]!) * -L.tz[best]! + (sz - L.pz[best]!) * L.tx[best]! >= 0 ? 1 : -1;
    return { s: best, side };
  }, [L, rail.station.at]);
  const n = rail.tracks;
  const offs = useMemo(() => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * GAP), [n]);
  const platformTrack = station.side * ((n - 1) / 2) * GAP;
  const platformMid = platformTrack + station.side * (1.7 + PLATFORM.w / 2);

  // ── The static railway, built once ──
  const statics = useMemo(() => {
    const g = new THREE.Group();
    const half = ((n - 1) / 2) * GAP;
    // Ballast bed: a low bank with sloping sides.
    const bed = new THREE.Mesh(
      ribbon(L, 0, L.n, [
        [-half - 3.2, 0.0],
        [-half - 2.2, 0.2],
        [half + 2.2, 0.2],
        [half + 3.2, 0.0],
      ]),
      toon({ color: "#8f877b" }),
    );
    bed.receiveShadow = true;
    bed.userData.noInk = true;
    g.add(bed);
    const sleepers: { x: number; y: number; z: number; yaw: number }[] = [];
    const rails: { x: number; y: number; z: number; yaw: number }[] = [];
    const wires: { x: number; y: number; z: number; yaw: number }[] = [];
    for (const off of offs) {
      for (let s = 0.5; s < L.n; s += 1.0) {
        const p = at(L, s, off);
        sleepers.push({ x: p.x, y: 0.26, z: p.z, yaw: yawOf(p.tx, p.tz) });
      }
      for (const side of [-1, 1])
        for (let s = 1; s < L.n; s += 2) {
          const p = at(L, s, off + side * HALF_GAUGE);
          rails.push({ x: p.x, y: 0.4, z: p.z, yaw: yawOf(p.tx, p.tz) });
        }
      for (let s = 2.5; s < L.n; s += 5) {
        const p = at(L, s, off);
        wires.push({ x: p.x, y: 5.6, z: p.z, yaw: yawOf(p.tx, p.tz) });
      }
    }
    g.add(laid(new THREE.BoxGeometry(0.26, 0.14, 2.75), toon({ color: "#b3ada2" }), sleepers));
    g.add(laid(new THREE.BoxGeometry(2.04, 0.16, 0.1), toon({ color: "#7d838c" }), rails));
    g.add(laid(new THREE.BoxGeometry(5.04, 0.035, 0.035), toon({ color: "#2a2d33" }), wires));
    // Masts on the far side from the platform, with a boom over every track.
    const masts: { x: number; y: number; z: number; yaw: number }[] = [];
    const booms: { x: number; y: number; z: number; yaw: number; sx: number }[] = [];
    const far = -station.side * (half + 3.2);
    const span = half * 2 + 4.2;
    for (let s = 20; s < L.n; s += 48) {
      const m = at(L, s, far);
      masts.push({ x: m.x, y: 3.6, z: m.z, yaw: yawOf(m.tx, m.tz) });
      const c = at(L, s, far + station.side * (span / 2));
      booms.push({ x: c.x, y: 6.3, z: c.z, yaw: yawOf(c.tx, c.tz) + Math.PI / 2, sx: span });
    }
    g.add(laid(new THREE.BoxGeometry(0.3, 7.2, 0.3), toon({ color: "#9aa0a6" }), masts, true));
    g.add(laid(new THREE.BoxGeometry(1, 0.14, 0.14), toon({ color: "#9aa0a6" }), booms, true));

    // ── Potheri platform: a low concrete deck with a yellow safety edge, a path out to the road ──
    const s0 = station.s - PLATFORM.len / 2;
    const s1 = station.s + PLATFORM.len / 2;
    const edge = platformMid - station.side * (PLATFORM.w / 2);
    const outer = platformMid + station.side * (PLATFORM.w / 2);
    const lo = Math.min(edge, outer);
    const hi = Math.max(edge, outer);
    const deck = new THREE.Mesh(
      ribbon(L, s0, s1, [
        [lo, 0],
        [lo, PLATFORM.h],
        [hi, PLATFORM.h],
        [hi, 0],
      ]),
      toon({ color: "#cfc8bb" }),
    );
    deck.receiveShadow = true;
    g.add(deck);
    const stripe = new THREE.Mesh(
      ribbon(
        L,
        s0,
        s1,
        [edge - station.side * 0.05, edge + station.side * 0.45].sort((a, b) => a - b).map((o) => [o, PLATFORM.h + 0.012] as [number, number]),
      ),
      toon({ color: "#f5c518" }),
    );
    stripe.userData.noInk = true;
    g.add(stripe);
    const path = new THREE.Mesh(
      (() => {
        // From the back of the platform straight out towards the road, 22 m.
        const geo = new THREE.PlaneGeometry(3, 22, 1, 11);
        geo.rotateX(-Math.PI / 2);
        return geo;
      })(),
      toon({ color: "#c9b79c" }),
    );
    {
      const p = at(L, station.s, outer + station.side * 11);
      path.position.set(p.x, 0.03, p.z);
      path.rotation.y = yawOf(p.tx, p.tz);
      path.receiveShadow = true;
      path.userData.noInk = true;
    }
    g.add(path);
    // Canopy: posts down the middle and a roof, over the middle of the platform.
    const posts: { x: number; y: number; z: number; yaw: number }[] = [];
    const roofs: { x: number; y: number; z: number; yaw: number }[] = [];
    for (let s = station.s - 27; s <= station.s + 27; s += 7.7) {
      const p = at(L, s, platformMid);
      posts.push({ x: p.x, y: PLATFORM.h + 1.8, z: p.z, yaw: 0 });
      roofs.push({ x: p.x, y: PLATFORM.h + 3.75, z: p.z, yaw: yawOf(p.tx, p.tz) });
    }
    g.add(laid(new THREE.CylinderGeometry(0.11, 0.11, 3.6, 8), toon({ color: "#2e6b4f" }), posts, true));
    g.add(laid(new THREE.BoxGeometry(7.9, 0.2, PLATFORM.w - 0.6), toon({ color: "#c8323d" }), roofs, true));
    // Benches under the canopy.
    const benches: { x: number; y: number; z: number; yaw: number }[] = [];
    for (const ds of [-19, -4, 11, 22]) {
      const p = at(L, station.s + ds, platformMid + station.side * 1.6);
      benches.push({ x: p.x, y: PLATFORM.h + 0.45, z: p.z, yaw: yawOf(p.tx, p.tz) });
    }
    g.add(laid(new THREE.BoxGeometry(1.8, 0.1, 0.5), toon({ color: "#8a5a35" }), benches, true));
    g.add(laid(new THREE.BoxGeometry(1.6, 0.45, 0.35), toon({ color: "#55595f" }), benches.map((b) => ({ ...b, y: PLATFORM.h + 0.2 })), true));
    // Yellow name boards near each end, readable from the platform and from the train.
    const board = toon({ map: nameBoard(rail.station.name, rail.station.ref) });
    for (const ds of [-38, 38]) {
      const p = at(L, station.s + ds, platformMid);
      const grp = new THREE.Group();
      grp.position.set(p.x, PLATFORM.h, p.z);
      grp.rotation.y = yawOf(p.tx, p.tz);
      for (const dx of [-1.4, 1.4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.9, 0.1), toon({ color: "#2b2b2b" }));
        leg.position.set(dx, 1.45, 0);
        grp.add(leg);
      }
      for (const face of [0, Math.PI]) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), board);
        panel.position.set(0, 2.35, face ? -0.03 : 0.03);
        panel.rotation.y = face + (station.side > 0 ? Math.PI : 0);
        grp.add(panel);
      }
      g.add(grp);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !o.userData.noInk) o.castShadow = true;
    });
    return g;
  }, [L, offs, n, station, platformMid, rail.station.name, rail.station.ref]);
  useEffect(() => () => statics.traverse((o) => (o as THREE.Mesh).geometry?.dispose()), [statics]);

  // ── The train ──
  const coaches = useRef<(THREE.Group | null)[]>([]);
  const train = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const side = toon({ map: coachSide(false) });
    const cab = toon({ map: cabFace() });
    const plain = toon({ color: "#ebe7de" });
    const gangway = toon({ color: "#3a3a40" });
    // Box faces: +x, -x (the ends), +y, -y, +z, -z (the sides).
    return {
      lead: [cab, gangway, plain, plain, side, side],
      tail: [gangway, cab, plain, plain, side, side],
      mid: [gangway, gangway, plain, plain, side, side],
      roof: toon({ color: "#9ea3a8" }),
      under: toon({ color: "#2a2b30" }),
      lamp: toon({ color: "#000000", emissive: "#fff3c4" }),
    };
  }, []);
  const lastCycle = useRef(-1);
  useFrame(() => {
    const g = game.current;
    const now = Date.now() / 1000;
    const cycle = Math.floor(now / CYCLE);
    const t = now % CYCLE;
    const dir = cycle % 2 ? 1 : -1; // which way this train runs
    let s: number | null = null;
    if (t < T_IN) s = station.s - dir * RUN * (1 - t / T_IN) ** 2;
    else if (t < T_IN + T_STOP) s = station.s;
    else if (t < T_IN + T_STOP + T_OUT) s = station.s + dir * RUN * ((t - T_IN - T_STOP) / T_OUT) ** 2;
    if (train.current) train.current.visible = s !== null;
    if (s === null) return;
    // A heads-up (and a horn) when a train sets off towards Potheri while you're near the station.
    if (cycle !== lastCycle.current) {
      if (lastCycle.current >= 0 && t < T_IN && Math.hypot(g.pos.x - rail.station.at[0], g.pos.z - rail.station.at[1]) < 160) onTrain();
      lastCycle.current = cycle;
    }
    const total = COACH.n * COACH.len + (COACH.n - 1) * COACH.gap;
    coaches.current.forEach((c, i) => {
      if (!c) return;
      // Coach i's centre, counted from the front of the train.
      const cs = s + dir * (total / 2 - COACH.len / 2 - i * (COACH.len + COACH.gap));
      const a = at(L, cs - 7, platformTrack);
      const b = at(L, cs + 7, platformTrack);
      c.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      // Local +x points the way the train is going.
      c.rotation.y = Math.atan2(-(b.z - a.z) * dir, (b.x - a.x) * dir);
    });
  });

  return (
    <>
      <primitive object={statics} />
      <group ref={train} visible={false}>
        {Array.from({ length: COACH.n }, (_, i) => {
          const body = i === 0 ? mats.lead : i === COACH.n - 1 ? mats.tail : mats.mid;
          return (
            <group key={i} ref={(el) => void (coaches.current[i] = el)}>
              <mesh material={body} position-y={COACH.floor + COACH.h / 2} castShadow>
                <boxGeometry args={[COACH.len, COACH.h, COACH.w]} />
              </mesh>
              <mesh material={mats.roof} position-y={COACH.floor + COACH.h} scale={[0.35, 1, 1]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[COACH.w / 2 - 0.1, COACH.w / 2 - 0.1, COACH.len - 0.2, 14, 1, false, 0, Math.PI]} />
              </mesh>
              {[-6.5, 6.5].map((x) => (
                <mesh key={x} material={mats.under} position={[x, 0.75, 0]}>
                  <boxGeometry args={[3, 0.75, 2.4]} />
                </mesh>
              ))}
              <mesh material={mats.under} position={[0, 0.95, 0]}>
                <boxGeometry args={[8, 0.5, 2.2]} />
              </mesh>
              {i === 1 ? (
                // The pantograph, reaching up to the wire.
                <group position={[4, COACH.floor + COACH.h + 0.3, 0]}>
                  <mesh material={mats.under} position={[-0.45, 0.6, 0]} rotation-z={-0.7}>
                    <boxGeometry args={[0.06, 1.5, 0.06]} />
                  </mesh>
                  <mesh material={mats.under} position={[0.45, 0.6, 0]} rotation-z={0.7}>
                    <boxGeometry args={[0.06, 1.5, 0.06]} />
                  </mesh>
                  <mesh material={mats.under} position={[0, 1.18, 0]}>
                    <boxGeometry args={[0.12, 0.05, 1.6]} />
                  </mesh>
                </group>
              ) : null}
              {i === 0 ? (
                <mesh material={mats.lamp} position={[COACH.len / 2 + 0.02, COACH.floor + 0.55, 0]} rotation-y={Math.PI / 2} userData={{ noInk: true }}>
                  <circleGeometry args={[0.16, 12]} />
                </mesh>
              ) : null}
            </group>
          );
        })}
      </group>
    </>
  );
}
