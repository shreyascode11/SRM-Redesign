"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Outfit } from "@/lib/walk/script";
import { chennaiHour, type Collider, type Paths, type World, type XZ } from "@/lib/walk/world";
import { type Anim, Character, newAnim, OUTFIT_SIZES } from "./Character";
import { Held, QUEST_LOOPS, Rewards } from "./Rewards";
import { curve, dropAt, toon } from "./curve";
import type { Game } from "./state";
import { Ink } from "./Ink";
import { Sky as SkyDome } from "./Sky";
import { WorldMeshes } from "./WorldMeshes";

export type Npc = { id: string; x: number; z: number; face: number; outfit: Outfit };
export type Overlay = {
  /** DOM elements positioned over the canvas each frame, keyed "place:<id>", "person:<id>", "emote", "pick". */
  els: Map<string, HTMLElement>;
  /** World anchors for those elements: x, height, z. */
  anchors: Map<string, [number, number, number]>;
  /** How far away an element may be and still show. */
  range: Map<string, number>;
};

const WALK = 4.2;
/** Students walking about, and their names (made up; they are characters, not real people). */
const CROWD_SIZE = 16;
const CROWD_NAMES = ["Arjun", "Priya", "Karthik", "Divya", "Rahul", "Ananya", "Vikram", "Sneha", "Aditya", "Meera", "Rohan", "Kavya", "Siddharth", "Lakshmi", "Farhan", "Aisha"];
const RUN = 8;
const tmp = new THREE.Vector3();
const UP = 1.35;

export type Sky = {
  fog: string;
  sun: string;
  sunI: number;
  hemiTop: string;
  hemiBottom: string;
  hemiI: number;
  night: number;
  top: string;
  horizon: string;
  cloud: string;
  cloudShade: string;
};

