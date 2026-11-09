/**
 * Stand-in for real SRM photography / video until the team drops files into public/media/.
 * Neutral gradient + visible "PHOTO TODO" label — never stock photos of other campuses.
 */
type Props = {
  /** What the real photo should show, e.g. "Kattankulathur campus aerial at dusk". Doubles as alt text. */
  description: string;
  /** The file this placeholder stands in for, e.g. "media/campuses/kattankulathur.jpg". */
  file?: string;
  kind?: "photo" | "video";
  /** Background media: hidden from assistive tech (the real media will be decorative too). */
  decorative?: boolean;
  labelPosition?: "bottom-left" | "top-right";
  className?: string;
};

export function MediaPlaceholder({
  description,
  file,
  kind = "photo",
  decorative = false,
  labelPosition = "bottom-left",
  className = "",
}: Props) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": description };
  return (
    <div
      {...a11y}
      className={`relative overflow-hidden bg-gradient-to-br from-srm-blue-900 via-[#1a2f73] to-[#24467a] ${className}`}
    >
      <div
        className={`absolute max-w-[calc(100%-1.5rem)] rounded bg-ink/80 px-2 py-1 font-mono text-xs leading-snug text-paper ${
          labelPosition === "top-right" ? "top-3 right-3" : "bottom-3 left-3"
        }`}
      >
        <span className="font-bold">{kind === "video" ? "VIDEO TODO" : "PHOTO TODO"}</span>
        <span aria-hidden="true">
          {" "}
          · {description}
          {file ? ` → public/${file}` : ""}
        </span>
      </div>
    </div>
  );
}
