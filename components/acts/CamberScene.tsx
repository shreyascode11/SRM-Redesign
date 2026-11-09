import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { Photo } from "@/components/ui/Photo";
import { Fact } from "@/components/ui/Todo";
import type { Story } from "@/lib/content";
import { Link } from "@/lib/i18n";
import { findMedia, findSequence } from "@/lib/media";
import { CamberScroll } from "./CamberScroll";

/**
 * Team Camber Racing pinned scene.
 * Motion on: a ~3.4-screen track with a sticky stage; scrolling scrubs an image sequence of the car and the
 * event wins appear as callouts one by one. Motion off / Lite / no JS: the same stage as a normal block with
 * every callout visible and the poster image. Everything is real SSR text.
 */
export async function CamberScene({ story }: { story: Story }) {
  const t = await getTranslations("Acts.leap");
  const sequence = findSequence(story.media.sequence);
  const poster = findMedia(story.media.photo);
  // Facts are looked up by stable key, not by (translated) label.
  const fact = (key: string) => story.facts.find((f) => f.key === key)?.value;

  const wins = fact("eventWins")?.split(" · ") ?? [];
  const award = fact("award");
  const callouts = [
    ...wins.map((w) => ({ kicker: t("first"), text: w })),
    ...(award ? [{ kicker: t("award"), text: award }] : []),
  ];
  const eyebrow = [fact("result"), fact("category")].filter(Boolean).join(" · ");

  return (
    <article aria-labelledby={`sw-${story.slug}`} data-student-work={story.slug}>
      <CamberScroll frames={sequence} calloutCount={callouts.length}>
        <div className="camber-sticky overflow-hidden">
          {/* Media layer: poster (or first frame) → canvas drawn on top once frames load */}
          <div aria-hidden="true" className="absolute inset-0">
            {sequence ? (
              <Image src={sequence.lg[0]!} alt="" fill sizes="100vw" className="object-cover" />
            ) : poster ? (
              <Photo src={story.media.photo} alt="" decorative sizes="100vw" className="size-full" />
            ) : (
              <MediaPlaceholder
                decorative
                kind="video"
                description="Camber car — turntable or drive-by video, converted to a scroll sequence"
                file="media/camber/sequence/ (run scripts/make-sequence.sh)"
                labelPosition="top-right"
                className="size-full"
              />
            )}
            <div data-camber-canvas-slot className="absolute inset-0" />
            {/* Scrim sized for the worst case (a pure-white frame): ≥ 80% ink behind body text → ≥ 4.5:1.
                Mobile: strong top (title) and bottom (people, link), lighter middle where the car shows.
                Desktop: strong left column, clear right side; callouts carry their own dark backing. */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0d]/90 via-[#0a0a0d]/55 to-[#0a0a0d]/90 lg:bg-gradient-to-r lg:from-[#0a0a0d]/95 lg:via-[#0a0a0d]/82 lg:via-45% lg:to-transparent" />
          </div>

          <div className="site-container relative flex h-full flex-col gap-5 py-6 lg:justify-center lg:py-10">
            <div className="max-w-xl">
              {eyebrow ? <p className="text-sm font-semibold tracking-wide text-fg-muted uppercase">{eyebrow}</p> : null}
              <h4
                id={`sw-${story.slug}`}
                className="mt-2 font-display text-[clamp(1.6rem,3.6vw,3.25rem)] leading-[1.05] font-bold text-balance"
              >
                {story.title}
              </h4>
              <p className="mt-3 hidden text-lg text-fg-muted sm:block">{story.dek}</p>
            </div>

            <ol className="grid grid-cols-2 gap-2 lg:absolute lg:top-1/2 lg:right-12 lg:w-[23rem] lg:-translate-y-1/2 lg:grid-cols-1">
              {callouts.map((c, i) => (
                <li
                  key={c.text}
                  data-callout={i}
                  className="camber-callout flex flex-col rounded-2xl border border-line-subtle bg-[#0a0a0d]/80 px-3 py-2 lg:flex-row lg:items-baseline lg:gap-3 lg:px-4 lg:py-3"
                >
                  <span className="font-display text-sm font-bold text-tree lg:min-w-16 lg:text-base">{c.kicker}</span>
                  <span className="text-sm leading-snug lg:text-base">{c.text}</span>
                </li>
              ))}
            </ol>

            <div className="mt-auto flex max-w-xl flex-wrap items-end justify-between gap-4 lg:mt-0 lg:flex-col lg:items-start">
              <ul className="flex flex-col gap-0.5 text-sm">
                {story.people.map((p) => (
                  <li key={p.name}>
                    <span className="font-semibold">
                      <Fact value={p.name} />
                    </span>{" "}
                    · <Fact value={p.role} />
                  </li>
                ))}
              </ul>
              <Link
                href={`/stories/${story.slug}`}
                data-magnetic
                className="relative inline-flex min-h-11 items-center gap-2 overflow-hidden rounded-full border border-line bg-[#0a0a0d]/60 px-5 font-semibold text-fg no-underline hover:border-fg"
              >
                {t("readStory")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <p aria-hidden="true" className="camber-hint absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-sm text-fg-muted">
            {t("scrollHint")} ↓
          </p>
          <div aria-hidden="true" className="camber-progress absolute inset-x-0 bottom-0 h-1 bg-tree" />
        </div>
      </CamberScroll>
    </article>
  );
}
