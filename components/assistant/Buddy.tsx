/**
 * "Leafy", Ask SRM's mascot: a round lilac sprout with two leaves (an original character, echoing the tree and the
 * site's lilac). Decorative: the button or heading beside it carries the name for screen readers. Moods are pure CSS
 * (idle blink and bob, wave, think); all of it stops under reduced motion or Lite Mode.
 */
type BuddyMood = "idle" | "think";

export function Buddy({ mood = "idle", className = "" }: { mood?: BuddyMood; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-mood={mood} className={`buddy ${className}`}>
      {/* leaves: they wave on hover and wiggle while thinking */}
      <g className="buddy-leaf-l">
        <path d="M30 17C24 8 14 8 11 12c4 6 12 8 19 5z" fill="#2E8B57" />
        <path d="M27 15c-4-2-8-2-11-1" fill="none" stroke="#9EE3B5" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g className="buddy-leaf-r">
        <path d="M34 17c6-9 16-9 19-5-4 6-12 8-19 5z" fill="#3DA46A" />
        <path d="M37 15c4-2 8-2 11-1" fill="none" stroke="#9EE3B5" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <path d="M32 22v-6" stroke="#2E8B57" strokeWidth="3" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="32" cy="40" rx="21" ry="19" fill="#ECD2F3" />
      <ellipse cx="32" cy="40" rx="21" ry="19" fill="none" stroke="#623562" strokeWidth="2.2" />
      <ellipse cx="22" cy="31" rx="6" ry="3.2" fill="#fff" opacity=".55" transform="rotate(-24 22 31)" />
      {/* face */}
      <g className="buddy-eyes">
        <ellipse className="buddy-eye" cx="24" cy="39" rx="3.1" ry="4.2" fill="#2b1f2b" />
        <ellipse className="buddy-eye" cx="40" cy="39" rx="3.1" ry="4.2" fill="#2b1f2b" />
        <circle cx="25" cy="37.4" r="1.1" fill="#fff" />
        <circle cx="41" cy="37.4" r="1.1" fill="#fff" />
      </g>
      <ellipse cx="17" cy="46" rx="3.6" ry="2.3" fill="#F08FB0" opacity=".6" />
      <ellipse cx="47" cy="46" rx="3.6" ry="2.3" fill="#F08FB0" opacity=".6" />
      <path className="buddy-mouth" d="M27.5 47c2.6 3 6.4 3 9 0" fill="none" stroke="#623562" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
