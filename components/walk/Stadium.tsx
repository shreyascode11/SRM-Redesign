"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { World, XZ } from "@/lib/walk/world";
import { addGeo, newBuf, toGeo } from "./buildings";
import { bend, curve, toon } from "./curve";
import { obb } from "./Grounds";
import type { Game } from "./state";

/**
 * The sports ground beside Tech Park: a football pitch with its markings, ringed by a five-lane running track.
 * Sized to the mapped lawn (the campus is drawn at 0.65 of real size, so the pitch is too). Everything flat is laid
 * as strips a couple of metres long, so it bends with the curved world like the roads do.
 */

export const PITCH = { L: 54, W: 36 };
export const TRACK = { r0: 19.5, lanes: 5, lane: 1.05 };
/** Goal mouth: width scaled with the pitch, height real (people are real size). */
export const GOAL = { w: 4.8, h: 2.44, d: 1.6 };

function netTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.strokeStyle = "rgba(255,255,255,0.9)";
  x.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 64);
    x.moveTo(0, i);
    x.lineTo(64, i);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 4);
  return t;
}

/** The ground's frame: centre, turn, and a point in it (l along the pitch, s across) in world x, z. */
export function groundFrame(world: World) {
  const g = world.green.find((x) => x.s === "ground");
  if (!g) return null;
  const o = obb(g.p);
  const cos = Math.cos(o.yaw);
  const sin = Math.sin(o.yaw);
  const at = (l: number, s: number): XZ => [o.x + cos * l + sin * s, o.z - sin * l + cos * s];
  return { ...o, at };
}

/** The floodlights' faces: dark by day, glowing from dusk (like the street lamps). */
function Floodlights({ lamps, yaw }: { lamps: XZ[]; yaw: number }) {
  const mat = useMemo(() => bend(new THREE.MeshToonMaterial({ color: "#000000", emissive: "#fff6dc", transparent: true, opacity: 0.25 })), []);
  const geo = useMemo(() => new THREE.BoxGeometry(2.9, 1.7, 0.1), []);
  useFrame(() => {
    mat.opacity = 0.25 + Math.min(1, curve.uNight.value * 2) * 0.75;
  });
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  return (
    <>
      {lamps.map(([x, z], i) => (
        <mesh key={i} geometry={geo} material={mat} position={[x, 18.4, z]} rotation-y={yaw} userData={{ noInk: true }} />
      ))}
    </>
  );
}

function ballTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f7f7f2";
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = "#1d1f24";
  for (const [px, py] of [
    [32, 64],
    [96, 30],
    [96, 98],
    [160, 64],
    [224, 30],
    [224, 98],
    [0, 10],
    [64, 6],
    [128, 122],
    [192, 6],
  ]) {
    x.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      x.lineTo(px! + Math.cos(a) * 14, py! + Math.sin(a) * 14);
    }
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A football to play with: walk or run into it to dribble and shoot. It rolls and slows, bounces off the edges of
 * the pitch, and a ball over the goal line between the posts is a goal (blue at one end, gold at the other); then it
 * goes back to the centre spot.
 */
