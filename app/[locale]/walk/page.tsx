import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { GrailChapter, GrailHero, GrailPage, GrailStart } from "@/components/grail/GrailPage";
import { WalkLauncher } from "@/components/walk/WalkLauncher";
import type { Locale } from "@/lib/i18n";
import { alternatesFor, socialFor } from "@/lib/page-metadata";
import { getWalkScript } from "@/lib/walk/script";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Walk.meta" });
  const social = socialFor(locale, { title: t("title"), description: t("description"), path: "/walk", ownImage: true });
  // The link preview is a real frame from the game.
  const image = { url: "/walk/cover-gate.jpg", width: 1200, height: 630, alt: t("coverAlt") };
  return {
    title: `${t("title")} — SRMIST`,
    description: t("description"),
    alternates: alternatesFor(locale, "/walk"),
    ...social,
    openGraph: { ...social.openGraph, images: [image] },
    twitter: { ...social.twitter, images: [image.url] },
  };
}

/**
 * Walk SRM: the Kattankulathur campus as a small walkable world (Messenger-style). The game is an enhancement behind
 * "Begin"; this page itself is static, light and complete without it: the tour below lists every place, person and
 * quest in the game, with links to the right pages.
 */
export default async function WalkPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Walk");
  const script = await getWalkScript(locale);
  const placeName = (id: string) => script.places.find((p) => p.id === id)?.name ?? id;
  const kinds = new Map<string, typeof script.places>();
  for (const p of script.places) kinds.set(p.kindLabel, [...(kinds.get(p.kindLabel) ?? []), p]);

  return (
    <GrailPage>
      <GrailHero
        kicker={t("hero.kicker")}
        title={t("hero.title")}
        lead={
          <>
            <p>{t("hero.lead")}</p>
            <p className="mt-2 text-sm">{t("hero.time")}</p>
          </>
        }
      >
        <WalkLauncher
          script={script}
          labels={{ begin: t("hero.begin"), outfitFirst: t("hero.outfitFirst"), textTour: t("hero.textTour"), lite: t("hero.lite"), noWebgl: t("hero.noWebgl") }}
        />
        <Image
          src="/walk/cover-gate.jpg"
          alt={t("meta.coverAlt")}
          width={1200}
          height={630}
          priority
          sizes="(min-width: 1440px) 1344px, 100vw"
          className="mt-10 w-full rounded-[28px] border border-white/15"
        />
        <p className="mt-6 max-w-2xl text-xs text-[var(--fg-muted)]">{t("hero.credit")}</p>
      </GrailHero>

      <div id="walk-tour" className="scroll-mt-16">
        <GrailChapter tone="light" kicker={t("tour.title")} level={2} title={t("tour.questsTitle")} titleId="walk-quests" intro={<p>{t("tour.intro")}</p>}>
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {script.quests.map((q) => (
              <li key={q.id} className="grail-paper flex flex-col gap-2 p-5">
                <p className="text-sm font-semibold text-fg-muted uppercase">{script.stats[q.stat]}</p>
                <h3 className="text-2xl font-bold">{q.title}</h3>
                <ol className="flex list-decimal flex-col gap-1 pl-5">
                  {q.steps.map((s) => (
                    <li key={s.hint}>{s.hint}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </GrailChapter>

        <GrailChapter kicker={t("tour.title")} level={3} title={t("tour.peopleTitle")} titleId="walk-people">
          <ul className="grid gap-4 md:grid-cols-2">
            {script.people.map((p) => (
              <li key={p.id} className="grail-paper flex flex-col gap-2 p-5">
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-sm text-fg-muted">{t("tour.at", { place: placeName(p.at) })}</p>
                <p>“{p.greet}”</p>
                {p.topics.length ? (
                  <dl className="mt-1 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
                    {p.topics.map((x) => (
                      <div key={x.id}>
                        <dt className="font-semibold">{x.q}</dt>
                        <dd className="text-fg-muted">
                          {x.a}{" "}
                          {x.link ? (
                            <a href={x.link.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                              {x.link.label} →
                            </a>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        </GrailChapter>

        <GrailChapter tone="light" kicker={t("tour.title")} level={4} title={t("tour.placesTitle")} titleId="walk-places">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[...kinds].map(([kind, list]) => (
              <section key={kind} aria-label={kind}>
                <h3 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">{kind}</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {list.map((p) => (
                    <li key={p.id} className="grail-paper flex items-center gap-3 p-2 pr-4">
                      {p.photo ? (
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                          <Image src={p.photo} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                      ) : (
                        <span aria-hidden="true" className="size-14 shrink-0 rounded-xl bg-[var(--line)]" />
                      )}
                      {p.href ? (
                        <a href={p.href} className="inline-flex min-h-11 items-center font-semibold">
                          {p.name}
                        </a>
                      ) : (
                        <span className="font-semibold">{p.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </GrailChapter>
      </div>

      <GrailStart level={5} />
    </GrailPage>
  );
}
