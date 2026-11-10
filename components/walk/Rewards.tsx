"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "@/lib/walk/world";
import type { Loop } from "./Character";
import { bend, toon } from "./curve";
import type { Npc } from "./Scene";

/**
 * What a finished club quest leaves behind on campus, so you can see what you did: the dancer keeps dancing, the
 * painting stands on its easel, the guitar plays, the telescope is up, and so on. Everything is built in code in
 * the walk's toon style. People's props sit in a group facing the way they face; held things move with them.
 */

/** Who keeps doing what once their quest is done. */
export const QUEST_LOOPS: Record<string, [quest: string, loop: Loop]> = {
  dancer: ["dance-practice", "dance"],
  musician: ["jam-session", "strum"],
  creative: ["sketch-walk", "paint"],
  astro: ["star-party", "stargaze"],
  gamer: ["lan-night", "game"],
};

const GOLD = "#e2b13c";
const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
/** A screen or a light: it glows (all emissive, nothing lit), and still bends with the world. Its own material, so
 * its colour and opacity can change every frame. */
const glow = (o: { map?: THREE.Texture; color?: THREE.ColorRepresentation; transparent?: boolean; opacity?: number }) =>
  bend(
    new THREE.MeshToonMaterial({
      color: "#000000",
      emissive: o.color ?? "#ffffff",
      emissiveMap: o.map ?? null,
      map: o.transparent ? (o.map ?? null) : null, // the map's alpha cuts the shape out
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      depthWrite: !o.transparent,
    }),
  );

// ── The painting: the arch gate and the clock tower at sunset, in thick strokes ──
function paintingTexture() {
  return tex(512, 384, (x) => {
    const sky = x.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, "#5b5bb5");
    sky.addColorStop(0.5, "#ff8a8a");
    sky.addColorStop(1, "#ffc56b");
    x.fillStyle = sky;
    x.fillRect(0, 0, 512, 384);
    x.fillStyle = "#fff2b3";
    x.beginPath();
    x.arc(392, 196, 44, 0, Math.PI * 2);
    x.fill();
    // Brush strokes over the sky.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`;
      x.lineWidth = 4 + rnd() * 8;
      x.lineCap = "round";
      const sx = rnd() * 512;
      const sy = rnd() * 250;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx + 30 + rnd() * 50, sy + (rnd() - 0.5) * 8);
      x.stroke();
    }
    // Ground.
    x.fillStyle = "#4f8a4b";
    x.fillRect(0, 262, 512, 122);
    x.fillStyle = "#3d7040";
    for (let i = 0; i < 40; i++) x.fillRect(rnd() * 512, 262 + rnd() * 120, 18 + rnd() * 30, 5);
    x.fillStyle = "#c9b79c";
    x.beginPath();
    x.moveTo(230, 384);
    x.lineTo(270, 262);
    x.lineTo(296, 262);
    x.lineTo(330, 384);
    x.fill();
    // The arch gate on the left: two piers and the arch.
    x.fillStyle = "#f3ead8";
    x.fillRect(40, 150, 26, 112);
    x.fillRect(150, 150, 26, 112);
    x.fillRect(32, 132, 152, 22);
    x.strokeStyle = "#f3ead8";
    x.lineWidth = 14;
    x.beginPath();
    x.arc(108, 172, 44, Math.PI, 0);
    x.stroke();
    x.fillStyle = "#8a2432";
    x.fillRect(60, 136, 96, 12);
    // The clock tower in the middle.
    x.fillStyle = "#f5df9a";
    x.fillRect(270, 120, 34, 142);
    x.fillStyle = "#ffffff";
    x.fillRect(264, 112, 46, 10);
    x.fillStyle = "#e9c46a";
    x.beginPath();
    x.arc(287, 112, 22, Math.PI, 0);
    x.fill();
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(287, 140, 11, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#1d2330";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(287, 140);
    x.lineTo(287, 132);
    x.moveTo(287, 140);
    x.lineTo(293, 142);
    x.stroke();
    // A palm and a signature.
    x.strokeStyle = "#6b4b2a";
    x.lineWidth = 7;
    x.beginPath();
    x.moveTo(460, 262);
    x.quadraticCurveTo(452, 210, 462, 170);
    x.stroke();
    x.fillStyle = "#2f6e3a";
    for (let a = 0; a < 6; a++) {
      x.beginPath();
      x.ellipse(462 + Math.cos(a) * 26, 168 + Math.sin(a * 2) * 6, 30, 8, a * 0.55, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "rgba(30,30,40,0.7)";
    x.font = "italic 20px Georgia, serif";
    x.fillText("SRM '26", 420, 368);
  });
}

