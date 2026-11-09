import type { KolamVariant } from "@/lib/kolam";
import { Kolam } from "./Kolam";

const KOLAM_VARIANTS: KolamVariant[] = ["lattice", "rings", "petals", "flower"];
const STAT_COLORS = ["var(--stat-build)", "var(--stat-think)", "var(--stat-connect)", "var(--stat-grow)"];

/** A kolam crest that's stable for a given key (a college, a centre), so the same thing always gets the same crest. */
export function Crest({ seed, className = "size-10" }: { seed: string; className?: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <Kolam variant={KOLAM_VARIANTS[h % 4]!} color={STAT_COLORS[(h >>> 3) % 4]!} className={`shrink-0 ${className}`} />;
}