function Ball({ frame, game, onGoal }: { frame: NonNullable<ReturnType<typeof groundFrame>>; game: React.RefObject<Game>; onGoal: (blue: number, gold: number) => void }) {
  const R = 0.22;
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => ballTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const st = useRef({ l: 0, s: 0, vl: 0, vs: 0, reset: 0, blue: 0, gold: 0 });
  const cos = Math.cos(frame.yaw);
  const sin = Math.sin(frame.yaw);
  // World x, z → the pitch's l (along) and s (across), and back.
  const toLocal = (x: number, z: number) => {
    const dx = x - frame.x;
    const dz = z - frame.z;
    return [dx * cos - dz * sin, dx * sin + dz * cos] as const;
  };
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const b = st.current;
    const g = game.current;
    const m = mesh.current;
    if (!m || !g) return;
    if (b.reset > 0) {
      b.reset -= dt;
      if (b.reset <= 0) Object.assign(b, { l: 0, s: 0, vl: 0, vs: 0 });
    }
    // The player's feet push the ball; the faster you go, the harder the kick.
    const [pl, ps] = toLocal(g.pos.x, g.pos.z);
    const dl = b.l - pl;
    const ds = b.s - ps;
    const d = Math.hypot(dl, ds);
    if (d < 0.9 && g.jumpY < 0.4) {
      const hl = Math.sin(g.heading) * cos - Math.cos(g.heading) * sin;
      const hs = Math.sin(g.heading) * sin + Math.cos(g.heading) * cos;
      const power = 1.5 + g.speed * 1.35;
      // Mostly where you're heading, a little away from your feet.
      const nl = d > 0.01 ? dl / d : hl;
      const ns = d > 0.01 ? ds / d : hs;
      b.vl = (hl * 0.9 + nl * 0.1) * power;
      b.vs = (hs * 0.9 + ns * 0.1) * power;
      b.l = pl + nl * 0.92;
      b.s = ps + ns * 0.92;
    }
    // Roll, slow down.
    const k = Math.exp(-dt * 0.85);
    b.vl *= k;
    b.vs *= k;
    b.l += b.vl * dt;
    b.s += b.vs * dt;
    const goalLine = PITCH.L / 2 - 1;
    const touch = PITCH.W / 2 - 0.6;
    if (b.reset <= 0 && Math.abs(b.l) > goalLine && Math.abs(b.s) < GOAL.w / 2 - R) {
      if (b.l > 0) b.blue++;
      else b.gold++;
      onGoal(b.blue, b.gold);
      b.reset = 2.2;
      b.vl *= 0.2;
      b.vs *= 0.2;
    }
    // The goal's back and the edges of the pitch keep it in play.
    const back = goalLine + (Math.abs(b.s) < GOAL.w / 2 ? GOAL.d : 0.6);
    if (Math.abs(b.l) > back) {
      b.l = Math.sign(b.l) * back;
      b.vl *= -0.45;
    }
    if (Math.abs(b.s) > touch) {
      b.s = Math.sign(b.s) * touch;
      b.vs *= -0.5;
    }
    const [x, z] = frame.at(b.l, b.s);
    // Spin about the axis across its path.
    const wx = x - m.position.x;
    const wz = z - m.position.z;
    const step = Math.hypot(wx, wz);
    if (step > 1e-4 && step < 2) {
      q.setFromAxisAngle(new THREE.Vector3(wz / step, 0, -wx / step), step / R);
      m.quaternion.premultiply(q);
    }
    m.position.set(x, R, z);
  });
  return (
    <mesh ref={mesh} castShadow material={toon({ map: tex })}>
      <sphereGeometry args={[R, 18, 12]} />
    </mesh>
  );
}