// ── A game on the LAN-night screen ──
function gameTexture() {
  return tex(256, 150, (x) => {
    x.fillStyle = "#14122b";
    x.fillRect(0, 0, 256, 150);
    x.fillStyle = "#2b2560";
    for (let i = 0; i < 30; i++) x.fillRect((i * 53) % 256, (i * 37) % 90, 2, 2);
    x.fillStyle = "#38d39f";
    x.fillRect(10, 118, 90, 10);
    x.fillRect(120, 96, 60, 10);
    x.fillRect(196, 74, 50, 10);
    x.fillStyle = "#ffd166";
    x.fillRect(140, 80, 12, 16);
    x.fillStyle = "#ff5d73";
    x.fillRect(214, 58, 14, 14);
    x.fillStyle = "#ffffff";
    x.font = "bold 18px monospace";
    x.fillText("LEVEL UP", 10, 24);
    x.font = "12px monospace";
    x.fillText("SCORE 004200", 150, 22);
  });
}

function bannerTexture(text: string, bg: string) {
  return tex(256, 64, (x) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, 256, 64);
    x.fillStyle = "#ffffff";
    x.font = "bold 30px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 128, 34);
  });
}

function noteTexture() {
  return tex(64, 64, (x) => {
    x.fillStyle = GOLD;
    x.font = "bold 52px serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("♪", 32, 34);
  });
}

/** Music notes floating up and fading, always turned to the camera. */
function Notes({ y = 1.9, count = 4 }: { y?: number; count?: number }) {
  const { camera } = useThree();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(() => Array.from({ length: count }, () => glow({ map: noteTexture(), transparent: true })), [count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.35 + i / count) % 1;
      m.position.set(Math.sin(t * 1.4 + i * 2) * 0.35 + (i % 2 ? 0.25 : -0.25), y + p * 1.4, 0);
      m.quaternion.copy(camera.quaternion);
      if (m.parent) m.quaternion.premultiply(m.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
      (m.material as THREE.MeshToonMaterial).opacity = Math.sin(p * Math.PI);
    });
  });
  return (
    <group userData={{ noInk: true }}>
      {mats.map((mat, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} material={mat} userData={{ noInk: true }}>
          <planeGeometry args={[0.32, 0.32]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Things people hold (inside their own group, so they turn with them) ──
export function Held({ id, done }: { id: string; done: string[] }) {
  const wood = toon({ color: "#c2703d" });
  const dark = toon({ color: "#4a2f1d" });
  const black = toon({ color: "#1b1b22" });
  if (id === "musician" && done.includes("jam-session")) {
    return (
      <group position={[0.02, 1.0, 0.2]} rotation-z={1.0}>
        <mesh material={wood} position-y={-0.1} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.17, 0.17, 0.08, 20]} />
        </mesh>
        <mesh material={wood} position-y={0.08} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.13, 0.13, 0.08, 20]} />
        </mesh>
        <mesh material={black} position={[0, -0.02, 0.041]}>
          <circleGeometry args={[0.05, 16]} />
        </mesh>
        <mesh material={dark} position-y={0.38}>
          <boxGeometry args={[0.05, 0.5, 0.03]} />
        </mesh>
        <mesh material={dark} position-y={0.67}>
          <boxGeometry args={[0.08, 0.12, 0.03]} />
        </mesh>
      </group>
    );
  }
  if (id === "gamer" && done.includes("lan-night")) {
    return (
      <mesh material={black} position={[0, 1.02, 0.36]}>
        <boxGeometry args={[0.18, 0.05, 0.09]} />
      </mesh>
    );
  }
  return null;
}