export function Scene({
  world,
  collider,
  paths,
  game,
  outfit,
  npcs,
  overlay,
  onNear,
  onWalker,
  highlight,
  pickAt,
  sky,
  quality,
  names,
  done,
  onChime,
}: {
  world: World;
  collider: Collider;
  paths: Paths;
  game: React.RefObject<Game>;
  outfit: Outfit;
  npcs: Npc[];
  overlay: Overlay;
  onNear: (person: string | null, place: string | null) => void;
  onWalker: (w: { i: number; name: string; to: string } | null) => void;
  highlight: string | null;
  pickAt: XZ | null;
  sky: Sky;
  quality: "auto" | "low" | "high";
  names: Record<string, string>;
  /** Finished quests: what they leave behind shows on campus. */
  done: string[];
  /** The clock tower strikes the hour (1–12) while you're within earshot. */
  onChime: (hour: number) => void;
}) {
  const { camera, gl, size, scene } = useThree();
  const player = useRef<THREE.Group>(null);
  const npcRefs = useRef(new Map<string, THREE.Group>());
  const beacon = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const crate = useRef<THREE.Group>(null);
  const playerAnim = useMemo(() => ({ current: game.current.anim }), [game]);
  const npcAnims = useMemo(() => new Map(npcs.map((n) => [n.id, { current: game.current.npc[n.id]! }])), [npcs, game]);
  const places = useMemo(
    () =>
      // Every place counts, not only buildings: quests also send you to the arch gate and other open spots.
      Object.entries(world.places).map(([id, p]) => ({ id, x: p.door[0], z: p.door[1] })),
    [world],
  );
  const sun = useRef<THREE.DirectionalLight>(null);
  // Once their quest is done, the dancer keeps dancing, the musician keeps playing, and so on.
  useEffect(() => {
    for (const [id, [quest, loop]] of Object.entries(QUEST_LOOPS)) {
      const a = game.current.npc[id];
      if (a) a.loop = done.includes(quest) ? loop : "";
    }
  }, [done, game]);
  const tower = world.places["clock-tower"];
  const lastHour = useRef(-1);
  const skyColors = useMemo(() => ({ top: sky.top, horizon: sky.horizon, cloud: sky.cloud, cloudShade: sky.cloudShade, night: sky.night }), [sky]);
  // Students walking the campus on their own, between real places, along the side of real roads. Each has a name,
  // a pace and a side of the road; they wave when you come close, answer your emotes, and stop to say hello.
  const walkers = useMemo(() => {
    const ids = Object.keys(world.places);
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: CROWD_SIZE }, (_, i) => {
      const start = world.places[ids[Math.floor(rnd() * ids.length)]!]!.door;
      const outfit = Object.fromEntries((Object.keys(OUTFIT_SIZES) as (keyof Outfit)[]).map((k) => [k, Math.floor(rnd() * OUTFIT_SIZES[k])])) as Outfit;
      return {
        i,
        name: CROWD_NAMES[i % CROWD_NAMES.length]!,
        outfit,
        pos: { x: start[0] + 3, z: start[1] + 3 },
        route: [] as XZ[],
        to: "",
        heading: rnd() * 6.28,
        pace: 1.5 + rnd() * 0.9,
        side: (rnd() > 0.5 ? 1 : -1) * (1.6 + rnd() * 1.2),
        wait: rnd() * 3,
        stop: 0,
        waved: -99,
        anim: { current: newAnim() },
      };
    });
  }, [world]);
  const walkerRefs = useRef(new Map<number, THREE.Group>());
  const placeIds = useMemo(() => Object.keys(world.places), [world]);
  const camPos = useRef(new THREE.Vector3());
  const lastNear = useRef<string>("");
  const lastWalker = useRef<string>("");
  const frame = useRef(0);
  const occlusion = useRef(1);

  useEffect(() => {
    scene.background = new THREE.Color(sky.fog);
    scene.fog = new THREE.Fog(sky.fog, 70, 300);
    curve.uNight.value = sky.night;
  }, [scene, sky]);

  // Pointer: drag to look around, tap the ground to walk there, wheel or pinch to zoom.
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const g = game.current;
      if (pointers.size === 2) {
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) g.cam.minDist = g.cam.dist = Math.min(30, Math.max(3.5, g.cam.dist * (pinch / d)));
        pinch = d;
        return;
      }
      g.cam.yaw -= (e.clientX - p.x) * 0.006;
      g.cam.pitch = Math.min(1.25, Math.max(0.18, g.cam.pitch + (e.clientY - p.y) * 0.004));
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!p || pointers.size) return;
      const g = game.current;
      if (g.frozen || g.paused) return;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8 || performance.now() - p.t > 450) return;
      const hit = groundAt(e.clientX, e.clientY);
      if (!hit) return;
      g.route = paths.route([g.pos.x, g.pos.z], collider.resolve(hit[0], hit[1], 0.6));
      g.onArrive = null;
      ripple(hit);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = game.current;
      g.cam.minDist = g.cam.dist = Math.min(30, Math.max(3.5, g.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    };
    const rect = () => el.getBoundingClientRect();
    // The ground is drawn bent, so find where the click ray meets the bent surface (bisection along the ray).
    const ray = new THREE.Raycaster();
    const groundAt = (cx: number, cy: number): XZ | null => {
      const r = rect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      const o = ray.ray.origin;
      const d = ray.ray.direction;
      const below = (t: number) => o.y + d.y * t < -dropAt(o.x + d.x * t, o.z + d.z * t);
      let lo = 0;
      let hi = 600;
      if (!below(hi)) return null;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (below(mid)) hi = mid;
        else lo = mid;
      }
      return [o.x + d.x * hi, o.z + d.z * hi];
    };
    const rippleEl = overlay.els.get("ripple");
    const ripple = (at: XZ) => {
      overlay.anchors.set("ripple", [at[0], 0.1, at[1]]);
      if (rippleEl) {
        rippleEl.classList.remove("walk-ripple-on");
        void rippleEl.offsetWidth;
        rippleEl.classList.add("walk-ripple-on");
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, camera, game, paths, collider, overlay]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const g = game.current;
    curve.uTime.value += dt;
    frame.current++;

    // ── The clock tower strikes the hour, heard within about 150 m ──
    const hourNow = Math.floor(chennaiHour());
    if (lastHour.current >= 0 && hourNow !== lastHour.current && tower && Math.hypot(g.pos.x - tower.x, g.pos.z - tower.z) < 150) onChime(hourNow % 12 || 12);
    lastHour.current = hourNow;

    // ── Movement ──
    let mx = 0;
    let mz = 0;
    if (!g.frozen && !g.paused) {
      const k = g.keys;
      const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + -g.joy.y;
      const side = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + g.joy.x;
      if (Math.abs(fwd) > 0.05 || Math.abs(side) > 0.05) {
        // Camera-relative: "up" walks away from the camera.
        const fx = -Math.sin(g.cam.yaw);
        const fz = -Math.cos(g.cam.yaw);
        mx = fx * fwd + -fz * side;
        mz = fz * fwd + fx * side;
        g.route = [];
        g.onArrive = null;
      } else if (g.route.length) {
        const [tx, tz] = g.route[0]!;
        const dx = tx - g.pos.x;
        const dz = tz - g.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.1) {
          g.route.shift();
          if (!g.route.length && g.onArrive) {
            const cb = g.onArrive;
            g.onArrive = null;
            cb();
          }
        } else {
          mx = dx / d;
          mz = dz / d;
        }
      }
    }
    const len = Math.hypot(mx, mz);
    // Run only when you ask to: the Run button (or R), or Shift held. A full thumb stick or a long tap-to-walk route
    // walks; they used to switch to running on their own, so on a phone walking and running felt the same.
    const runOn = g.run || g.keys.has("shift");
    const want = len > 0.05 ? (runOn ? RUN : WALK) * g.pace * Math.min(1, len) : 0;
    g.speed += (want - g.speed) * Math.min(1, dt * (want > g.speed ? 6 : 10));
    if (len > 0.05) {
      const h = Math.atan2(mx, mz);
      let dh = h - g.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      g.heading += dh * Math.min(1, dt * 12);
    }
    if (g.speed > 0.02) {
      const nx = g.pos.x + Math.sin(g.heading) * g.speed * dt;
      const nz = g.pos.z + Math.cos(g.heading) * g.speed * dt;
      const [rx, rz] = collider.resolve(nx, nz, 0.35);
      // Stuck against a wall while following a route: skip to the next point.
      if (g.route.length && Math.hypot(rx - g.pos.x, rz - g.pos.z) < g.speed * dt * 0.15) g.route.shift();
      g.pos.x = rx;
      g.pos.z = rz;
    }
    g.anim.speed = g.speed;
    // Jumping: up at jumpV, pulled down by gravity, land softly.
    if (g.jumpY > 0) {
      g.jumpV -= 19 * dt;
      g.jumpY = Math.max(0, g.jumpY + g.jumpV * dt);
      if (g.jumpY === 0) g.jumpV = 0;
    }
    g.anim.air += ((g.jumpY > 0.05 ? 1 : 0) - g.anim.air) * Math.min(1, dt * 14);
    curve.uCenter.value.set(g.pos.x, g.pos.z);
    if (player.current) {
      player.current.position.set(g.pos.x, g.jumpY, g.pos.z);
      player.current.rotation.y = g.heading;
    }
    // The sun (and its shadow box) follows you.
    if (sun.current) {
      sun.current.position.set(g.pos.x + 40, 70, g.pos.z + 25);
      sun.current.target.position.set(g.pos.x, 0, g.pos.z);
      sun.current.target.updateMatrixWorld();
    }

    // ── Camera: follows with a little lag, pulls in when a building is in the way ──
    if (frame.current % 8 === 0) {
      const cx = g.pos.x + Math.sin(g.cam.yaw) * g.cam.dist * Math.cos(g.cam.pitch);
      const cz = g.pos.z + Math.cos(g.cam.yaw) * g.cam.dist * Math.cos(g.cam.pitch);
      let f = 1;
      for (let s = 0.25; s <= 1; s += 0.25) {
        const x = g.pos.x + (cx - g.pos.x) * s;
        const z = g.pos.z + (cz - g.pos.z) * s;
        if (collider.blocked(x, z, 0.5) && g.cam.pitch < 0.9) {
          f = Math.max(0.35, s - 0.2);
          break;
        }
      }
      occlusion.current = f;
    }
    const dist = g.cam.dist * occlusion.current;
    const ahead = g.reduced ? 0 : Math.min(1, g.speed / (RUN * g.pace)) * 2.5;
    const tx = g.pos.x + Math.sin(g.heading) * ahead;
    const tz = g.pos.z + Math.cos(g.heading) * ahead;
    const want3 = tmp.set(
      tx + Math.sin(g.cam.yaw) * dist * Math.cos(g.cam.pitch),
      UP + g.jumpY * 0.6 + dist * Math.sin(g.cam.pitch),
      tz + Math.cos(g.cam.yaw) * dist * Math.cos(g.cam.pitch),
    );
    if (camPos.current.lengthSq() === 0 || g.reduced) camPos.current.copy(want3);
    else camPos.current.lerp(want3, Math.min(1, dt * 5));
    camera.position.copy(camPos.current);
    camera.lookAt(tx, UP - 0.6 + g.jumpY * 0.6, tz);

    // ── People: look at you when you're near, turn to you while talking; hidden when far away ──
    let nearPerson: string | null = null;
    let nearD = 3.2;
    for (const n of npcs) {
      const grp = npcRefs.current.get(n.id);
      const a = g.npc[n.id]!;
      const dx = g.pos.x - n.x;
      const dz = g.pos.z - n.z;
      const d = Math.hypot(dx, dz);
      if (grp) {
        grp.visible = d < 170;
        grp.position.y = 0;
        const toPlayer = Math.atan2(dx, dz);
        if (g.talkingTo === n.id) {
          let dh = toPlayer - grp.rotation.y;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          grp.rotation.y += dh * Math.min(1, dt * 6);
          a.look = 0;
        } else {
          let rel = d < 14 ? toPlayer - grp.rotation.y : 0;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          a.look = Math.max(-1, Math.min(1, rel));
          grp.rotation.y += (n.face - grp.rotation.y) * Math.min(1, dt * 1.5);
        }
      }
      if (d < nearD) {
        nearD = d;
        nearPerson = n.id;
      }
    }
    let nearPlace: string | null = null;
    let placeD = 16;
    for (const p of places) {
      const d = Math.hypot(g.pos.x - p.x, g.pos.z - p.z);
      if (d < placeD) {
        placeD = d;
        nearPlace = p.id;
      }
    }
    const key = `${nearPerson}|${nearPlace}`;
    if (key !== lastNear.current) {
      lastNear.current = key;
      g.near = { person: nearPerson, place: nearPlace };
      onNear(nearPerson, nearPlace);
    }

    // ── Students walking about ──
    const now = performance.now() / 1000;
    const emoted = g.crowd.emoteAt > 0 && now - g.crowd.emoteAt < 0.2;
    let nearWalker: number | null = null;
    let nearWD = 3.2;
    for (const w of walkers) {
      const grp = walkerRefs.current.get(w.i);
      const a = w.anim.current;
      const toYou = Math.hypot(g.pos.x - w.pos.x, g.pos.z - w.pos.z);
      if (toYou < nearWD && !nearPerson) {
        nearWD = toYou;
        nearWalker = w.i;
      }
      // Said hello to (E), or you came close for the first time in a while: stop, turn to you, wave.
      if (g.crowd.greet === w.i || (toYou < 4.5 && now - w.waved > 25)) {
        w.waved = now;
        w.stop = g.crowd.greet === w.i ? 3.5 : 1.6;
        a.wave = 1.3;
        a.talk = g.crowd.greet === w.i ? 1.5 : 0;
        if (g.crowd.greet === w.i) g.crowd.greet = null;
      }
      if (emoted && toYou < 16) a.wave = 1.4;
      if (w.stop > 0) {
        w.stop -= dt;
        a.speed = 0;
        let dh = Math.atan2(g.pos.x - w.pos.x, g.pos.z - w.pos.z) - w.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        w.heading += dh * Math.min(1, dt * 6);
      } else if (!w.route.length) {
        a.speed = 0;
        w.wait -= dt;
        if (w.wait <= 0 && frame.current % CROWD_SIZE === w.i) {
          const id = placeIds[Math.floor(Math.random() * placeIds.length)]!;
          const to = world.places[id]!.door;
          w.to = id;
          w.route = paths.route([w.pos.x, w.pos.z], [to[0] + 2, to[1] + 2]);
          w.wait = 2 + Math.random() * 6;
        }
      } else {
        // Keep to one side of the road: aim a little to the side of each point on the way.
        const [px, pz] = w.route[0]!;
        const ex = px - w.pos.x;
        const ez = pz - w.pos.z;
        const d = Math.hypot(ex, ez);
        const last = w.route.length === 1;
        const tx2 = last ? px : px + (ez / (d || 1)) * w.side;
        const tz2 = last ? pz : pz - (ex / (d || 1)) * w.side;
        const dx = tx2 - w.pos.x;
        const dz = tz2 - w.pos.z;
        if (Math.hypot(dx, dz) < 1.2 || d < 1) w.route.shift();
        else {
          let dh = Math.atan2(dx, dz) - w.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          w.heading += dh * Math.min(1, dt * 5);
          // Make way for you: slow down when you're right in front.
          const v = w.pace * (toYou < 1.6 ? 0.25 : 1);
          const [rx, rz] = collider.resolve(w.pos.x + Math.sin(w.heading) * v * dt, w.pos.z + Math.cos(w.heading) * v * dt, 0.45);
          if (Math.hypot(rx - w.pos.x, rz - w.pos.z) < v * dt * 0.1) w.route.shift();
          w.pos.x = rx;
          w.pos.z = rz;
          a.speed = v;
        }
      }
      a.look = toYou < 12 && w.stop <= 0 ? Math.max(-1, Math.min(1, (() => {
        let r = Math.atan2(g.pos.x - w.pos.x, g.pos.z - w.pos.z) - w.heading;
        while (r > Math.PI) r -= Math.PI * 2;
        while (r < -Math.PI) r += Math.PI * 2;
        return Math.abs(r) < 1.6 ? r : 0;
      })())) : 0;
      if (grp) {
        grp.visible = toYou < 150;
        grp.position.set(w.pos.x, 0, w.pos.z);
        grp.rotation.y = w.heading;
      }
    }
    const nw = nearWalker === null ? null : walkers[nearWalker]!;
    const walkerKey = nw ? `${nw.i}:${nw.to}` : "";
    if (walkerKey !== lastWalker.current) {
      lastWalker.current = walkerKey;
      g.crowd.near = nearWalker;
      onWalker(nw ? { i: nw.i, name: nw.name, to: nw.to } : null);
    }

    // ── Way-finding: a light column over the next stop, and an arrow at your feet ──
    if (beacon.current) {
      beacon.current.visible = !!g.target && Math.hypot(g.target[0] - g.pos.x, g.target[1] - g.pos.z) > 14;
      if (g.target) {
        beacon.current.position.set(g.target[0], 0, g.target[1]);
        beacon.current.rotation.y += dt * 0.8;
      }
    }
    if (arrow.current) {
      const show = !!g.target && Math.hypot(g.target[0] - g.pos.x, g.target[1] - g.pos.z) > 8;
      arrow.current.visible = show;
      if (show) {
        const a = Math.atan2(g.target![0] - g.pos.x, g.target![1] - g.pos.z);
        arrow.current.position.set(g.pos.x + Math.sin(a) * 1.1, 0.08, g.pos.z + Math.cos(a) * 1.1);
        arrow.current.rotation.set(-Math.PI / 2, 0, a + Math.PI);
      }
    }
    if (crate.current) {
      crate.current.visible = !!pickAt;
      if (pickAt) {
        crate.current.position.set(pickAt[0], 0.45 + Math.sin(curve.uTime.value * 2) * 0.12, pickAt[1]);
        crate.current.rotation.y += dt;
      }
    }

    // ── Emote floats up above you ──
    if (g.emote) {
      g.emote.t -= dt;
      overlay.anchors.set("emote", [g.pos.x, 2.3 + (2 - g.emote.t) * 0.5, g.pos.z]);
      if (g.emote.t <= 0) {
        g.emote = null;
        overlay.anchors.delete("emote");
      }
    }
    overlay.anchors.set("me", [g.pos.x, 2.1, g.pos.z]);

    // ── DOM labels follow their anchors on the bent world ──
    for (const [k, el] of overlay.els) {
      const a = overlay.anchors.get(k);
      if (!a) {
        el.style.visibility = "hidden";
        continue;
      }
      const d = Math.hypot(a[0] - g.pos.x, a[2] - g.pos.z);
      const r = overlay.range.get(k) ?? Infinity;
      tmp.set(a[0], a[1] - dropAt(a[0], a[2]), a[2]).project(camera);
      const on = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && d < r;
      el.style.visibility = on ? "visible" : "hidden";
      if (on) {
        const x = ((tmp.x + 1) / 2) * size.width;
        const y = ((1 - tmp.y) / 2) * size.height;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.opacity = d > r * 0.75 ? String(1 - (d - r * 0.75) / (r * 0.25)) : "1";
      }
    }
  });

  return (
    <>
      <SkyDome colors={skyColors} />
      <hemisphereLight args={[sky.hemiTop, sky.hemiBottom, sky.hemiI]} />
      <directionalLight
        ref={sun}
        intensity={sky.sunI}
        color={sky.sun}
        castShadow={quality !== "low"}
        shadow-mapSize={quality === "high" ? [4096, 4096] : [2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
      <Ink lines={quality !== "low"} />
      <WorldMeshes world={world} highlight={highlight} names={names} />
      <group ref={player}>
        <Character outfit={outfit} anim={playerAnim as React.RefObject<Anim>} blob={quality === "low"} />
      </group>
      {npcs.map((n) => (
        <group
          key={n.id}
          ref={(el) => {
            if (el) npcRefs.current.set(n.id, el);
            else npcRefs.current.delete(n.id);
          }}
          position={[n.x, 0, n.z]}
          rotation-y={n.face}
        >
          <Character outfit={n.outfit} anim={npcAnims.get(n.id) as React.RefObject<Anim>} blob={quality === "low"} />
          <Held id={n.id} done={done} />
        </group>
      ))}
      <Rewards world={world} npcs={npcs} done={done} />
      {walkers.map((w) => (
        <group
          key={w.i}
          ref={(el) => {
            if (el) walkerRefs.current.set(w.i, el);
            else walkerRefs.current.delete(w.i);
          }}
        >
          <Character outfit={w.outfit} anim={w.anim as React.RefObject<Anim>} blob={quality === "low"} />
        </group>
      ))}
      <group ref={beacon} visible={false} userData={{ noInk: true }}>
        <mesh position-y={40} material={toon({ color: "#ffd166", transparent: true, opacity: 0.22 })}>
          <cylinderGeometry args={[1.6, 1.6, 80, 16, 1, true]} />
        </mesh>
        <mesh position-y={0.15} rotation-x={-Math.PI / 2} material={toon({ color: "#ffd166", transparent: true, opacity: 0.6 })}>
          <ringGeometry args={[2.2, 2.8, 32]} />
        </mesh>
      </group>
      <mesh ref={arrow} visible={false} material={toon({ color: "#ffd166" })} userData={{ noInk: true }}>
        <coneGeometry args={[0.22, 0.55, 3]} />
      </mesh>
      <group ref={crate} visible={false}>
        <mesh material={toon({ color: "#d4a373" })}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
        </mesh>
        <mesh position-y={0.46} material={toon({ color: "#ffd166" })}>
          <boxGeometry args={[0.95, 0.08, 0.3]} />
        </mesh>
      </group>
    </>
  );
}

