"use client";

import { useEffect, useRef } from "react";

const DESKTOP = "(min-width: 64rem)";

/**
 * Footer groups are <details> rendered open, so without JS everything is visible.
 * With JS: collapsed on mobile, always open and non-toggling on desktop.
 */
export function FooterAccordion({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mq = window.matchMedia(DESKTOP);
    const blockToggle = (e: Event) => e.preventDefault();

    const apply = () => {
      root.querySelectorAll("details").forEach((d) => {
        d.open = mq.matches;
        const summary = d.querySelector("summary");
        if (!summary) return;
        if (mq.matches) {
          summary.tabIndex = -1;
          summary.addEventListener("click", blockToggle);
        } else {
          summary.removeAttribute("tabindex");
          summary.removeEventListener("click", blockToggle);
        }
      });
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
