import type Fuse from "fuse.js";
import type { Lexicon, Understood } from "./ask";
import type { Campus, College, Programme } from "./content";

/**
 * Instant programme search. Pure module: no content imports, so the client bundle
 * only carries the slim SearchDoc[] the server passes down, and Fuse itself loads lazily on first use.
 */

export type SearchDoc = {
  slug: string;
  name: string;
  /** Official English name — so English queries still match on Tamil/Hindi pages. */
  alt: string;
  college: string;
  level: "UG" | "PG";
  durationYears: number | null;
  /** null = not published; result cards say so rather than guess. */
  feesPerYearINR: number | null;
  campuses: string[];
  tags: string[];
  summary: string;
};

/** Server-side: slim the content records down to what search and result cards need. */
export function toSearchDocs(programmes: Programme[], colleges: College[], campuses: Campus[]): SearchDoc[] {
  const collegeName = new Map(colleges.map((c) => [c.slug, c.shortName]));
  const campusName = new Map(campuses.map((c) => [c.slug, c.name]));
  return programmes.map((p) => ({
    slug: p.slug,
    name: p.name,
    alt: p.officialName ?? p.name,
    college: collegeName.get(p.college) ?? p.college,
    level: p.level,
    durationYears: typeof p.durationYears === "number" ? p.durationYears : null,
    feesPerYearINR: typeof p.feesPerYearINR === "number" ? p.feesPerYearINR : null,
    campuses: p.campuses.map((c) => campusName.get(c) ?? c),
    tags: p.tags,
    summary: p.summary,
  }));
}

// Words that carry no subject meaning in "I like robots and want to work abroad"-style queries.
const STOPWORDS = new Set(
  "a an and are as at be become becoming but by do for from i i'm im in into is it like love me my of on or so study studying the to want wanna what which who with would you"
    .split(" "),
);

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}+#]+/u)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

const norm = (s: string) => s.normalize("NFC").toLowerCase();

/** The visitor's own words that a programme matched: the "why", with nothing generated. Used by the hero and /api/ask. */
export function matchedWords(u: Understood, words: string[], tags: string[], names: string[]): string[] {
  const lowered = names.map(norm);
  return [
    ...new Set([
      ...u.terms.filter((t) => tags.includes(t.tag)).map((t) => t.said),
      ...words.filter((w) => tags.includes(w) || (w.length >= 3 && lowered.some((n) => n.includes(w)))),
    ]),
  ];
}

export type Searcher = (query: string, limit?: number) => SearchDoc[];

/**
 * Each meaningful word is searched separately and scores are summed, so multi-word natural language
 * ranks programmes matching more of the words first. Whole-phrase match adds a bonus for exact names.
 */
export async function loadSearcher(docs: SearchDoc[]): Promise<Searcher> {
  const { default: FuseCtor } = await import("fuse.js");
  const fuse: Fuse<SearchDoc> = new FuseCtor(docs, {
    keys: [
      { name: "name", weight: 3 },
      { name: "alt", weight: 2.5 },
      { name: "tags", weight: 2.5 },
      { name: "college", weight: 1 },
      { name: "summary", weight: 0.5 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.3,
    minMatchCharLength: 2,
  });

  return (query, limit = 3) => {
    const words = tokenize(query);
    if (words.length === 0) return [];
    const scores = new Map<number, number>();
    const add = (q: string, weight: number) => {
      for (const r of fuse.search(q)) scores.set(r.refIndex, (scores.get(r.refIndex) ?? 0) + (1 - (r.score ?? 1)) * weight);
    };
    for (const w of words) add(w, 1);
    if (words.length > 1) add(words.join(" "), 1.5);
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    // Drop weak fuzzy tails ("cars" ≈ "care") — better to show 1 strong match than 3 with a wrong one.
    const floor = (ranked[0]?.[1] ?? 0) * 0.45;
    return ranked
      .filter(([, score]) => score >= floor)
      .slice(0, limit)
      .map(([i]) => docs[i]!);
  };
}

export type SearchIndex = { search: Searcher; lexicon: Lexicon };
let index: { locale: string; loading: Promise<SearchIndex> } | null = null;

/** The per-language index plus Fuse, fetched once on first use and shared by the hero and the command palette. */
export function loadSearchIndex(locale: string): Promise<SearchIndex> {
  if (index?.locale === locale) return index.loading;
  const loading = fetch(`/api/search-index/${locale}`)
    .then((res) => res.json() as Promise<{ docs: SearchDoc[]; lexicon: Lexicon }>)
    .then(async ({ docs, lexicon }) => ({ search: await loadSearcher(docs), lexicon }));
  index = { locale, loading };
  // A failed fetch can be retried on the next use.
  loading.catch(() => {
    index = null;
  });
  return loading;
}
