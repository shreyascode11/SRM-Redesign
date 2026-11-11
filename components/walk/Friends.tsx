"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { type Anim, Character } from "./Character";
import { dropAt } from "./curve";
import type { Friend, Party } from "./party";

/**
 * Friends in your room, drawn as their own dressed-up students: eased toward where they say they are (about ten
 * updates a second), walking, running, jumping and dancing as they do, with a name tag and a bubble for their
 * emotes and chat.
 */
export function Friends({ party, version }: { party: Party; version: number }) {
  void version; // re-render when people join, leave or change their outfit
  return (
    <>
      {[...party.friends.values()].map((f) => (
        <FriendAvatar key={f.id} f={f} />
      ))}
    </>
  );
}

function FriendAvatar({ f }: { f: Friend }) {
  const grp = useRef<THREE.Group>(null);
  const label = useRef<THREE.Group>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const shown = useRef("");
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = f.pose;
    const d = f.draw;
    // A jump across the map (they teleported): snap instead of sliding there.
    if (Math.hypot(p.x - d.x, p.z - d.z) > 25) {
      d.x = p.x;
      d.z = p.z;
    }
    const k = Math.min(1, dt * 10);
    d.x += (p.x - d.x) * k;
    d.z += (p.z - d.z) * k;
    let dh = p.h - d.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    d.h += dh * k;
    const a: Anim = f.anim.current;
    a.speed = p.sp;
    a.air += ((p.y > 0.05 ? 1 : 0) - a.air) * Math.min(1, dt * 14);
    a.dance = p.d ? 0.3 : 0;
    const g = grp.current;
    if (g) {
      g.visible = f.seen > 0 && performance.now() - f.seen < 8000;
      g.position.set(d.x, p.y, d.z);
      g.rotation.y = d.h;
    }
    // The world curves away with distance; the label follows it down.
    if (label.current) label.current.position.y = 2.15 - dropAt(d.x, d.z);
    const now = performance.now();
    const text = f.bubble && f.bubble.until > now ? f.bubble.text : "";
    if (text !== shown.current && bubble.current) {
      shown.current = text;
      bubble.current.textContent = text;
      bubble.current.style.display = text ? "block" : "none";
    }
  });
  return (
    <group ref={grp} visible={false}>
      <Character outfit={f.outfit} anim={f.anim as React.RefObject<Anim>} />
      <group ref={label} position-y={2.15}>
        <Html center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
          <div className="flex flex-col items-center gap-1" style={{ transform: "translateY(-50%)" }}>
            <span ref={bubble} className="max-w-48 rounded-2xl bg-white px-3 py-1 text-center text-sm font-semibold text-black shadow-lg" style={{ display: "none" }} />
            <span className="rounded-full bg-[#2e8b57] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white shadow">{f.name}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}
