"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Outfit } from "@/lib/walk/script";
import { toon } from "./curve";

/**
 * An anime-style student (our own design), built in code: real proportions (about 1.75 m, seven heads tall), a face
 * drawn onto the head, bangs and locks of hair, and joints at the hips, knees, shoulders and elbows so it walks, runs,
 * waves, nods and cheers. Drawn with flat cel colours; the ink pass (Ink.tsx) adds the outlines. Everything in the
 * outfit screen is a colour or a visible part, so a change costs nothing to load.
 */

/**
 * air: 0 on the ground … 1 in the middle of a jump (knees tucked, arms out). dance: seconds of dancing left.
 * loop: what someone keeps doing while standing still, once their club quest is done.
 */
export type Loop = "" | "dance" | "strum" | "paint" | "stargaze" | "game";
export type Anim = { speed: number; wave: number; cheer: number; talk: number; look: number; air: number; dance: number; loop: Loop };
export const newAnim = (): Anim => ({ speed: 0, wave: 0, cheer: 0, talk: 0, look: 0, air: 0, dance: 0, loop: "" });

export const PALETTE = {
  skin: ["#f6dcc8", "#e8bf9f", "#cf9a72", "#b07a54", "#8d5b3c", "#65412a"],
  hairColor: ["#231e28", "#40302a", "#6e3423", "#9d9ba3", "#5b4232"],
  // [main, accent] per top: SRM navy+gold, Camber Racing, lab coat, kurta, hoodie, NCC, jersey, plain tee
  top: [
    ["#2c3e74", "#e2b13c"],
    ["#c8323d", "#22252b"],
    ["#f1f1ec", "#9fb8cc"],
    ["#d77c5b", "#efd29a"],
    ["#6d5a8e", "#4e4068"],
    ["#7d7650", "#55502f"],
    ["#2f8f86", "#f4f4f4"],
    ["#e9a25d", "#c96f45"],
  ],
  bottom: ["#45608a", "#2e3138", "#a85f6f", "#8f8a62"],
  shoes: ["#f0f0ea", "#7a5236", "#33292a", "#b9373a"],
  bag: ["#000000", "#3d5a6c", "#e2b13c", "#6d597a"],
};
export const OUTFIT_SIZES: Record<keyof Outfit, number> = { hair: 6, hairColor: 5, skin: 6, top: 8, bottom: 4, shoes: 4, bag: 4 };
export const DEFAULT_OUTFIT: Outfit = { skin: 2, hair: 0, hairColor: 0, top: 0, bottom: 0, shoes: 0, bag: 1 };