// ── Things that stand next to people, facing the way they face ──
function Easel() {
  const wood = toon({ color: "#9a6a3d" });
  const art = useMemo(() => toon({ map: paintingTexture() }), []);
  return (
    <group position={[1.05, 0, 0.55]} rotation-y={-0.35}>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} material={wood} position={[x, 0.85, 0.08]} rotation={[-0.12, 0, x > 0 ? -0.08 : 0.08]}>
          <boxGeometry args={[0.05, 1.75, 0.05]} />
        </mesh>
      ))}
      <mesh material={wood} position={[0, 0.8, -0.32]} rotation-x={0.35}>
        <boxGeometry args={[0.05, 1.7, 0.05]} />
      </mesh>
      <mesh material={wood} position={[0, 0.92, 0.16]}>
        <boxGeometry args={[1.1, 0.05, 0.12]} />
      </mesh>
      <mesh material={toon({ color: "#f4efe4" })} position={[0, 1.36, 0.12]} rotation-x={-0.12}>
        <boxGeometry args={[1.08, 0.82, 0.04]} />
      </mesh>
      <mesh material={art} position={[0, 1.36, 0.145]} rotation-x={-0.12}>
        <planeGeometry args={[1.0, 0.75]} />
      </mesh>
      {/* A paint palette and a jar of brushes on the ground. */}
      <mesh material={toon({ color: "#d9b38c" })} position={[-0.75, 0.04, 0.3]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.22, 20]} />
      </mesh>
      {["#e63946", "#2a9d8f", "#ffd166", "#457b9d"].map((c, i) => (
        <mesh key={c} material={toon({ color: c })} position={[-0.83 + (i % 2) * 0.14, 0.05, 0.22 + Math.floor(i / 2) * 0.13]}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function Telescope() {
  const white = toon({ color: "#f2f2ee" });
  const black = toon({ color: "#23262e" });
  return (
    <group position={[0.85, 0, 0.35]}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} material={black} position={[Math.sin(a) * 0.22, 0.55, Math.cos(a) * 0.22]} rotation={[Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38]}>
          <cylinderGeometry args={[0.02, 0.02, 1.15, 6]} />
        </mesh>
      ))}
      <mesh material={black} position-y={1.13}>
        <boxGeometry args={[0.14, 0.1, 0.14]} />
      </mesh>
      <group position-y={1.25} rotation-x={0.75}>
        <mesh material={white}>
          <cylinderGeometry args={[0.085, 0.07, 0.95, 16]} />
        </mesh>
        <mesh material={black} position-y={0.47}>
          <cylinderGeometry args={[0.095, 0.095, 0.08, 16]} />
        </mesh>
        <mesh material={black} position-y={-0.5}>
          <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function GameDesk() {
  const screen = useMemo(() => glow({ map: gameTexture() }), []);
  const desk = toon({ color: "#3b3f4a" });
  const black = toon({ color: "#15161b" });
  const strip = useMemo(() => glow({ color: "#ff5d73" }), []);
  useFrame(({ clock }) => strip.emissive.setHSL((clock.elapsedTime * 0.15) % 1, 0.85, 0.6));
  return (
    <group position={[-1.3, 0, 0.5]} rotation-y={1.0}>
      <mesh material={desk} position-y={0.74}>
        <boxGeometry args={[1.4, 0.06, 0.6]} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} material={black} position={[x, 0.37, 0]}>
          <boxGeometry args={[0.06, 0.74, 0.55]} />
        </mesh>
      ))}
      <mesh material={strip} position={[0, 0.7, 0.305]}>
        <boxGeometry args={[1.38, 0.03, 0.01]} />
      </mesh>
      <mesh material={black} position={[0, 0.9, -0.12]}>
        <boxGeometry args={[0.08, 0.3, 0.06]} />
      </mesh>
      <mesh material={black} position={[0, 1.22, -0.14]}>
        <boxGeometry args={[1.16, 0.7, 0.05]} />
      </mesh>
      <mesh material={screen} position={[0, 1.22, -0.113]} userData={{ noInk: true }}>
        <planeGeometry args={[1.08, 0.63]} />
      </mesh>
      <mesh material={black} position={[0.2, 0.78, 0.1]}>
        <boxGeometry args={[0.5, 0.02, 0.16]} />
      </mesh>
    </group>
  );
}

