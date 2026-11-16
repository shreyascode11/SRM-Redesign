import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GrailChapter, GrailHero, GrailPage } from "@/components/grail/GrailPage";
import { getContent } from "@/lib/content";
import { Link, type Locale } from "@/lib/i18n";
import { alternatesFor, socialFor } from "@/lib/page-metadata";
import { getWalkScript } from "@/lib/walk/script";
import { TOUR_STOPS } from "@/lib/walk/tour";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Visit.meta" });
  return {
    title: `${t("title")} — SRMIST`,
    description: t("description"),
    alternates: alternatesFor(locale, "/visit"),
    ...socialFor(locale, { title: t("title"), description: t("description"), path: "/visit" }),
  };
}

/**
 * Plan your visit to Kattankulathur: getting there (address, directions, the train, the road), a ten-stop walk in
 * the same order as Walk SRM's guided tour (with what SRM publishes about each place), and who to call first.
 * Everything comes from the site's content and messages; nothing here is new data.
 */
export default async function VisitPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Visit");
  const { site, campuses } = getContent(locale);
  const campus = campuses.find((c) => c.slug === "kattankulathur");
  const script = await getWalkScript(locale);
  const stops = TOUR_STOPS.map((id) => script.places.find((p) => p.id === id)).filter((p) => p !== undefined);
  const directions = campus ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(campus.directionsQuery)}` : null;

  return (
    <GrailPage>
      <GrailHero kicker={t("hero.kicker")} title={t("hero.title")} lead={<p>{t("hero.lead")}</p>} />

      <GrailChapter tone="light" kicker={t("hero.kicker")} level={2} title={t("getThere.title")} titleId="visit-getting-here">
        <div className="grid gap-4 md:grid-cols-3">
          <section className="grail-paper flex flex-col gap-2 p-5" aria-labelledby="visit-address">
            <h3 id="visit-address" className="text-xl font-bold">
              📍 {t("getThere.address")}
            </h3>
            {campus ? <p>{campus.address}</p> : null}
            {directions ? (
              <a href={directions} className="mt-auto inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {t("getThere.directions")} →
              </a>
            ) : null}
          </section>
          <section className="grail-paper flex flex-col gap-2 p-5" aria-labelledby="visit-train">
            <h3 id="visit-train" className="text-xl font-bold">
              🚆 {t("getThere.train")}
            </h3>
            <p>{t("getThere.trainText")}</p>
          </section>
          <section className="grail-paper flex flex-col gap-2 p-5" aria-labelledby="visit-road">
            <h3 id="visit-road" className="text-xl font-bold">
              🚗 {t("getThere.road")}
            </h3>
            {campus ? <p>{campus.distanceFromChennai}</p> : null}
          </section>
        </div>
      </GrailChapter>

      <GrailChapter kicker={t("hero.kicker")} level={3} title={t("walk.title")} titleId="visit-walk" intro={<p>{t("walk.intro")}</p>}>
        <ol className="grid gap-4 md:grid-cols-2">
          {stops.map((p, i) => (
            <li key={p.id} className="grail-paper flex gap-4 p-5">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffd166] font-bold text-black">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-fg-muted">{script.ui[`tour_${p.id}`]}</p>
                {p.href ? (
                  <a href={p.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                    {t("walk.page")} →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <Link href="/walk" className="grail-cta mt-8 w-fit">
          🧭 {t("walk.cta")} ▸
        </Link>
      </GrailChapter>

      <GrailChapter tone="light" kicker={t("hero.kicker")} level={4} title={t("call.title")} titleId="visit-call" intro={<p>{t("call.intro")}</p>}>
        <ul className="grid gap-4 md:grid-cols-3">
          {site.admissions.phones.map((ph) => (
            <li key={ph.id} className="grail-paper flex flex-col gap-1 p-5">
              <p className="text-sm text-fg-muted">{ph.label}</p>
              <a href={`tel:${ph.tel}`} className="inline-flex min-h-11 items-center text-xl font-bold">
                📞 {ph.display}
              </a>
            </li>
          ))}
        </ul>
        <a href={site.virtualTourUrl} className="mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          {t("call.tour360")} →
        </a>
      </GrailChapter>
    </GrailPage>
  );
}
