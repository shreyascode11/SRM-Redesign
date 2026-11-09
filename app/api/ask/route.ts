import { NextResponse, type NextRequest } from "next/server";
import lexiconData from "@/content/lexicon.json";
import { understand, type Answer, type AnswerCard, type Lexicon } from "@/lib/ask";
import { campuses, colleges, getContent, isTodo, programmes } from "@/lib/content";
import { routing } from "@/lib/i18n";
import { loadSearcher, matchedWords, tokenize, toSearchDocs, type Searcher } from "@/lib/search";

/**
 * GET /api/ask?q=… — programme matcher, free and offline: no paid AI, no external calls.
 * Ranks with the same Fuse searcher as the hero, then answers with facts copied from programmes.json.
 * "Why it matches" is the visitor's own recognised words — nothing is generated, so nothing can be invented.
 * Low confidence → the UI says "I'm not sure" and gives admissions numbers. Deterministic, so CDN-cached.
 */
const lexicon = lexiconData as Lexicon;
const docs = toSearchDocs(programmes, colleges, campuses);
let searcher: Promise<Searcher> | null = null;
const MAX_QUERY = 200;

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (!query) return NextResponse.json({ error: "missing q" }, { status: 400 });
  const requested = req.nextUrl.searchParams.get("locale");
  const locale = routing.locales.find((l) => l === requested) ?? routing.defaultLocale;
  const local = getContent(locale);
  const getCampus = local.getCampus;

  searcher ??= loadSearcher(docs);
  const search = await searcher;
  const u = understand(query, lexicon);
  const words = tokenize(query);

  let ranked = search(u.searchText, 8).map((d) => programmes.find((p) => p.slug === d.slug)!);
  if (u.level) {
    const atLevel = ranked.filter((p) => p.level === u.level);
    if (atLevel.length) ranked = atLevel;
  }

  const cards: AnswerCard[] = ranked.map((english) => {
    // Match on English (tags, official name); show the visitor's language.
    const p = local.getProgramme(english.slug)!;
    return {
      slug: p.slug,
      name: p.name,
      college: local.getCollege(p.college)?.shortName ?? p.college,
      level: p.level,
      durationYears: typeof p.durationYears === "number" ? p.durationYears : null,
      campuses: p.campuses.map((c) => getCampus(c)?.name ?? c),
      summary: p.summary,
      matched: matchedWords(u, words, p.tags, [english.name, p.name]),
      placesNotListed: u.places
        .filter((pl) => !p.campuses.includes(pl as (typeof p.campuses)[number]))
        .map((pl) => getCampus(pl)?.name ?? pl),
      facts: {
        feesPerYearINR: typeof p.feesPerYearINR === "number" ? p.feesPerYearINR : null,
        eligibility: isTodo(p.eligibility) ? null : p.eligibility,
        entrance: isTodo(p.entrance) ? null : p.entrance,
        deadline: isTodo(p.deadline) ? null : p.deadline,
      },
      source: p.sources[0] ?? null,
    };
  });

  // Confident only when a programme matched something the visitor actually said (not just fuzzy spelling).
  const confident = cards.filter((c) => c.matched.length > 0);
  // "Chennai" lists three campuses; a programme at any one of them is not "not listed".
  const chennai = ["kattankulathur", "ramapuram", "vadapalani"].map((slug) => getCampus(slug)!.name);
  for (const c of confident)
    if (c.placesNotListed.length && c.campuses.some((x) => chennai.includes(x)) && c.placesNotListed.every((x) => chennai.includes(x)))
      c.placesNotListed = [];

  const answer: Answer = {
    query,
    confidence: confident.length ? "high" : "low",
    level: u.level,
    // Low confidence returns no cards: a fuzzy "closest" guess (e.g. pharmacy for "astronaut chef") misleads.
    cards: confident.slice(0, 3),
  };

  return NextResponse.json(answer, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
