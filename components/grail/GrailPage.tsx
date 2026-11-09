import { getLocale, getTranslations } from "next-intl/server";
import { getContent } from "@/lib/content";
import { Link, type Locale } from "@/lib/i18n";
import { GrailMotion } from "./GrailMotion";
import { Rise } from "./Rise";

/**
 * The "Level up" theme for inner pages: the same black ground, serif display type, rising letters, corner labels
 * and sliding sheets as the homepage, packaged so any page can wear it. Content, ids, anchors and landmarks stay
 * exactly as they were; only the presentation changes.
 */

export { Crest } from "./Crest";

/** The page's <main>: switches the theme on and wires the motion (rising headings, sheet entrances). */
export function GrailPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main id="main" tabIndex={-1} data-grail data-grail-page className={`bg-[var(--bg)] text-[var(--fg)] ${className}`}>
      <GrailMotion />
      {children}
    </main>
  );
}

/** Small labels in the top corners of a chapter: what it is on the left, its level on the right. */
async function Corner({ kicker, level }: { kicker: string; level: number }) {
  const t = await getTranslations("Grail");
  return (
    <div className="flex justify-between gap-4 text-sm font-medium opacity-80">
      <span>{kicker}</span>
      <span className="shrink-0">{t("level", { n: String(level).padStart(2, "0") })}</span>
    </div>
  );
}

/** The page's opening chapter on black: corner labels, a huge serif title whose letters rise, the lead, actions. */
export async function GrailHero({
  kicker,
  level = 1,
  title,
  lead,
  before,
  children,
  size = "text-[clamp(2.8rem,9vw,7.5rem)]",
  titleStyle,
}: {
  kicker: string;
  level?: number;
  title: string;
  titleStyle?: React.CSSProperties;
  lead?: React.ReactNode;
  before?: React.ReactNode;
  children?: React.ReactNode;
  size?: string;
}) {
  return (
    <section aria-labelledby="page-title" data-tone="hero" className="relative overflow-hidden pb-20 lg:pb-28">
      <div className="site-container pt-6">
        {before}
        <Corner kicker={kicker} level={level} />
        <Rise as="h1" id="page-title" onLoad text={title} style={titleStyle} className={`mt-6 ${size}`} />
        {lead ? <div className="mt-6 max-w-2xl text-lg text-[var(--fg-muted)]">{lead}</div> : null}
        {children}
      </div>
    </section>
  );
}

/**
 * One chapter of a page. `tone` picks the ground: black, an off-white sheet or the lilac cloud. Sheets and lilac
 * slide up over the chapter before them with a slight tilt that straightens as they land.
 */
export async function GrailChapter({
  id,
  tone = "dark",
  kicker,
  level,
  title,
  titleId,
  intro,
  children,
  className = "",
  size = "text-[clamp(2.4rem,7vw,6rem)]",
}: {
  id?: string;
  tone?: "dark" | "light" | "lilac";
  kicker: string;
  level: number;
  title: string;
  titleId: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: string;
}) {
  const ground = tone === "light" ? "grail-sheet" : tone === "lilac" ? "grail-lilac" : "";
  return (
    <section id={id} aria-labelledby={titleId} data-tone={tone} className={`relative scroll-mt-16 ${ground} ${className}`}>
      <div className="site-container py-16 lg:py-24">
        <Corner kicker={kicker} level={level} />
        <Rise id={titleId} text={title} className={`mt-4 ${size}`} />
        {intro ? <div className="mt-4 max-w-2xl text-lg text-[var(--fg-muted)]">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** The closing lilac chapter every page ends on: apply, ask, or call. */
export async function GrailStart({ level }: { level: number }) {
  const t = await getTranslations("Grail.start");
  const { site } = getContent((await getLocale()) as Locale);
  return (
    <GrailChapter tone="lilac" kicker={t("kicker")} level={level} title={t("title")} titleId="page-start" intro={t("intro")} size="text-[clamp(2.8rem,9vw,8rem)]">
      <div className="flex flex-wrap gap-3">
        <Link href="/admissions#apply" className="grail-cta grail-cta-ink">
          {t("apply")}
        </Link>
        <Link href="/admissions#enquiry" className="inline-flex min-h-12 items-center rounded-full border border-current px-6 font-semibold text-[var(--fg)] no-underline">
          {t("enquire")}
        </Link>
        {site.admissions.phones.slice(0, 1).map((p) => (
          <a key={p.tel} href={`tel:${p.tel}`} className="inline-flex min-h-12 items-center rounded-full border border-current px-6 font-semibold text-[var(--fg)] no-underline">
            {t("call")}: {p.display}
          </a>
        ))}
      </div>
    </GrailChapter>
  );
}

/** An outline pill for secondary actions on black. */
export const ghostPill =
  "inline-flex min-h-12 items-center rounded-full border border-[var(--line)] px-6 font-semibold text-[var(--fg)] no-underline hover:border-[var(--fg)]";

/** "On this page" as a row of chips in the hero: every chapter one tap away (replaces the old sidebar list). */
export function JumpChips({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <nav aria-label={label} className="mt-12">
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[var(--fg)] no-underline hover:border-[var(--fg)]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Grounds for a run of chapters: off-white and black in turn, with lilac every fourth. */
export const chapterTone = (i: number): "light" | "dark" | "lilac" => (i % 4 === 3 ? "lilac" : i % 2 === 0 ? "light" : "dark");
