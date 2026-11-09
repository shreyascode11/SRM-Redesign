import { getLocale, getTranslations } from "next-intl/server";
import { getContent } from "@/lib/content";
import { HREF } from "@/lib/sections";
import { researchCentres } from "@/lib/research-centres";
import { LIFE_SECTIONS, lifeSections } from "@/lib/student-life";
import type { NavData } from "./types";

/** Server-only: builds the menu from content JSON so none of that JSON ships to the client. */
export async function getNavData(): Promise<NavData> {
  const t = await getTranslations("Nav");
  const hostelT = await getTranslations("Hostels");
  const lifeT = await getTranslations("Life");
  const { campuses, colleges, featuredStory, missions, naacGrade, nirf, programmes, site, studentWork } = getContent(await getLocale());
  const universityRank = nirf.ranks.find((r) => r.id === "university")?.rank;
  const camber = studentWork[0];

  return {
    labels: {
      primary: t("primary"),
      home: t("home"),
      menu: t("menu"),
      close: t("close"),
      language: t("language"),
      external: t("external"),
      apply: t("apply"),
    },
    // Apply goes to our hub, not straight to the portal: SRM's portal sometimes answers 403, and the hub has the fallbacks.
    apply: { label: t("applyLong"), href: "/admissions#apply" },
    enquiry: { label: t("enquiry"), href: "/admissions#enquiry" },
    play: { label: t("play"), href: "/walk" },
    call: { label: t("callAdmissions"), display: site.admissions.phones[0]!.display, tel: site.admissions.phones[0]!.tel },
    compare: { label: t("compare"), href: "/compare" },
    sections: [
      {
        id: "study",
        label: t("study"),
        intro: t("studyIntro", { programmes: programmes.length, colleges: colleges.length }),
        groups: [
          {
            title: t("startHere"),
            links: [
              { label: t("findProgramme"), href: "/programmes" },
              { label: t("compare"), href: "/compare" },
              { label: t("undergraduate"), href: "/programmes#level-ug" },
              { label: t("postgraduate"), href: "/programmes#level-pg" },
              { label: t("admissions"), href: "/admissions" },
              { label: t("enquiry"), href: "/admissions#enquiry" },
            ],
          },
          {
            title: t("byCollege"),
            links: colleges.map((c) => ({ label: c.shortName, href: `/programmes#${c.slug}` })),
          },
        ],
        feature: { eyebrow: t("callAdmissions"), title: site.admissions.phones[0]!.display, href: "/admissions" },
      },
      {
        id: "research",
        label: t("research"),
        intro: t("researchIntro"),
        groups: [
          {
            title: t("missions"),
            links: missions.map((m) => ({ label: m.name, href: HREF.mission(m.slug) })),
          },
          {
            title: t("researchCentres"),
            links: [
              ...researchCentres.centres.map((c) => ({ label: c.acronym, href: `/research#${c.slug}` })),
              { label: t("patents"), href: "/research#patents" },
            ],
          },
          { title: t("researchNumbers"), links: [{ label: t("researchNumbers"), href: HREF.researchNumbers }] },
        ],
      },
      {
        id: "student-work",
        label: t("studentWork"),
        intro: t("studentWorkIntro"),
        groups: [
          {
            title: t("studentWork"),
            links: studentWork
              .filter((s) => !s.title.startsWith("TODO:"))
              .map((s) => ({ label: s.title, href: `/stories/${s.slug}` })),
          },
          { title: t("allStories"), links: [{ label: t("allStories"), href: HREF.stories }, { label: t("alumni"), href: HREF.alumni }] },
        ],
        feature: camber ? { eyebrow: t("featured"), title: camber.title, href: `/stories/${camber.slug}` } : undefined,
      },
      {
        id: "campuses",
        label: t("campuses"),
        intro: t("campusesIntro"),
        groups: [
          {
            title: t("ourCampuses"),
            links: [
              { label: t("walk"), href: "/walk" },
              ...campuses.filter((c) => c.kind === "campus").map((c) => ({ label: c.name, href: `/campuses/${c.slug}` })),
            ],
          },
          {
            title: t("housing"),
            links: [
              { label: hostelT("sections.accommodation"), href: "/hostels#accommodation" },
              { label: hostelT("sections.women"), href: "/hostels#women" },
              { label: hostelT("sections.men"), href: "/hostels#men" },
              { label: hostelT("sections.international"), href: "/hostels#international" },
              { label: hostelT("sections.apply"), href: "/hostels#apply" },
              { label: hostelT("sections.dining"), href: "/hostels#dining" },
              { label: hostelT("sections.safety"), href: "/hostels#safety" },
              { label: hostelT("sections.contact"), href: "/hostels#contact" },
            ],
          },
          {
            title: t("sisterUniversities"),
            links: campuses
              .filter((c) => c.kind === "sister")
              .map((c) => ({ label: c.name, href: `/campuses/${c.slug}` })),
          },
        ],
        feature: { eyebrow: t("virtualTour"), title: campuses.find((c) => c.isMain)?.name ?? "", href: site.virtualTourUrl },
      },
      {
        id: "about",
        label: t("about"),
        intro: t("aboutIntro", { naac: naacGrade, rank: universityRank ?? "—", year: nirf.year }),
        groups: [
          {
            title: t("institution"),
            links: [
              { label: t("rankings"), href: HREF.rankings },
              { label: t("alumni"), href: HREF.alumni },
              { label: t("thisWeek"), href: HREF.thisWeek },
              { label: t("admissions"), href: "/admissions" },
            ],
          },
          {
            title: t("studentLife"),
            links: lifeSections.map((k) => ({ label: lifeT(`sections.${k}`), href: `/student-life#${LIFE_SECTIONS[k]}` })),
          },
        ],
        feature: featuredStory
          ? { eyebrow: t("thisWeek"), title: featuredStory.title, href: `/stories/${featuredStory.slug}` }
          : undefined,
      },
    ],
  };
}
