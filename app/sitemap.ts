import type { MetadataRoute } from "next";
import { campuses, isTodo, programmes, stories } from "@/lib/content";
import { routing } from "@/lib/i18n";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const url = (locale: string, path: string) => `${siteUrl}${locale === routing.defaultLocale ? "" : `/${locale}`}${path}`;

/** Every page in every language, each entry listing its hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/programmes",
    "/compare",
    "/admissions",
    "/hostels",
    "/student-life",
    "/research",
    "/stories",
    "/walk",
    ...programmes.map((p) => `/programmes/${p.slug}`),
    ...campuses.map((c) => `/campuses/${c.slug}`),
    ...stories.filter((s) => !isTodo(s.title)).map((s) => `/stories/${s.slug}`),
  ];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/programmes/") ? 0.8 : 0.6,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])) },
    })),
  );
}
