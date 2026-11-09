"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The 3D Kattankulathur campus for the hostel finder: OpenStreetMap footprints extruded to (approximate) height,
 * roads, ponds and trees. Hostels are coloured by who lives there and carry a name tag; picking one (here or in
 * the list beside it) flies the camera in close. Loaded only on demand (next/dynamic, never in Lite Mode), so three.js
 * is never part of the page's first download. Decorative for assistive tech: the list beside it does the same job.
 */

export type CampusData = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  buildings: { p: [number, number][]; h: number; slug?: string; group?: "men" | "women" | "international"; name?: string; label?: string }[];
  roads: { p: [number, number][]; w: number }[];
  water: { p: [number, number][] }[];
  trees: [number, number, number][];
};

const COLORS = {
  ground: "#1a2419",
  campus: "#283625",
  road: "#59606a",
  water: "#1f4a70",
  building: "#e4e1da",
  landmark: "#f2efe8",
  men: "#9ee3ff",
  women: "#ffcdff",
  international: "#ffc63a",
  selected: "#ecd2f3",
  tree: "#2f6a38",
};

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;

/**
 * Walls with floors and windows, drawn by the shader from world position (so every footprint gets them for free,
 * merged or not): a window every 4 m along the wall, a floor every 3.4 m, a faint floor line, and here and there a
 * warmly lit window. Roofs come out a shade darker. No textures to download.
 */