function Trophy() {
  const gold = toon({ color: GOLD });
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.8;
  });
  return (
    <group position={[-1.0, 0, 0.45]}>
      <mesh material={toon({ color: "#2c3e74" })} position-y={0.45}>
        <boxGeometry args={[0.45, 0.9, 0.45]} />
      </mesh>
      <group ref={spin} position-y={0.9}>
        <mesh material={toon({ color: "#3a2a1e" })} position-y={0.05}>
          <boxGeometry args={[0.2, 0.1, 0.2]} />
        </mesh>
        <mesh material={gold} position-y={0.17}>
          <cylinderGeometry args={[0.025, 0.04, 0.16, 10]} />
        </mesh>
        <mesh material={gold} position-y={0.37}>
          <cylinderGeometry args={[0.16, 0.06, 0.26, 18]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={gold} position={[s * 0.16, 0.38, 0]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.06, 0.015, 6, 14]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DanceFloor() {
  const speaker = useRef<THREE.Mesh>(null);
  const colors = ["#ff5d73", "#ffd166", "#38d39f", "#5b8cff", "#c77dff"];
  const mats = useMemo(() => Array.from({ length: 16 }, () => glow({ color: "#ffffff", transparent: true, opacity: 0.75 })), []);
  useFrame(({ clock }) => {
    const beat = Math.floor(clock.elapsedTime * 2);
    mats.forEach((m, i) => m.emissive.set(colors[(i * 3 + beat) % colors.length]!));
    if (speaker.current) speaker.current.scale.setScalar(1 + Math.abs(Math.sin(clock.elapsedTime * Math.PI * 2)) * 0.06);
  });
  return (
    <group>
      {mats.map((m, i) => (
        <mesh key={i} material={m} position={[((i % 4) - 1.5) * 0.6, 0.03, (Math.floor(i / 4) - 1.5) * 0.6]} rotation-x={-Math.PI / 2} userData={{ noInk: true }}>
          <planeGeometry args={[0.56, 0.56]} />
        </mesh>
      ))}
      <group position={[1.7, 0, -0.2]} rotation-y={-0.4}>
        <mesh material={toon({ color: "#1b1b22" })} position-y={0.5}>
          <boxGeometry args={[0.55, 1.0, 0.45]} />
        </mesh>
        <mesh ref={speaker} material={toon({ color: "#55596a" })} position={[0, 0.62, 0.23]}>
          <circleGeometry args={[0.19, 20]} />
        </mesh>
        <mesh material={toon({ color: "#55596a" })} position={[0, 0.24, 0.23]}>
          <circleGeometry args={[0.1, 16]} />
        </mesh>
      </group>
      <Notes y={1.6} count={3} />
    </group>
  );
}

function Amp() {
  return (
    <group position={[1.0, 0, 0.1]} rotation-y={-0.3}>
      <mesh material={toon({ color: "#222329" })} position-y={0.3}>
        <boxGeometry args={[0.55, 0.6, 0.32]} />
      </mesh>
      <mesh material={toon({ color: "#8c7a5b" })} position={[0, 0.27, 0.161]}>
        <planeGeometry args={[0.46, 0.4]} />
      </mesh>
      <mesh material={toon({ color: GOLD })} position={[0, 0.53, 0.161]}>
        <planeGeometry args={[0.4, 0.05]} />
      </mesh>
    </group>
  );
}

const STALLS: [string, string, number, number, number][] = [
  ["Music Club", "#c8323d", -3.4, 0.3, 0.55],
  ["Astrophilia", "#2c3e74", 0, -3.2, 0],
  ["Dance Club", "#6d5a8e", 3.4, 0.3, -0.55],
];
function Stall({ name, color }: { name: string; color: string }) {
  const banner = useMemo(() => toon({ map: bannerTexture(name, color) }), [name, color]);
  const pole = toon({ color: "#e8e4da" });
  return (
    <group>
      {[-0.95, 0.95].flatMap((x) =>
        [-0.5, 0.5].map((z) => (
          <mesh key={`${x}${z}`} material={pole} position={[x, 1.1, z]}>
            <cylinderGeometry args={[0.035, 0.035, 2.2, 6]} />
          </mesh>
        )),
      )}
      <mesh material={toon({ color })} position-y={2.45} rotation-y={Math.PI / 4} scale={[1, 1, 0.6]}>
        <coneGeometry args={[1.45, 0.6, 4]} />
      </mesh>
      <mesh material={toon({ color: "#f4efe4" })} position-y={0.78}>
        <boxGeometry args={[1.8, 0.06, 0.8]} />
      </mesh>
      <mesh material={toon({ color })} position={[0, 0.45, 0.38]}>
        <boxGeometry args={[1.8, 0.7, 0.03]} />
      </mesh>
      <mesh material={banner} position={[0, 1.95, 0.52]}>
        <planeGeometry args={[1.8, 0.45]} />
      </mesh>
    </group>
  );
}
function ClubFair() {
  return (
    <group>
      {STALLS.map(([name, color, x, z, ry]) => (
        <group key={name} position={[x, 0, z]} rotation-y={ry}>
          <Stall name={name} color={color} />
        </group>
      ))}
    </group>
  );
}

/** Green for wet waste, blue for dry, and two planters of flowers. */
function BinsAndFlowers() {
  const pot = toon({ color: "#b5643c" });
  return (
    <group>
      {[
        ["#2e8b57", -0.45],
        ["#2f6fb0", 0.25],
      ].map(([c, x]) => (
        <group key={c as string} position-x={x as number}>
          <mesh material={toon({ color: c as string })} position-y={0.42}>
            <cylinderGeometry args={[0.27, 0.23, 0.84, 14]} />
          </mesh>
          <mesh material={toon({ color: "#e8e4da" })} position-y={0.87}>
            <cylinderGeometry args={[0.29, 0.29, 0.07, 14]} />
          </mesh>
        </group>
      ))}
      {[1.0, 1.65].map((x) => (
        <group key={x} position-x={x}>
          <mesh material={pot} position-y={0.22}>
            <cylinderGeometry args={[0.24, 0.18, 0.44, 12]} />
          </mesh>
          <mesh material={toon({ color: "#3f8f46" })} position-y={0.52}>
            <sphereGeometry args={[0.26, 10, 8]} />
          </mesh>
          {["#ff5d73", "#ffd166", "#ffffff"].map((c, i) => (
            <mesh key={c} material={toon({ color: c })} position={[Math.sin(i * 2.1) * 0.16, 0.7, Math.cos(i * 2.1) * 0.16]}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Where a place's door faces: away from the middle of its building. */
function placeFrame(world: World, id: string) {
  const pl = world.places[id];
  if (!pl) return null;
  const b = pl.b !== undefined ? world.buildings[pl.b] : undefined;
  const c = b ? b.p.reduce((s, q) => [s[0] + q[0] / b.p.length, s[1] + q[1] / b.p.length], [0, 0]) : [pl.x, pl.z];
  return { x: pl.door[0], z: pl.door[1], face: Math.atan2(pl.door[0] - c[0]!, pl.door[1] - c[1]!) };
}

const BY_PERSON: Record<string, [quest: string, Comp: () => React.ReactNode]> = {
  creative: ["sketch-walk", Easel],
  astro: ["star-party", Telescope],
  gamer: ["lan-night", GameDesk],
  quizmaster: ["quiz-night", Trophy],
  dancer: ["dance-practice", DanceFloor],
  musician: ["jam-session", () => (
    <>
      <Amp />
      <Notes />
    </>
  )],
  clubs: ["club-fair", ClubFair],
  rotaract: ["clean-up", () => (
    <group position={[1.4, 0, 0.2]}>
      <BinsAndFlowers />
    </group>
  )],
};

export function Rewards({ world, npcs, done }: { world: World; npcs: Npc[]; done: string[] }) {
  const root = useRef<THREE.Group>(null);
  const cleanSpots = useMemo(() => ["clock-tower", "library"].map((id) => placeFrame(world, id)).filter((f) => f !== null), [world]);
  const cleaned = done.includes("clean-up");
  const shown = npcs.filter((n) => BY_PERSON[n.id] && done.includes(BY_PERSON[n.id]![0]));
  useEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noInk) o.castShadow = true;
    });
  }, [shown.length, cleaned]);
  return (
    <group ref={root}>
      {shown.map((n) => {
        const Comp = BY_PERSON[n.id]![1];
        return (
          <group key={n.id} position={[n.x, 0, n.z]} rotation-y={n.face}>
            <Comp />
          </group>
        );
      })}
      {cleaned
        ? cleanSpots.map((f, i) => (
            <group key={i} position={[f.x, 0, f.z]} rotation-y={f.face}>
              <group position={[-3.2, 0, 0.4]}>
                <BinsAndFlowers />
              </group>
            </group>
          ))
        : null}
    </group>
  );
}
