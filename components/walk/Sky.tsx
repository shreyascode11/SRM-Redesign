"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * A painted sky: a teal gradient with flat, cel-shaded clouds (a light top, a cooler underside and a thin ink rim),
 * drifting slowly. It follows the camera, so it is always "at infinity", and it is left out of the ink line pass.
 */
const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform vec3 uCloudShade;
uniform vec3 uInk;
uniform float uTime;
uniform float uNight;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  // Clouds on a flattened dome, thicker near the horizon, stretched sideways like painted streaks.
  vec2 p = vDir.xz / (0.25 + vDir.y) * vec2(0.9, 1.6) + vec2(uTime * 0.004, 0.0);
  float c = fbm(p * 1.4);
  float shape = smoothstep(0.56, 0.58, c) * smoothstep(0.02, 0.18, vDir.y);
  float shade = smoothstep(0.62, 0.64, fbm(p * 1.4 + vec2(0.03, 0.05)));
  vec3 cloud = mix(uCloudShade, uCloud, shade);
  col = mix(col, cloud, shape);
  // Ink rim around each cloud.
  float rim = smoothstep(0.545, 0.56, c) - smoothstep(0.56, 0.575, c);
  col = mix(col, uInk, rim * 0.35 * smoothstep(0.02, 0.18, vDir.y));
  // Stars at night.
  float star = step(0.9985, hash(floor(vDir.xz * 420.0 + vDir.y * 13.0))) * uNight * smoothstep(0.1, 0.4, vDir.y);
  col += star * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

type SkyColors = { top: string; horizon: string; cloud: string; cloudShade: string; night: number };

export function Sky({ colors }: { colors: SkyColors }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uCloud: { value: new THREE.Color() },
          uCloudShade: { value: new THREE.Color() },
          uInk: { value: new THREE.Color("#2a3a44") },
          uTime: { value: 0 },
          uNight: { value: 0 },
        },
      }),
    [],
  );
  useMemo(() => {
    mat.uniforms.uTop!.value.set(colors.top);
    mat.uniforms.uHorizon!.value.set(colors.horizon);
    mat.uniforms.uCloud!.value.set(colors.cloud);
    mat.uniforms.uCloudShade!.value.set(colors.cloudShade);
    mat.uniforms.uNight!.value = colors.night;
  }, [mat, colors]);
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-10} frustumCulled={false} userData={{ noInk: true }}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  );
}
