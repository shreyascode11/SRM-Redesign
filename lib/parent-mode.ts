/**
 * Parent Mode: programme pages lead with plain answers — fees, admission, safety and hostel,
 * distance, jobs — and a Call admissions button. State lives on <html data-parent="on|off">, set before first
 * paint (no flash), remembered in localStorage, and switchable by link: ?parent=on / ?parent=off.
 */
export const PARENT_STORAGE_KEY = "srm-parent";

/** Runs inline in <head> before first paint (serialised with toString). Must stay self-contained. */
export function applyParentMode(storageKey: string): void {
  let value: string | null = null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("parent");
    if (fromUrl === "on" || fromUrl === "off") localStorage.setItem(storageKey, fromUrl);
    value = localStorage.getItem(storageKey);
  } catch {
    // Storage blocked: Parent Mode simply starts off.
  }
  document.documentElement.dataset.parent = value === "on" ? "on" : "off";
}

export function setParentMode(on: boolean): void {
  try {
    localStorage.setItem(PARENT_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: applies to this page view only.
  }
  document.documentElement.dataset.parent = on ? "on" : "off";
}

export function subscribeParentMode(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-parent"] });
  return () => observer.disconnect();
}

export const readParentMode = () => document.documentElement.dataset.parent === "on";