// ── Shared geometry (metres) ──
const cyl = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const G = {
  head: (() => {
    const g = new THREE.SphereGeometry(0.138, 24, 18);
    g.scale(1, 1.1, 1.04);
    return g;
  })(),
  face: (() => {
    const g = new THREE.SphereGeometry(0.1394, 24, 18);
    g.scale(1, 1.1, 1.04);
    return g;
  })(),
  ear: new THREE.SphereGeometry(0.028, 8, 6),
  neck: cyl(0.045, 0.05, 0.11),
  torso: (() => {
    // A shaped torso: waist, chest, shoulders, turned on a lathe and flattened front to back.
    const prof = [
      [0.0, -0.01],
      [0.152, -0.01],
      [0.158, 0.08],
      [0.168, 0.22],
      [0.188, 0.36],
      [0.196, 0.43],
      [0.17, 0.49],
      [0.09, 0.53],
      [0.0, 0.535],
    ].map(([r, y]) => new THREE.Vector2(r!, y!));
    const g = new THREE.LatheGeometry(prof, 18);
    g.scale(1, 1, 0.66);
    g.translate(0, -0.25, 0);
    return g;
  })(),
  hips: (() => {
    const g = cyl(0.155, 0.165, 0.16, 16);
    g.scale(1, 1, 0.72);
    return g;
  })(),
  shoulder: new THREE.SphereGeometry(0.072, 12, 10),
  coat: (() => {
    const g = cyl(0.15, 0.2, 0.42, 12);
    g.scale(1, 1, 0.7);
    return g;
  })(),
  skirt: cyl(0.15, 0.24, 0.5, 12),
  collar: (() => {
    const g = new THREE.TorusGeometry(0.06, 0.018, 6, 14);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  stripe: (() => {
    const g = cyl(0.193, 0.185, 0.05, 12);
    g.scale(1, 1, 0.69);
    return g;
  })(),
  hood: (() => {
    const g = new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI);
    return g;
  })(),
  sleeve: cyl(0.068, 0.062, 0.15),
  upper: new THREE.CapsuleGeometry(0.052, 0.2, 4, 10),
  fore: new THREE.CapsuleGeometry(0.044, 0.18, 4, 10),
  hand: (() => {
    const g = new THREE.SphereGeometry(0.042, 8, 6);
    g.scale(0.85, 1.15, 0.7);
    return g;
  })(),
  thigh: new THREE.CapsuleGeometry(0.085, 0.3, 4, 12),
  shortsLeg: cyl(0.1, 0.09, 0.26, 14),
  shin: new THREE.CapsuleGeometry(0.06, 0.3, 4, 12),
  sock: cyl(0.053, 0.05, 0.06),
  shoe: (() => {
    const g = new THREE.CapsuleGeometry(0.052, 0.14, 4, 10);
    g.rotateX(Math.PI / 2);
    g.scale(1, 0.72, 1);
    g.translate(0, 0.012, 0.035);
    return g;
  })(),
  sole: (() => {
    const g = new THREE.BoxGeometry(0.108, 0.025, 0.26);
    g.translate(0, -0.03, 0.035);
    return g;
  })(),
  // Hair
  cap: (() => {
    const g = new THREE.SphereGeometry(0.151, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    g.scale(1.02, 1.12, 1.08);
    return g;
  })(),
  buzz: (() => {
    const g = new THREE.SphereGeometry(0.143, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
    g.scale(1, 1.12, 1.05);
    return g;
  })(),
  lock: (() => {
    const g = new THREE.ConeGeometry(0.034, 0.12, 4);
    g.rotateX(Math.PI); // point down
    g.scale(1, 1, 0.45);
    return g;
  })(),
  bun: new THREE.SphereGeometry(0.06, 10, 8),
  sheet: (() => {
    const g = new THREE.BoxGeometry(0.25, 0.32, 0.06, 2, 3, 1);
    return g;
  })(),
  tail: (() => {
    const g = new THREE.CapsuleGeometry(0.035, 0.18, 4, 8);
    return g;
  })(),
  curl: new THREE.SphereGeometry(0.052, 8, 6),
  // Bags
  pack: (() => {
    const g = new THREE.CapsuleGeometry(0.13, 0.12, 6, 12);
    g.scale(1.05, 1, 0.5);
    return g;
  })(),
  pocket: (() => {
    const g = new THREE.CapsuleGeometry(0.08, 0.04, 4, 10);
    g.scale(1.1, 1, 0.45);
    return g;
  })(),
  strap: new THREE.BoxGeometry(0.035, 0.36, 0.02),
  tote: new THREE.BoxGeometry(0.05, 0.3, 0.26),
  sling: new THREE.BoxGeometry(0.2, 0.14, 0.07),
  blob: new THREE.CircleGeometry(0.34, 18),
};

/** The face, drawn once per brow colour: anime eyes with a heavy upper lash line, brows, a nose tick and a small mouth. */
const faces = new Map<string, THREE.CanvasTexture>();
function faceTexture(brow: string) {
  const hit = faces.get(brow);
  if (hit) return hit;
  const W = 512;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const cx = W * 0.25; // the front of the head
  const ink = "#2a2230";
  x.lineCap = "round";
  x.lineJoin = "round";
  for (const s of [-1, 1]) {
    const ex = cx + s * 27;
    const ey = 120;
    // Eye white
    x.fillStyle = "#fbf8f4";
    x.beginPath();
    x.ellipse(ex, ey + 3, 12, 9, 0, 0, Math.PI * 2);
    x.fill();
    // Iris and pupil
    x.fillStyle = "#3b2a2e";
    x.beginPath();
    x.ellipse(ex + s * 1.5, ey + 4, 7.5, 9.5, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#1b1418";
    x.beginPath();
    x.ellipse(ex + s * 1.5, ey + 5, 3.8, 5, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(ex + s * 1.5 - 3, ey, 2.4, 0, Math.PI * 2);
    x.fill();
    // Upper lash line, heavy at the outer corner
    x.strokeStyle = ink;
    x.lineWidth = 4.2;
    x.beginPath();
    x.moveTo(ex - s * 13, ey + 1);
    x.quadraticCurveTo(ex, ey - 9, ex + s * 14, ey - 2);
    x.stroke();
    x.lineWidth = 2.2;
    x.beginPath();
    x.moveTo(ex + s * 13, ey - 2);
    x.lineTo(ex + s * 17, ey - 5);
    x.stroke();
    // Brow
    x.strokeStyle = brow;
    x.lineWidth = 3.4;
    x.beginPath();
    x.moveTo(ex - s * 11, ey - 17);
    x.quadraticCurveTo(ex, ey - 21, ex + s * 12, ey - 18);
    x.stroke();
    // A touch of blush
    x.fillStyle = "rgba(232,120,110,0.22)";
    x.beginPath();
    x.ellipse(ex + s * 6, ey + 26, 11, 5, 0, 0, Math.PI * 2);
    x.fill();
  }
  // Nose tick and mouth
  x.strokeStyle = "rgba(60,40,40,0.55)";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(cx + 2, 138);
  x.lineTo(cx - 1, 146);
  x.stroke();
  x.strokeStyle = ink;
  x.lineWidth = 2.6;
  x.beginPath();
  x.moveTo(cx - 8, 160);
  x.quadraticCurveTo(cx, 163, cx + 8, 160);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faces.set(brow, t);
  return t;
}
const faceMats = new Map<string, THREE.Material>();
const faceMaterial = (brow: string) => {
  const hit = faceMats.get(brow);
  if (hit) return hit;
  const m = toon({ color: "#ffffff" }).clone() as THREE.MeshToonMaterial;
  m.map = faceTexture(brow);
  m.transparent = true;
  m.depthWrite = false;
  m.onBeforeCompile = toon({ color: "#ffffff" }).onBeforeCompile;
  m.customProgramCacheKey = toon({ color: "#ffffff" }).customProgramCacheKey;
  faceMats.set(brow, m);
  return m;
};

/** Bangs: locks fanned across the forehead (and sides), angled outward. */
const FRINGE: [number, number, number, number][] = [
  // x, y, z (on the head), tilt
  [-0.083, 0.083, 0.116, 0.35],
  [-0.039, 0.094, 0.132, 0.12],
  [0.005, 0.097, 0.137, -0.05],
  [0.05, 0.092, 0.13, -0.2],
  [0.094, 0.077, 0.11, -0.42],
  [-0.132, 0.022, 0.055, 0.25],
  [0.132, 0.022, 0.055, -0.25],
];

/** Volume at the back and sides: locks that fall from the crown. */
const BACK: [number, number, number, number, number][] = [
  [-0.1, 0.0, -0.09, 0.45, 0.25],
  [-0.04, 0.0, -0.13, 0.5, 0.1],
  [0.03, 0.0, -0.135, 0.5, -0.08],
  [0.09, 0.0, -0.1, 0.45, -0.25],
  [-0.145, 0.03, -0.02, 0.15, 0.3],
  [0.145, 0.03, -0.02, 0.15, -0.3],
];

export function Character({ outfit, anim, scale = 1, blob = false }: { outfit: Outfit; anim: React.RefObject<Anim>; scale?: number; blob?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 6);
  const time = useRef(Math.random() * 10);
  const amt = useRef(0);

  const m = useMemo(() => {
    const [top, accent] = PALETTE.top[outfit.top] ?? PALETTE.top[0]!;
    const hair = PALETTE.hairColor[outfit.hairColor]!;
    return {
      skin: toon({ color: PALETTE.skin[outfit.skin] }),
      hair: toon({ color: hair }),
      face: faceMaterial(hair),
      top: toon({ color: top }),
      accent: toon({ color: accent }),
      bottom: toon({ color: PALETTE.bottom[outfit.bottom] }),
      sock: toon({ color: "#f2f2ee" }),
      shoes: toon({ color: PALETTE.shoes[outfit.shoes] }),
      bag: toon({ color: PALETTE.bag[outfit.bag] }),
      strap: toon({ color: "#3a3f46" }),
      blob: toon({ color: "#000000", transparent: true, opacity: 0.18 }),
    };
  }, [outfit]);

  useEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noInk) o.castShadow = true;
    });
  }, [outfit]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const a = anim.current;
    time.current += dt;
    const t = time.current;
    const target = Math.min(1, a.speed / 3.5);
    amt.current += (target - amt.current) * Math.min(1, dt * 8);
    const k = amt.current;
    const run = a.speed > 6 ? 1.3 : 1;
    phase.current += dt * (1.6 + a.speed * 1.75);
    const s = Math.sin(phase.current);
    if (legL.current && legR.current && kneeL.current && kneeR.current) {
      legL.current.rotation.x = s * 0.62 * k * run;
      legR.current.rotation.x = -s * 0.62 * k * run;
      kneeL.current.rotation.x = Math.max(0, -Math.sin(phase.current + 0.9)) * 0.95 * k * run;
      kneeR.current.rotation.x = Math.max(0, Math.sin(phase.current + 0.9)) * 0.95 * k * run;
    }
    let jump = 0;
    if (armL.current && armR.current && elbowL.current && elbowR.current) {
      armL.current.rotation.x = -s * 0.55 * k * run;
      armR.current.rotation.x = s * 0.55 * k * run;
      armL.current.rotation.z = -0.08 - Math.sin(t * 1.6) * 0.015;
      armR.current.rotation.z = 0.08 + Math.sin(t * 1.6) * 0.015;
      elbowL.current.rotation.x = -(0.18 + k * 0.45 * run);
      elbowR.current.rotation.x = -(0.18 + k * 0.45 * run);
      if (a.wave > 0) {
        a.wave -= dt;
        armR.current.rotation.z = 2.7;
        armR.current.rotation.x = 0;
        elbowR.current.rotation.x = -0.5 + Math.sin(t * 12) * 0.35;
      }
      if (a.cheer > 0) {
        a.cheer -= dt;
        armL.current.rotation.z = -2.8;
        armR.current.rotation.z = 2.8;
        armL.current.rotation.x = armR.current.rotation.x = 0;
        elbowL.current.rotation.x = elbowR.current.rotation.x = -0.2;
        jump = Math.abs(Math.sin(t * 9)) * 0.22;
      }
    }
    // In the air: one knee tucked up, the other trailing, arms thrown out.
    const air = a.air;
    if (air > 0.01 && legL.current && legR.current && kneeL.current && kneeR.current && armL.current && armR.current) {
      const mix = THREE.MathUtils.lerp;
      legL.current.rotation.x = mix(legL.current.rotation.x, -0.75, air);
      legR.current.rotation.x = mix(legR.current.rotation.x, 0.2, air);
      kneeL.current.rotation.x = mix(kneeL.current.rotation.x, 1.25, air);
      kneeR.current.rotation.x = mix(kneeR.current.rotation.x, 0.6, air);
      armL.current.rotation.z = mix(armL.current.rotation.z, -1.15, air);
      armR.current.rotation.z = mix(armR.current.rotation.z, 1.15, air);
      armL.current.rotation.x = mix(armL.current.rotation.x, -0.35, air);
      armR.current.rotation.x = mix(armR.current.rotation.x, -0.35, air);
    }
    if (body.current) body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.045 * k * run * (1 - air) + Math.sin(t * 2) * 0.004 + jump;
    if (torso.current) {
      torso.current.rotation.x = 0.07 * k * run;
      torso.current.rotation.y = s * 0.07 * k;
    }
    if (head.current) {
      head.current.rotation.y += (Math.max(-1, Math.min(1, a.look)) - head.current.rotation.y) * Math.min(1, dt * 6);
      head.current.rotation.x = a.talk > 0 ? Math.sin(t * 7) * 0.07 : Math.sin(t * 1.3) * 0.015;
      if (a.talk > 0) a.talk -= dt;
    }
    if (body.current) body.current.rotation.z = 0;

    // ── Standing loops: dancing, strumming a guitar, painting, stargazing, gaming ──
    if (a.dance > 0) a.dance = k > 0.3 ? 0 : a.dance - dt; // walking off ends the dance
    const loop: Loop = a.dance > 0 ? "dance" : a.loop;
    const arms = armL.current && armR.current && elbowL.current && elbowR.current;
    if (!loop || k > 0.3 || a.wave > 0 || a.cheer > 0 || air > 0.01 || !arms || !legL.current || !legR.current || !kneeL.current || !kneeR.current) return;
    const [aL, aR, eL, eR] = [armL.current!, armR.current!, elbowL.current!, elbowR.current!];
    if (loop === "dance") {
      // About 120 beats a minute: bounce on every beat, sway and swap arms every two.
      const b = t * Math.PI * 4;
      const sw = Math.sin(b / 2);
      aL.rotation.set(-0.3, 0, -(1.7 + sw * 0.9));
      aR.rotation.set(-0.3, 0, 1.7 - sw * 0.9);
      eL.rotation.x = -0.7 - Math.cos(b) * 0.4;
      eR.rotation.x = -0.7 + Math.cos(b) * 0.4;
      legL.current!.rotation.x = Math.sin(b) * 0.28;
      legR.current!.rotation.x = -Math.sin(b) * 0.28;
      kneeL.current!.rotation.x = Math.max(0, Math.sin(b)) * 0.7;
      kneeR.current!.rotation.x = Math.max(0, -Math.sin(b)) * 0.7;
      if (body.current) {
        body.current.position.y = Math.abs(Math.sin(b)) * 0.09;
        body.current.rotation.z = sw * 0.1;
      }
      if (torso.current) torso.current.rotation.y = sw * 0.4;
      if (head.current) head.current.rotation.x = Math.sin(b) * 0.1;
    } else if (loop === "strum") {
      // One hand on the neck, the other strumming across the body, nodding to the beat.
      aL.rotation.set(-0.85, 0, -0.55);
      eL.rotation.x = -0.75;
      aR.rotation.set(-0.35, 0, 0.3);
      eR.rotation.x = -1.35 + Math.sin(t * 11) * 0.22;
      if (head.current) head.current.rotation.x = 0.12 + Math.sin(t * 4.2) * 0.08;
      if (body.current) body.current.position.y = Math.abs(Math.sin(t * 4.2)) * 0.02;
    } else if (loop === "paint") {
      // Brush hand out to the easel, small strokes; the other hand holds the palette.
      aR.rotation.set(-1.15 + Math.sin(t * 2.6) * 0.12, 0, 0.55 + Math.sin(t * 1.7) * 0.1);
      eR.rotation.x = -0.35 + Math.sin(t * 5) * 0.18;
      aL.rotation.set(-0.5, 0, -0.25);
      eL.rotation.x = -1.2;
      if (head.current) head.current.rotation.y = -0.45;
    } else if (loop === "stargaze") {
      // A hand on the telescope, looking up at the sky.
      aR.rotation.set(-0.75, 0, 0.45);
      eR.rotation.x = -0.4;
      if (head.current) {
        head.current.rotation.x = -0.38 + Math.sin(t * 0.7) * 0.04;
        head.current.rotation.y = -0.3;
      }
    } else if (loop === "game") {
      // Both hands on a controller, thumbs busy, leaning in at the screen.
      aL.rotation.set(-0.75, 0, 0.28);
      aR.rotation.set(-0.75, 0, -0.28);
      eL.rotation.x = -0.95 + Math.sin(t * 13) * 0.05;
      eR.rotation.x = -0.95 + Math.cos(t * 15) * 0.05;
      if (head.current) {
        head.current.rotation.x = 0.15;
        head.current.rotation.y = -0.55;
      }
      if (torso.current) torso.current.rotation.y = -0.2 + Math.sin(t * 3) * 0.04;
    }
  });

  const longTop = outfit.top === 2 || outfit.top === 3;
  const skirt = outfit.bottom === 2;
  const shorts = outfit.bottom === 3;
  const longSleeves = outfit.top === 2 || outfit.top === 4 || outfit.top === 5;
  const hair = outfit.hair;

  const leg = (side: -1 | 1) => (
    <group ref={side < 0 ? legL : legR} position={[side * 0.095, 0.9, 0]}>
      {shorts ? <mesh geometry={G.shortsLeg} material={m.bottom} position-y={-0.13} /> : null}
      <mesh geometry={G.thigh} material={skirt ? m.skin : shorts ? m.skin : m.bottom} position-y={-0.22} />
      <group ref={side < 0 ? kneeL : kneeR} position-y={-0.42}>
        <mesh geometry={G.shin} material={shorts || skirt ? m.skin : m.bottom} position-y={-0.2} />
        <mesh geometry={G.sock} material={m.sock} position-y={-0.38} />
        <mesh geometry={G.shoe} material={m.shoes} position-y={-0.44} />
        <mesh geometry={G.sole} material={m.sock} position-y={-0.44} />
      </group>
    </group>
  );
  const arm = (side: -1 | 1) => (
    <group ref={side < 0 ? armL : armR} position={[side * 0.215, 0.44, 0]}>
      <mesh geometry={G.shoulder} material={m.top} />
      <mesh geometry={G.sleeve} material={m.top} position-y={-0.06} />
      <mesh geometry={G.upper} material={longSleeves ? m.top : m.skin} position-y={-0.14} />
      <group ref={side < 0 ? elbowL : elbowR} position-y={-0.28}>
        <mesh geometry={G.fore} material={longSleeves ? m.top : m.skin} position-y={-0.12} />
        <mesh geometry={G.hand} material={m.skin} position-y={-0.27} />
      </group>
    </group>
  );

  return (
    <group ref={root} scale={scale}>
      {blob ? <mesh geometry={G.blob} material={m.blob} rotation-x={-Math.PI / 2} position-y={0.03} userData={{ noInk: true }} /> : null}
      <group ref={body}>
        {leg(-1)}
        {leg(1)}
        <group ref={torso} position-y={0.92}>
          <mesh geometry={G.torso} material={m.top} position-y={0.24} />
          <mesh geometry={G.hips} material={skirt ? m.bottom : m.bottom} position-y={-0.02} />
          {outfit.top === 0 || outfit.top === 6 ? <mesh geometry={G.stripe} material={m.accent} position-y={0.3} /> : null}
          {outfit.top === 1 ? <mesh geometry={G.stripe} material={m.accent} position-y={0.12} /> : null}
          {longTop ? <mesh geometry={G.coat} material={m.top} position-y={-0.12} /> : null}
          {skirt ? <mesh geometry={G.skirt} material={m.bottom} position-y={-0.18} /> : null}
          {outfit.top === 4 ? <mesh geometry={G.hood} material={m.accent} position={[0, 0.5, -0.07]} rotation-x={-0.4} /> : null}
          <mesh geometry={G.collar} material={outfit.top === 3 ? m.accent : m.top} position-y={0.49} />
          {/* Bag */}
          {outfit.bag === 1 ? (
            <>
              <mesh geometry={G.pack} material={m.bag} position={[0, 0.27, -0.17]} />
              <mesh geometry={G.pocket} material={m.bag} position={[0, 0.17, -0.235]} />
              <mesh geometry={G.strap} material={m.strap} position={[-0.085, 0.3, 0.075]} rotation-x={0.1} />
              <mesh geometry={G.strap} material={m.strap} position={[0.085, 0.3, 0.075]} rotation-x={0.1} />
            </>
          ) : null}
          {outfit.bag === 2 ? <mesh geometry={G.tote} material={m.bag} position={[0.2, 0.0, 0]} /> : null}
          {outfit.bag === 3 ? <mesh geometry={G.sling} material={m.bag} position={[-0.12, 0.04, 0.12]} rotation-z={0.25} /> : null}
          {arm(-1)}
          {arm(1)}
          {/* Neck and head */}
          <mesh geometry={G.neck} material={m.skin} position-y={0.54} />
          <group ref={head} position-y={0.7}>
            <mesh geometry={G.head} material={m.skin} />
            <mesh geometry={G.face} material={m.face} userData={{ noInk: true }} />
            <mesh geometry={G.ear} material={m.skin} position={[-0.14, 0, 0]} />
            <mesh geometry={G.ear} material={m.skin} position={[0.14, 0, 0]} />
            {hair === 5 ? (
              <mesh geometry={G.buzz} material={m.hair} position={[0, 0.012, -0.004]} rotation-x={-0.18} />
            ) : (
              <mesh geometry={G.cap} material={m.hair} position={[0, 0.012, -0.012]} rotation-x={-0.3} />
            )}
            {hair !== 5
              ? FRINGE.map(([x, y, z, tilt], i) => (
                  <mesh key={i} geometry={G.lock} material={m.hair} position={[x, y, z]} rotation={[-0.35, 0, tilt]} />
                ))
              : null}
            {hair !== 5 && hair !== 2
              ? BACK.map(([x, y, z, rx, rz], i) => <mesh key={`b${i}`} geometry={G.lock} material={m.hair} position={[x, y, z]} rotation={[rx, 0, rz]} />)
              : null}
            {hair === 1 ? <mesh geometry={G.bun} material={m.hair} position={[0, 0.12, -0.11]} /> : null}
            {hair === 2 ? <mesh geometry={G.sheet} material={m.hair} position={[0, -0.12, -0.1]} rotation-x={0.12} /> : null}
            {hair === 3 ? <mesh geometry={G.tail} material={m.hair} position={[0, -0.03, -0.18]} rotation-x={0.45} /> : null}
            {hair === 4
              ? [
                  [-0.1, 0.1, 0.02],
                  [0.1, 0.1, 0.02],
                  [0, 0.15, -0.02],
                  [-0.08, 0.07, -0.1],
                  [0.08, 0.07, -0.1],
                  [0, 0.06, -0.14],
                ].map((p, i) => <mesh key={i} geometry={G.curl} material={m.hair} position={p as [number, number, number]} />)
              : null}
          </group>
        </group>
      </group>
    </group>
  );
}
