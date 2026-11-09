/**
 * Motion gate. Every GSAP / Lenis / R3F entry point checks this first.
 * Reads the attributes set by lib/lite-mode.ts, so Lite Mode and prefers-reduced-motion both switch motion off.
 */

export function motionAllowed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.motion === "full";
}

/** Video and 3D are heavier than motion: off in Lite Mode even if the visitor allows motion. */
export function heavyMediaAllowed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.lite !== "on";
}
