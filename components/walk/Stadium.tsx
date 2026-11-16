"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { World, XZ } from "@/lib/walk/world";
import { toon } from "./curve";
import { obb } from "./Grounds";

/**
 * The sports ground beside Tech Park: a football pitch with its markings, ringed by a five-lane running track.
 * Sized to the mapped lawn (the campus is drawn at 0.65 of real size, so the pitch is too). Everything flat is laid
 * as strips a couple of metres long, so it bends with the curved world like the roads do.
 */

export const PITCH = { L: 54, W: 36 };
export const TRACK = { r0: 19.5, lanes: 5, lane: 1.05 };

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

export function Stadium({ world }: { world: World }) {
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
    return { f, field, track, apron, lines, fin, tex: pitchTexture() };
  }, [world]);
  useEffect(
    () => () => {
      if (!built) return;
      for (const g of [built.field, built.track, built.apron, built.fin, ...built.lines]) g.dispose();
      built.tex.dispose();
    },
    [built],
  );
  if (!built) return null;
  const { f } = built;
  const finAt = f.at(PITCH.L / 2 - 4, -(TRACK.r0 + (TRACK.lanes * TRACK.lane) / 2));
  return (
    <group>
      <mesh geometry={built.field} material={toon({ map: built.tex })} position={[f.x, 0.06, f.z]} rotation-y={f.yaw} receiveShadow userData={{ noInk: true }} />
      <mesh geometry={built.apron} material={toon({ color: "#cfc6b4" })} receiveShadow userData={{ noInk: true }} />
      <mesh geometry={built.track} material={toon({ color: "#b5553c" })} receiveShadow userData={{ noInk: true }} />
      {built.lines.map((g, i) => (
        <mesh key={i} geometry={g} material={toon({ color: "#f6f2ea" })} userData={{ noInk: true }} />
      ))}
      <mesh geometry={built.fin} material={toon({ color: "#f6f2ea" })} position={[finAt[0], 0.09, finAt[1]]} rotation-y={f.yaw} userData={{ noInk: true }} />
    </group>
  );
}
