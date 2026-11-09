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

  const mm = gsap.matchMedia();
  const ctx = gsap.context(() => {
    cleanups.push(...actTitles(mm));
    curtains();
    cleanups.push(...counters());
    treeFinale();
  });
  cleanups.push(() => {
    mm.revert();
    ctx.revert();
  });
  cleanups.push(magneticButtons());
  cleanups.push(dragStrip());
  cleanups.push(cursor());

  ScrollTrigger.refresh();
  return () => {
    for (const fn of cleanups.reverse()) fn();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}

const rand = gsap.utils.random;

/**
 * Act titles (RISD "incomplete → complete"): each letter is cut into two fragments that fly in from
 * scattered positions and lock together as the title scrolls in. Desktop: the assembled title then pins
 * as a faint watermark while the act's content scrolls over it.
 */
function actTitles(mm: gsap.MatchMedia): (() => void)[] {
  const restores: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>("[data-act-title]").forEach((title) => {
    const text = title.textContent ?? "";
    const original = title.innerHTML;

    // Screen readers keep the plain word; the fragments are aria-hidden.
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    for (const ch of text) {
      const letter = document.createElement("span");
      letter.className = "act-letter";
      for (const half of ["act-frag-top", "act-frag-bottom"]) {
        const frag = document.createElement("span");
        frag.className = `act-frag ${half}`;
        frag.textContent = ch;
        letter.append(frag);
      }
      visual.append(letter);
    }
    title.replaceChildren(sr, visual);
    restores.push(() => {
      title.innerHTML = original;
    });

    gsap.fromTo(
      title.querySelectorAll(".act-frag"),
      {
        x: () => rand(-0.3, 0.3) * window.innerWidth,
        y: () => rand(-180, 180),
        rotate: () => rand(-75, 75),
        opacity: 0,
      },
      {
        x: 0,
        y: 0,
        rotate: 0,
        opacity: 1,
        ease: "none",
        stagger: { each: 0.025, from: "random" },
        scrollTrigger: { trigger: title, start: "top 92%", end: "top 30%", scrub: 0.6, invalidateOnRefresh: true },
      },
    );

    const section = title.closest<HTMLElement>("[data-act]");
    mm.add("(min-width: 64rem)", () => {
      if (!section) return;
      ScrollTrigger.create({
        trigger: title,
        start: "top 14%",
        endTrigger: section,
        end: "bottom bottom",
        pin: true,
        pinSpacing: false,
      });
      gsap.to(title, {
        // Faint enough that the word never competes with the text scrolling over it.
        opacity: 0.06,
        ease: "none",
        scrollTrigger: { trigger: title, start: "top 14%", end: "+=35%", scrub: true },
      });
    });
  });
  return restores;
}

/**
 * Act transitions (Guildhall): the previous act's colour hangs over the top of the new act like a curtain
 * and lifts away (scaleY → 0) as you scroll in. The curtain element is display:none until this runs.
 */
function curtains() {
  document.querySelectorAll<HTMLElement>("[data-curtain]").forEach((curtain) => {
    const section = curtain.parentElement;
    if (!section) return;
    gsap.set(curtain, { display: "block", scaleY: 1, transformOrigin: "50% 0%" });
    gsap.to(curtain, {
      scaleY: 0,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top bottom", end: "top 25%", scrub: true },
    });
  });
}

/**
 * Tree finale (end of Act III): the branches draw in, the leaves pop out, and the visitor's leaf arrives last and
 * pulses three times. Only when it starts below the screen, so nothing that's already visible disappears.
 */
function treeFinale() {
  const root = document.querySelector<HTMLElement>("[data-tree-finale]");
  if (!root || root.getBoundingClientRect().top < window.innerHeight) return;
  const branches = root.querySelectorAll(".finale-branch");
  const leaves = root.querySelectorAll(".finale-leaf, .finale-dot");
  const apex = root.querySelector(".finale-apex");
  gsap.set(branches, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(leaves, { scale: 0, opacity: 0, transformOrigin: "50% 100%" });
  if (apex) gsap.set(apex, { scale: 0, opacity: 0 });
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 55%", once: true } });
  tl.to(branches, { strokeDashoffset: 0, duration: 1.1, ease: "power2.out", stagger: 0.006 }).to(
    leaves,
    { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)", stagger: { each: 0.025, from: "random" } },
    "-=0.5",
  );
  if (apex) tl.to(apex, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }).to(apex, { scale: 1.08, duration: 0.4, yoyo: true, repeat: 5, ease: "sine.inOut" });
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

/** Mouse drag-to-scroll on the college strip (touch and trackpads already scroll it natively). */
function dragStrip(): () => void {
  const strip = document.querySelector<HTMLElement>("[data-college-strip]");
  if (!strip) return () => {};
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let moved = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = strip.scrollLeft;
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5 && !moved) {
      moved = true;
      strip.style.scrollSnapType = "none";
      strip.setPointerCapture(e.pointerId);
    }
    if (moved) strip.scrollLeft = startScroll - dx;
  };
  const up = () => {
    dragging = false;
    strip.style.scrollSnapType = "";
  };
  // A drag shouldn't also open the card it started on.
  const click = (e: MouseEvent) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  };
  strip.addEventListener("pointerdown", down);
  strip.addEventListener("pointermove", move);
  strip.addEventListener("pointerup", up);
  strip.addEventListener("pointercancel", up);
  strip.addEventListener("click", click, true);
  return () => {
    strip.removeEventListener("pointerdown", down);
    strip.removeEventListener("pointermove", move);
    strip.removeEventListener("pointerup", up);
    strip.removeEventListener("pointercancel", up);
    strip.removeEventListener("click", click, true);
  };
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
