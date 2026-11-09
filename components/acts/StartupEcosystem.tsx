import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { getContent } from "@/lib/content";
import { findMedia } from "@/lib/media";
import { SECTION } from "@/lib/sections";

/**
 * SRM's startup ecosystem as a static logo wall (no auto-rotating carousels). The logos are SRM's
 * own 150 × 100 files, so tiles never render them larger than that.
 */
export async function StartupEcosystem() {
  const t = await getTranslations("Acts.leap");
  const nav = await getTranslations("Nav");
  const { startups, startupsCount, startupsSource } = getContent(await getLocale());

  return (
    <div id={SECTION.startups} className="site-container pb-12 lg:pb-16">
      <h3 className="font-display text-section font-bold">{t("startupsTitle")}</h3>
      <p className="mt-3 max-w-prose text-fg-muted">{t("startupsIntro", { count: startupsCount })}</p>
      <ul className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4">
        {startups.map((s) => {
          const url = findMedia(s.logo);
          return (
            <li key={s.slug} className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-2xl bg-white">
              {url ? (
                <Image src={url} alt={s.name} width={150} height={100} sizes="150px" className="h-auto w-full max-w-[150px]" />
              ) : (
                <span className="px-2 text-center text-sm font-semibold text-ink">{s.name}</span>
              )}
            </li>
          );
        })}
      </ul>
      <a href={startupsSource} className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">
        {t("startupsLink")} <span aria-hidden="true">→</span>
        <span className="sr-only"> {nav("external")}</span>
      </a>
    </div>
  );
}
