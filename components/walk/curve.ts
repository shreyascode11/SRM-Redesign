import * as THREE from "three";

/**
 * The "tiny planet" look (Messenger-style): every material is bent so the ground falls away with distance from the
 * player, like walking on a small round world. The world itself stays flat (collision, paths and the map use real
 * metres); only what you see curves. Shared uniforms, so one update per frame moves the whole world.
 */
export const curve = {
  uCurve: { value: 0.0009 },
  uCenter: { value: new THREE.Vector2() },
  uNight: { value: 0 },
  uTime: { value: 0 },
};

/** Visual drop at a world point: the same formula as the shader, so DOM labels sit on the bent world. */
export const dropAt = (x: number, z: number) => {
  const dx = x - curve.uCenter.value.x;
  const dz = z - curve.uCenter.value.y;
  return (dx * dx + dz * dz) * curve.uCurve.value;
};

// A three-step toon ramp: flat, friendly shading.
let ramp: THREE.DataTexture | null = null;
const toonRamp = () => {
  if (ramp) return ramp;
  const data = new Uint8Array([172, 172, 172, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
};

type Opts = {
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  windows?: boolean;
  grass?: boolean;
  /** Road surfaces (geometry carries aLat across, aLen along, aW width): 1 asphalt · 2 painted kerb · 3 paver tiles. */
  surface?: 1 | 2 | 3;
  sway?: boolean;
  transparent?: boolean;
  opacity?: number;
  emissive?: THREE.ColorRepresentation;
  map?: THREE.Texture;
};

const cache = new Map<string, THREE.Material>();

/** A bent toon material; identical requests share one material (and one shader program). */
export function toon(opts: Opts = {}): THREE.MeshToonMaterial {
  const key = JSON.stringify({ ...opts, map: opts.map?.uuid });
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? "#ffffff",
    gradientMap: toonRamp(),
    vertexColors: !!opts.vertexColors,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? "#000000",
    map: opts.map ?? null,
  });
  if (opts.transparent) m.depthWrite = false;
  bend(m, opts);
  cache.set(key, m);
  return m;
}

