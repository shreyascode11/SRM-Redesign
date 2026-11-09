import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * All scroll choreography. Loaded lazily by MotionDirector, only when motion is allowed
 * (not reduced motion, not Lite Mode). Every scene enhances markup that is already complete and readable:
 * remove this module and the page loses nothing but motion.
 *
 * Rules kept: transform + opacity only; numbers are real SSR text before and after counting;
 * everything is reverted by the returned cleanup (Lite Mode can switch on mid-session).
 */
export function startMotion(): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const cleanups: (() => void)[] = [];

  // ── Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync ──
  const lenis = new Lenis({
    autoRaf: false,
    anchors: { offset: -80 },
    prevent: (node) => !!node.closest("dialog, [data-lenis-prevent]"),
  });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  cleanups.push(() => {
    gsap.ticker.remove(tick);
    lenis.destroy();
  });

  const ctx = gsap.context(() => {
    cleanups.push(...counters());
  });
  cleanups.push(() => ctx.revert());
  cleanups.push(magneticButtons());
  cleanups.push(cursor());

  ScrollTrigger.refresh();
  return () => {
    for (const fn of cleanups.reverse()) fn();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}

/**
 * Counters: the real number is in the HTML from the server. On first entry we count up to that same value.
 * Screen readers get the final text throughout (the animating copy is aria-hidden).
 */
function counters(): (() => void)[] {
  const restores: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const value = Number(el.dataset.count);
    if (!Number.isFinite(value)) return;
    const prefix = el.dataset.countPrefix ?? "";
    const suffix = el.dataset.countSuffix ?? "";
    const decimals = Number(el.dataset.countDecimals ?? 0);
    const finalText = el.textContent ?? "";
    const format = new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = finalText;
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.textContent = finalText;
    el.replaceChildren(sr, visual);
    restores.push(() => {
      el.textContent = finalText;
    });

    const state = { n: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        gsap.fromTo(
          state,
          { n: 0 },
          {
            n: value,
            duration: 1.4,
            ease: "power3.out",
            onUpdate: () => {
              visual.textContent = `${prefix}${format.format(state.n)}${suffix}`;
            },
            onComplete: () => {
              visual.textContent = finalText;
            },
          },
        );
      },
    });
  });
  return restores;
}

/** Hull-style magnetic buttons with a leaf ripple on press. Opt in with data-magnetic. */
function magneticButtons(): () => void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  const offs: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const toX = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const toY = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      toX((e.clientX - (r.left + r.width / 2)) * 0.22);
      toY((e.clientY - (r.top + r.height / 2)) * 0.3);
    };
    const leave = () => {
      toX(0);
      toY(0);
    };
    const press = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const leaf = document.createElement("span");
      leaf.className = "leaf-ripple";
      leaf.setAttribute("aria-hidden", "true");
      leaf.style.left = `${e.clientX - r.left}px`;
      leaf.style.top = `${e.clientY - r.top}px`;
      el.append(leaf);
      gsap.fromTo(
        leaf,
        { scale: 0, opacity: 0.45, rotate: 45 },
        { scale: Math.max(r.width, r.height) / 10, opacity: 0, rotate: 45, duration: 0.7, ease: "power2.out", onComplete: () => leaf.remove() },
      );
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", press);
    offs.push(() => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", press);
      gsap.set(el, { clearProps: "transform" });
    });
  });
  return () => offs.forEach((f) => f());
}

/**
 * Desktop cursor: a leaf-node ring that follows the pointer, grows over interactive elements and shows a
 * label where one is declared (data-cursor-label, e.g. "Drag" on the college strip). The native cursor
 * stays visible — this is an accent, not a replacement.
 */
function cursor(): () => void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  ring.append(label);
  document.body.append(ring);

  const toX = gsap.quickTo(ring, "x", { duration: 0.25, ease: "power3.out" });
  const toY = gsap.quickTo(ring, "y", { duration: 0.25, ease: "power3.out" });
  let state = "";
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    ring.classList.add("is-visible");
    toX(e.clientX);
    toY(e.clientY);
    const target = e.target as Element | null;
    const labelled = target?.closest<HTMLElement>("[data-cursor-label]");
    const interactive = target?.closest("a, button, [role=button], summary, label");
    const next = labelled ? `label:${labelled.dataset.cursorLabel}` : interactive ? "hover" : "";
    if (next === state) return;
    state = next;
    ring.dataset.state = labelled ? "label" : interactive ? "hover" : "";
    label.textContent = labelled?.dataset.cursorLabel ?? "";
  };
  const hide = () => ring.classList.remove("is-visible");
  const show = () => ring.classList.add("is-visible");
  window.addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", hide);
  document.documentElement.addEventListener("pointerenter", show);
  return () => {
    window.removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", hide);
    document.documentElement.removeEventListener("pointerenter", show);
    ring.remove();
  };
}