function windowed(color: string, opts: { lit?: number; emissive?: string; emissiveIntensity?: number; roughness?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.8, emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.emissiveIntensity ?? 0 });
  const lit = opts.lit ?? 0.55;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float wall = 1.0 - smoothstep(0.35, 0.6, abs(vWN.y));
        vec2 tang = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
        vec2 cell = vec2(dot(vWPos.xz, tang) / 4.0, vWPos.y / 3.4);
        vec2 f = fract(cell);
        // Fade the pattern out where a window is smaller than a couple of pixels (far away), so it never shimmers.
        float aa = clamp(1.6 - max(fwidth(cell.x), fwidth(cell.y)) * 3.2, 0.0, 1.0);
        float win = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.8) * wall * step(0.9, vWPos.y) * aa;
        float line = step(0.94, f.y) * wall * aa;
        float h = fract(sin(dot(floor(cell) + floor(vWPos.xz * 0.013), vec2(12.9898, 78.233))) * 43758.5453);
        float winLit = win * step(${(1 - lit).toFixed(2)}, h);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.17, 0.23), win * 0.85);
        diffuseColor.rgb *= 1.0 - (1.0 - aa) * wall * 0.22; // far away: a wall just reads a touch darker
        diffuseColor.rgb *= 1.0 - line * 0.18;
        diffuseColor.rgb *= mix(1.0, 0.8, smoothstep(0.6, 0.9, vWN.y));`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += winLit * vec3(1.0, 0.74, 0.42) * 0.9;");
  };
  m.customProgramCacheKey = () => `windowed-${lit}`;
  return m;
}

const START = { pos: new THREE.Vector3(430, 400, 560), target: new THREE.Vector3(0, 0, -40) };

const centroid = (p: [number, number][]) => {
  const n = p.length;
  return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n] as const;
};

/** A footprint extruded upward; world z = footprint z. */
function extrude(p: [number, number][], h: number) {
  const shape = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A flat ribbon along a polyline (roads), merged by the caller. */
function ribbon(p: [number, number][], w: number, y: number) {
  const pos: number[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i]!;
    const [bx, bz] = p[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / len) * (w / 2);
    const nz = ((bx - ax) / len) * (w / 2);
    pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function flat(p: [number, number][], y: number) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function Campus({ data, selected, hovered, onPick, onHover }: { data: CampusData; selected: string | null; hovered: string | null; onPick: (slug: string) => void; onHover: (slug: string | null) => void }) {
  // Everything that never changes is merged into a handful of meshes: cheap to draw on a mid-range phone.
  const statics = useMemo(() => {
    const others = data.buildings.filter((b) => !b.slug);
    const geo = (list: typeof others) => (list.length ? mergeGeometries(list.map((b) => extrude(b.p, b.h))) : null);
    const roads = data.roads.length ? mergeGeometries(data.roads.map((r) => ribbon(r.p, r.w, 0.06))) : null;
    const water = data.water.length ? mergeGeometries(data.water.map((w) => flat(w.p, 0.04))) : null;
    return { plain: geo(others.filter((b) => !b.label)), landmarks: geo(others.filter((b) => b.label)), roads, water };
  }, [data]);
  const hostels = useMemo(
    () =>
      data.buildings
        .filter((b) => b.slug)
        .map((b) => ({ ...b, geo: extrude(b.p, b.h), c: centroid(b.p) })),
    [data],
  );

  const mats = useMemo(
    () => ({
      plain: windowed(COLORS.building, { lit: 0.35 }),
      landmark: windowed(COLORS.landmark, { lit: 0.5, roughness: 0.6 }),
    }),
    [],
  );
  // One material per hostel state (normal, hovered, selected), shared across hostels of the same group.
  const hostelMat = useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    return (group: string, state: "idle" | "hover" | "on") => {
      const k = `${group}-${state}`;
      let m = cache.get(k);
      if (!m) {
        const color = state === "on" ? COLORS.selected : COLORS[(group as "men") ?? "men"];
        m = windowed(color, { lit: 0.6, emissive: state === "on" ? "#623562" : state === "hover" ? color : "#000000", emissiveIntensity: state === "on" ? 0.5 : state === "hover" ? 0.25 : 0, roughness: 0.65 });
        cache.set(k, m);
      }
      return m;
    };
  }, []);

  const trees = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = trees.current;
    const t = trunks.current;
    if (!m || !t) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    data.trees.forEach(([x, z, s], i) => {
      o.position.set(x, 5.2 * s, z);
      o.scale.set(s, s * (0.85 + ((i * 29) % 10) / 40), s);
      o.rotation.y = i;
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(COLORS.tree).offsetHSL(((i * 37) % 10) / 200 - 0.025, 0, ((i * 53) % 10) / 100 - 0.05));
      o.position.set(x, 1.6 * s, z);
      o.scale.set(s, s, s);
      o.updateMatrix();
      t.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);

  const { bounds } = data;
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[w * 3, d * 3]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={COLORS.campus} />
      </mesh>
      {statics.water ? (
        <mesh geometry={statics.water}>
          <meshStandardMaterial color={COLORS.water} roughness={0.2} metalness={0.1} />
        </mesh>
      ) : null}
      {statics.roads ? (
        <mesh geometry={statics.roads} receiveShadow>
          <meshStandardMaterial color={COLORS.road} />
        </mesh>
      ) : null}
      {statics.plain ? <mesh geometry={statics.plain} material={mats.plain} castShadow receiveShadow /> : null}
      {statics.landmarks ? <mesh geometry={statics.landmarks} material={mats.landmark} castShadow receiveShadow /> : null}
      <instancedMesh ref={trees} args={[undefined, undefined, data.trees.length]} castShadow>
        <icosahedronGeometry args={[4.2, 1]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, data.trees.length]}>
        <cylinderGeometry args={[0.45, 0.7, 3.2, 6]} />
        <meshStandardMaterial color="#5b4636" roughness={0.9} />
      </instancedMesh>

      {hostels.map((b) => {
        const on = b.slug === selected;
        const hover = !on && b.slug === hovered;
        return (
          <group key={b.slug}>
            <mesh
              geometry={b.geo}
              material={hostelMat(b.group ?? "men", on ? "on" : hover ? "hover" : "idle")}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                onPick(b.slug!);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                onHover(b.slug!);
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
                onHover(null);
              }}
            />
            {on ? (
              <>
                <SelectedRing x={b.c[0]} z={b.c[1]} />
                <Beam x={b.c[0]} z={b.c[1]} h={b.h} />
              </>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/** A soft ring that pulses on the ground around the chosen hostel. */
function SelectedRing({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = (clock.elapsedTime % 1.6) / 1.6;
    m.scale.setScalar(1 + t * 0.8);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[x, 0.2, z]}>
      <ringGeometry args={[34, 38, 48]} />
      <meshBasicMaterial color={COLORS.selected} transparent />
    </mesh>
  );
}

/** A soft column of light over the chosen hostel, so it stands out from any angle. */
function Beam({ x, z, h }: { x: number; z: number; h: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (m) (m.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
  });
  const top = h + 90;
  return (
    <mesh ref={ref} position={[x, top / 2, z]}>
      <cylinderGeometry args={[7, 16, top, 24, 1, true]} />
      <meshBasicMaterial color={COLORS.selected} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Name tags are plain HTML in a layer over the canvas (no extra React roots); each frame this moves every tag to
 * its building's place on screen, and hides it when the building is behind the camera.
 */
type Anchor = { key: string; at: THREE.Vector3; hostel: boolean };
/**
 * Tags never pile up: each frame they're placed in order of importance (the chosen hostel, the one under the
 * pointer, the other hostels, then landmarks; nearer first), and a tag that would cover one already placed fades
 * out until you zoom in or turn the view and there's room for it.
 */
function Projector({ anchors, tags, selected, hovered }: { anchors: Anchor[]; tags: React.RefObject<Map<string, HTMLElement>>; selected: string | null; hovered: string | null }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const sizes = useRef(new Map<string, [number, number]>());
  useEffect(() => sizes.current.clear(), [selected]);
  useFrame(({ camera, size }) => {
    const items: { a: Anchor; el: HTMLElement; x: number; y: number; z: number; rank: number }[] = [];
    for (const a of anchors) {
      const el = tags.current.get(a.key);
      if (!el) continue;
      v.copy(a.at).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      if (off) {
        el.style.visibility = "hidden";
        continue;
      }
      const rank = a.key === selected ? 0 : a.key === hovered ? 1 : a.hostel ? 2 : 3;
      items.push({ a, el, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, z: v.z, rank });
    }
    items.sort((p, q) => p.rank - q.rank || p.z - q.z);
    // Read every size first (cached), then write: no layout thrash.
    for (const it of items) {
      if (!sizes.current.has(it.a.key)) sizes.current.set(it.a.key, [it.el.offsetWidth || 90, it.el.offsetHeight || 26]);
    }
    const placed: [number, number, number, number][] = [];
    for (const it of items) {
      const [w, h] = sizes.current.get(it.a.key)!;
      const r: [number, number, number, number] = [it.x - w / 2 - 3, it.y - h - 3, it.x + w / 2 + 3, it.y + 3];
      const clash = placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]);
      it.el.style.visibility = "visible";
      it.el.style.transform = `translate(${it.x}px, ${it.y}px) translate(-50%, -100%)`;
      if (clash) it.el.dataset.hidden = "";
      else {
        delete it.el.dataset.hidden;
        placed.push(r);
      }
    }
  });
  return null;
}

/** Flies the camera to the chosen hostel (or back out to the whole campus), easing to a stop. */
function Flight({ data, selected, controls }: { data: CampusData; selected: string | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const b = data.buildings.find((x) => x.slug === selected);
    if (!b) {
      goal.current = { pos: START.pos.clone(), target: START.target.clone() };
      return;
    }
    const [cx, cz] = centroid(b.p);
    const target = new THREE.Vector3(cx, b.h * 0.45, cz);
    // Come in from the side the camera is already on, low and close: "walking up to the door".
    const from = camera.position.clone().sub(target).setY(0).normalize();
    // Far enough to see the whole block (big footprints and tall towers need more room), close enough to feel "there".
    const radius = Math.max(...b.p.map(([x, z]) => Math.hypot(x - cx, z - cz)));
    const dist = 90 + radius * 2.1 + b.h * 1.2;
    const pos = target.clone().add(from.multiplyScalar(dist)).setY(b.h + dist * 0.55);
    goal.current = { pos, target };
  }, [selected, data, camera]);
  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(g.pos, k);
    c.target.lerp(g.target, k);
    c.update();
    if (camera.position.distanceTo(g.pos) < 0.5 && c.target.distanceTo(g.target) < 0.5) goal.current = null;
  });
  return null;
}

export default function HostelScene({
  selected,
  onPick,
  active,
  loadingLabel,
}: {
  selected: string | null;
  onPick: (slug: string) => void;
  /** False while the scene is scrolled out of view: rendering pauses. */
  active: boolean;
  loadingLabel: string;
}) {
  const [data, setData] = useState<CampusData | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    let live = true;
    fetch("/map/ktr-campus.json")
      .then((r) => r.json())
      .then((d: CampusData) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const tags = useRef(new Map<string, HTMLElement>());
  const [hovered, setHovered] = useState<string | null>(null);
  const labelled = useMemo(
    () =>
      (data?.buildings ?? [])
        .filter((b) => b.slug || b.label)
        .map((b) => {
          const [x, z] = centroid(b.p);
          return { key: b.slug ?? b.label!, b, at: new THREE.Vector3(x, b.h + 4, z), hostel: !!b.slug };
        }),
    [data],
  );
  const anchors = labelled;

  if (!data) return <p className="grid h-full place-items-center text-sm text-[var(--fg-muted)]">{loadingLabel}</p>;
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={active ? "always" : "never"}
        camera={{ position: START.pos.toArray(), fov: 38, near: 2, far: 6000 }}
        onPointerMissed={() => (document.body.style.cursor = "")}
      >
        <color attach="background" args={["#0a0f0b"]} />
        <fog attach="fog" args={["#0a0f0b", 900, 2400]} />
        <hemisphereLight args={["#dfe8ff", "#1b2418", 0.85]} />
        <directionalLight
          position={[-380, 520, 260]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-700}
          shadow-camera-right={700}
          shadow-camera-top={700}
          shadow-camera-bottom={-700}
          shadow-camera-far={2000}
          shadow-bias={-0.0005}
        />
        <Campus data={data} selected={selected} hovered={hovered} onPick={onPick} onHover={setHovered} />
        <Projector anchors={anchors} tags={tags} selected={selected} hovered={hovered} />
        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={1.32} minDistance={50} maxDistance={1400} target={START.target.toArray()} />
        <Flight data={data} selected={selected} controls={controls} />
      </Canvas>
      {/* Name tags: hostels can be picked by their tag; landmarks are just for orientation. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labelled.map(({ key, b }) => (
          <div
            key={key}
            ref={(el) => {
              if (el) tags.current.set(key, el);
              else tags.current.delete(key);
            }}
            className="hostel-tagbox absolute top-0 left-0"
            style={{ visibility: "hidden", zIndex: b.slug === selected ? 4 : b.slug === hovered ? 3 : b.slug ? 2 : 1 }}
          >
            {b.slug ? (
              <div
                onClick={() => onPick(b.slug!)}
                onPointerEnter={() => setHovered(b.slug!)}
                onPointerLeave={() => setHovered(null)}
                className={`hostel-tag pointer-events-auto ${b.slug === selected ? "is-on" : ""}`}
                data-group={b.group}
              >
                <span className="hostel-tag-kind" />
                {b.name}
              </div>
            ) : (
              <div className="hostel-landmark">{b.label}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