export function bend<T extends THREE.Material>(m: T, opts: Pick<Opts, "windows" | "sway" | "grass" | "surface"> = {}): T {
  m.onBeforeCompile = (s) => {
    s.uniforms.uCurve = curve.uCurve;
    s.uniforms.uCenter = curve.uCenter;
    s.uniforms.uNight = curve.uNight;
    s.uniforms.uTime = curve.uTime;
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uCurve;\nuniform vec2 uCenter;\nuniform float uTime;\nvarying vec3 vWorld;\nvarying vec3 vWNormal;" +
          (opts.windows ? "\nattribute float aStyle;\nattribute float aU;\nvarying float vStyle;\nvarying float vU;" : "") +
          (opts.surface ? "\nattribute float aLat;\nattribute float aLen;\nattribute float aW;\nvarying float vLat;\nvarying float vLen;\nvarying float vW;" : ""),
      )
      .replace(
        "#include <project_vertex>",
        `vec4 wp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
#endif
  wp = modelMatrix * wp;
  ${opts.sway ? "wp.x += sin(uTime * 1.3 + wp.x * 0.15 + wp.z * 0.11) * max(0.0, transformed.y - 1.0) * 0.06;" : ""}
  vWorld = wp.xyz;
  ${opts.windows ? "vStyle = aStyle; vU = aU;" : ""}
  ${opts.surface ? "vLat = aLat; vLen = aLen; vW = aW;" : ""}
  vWNormal = normalize(mat3(modelMatrix) * objectNormal);
  vec2 dd = wp.xz - uCenter;
  wp.y -= dot(dd, dd) * uCurve;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;`,
      );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform float uNight;\nuniform float uTime;\nvarying vec3 vWorld;\nvarying vec3 vWNormal;" +
        (opts.windows ? "\nvarying float vStyle;\nvarying float vU;" : "") +
        (opts.surface ? "\nvarying float vLat;\nvarying float vLen;\nvarying float vW;" : "") +
        "\nfloat h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat n21(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}" +
        "\nfloat box2(vec2 p, vec2 lo, vec2 hi){return step(lo.x,p.x)*step(p.x,hi.x)*step(lo.y,p.y)*step(p.y,hi.y);}",
    );
    if (opts.grass) {
      // Painted grass: darker and lighter patches, and short hand-drawn strokes.
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  float grassPatch = n21(vWorld.xz * 0.045) * 0.65 + n21(vWorld.xz * 0.16) * 0.35;
  diffuseColor.rgb *= mix(0.86, 1.08, smoothstep(0.35, 0.7, grassPatch));
  vec2 g = vWorld.xz * 1.6;
  vec2 gi = floor(g);
  vec2 gf = fract(g) - vec2(h21(gi), h21(gi + 3.1)) * 0.6 - 0.2;
  float stroke = step(0.82, h21(gi + 7.7)) * step(abs(gf.x + gf.y * 0.35), 0.03) * step(abs(gf.y), 0.22);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, stroke);`,
      );
    }
    if (opts.surface === 1) {
      // Asphalt: grain, repaired patches, lighter tyre tracks, white edge lines and centre dashes (wide roads).
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  float grain = h21(floor(vWorld.xz * 7.0));
  diffuseColor.rgb *= 0.94 + 0.08 * grain;
  float patchN = n21(vWorld.xz * 0.07 + 3.0);
  float repaired = smoothstep(0.72, 0.74, patchN);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, repaired);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.15, 0.2), (smoothstep(0.715, 0.72, patchN) - smoothstep(0.72, 0.725, patchN)) * 0.5);
  float lat = abs(vLat);
  float track = 1.0 - smoothstep(0.0, 0.1, abs(lat - 0.42));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.1, track * 0.6);
  float edgeLine = step(0.82, lat) * step(lat, 0.88) * step(5.5, vW);
  float dash = step(lat, 0.035) * step(fract(vLen / 7.0), 0.42) * step(7.0, vW);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.86), max(edgeLine, dash) * 0.95);`,
      );
    }
    if (opts.surface === 2) {
      // Kerb stones painted in black and yellow bands.
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  float band = step(0.5, fract(vLen / 1.1));
  diffuseColor.rgb = mix(vec3(0.16, 0.17, 0.19), vec3(0.95, 0.8, 0.27), band);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.15, 0.2), step(fract(vLen / 1.1), 0.03) * 0.6);`,
      );
    }
    if (opts.surface === 3) {
      // Footpaths: interlocking paver tiles in a running bond.
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  vec2 t = vec2(vLen / 0.45, (vLat * 0.5 + 0.5) * vW / 0.3);
  t.x += step(1.0, mod(floor(t.y), 2.0)) * 0.5;
  vec2 f = fract(t);
  float joint = step(f.x, 0.07) + step(f.y, 0.1);
  float tone = h21(floor(t)) * 0.08;
  diffuseColor.rgb *= 0.95 + tone;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, clamp(joint, 0.0, 1.0));`,
      );
    }
    if (opts.windows) {
      s.fragmentShader = s.fragmentShader
        .replace("void main() {", "void main() {\n  float winMask = 0.0;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
  // Windows, by style (buildings.ts): 1 punched · 2 grid · 3 hostel (with grills) · 4 curtain glass · 5 corrugated.
  if (abs(vWNormal.y) < 0.5 && vStyle > 0.5) {
    float st = floor(vStyle + 0.5);
    float fy = vWorld.y;
    float row = fract(fy / 3.4);
    float ground = step(fy, 3.4);
    vec3 glassC = vec3(0.16, 0.21, 0.27);
    vec3 inkC = vec3(0.13, 0.15, 0.2);
    float win = 0.0, frame = 0.0, line = 0.0;
    if (st < 1.5) {
      float c = fract(vU / 2.6);
      win = box2(vec2(c, row), vec2(0.36, 0.34), vec2(0.64, 0.7));
      frame = box2(vec2(c, row), vec2(0.32, 0.3), vec2(0.68, 0.74)) - win;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, frame);
    } else if (st < 2.5) {
      float c = fract(vU / 3.2);
      win = box2(vec2(c, row), vec2(0.1, 0.3), vec2(0.9, 0.8)) * (1.0 - ground * 0.6);
      frame = box2(vec2(c, row), vec2(0.07, 0.27), vec2(0.93, 0.83)) - box2(vec2(c, row), vec2(0.1, 0.3), vec2(0.9, 0.8));
      line = win * (step(abs(c - 0.5), 0.012) + step(abs(row - 0.55), 0.01));
    } else if (st < 3.5) {
      float c = fract(vU / 3.6);
      win = box2(vec2(c, row), vec2(0.18, 0.3), vec2(0.82, 0.76));
      frame = box2(vec2(c, row), vec2(0.15, 0.27), vec2(0.85, 0.79)) - win;
      // Grills: thin bars across the glass.
      line = win * (step(fract(vU * 2.2), 0.08) + step(abs(row - 0.53), 0.012));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.96, 0.93), frame);
      frame = 0.0;
    } else if (st < 4.5) {
      win = 1.0;
      line = step(fract(vU / 1.6), 0.025) + step(row, 0.03);
      glassC = mix(vec3(0.2, 0.37, 0.63), vec3(0.42, 0.62, 0.82), smoothstep(0.0, 1.0, fract(vU * 0.13 + fy * 0.02)));
    } else {
      diffuseColor.rgb *= 0.9 + 0.1 * step(0.5, fract(vU / 0.35));
      line = step(abs(fy - 4.2), 0.06);
    }
    winMask = clamp(win, 0.0, 1.0);
    // Monsoon weathering: faint vertical streaks under the windows and darker toward the ground.
    float streak = smoothstep(0.55, 0.95, n21(vec2(vU * 0.9, floor(fy / 3.4) * 7.0 + fy * 0.05)));
    diffuseColor.rgb *= (1.0 - 0.07 * streak * (1.0 - winMask)) * (0.94 + 0.06 * smoothstep(0.0, 4.0, fy));
    diffuseColor.rgb = mix(diffuseColor.rgb, glassC, winMask);
    // A soft sky reflection band on the glass.
    diffuseColor.rgb += winMask * 0.08 * step(0.55, fract(vU * 0.21 + row * 0.6));
    diffuseColor.rgb = mix(diffuseColor.rgb, inkC, clamp(line + frame * 0.75, 0.0, 1.0) * 0.85);
  }`,
        )
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.rgb += winMask * uNight * vec3(1.0, 0.8, 0.5) * 0.45;");
    }
  };
  m.customProgramCacheKey = () => `bend${opts.windows ? "w" : ""}${opts.sway ? "s" : ""}${opts.grass ? "g" : ""}${opts.surface ?? ""}`;
  return m;
}
