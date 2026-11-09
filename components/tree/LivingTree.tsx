import type { CSSProperties } from "react";
import { generateTree, type TreeSegment } from "@/lib/tree";
import { TreeScroll } from "./TreeScroll";

const tree = generateTree();
const window_ = (s: number, e: number) => ({ "--s": s, "--e": e }) as CSSProperties;

/**
 * Homepage-only scroll progress. Desktop: small bare tree fixed bottom-left (no box, so it never hides what's behind it), shown only while
 * the three acts are on screen (the hero shows the seed instead — see HeroSeed). Mobile: thin progress bar.
 * Decorative (aria-hidden): progress through the acts is also conveyed by the act headings themselves.
 */
export function LivingTree() {
  return (
    <TreeScroll>
      <div aria-hidden="true" className="living-tree pointer-events-none fixed bottom-4 left-4 z-40 hidden w-20 lg:block xl:w-24">
        <svg viewBox={tree.viewBox} focusable="false" className="block w-full overflow-visible">
          <line
            x1={tree.base.x - 46}
            x2={tree.base.x + 46}
            y1={tree.ground}
            y2={tree.ground}
            className="tree-ground"
          />
          <g className="tree-roots">{tree.roots.map(seg)}</g>
          <g>{tree.trunk.map(seg)}</g>
          <g>{tree.branches.map(seg)}</g>
          <g>
            {tree.leaves.map((l, i) => (
              <ellipse
                key={i}
                cx={l.cx}
                cy={l.cy}
                rx={l.rx}
                ry={l.ry}
                opacity={l.opacity}
                className="tree-leaf"
                // CSS rotate (not the SVG transform attribute): composes with the CSS scale around the leaf's own centre.
                style={{ "--s": l.s, rotate: `${l.rotate}deg` } as CSSProperties}
              />
            ))}
          </g>
          <circle cx={tree.base.x} cy={tree.base.y} r={4} className="tree-seed" />
        </svg>
      </div>
      <div aria-hidden="true" className="tree-bar pointer-events-none fixed inset-x-0 top-16 z-40 h-[3px] lg:hidden" />
    </TreeScroll>
  );
}

function seg(s: TreeSegment, i: number) {
  return (
    <path
      key={i}
      d={s.d}
      strokeWidth={s.width}
      pathLength={1}
      className="tree-seg"
      style={window_(s.s, s.e)}
    />
  );
}
