/**
 * Lite Mode: same information, zero video / 3D / smooth scroll.
 *
 * Auto-enabled when any of these are true (§8):
 *   - Save-Data            → navigator.connection.saveData (the JS mirror of the `Save-Data` header)
 *   - slow connection      → navigator.connection.effectiveType is 3g or worse
 *   - reduced motion       → prefers-reduced-motion: reduce
 * The visitor can override either way; the override is remembered in localStorage.
 *
 * State lives on <html> so CSS can react before React hydrates:
 *   data-lite="on" | "off"
 *   data-lite-reason="save-data" | "slow-network" | "reduced-motion" | "user" | ""
 *   data-motion="reduce" | "full"   (reduce whenever Lite is on OR the OS asks for it)
 */

export const LITE_STORAGE_KEY = "srm-lite";

export type LiteReason = "save-data" | "slow-network" | "reduced-motion" | "user";
type LiteOverride = "on" | "off" | null;

export type LiteState = {
  lite: boolean;
  reason: LiteReason | null;
  reducedMotion: boolean;
};

/**
 * Runs inline in <head> before first paint (serialised with toString), and again on the client
 * whenever the connection, motion preference or override changes.
 * Must stay self-contained: no imports, no outer-scope references.
 */
export function applyLiteMode(storageKey: string): void {
  const root = document.documentElement;
  let override: string | null = null;
  try {
    override = localStorage.getItem(storageKey);
  } catch {
    // Storage blocked (private mode etc.) — fall back to auto-detection.
  }
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let reason = "";
  if (conn && conn.saveData) reason = "save-data";
  else if (conn && /^(slow-2g|2g|3g)$/.test(conn.effectiveType || "")) reason = "slow-network";
  else if (prefersReduced) reason = "reduced-motion";

  let lite = reason !== "";
  if (override === "on") {
    lite = true;
    reason = "user";
  } else if (override === "off") {
    lite = false;
    reason = "";
  }

  root.dataset.lite = lite ? "on" : "off";
  root.dataset.liteReason = reason;
  root.dataset.motion = lite || prefersReduced ? "reduce" : "full";
}

export function setLiteOverride(value: LiteOverride): void {
  try {
    if (value === null) localStorage.removeItem(LITE_STORAGE_KEY);
    else localStorage.setItem(LITE_STORAGE_KEY, value);
  } catch {
    // Storage blocked — nothing to persist; auto-detection keeps working.
  }
  applyLiteMode(LITE_STORAGE_KEY);
}

/** Snapshot as a primitive so useSyncExternalStore can compare it cheaply. */
export function readLiteSnapshot(): string {
  const d = document.documentElement.dataset;
  return `${d.lite ?? "off"}|${d.liteReason ?? ""}|${d.motion ?? "full"}`;
}

export const SERVER_LITE_SNAPSHOT = "off||full";

export function parseLiteSnapshot(snapshot: string): LiteState {
  const [lite, reason, motion] = snapshot.split("|");
  return {
    lite: lite === "on",
    reason: (reason || null) as LiteReason | null,
    reducedMotion: motion === "reduce",
  };
}

/** Re-evaluates Lite Mode on connection / motion-preference changes; calls back on any change. */
export function subscribeLiteMode(onChange: () => void): () => void {
  const reapply = () => applyLiteMode(LITE_STORAGE_KEY);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const conn = (navigator as Navigator & { connection?: EventTarget }).connection;

  motionQuery.addEventListener("change", reapply);
  conn?.addEventListener("change", reapply);
  window.addEventListener("storage", reapply);

  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-lite", "data-lite-reason", "data-motion"],
  });

  return () => {
    motionQuery.removeEventListener("change", reapply);
    conn?.removeEventListener("change", reapply);
    window.removeEventListener("storage", reapply);
    observer.disconnect();
  };
}
