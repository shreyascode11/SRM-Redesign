import { getLocale, getTranslations } from "next-intl/server";
import { getCities, getMapData, mapAspect } from "@/lib/map";
import { SECTION } from "@/lib/sections";
import { CampusExplorer } from "./CampusExplorer";

/** Explore: campus constellation + detail panel + in-page 360° tour. */
export async function Explore() {
  const t = await getTranslations("Acts.explore");
  const locale = await getLocale();
  const { campuses, clusters, groups } = getMapData(locale);

  return (
    <section id={SECTION.explore} aria-labelledby="explore-title" className="bg-bg py-24 text-fg lg:py-36">
      <div className="site-container">
        <h2 id="explore-title" className="font-display text-hero font-bold text-balance">
          {t("title")}
        </h2>
        <p className="mt-4 mb-12 max-w-prose text-lg text-fg-muted">{t("intro")}</p>
        <CampusExplorer
          campuses={campuses}
          clusters={clusters}
          groups={groups}
          states={getCities(locale)}
          aspect={mapAspect}
          mapSrc="/map/india.svg"
        />
        <p className="mt-6 text-xs text-fg-muted">{t("mapCredit")}</p>
      </div>
    </section>
  );
}