/** The goal nets: seen from both sides, see-through between the strings. */
const netMats = new WeakMap<THREE.Texture, THREE.Material>();
function netMaterial(t: THREE.Texture) {
  let m = netMats.get(t);
  if (!m) {
    m = bend(new THREE.MeshToonMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    netMats.set(t, m);
  }
  return m;
}

/** Several geometries as one (position and normal, plus uv for the net texture). */
function mergeAll(list: THREE.BufferGeometry[]) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.getAttribute("position").array as Float32Array));
    nrm.push(...(g.getAttribute("normal").array as Float32Array));
    uv.push(...(g.getAttribute("uv").array as Float32Array));
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/** Points round a stadium shape (two straights of length `straight`, two half circles of radius r), every ~step m. */
function stadium(straight: number, r: number, step = 2): [number, number][] {
  const pts: [number, number][] = [];
  const half = straight / 2;
  const nS = Math.max(2, Math.ceil(straight / step));
  const nC = Math.max(8, Math.ceil((Math.PI * r) / step));
  for (let i = 0; i < nS; i++) pts.push([-half + (straight * i) / nS, -r]);
  for (let i = 0; i < nC; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / nC;
    pts.push([half + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i < nS; i++) pts.push([half - (straight * i) / nS, r]);
  for (let i = 0; i < nC; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / nC;
    pts.push([-half + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** A closed band between radius r0 and r1 round the stadium shape, at height y (local l, s → x, z). */
function band(straight: number, r0: number, r1: number, y: number, at: (l: number, s: number) => XZ) {
  const inner = stadium(straight, r0);
  const outer = stadium(straight, r1);
  const pos: number[] = [];
  const idx: number[] = [];
  inner.forEach((p, i) => {
    const q = outer[i]!;
    const [ax, az] = at(p[0], p[1]);
    const [bx, bz] = at(q[0], q[1]);
    pos.push(ax, y, az, bx, y, bz);
    const n = inner.length;
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Face up, whichever way round the frame turned the points.
  if (g.getAttribute("normal").getY(0) < 0) {
    const ix = g.getIndex()!.array as unknown as number[];
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2]!, ix[i + 1]!];
    g.computeVertexNormals();
  }
  return g;
}

function pitchTexture() {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 720;
  const x = c.getContext("2d")!;
  // Mowing stripes.
  for (let i = 0; i < 12; i++) {
    x.fillStyle = i % 2 ? "#5f9e4d" : "#6aab56";
    x.fillRect((i * 1080) / 12, 0, 1080 / 12 + 1, 720);
  }
  const k = 1080 / PITCH.L; // pixels per metre
  const m = (v: number) => v * k;
  x.strokeStyle = "#f6f6f0";
  x.lineWidth = 5;
  x.strokeRect(m(1), m(1), 1080 - m(2), 720 - m(2));
  x.beginPath();
  x.moveTo(540, m(1));
  x.lineTo(540, 720 - m(1));
  x.stroke();
  x.beginPath();
  x.arc(540, 360, m(6), 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#f6f6f0";
  x.beginPath();
  x.arc(540, 360, 6, 0, Math.PI * 2);
  x.fill();
  for (const side of [0, 1]) {
    const edge = side ? 1080 - m(1) : m(1);
    const d = side ? -1 : 1;
    const box = (depth: number, width: number) => x.strokeRect(Math.min(edge, edge + d * m(depth)), 360 - m(width) / 2, m(depth), m(width));
    box(10.7, 26);
    box(3.6, 11.9);
    x.beginPath();
    x.arc(edge + d * m(7.1), 360, 6, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.arc(edge + d * m(7.1), 360, m(6), side ? Math.PI - 0.93 : -0.93, side ? Math.PI + 0.93 : 0.93, side === 1);
    x.save();
    x.beginPath();
    x.rect(side ? 0 : edge + d * m(10.7), 0, side ? edge + d * m(10.7) : 1080, 720);
    x.clip();
    x.beginPath();
    x.arc(edge + d * m(7.1), 360, m(6), 0, Math.PI * 2);
    x.stroke();
    x.restore();
    for (const cy of [m(1), 720 - m(1)]) {
      x.beginPath();
      x.arc(edge, cy, m(0.9), 0, Math.PI * 2);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function Stadium({ world, game, onGoal }: { world: World; game: React.RefObject<Game>; onGoal: (blue: number, gold: number) => void }) {
  const built = useMemo(() => {
    const f = groundFrame(world);
    if (!f) return null;
    const field = new THREE.PlaneGeometry(PITCH.L, PITCH.W, 27, 18);
    field.rotateX(-Math.PI / 2);
    const outerR = TRACK.r0 + TRACK.lanes * TRACK.lane;
    const track = band(PITCH.L, TRACK.r0, outerR, 0.07, f.at);
    const apron = band(PITCH.L, outerR, outerR + 1.4, 0.06, f.at);
    const lines = Array.from({ length: TRACK.lanes + 1 }, (_, i) => band(PITCH.L, TRACK.r0 + i * TRACK.lane - 0.05, TRACK.r0 + i * TRACK.lane + 0.05, 0.085, f.at));
    // The finish line across the lanes, at the end of the home straight.
    const fin = new THREE.PlaneGeometry(0.5, TRACK.lanes * TRACK.lane, 1, 4);
    fin.rotateX(-Math.PI / 2);
    // Goals (white posts and crossbar, a net behind) and corner flags.
    const b = newBuf();
    const white = new THREE.Color("#f7f7f2");
    const M = new THREE.Matrix4();
    const put = (geo: THREE.BufferGeometry, l: number, y: number, s: number, c: THREE.Color, rx = 0, rz = 0) => {
      const [x, z] = f.at(l, s);
      addGeo(b, geo, M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, f.yaw, rz, "YXZ")), new THREE.Vector3(1, 1, 1)), c);
    };
    const post = new THREE.CylinderGeometry(0.06, 0.06, GOAL.h, 8);
    const bar = new THREE.CylinderGeometry(0.06, 0.06, GOAL.w + 0.12, 8);
    const nets: THREE.BufferGeometry[] = [];
    for (const d of [-1, 1]) {
      const gl = d * (PITCH.L / 2 - 1);
      for (const s of [-GOAL.w / 2, GOAL.w / 2]) put(post, gl, GOAL.h / 2, s, white);
      put(bar, gl, GOAL.h, 0, white, Math.PI / 2);
      // Net: back, roof and two sides, as one bent strip each.
      const back = new THREE.PlaneGeometry(GOAL.w, GOAL.h, 4, 2);
      back.rotateY(Math.PI / 2);
      const [bx, bz] = f.at(gl + d * GOAL.d, 0);
      back.applyMatrix4(new THREE.Matrix4().makeRotationY(f.yaw)).translate(bx, GOAL.h / 2, bz);
      const roof = new THREE.PlaneGeometry(GOAL.d, GOAL.w, 2, 4);
      roof.rotateX(-Math.PI / 2);
      const [rx2, rz2] = f.at(gl + (d * GOAL.d) / 2, 0);
      roof.applyMatrix4(new THREE.Matrix4().makeRotationY(f.yaw)).translate(rx2, GOAL.h, rz2);
      nets.push(back, roof);
      for (const s of [-GOAL.w / 2, GOAL.w / 2]) {
        const side = new THREE.PlaneGeometry(GOAL.d, GOAL.h, 2, 2);
        const [sx, sz] = f.at(gl + (d * GOAL.d) / 2, s);
        side.applyMatrix4(new THREE.Matrix4().makeRotationY(f.yaw)).translate(sx, GOAL.h / 2, sz);
        nets.push(side);
      }
      // Corner flags.
      for (const s of [-(PITCH.W / 2 - 1), PITCH.W / 2 - 1]) {
        const cl = d * (PITCH.L / 2 - 1);
        put(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), cl, 0.75, s, white);
        put(new THREE.BoxGeometry(0.02, 0.35, 0.45), cl, 1.3, s + 0.24 * Math.sign(s) * -1, new THREE.Color("#ffd166"));
      }
    }
    const net = mergeAll(nets);

    // A covered stand along one side, outside the track: five rows of seats in SRM blue and gold, a roof on posts.
    const standS = TRACK.r0 + TRACK.lanes * TRACK.lane + 4;
    const standL = 36;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const sized = (l: number, y: number, s: number, sl: number, sy: number, ss: number, c: THREE.Color, tilt = 0) => {
      const [x, z] = f.at(l, s);
      addGeo(b, box, M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, f.yaw, 0, "YXZ")), new THREE.Vector3(sl, sy, ss)), c);
    };
    const concrete = new THREE.Color("#c9c3b6");
    for (let row = 0; row < 5; row++) {
      const y = 0.45 * (row + 1);
      const s = standS + row * 0.9;
      sized(0, y / 2, s, standL, y, 0.9, concrete);
      for (let k = 0; k < 18; k++) {
        const l = -standL / 2 + 1 + k * ((standL - 2) / 17);
        sized(l, y + 0.2, s - 0.1, 1.5, 0.4, 0.45, new THREE.Color((k + row) % 2 ? "#2c3e74" : "#e2b13c"));
      }
    }
    for (const l of [-standL / 2, -standL / 6, standL / 6, standL / 2]) sized(l, 3.1, standS + 4.4, 0.25, 6.2, 0.25, new THREE.Color("#5b6472"));
    sized(0, 6.3, standS + 2, standL + 2, 0.25, 6.4, new THREE.Color("#c8323d"), -0.12);

    // Floodlight towers at the four corners, outside the track.
    const lamps: XZ[] = [];
    const towerL = PITCH.L / 2 + TRACK.r0 * 0.75;
    const towerS = TRACK.r0 + TRACK.lanes * TRACK.lane + 3;
    for (const dl of [-1, 1])
      for (const ds of [-1, 1]) {
        sized(dl * towerL, 9, ds * towerS, 0.5, 18, 0.5, new THREE.Color("#7d8590"));
        sized(dl * towerL, 18.4, ds * towerS, 3.2, 2, 0.4, new THREE.Color("#3b4048"));
        lamps.push(f.at(dl * towerL - dl * 0.35, ds * towerS - ds * 0.35));
      }
    return { f, field, track, apron, lines, fin, tex: pitchTexture(), solid: toGeo(b), net, netTex: netTexture(), lamps };
  }, [world]);
  useEffect(
    () => () => {
      if (!built) return;
      for (const g of [built.field, built.track, built.apron, built.fin, built.solid, built.net, ...built.lines]) g.dispose();
      built.tex.dispose();
      built.netTex.dispose();
    },
    [built],
  );
  if (!built) return null;
  const { f } = built;
  const netMat = netMaterial(built.netTex);
  const finAt = f.at(PITCH.L / 2 - 4, -(TRACK.r0 + (TRACK.lanes * TRACK.lane) / 2));
  return (
    <group>
      <mesh geometry={built.field} material={toon({ map: built.tex })} position={[f.x, 0.06, f.z]} rotation-y={f.yaw} receiveShadow userData={{ noInk: true }} />
      <mesh geometry={built.apron} material={toon({ color: "#cfc6b4" })} receiveShadow userData={{ noInk: true }} />
      <mesh geometry={built.track} material={toon({ color: "#b5553c" })} receiveShadow userData={{ noInk: true }} />
      {built.lines.map((g, i) => (
        <mesh key={i} geometry={g} material={toon({ color: "#f6f2ea" })} userData={{ noInk: true }} />
      ))}
      <mesh geometry={built.solid} material={toon({ vertexColors: true })} castShadow receiveShadow />
      <mesh geometry={built.net} material={netMat} userData={{ noInk: true }} />
      <Floodlights lamps={built.lamps} yaw={f.yaw} />
      <Ball frame={f} game={game} onGoal={onGoal} />
      <mesh geometry={built.fin} material={toon({ color: "#f6f2ea" })} position={[finAt[0], 0.09, finAt[1]]} rotation-y={f.yaw} userData={{ noInk: true }} />
    </group>
  );
}
