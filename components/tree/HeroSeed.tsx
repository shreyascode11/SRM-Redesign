/** The seed at the bottom of the hero — what the Living Tree grows from once the acts begin. */
export function HeroSeed() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 80 16"
      className="pointer-events-none absolute bottom-3 left-1/2 w-20 -translate-x-1/2"
    >
      <line x1="0" x2="80" y1="10" y2="10" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="40" cy="10" r="4" fill="var(--leaf-green-300)" className="hero-seed" />
    </svg>
  );
}
