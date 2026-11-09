import { safeJson } from "@/lib/jsonld";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GrailHome } from "@/components/grail/GrailHome";
import { getContent, upcomingEvents } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { alternatesFor, socialFor } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { alternates: alternatesFor(locale, ""), ...socialFor(locale, { title: t("title"), description: t("description"), path: "", ownImage: true }) };
}

// Rebuilt daily so "Coming up" drops events once they've passed.
export const revalidate = 86400;

// Homepage: "Level Up at SRM", a student's years at SRM played as a character who levels up.
export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { site, events: allEvents } = getContent(locale);
  const events = upcomingEvents(allEvents);
  // Structured data: the university, and the real upcoming events from "This week".
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollegeOrUniversity",
        name: "SRM Institute of Science and Technology",
        alternateName: "SRMIST",
        slogan: site.tagline,
        url: "https://www.srmist.edu.in/",
        telephone: "+91-44-27417000",
        address: {
          "@type": "PostalAddress",
          streetAddress: "SRM Nagar",
          addressLocality: "Kattankulathur",
          addressRegion: "Tamil Nadu",
          postalCode: "603203",
          addressCountry: "IN",
        },
      },
      ...events.map((e) => ({
        "@type": "Event",
        name: e.title,
        startDate: e.start,
        endDate: e.end,
        url: e.url,
        eventStatus: "https://schema.org/EventScheduled",
        location: { "@type": "Place", name: "SRM Institute of Science and Technology" },
        organizer: { "@type": "CollegeOrUniversity", name: "SRM Institute of Science and Technology", url: "https://www.srmist.edu.in/" },
      })),
    ],
  };

  return (
    <main id="main" tabIndex={-1}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      <GrailHome />
    </main>
  );
}
