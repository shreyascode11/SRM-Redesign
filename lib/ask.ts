/**
 * Programme matcher — free and offline: no paid AI, no external calls.
 * 1. understand(): map the visitor's words (en / ta / hi) to programme tags, level (UG/PG) and places via
 *    content/lexicon.json.
 * 2. The /api/ask route ranks programmes with the same Fuse searcher the hero uses, then builds answer cards
 *    whose facts (fees, eligibility, entrance, deadline) come straight from programmes.json — never generated.
 * Pure module: safe on client (instant search) and server (the route).
 */

type Words = { en?: string[]; ta?: string[]; hi?: string[] };
export type Lexicon = {
  concepts: (Words & { tag: string })[];
  level: { UG: Words; PG: Words };
  places: { campuses: string[]; words: string[] }[];
};

export type Understood = {
  /** What the visitor actually typed that we recognised, and the tag it maps to. */
  terms: { said: string; tag: string }[];
  level: "UG" | "PG" | null;
  /** Campus slugs the visitor mentioned (e.g. "Chennai" → three campuses). */
  places: string[];
  /** The original query plus recognised English tags — what the Fuse searcher ranks on. */
  searchText: string;
};

const norm = (s: string) => s.normalize("NFC").toLowerCase();
const isLatin = (w: string) => /^[\p{Script=Latin}\d\s.'+#-]+$/u.test(w);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Latin words match on word boundaries ("ai" must not match "said"); Indic words match as substrings. */
function found(query: string, word: string): boolean {
  const w = norm(word);
  if (!isLatin(w)) return query.includes(w);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}($|[^\\p{L}\\p{N}])`, "u").test(query);
}

const all = (w: Words) => [...(w.en ?? []), ...(w.ta ?? []), ...(w.hi ?? [])];

export function understand(query: string, lexicon: Lexicon): Understood {
  const q = norm(query);
  const terms: Understood["terms"] = [];
  for (const c of lexicon.concepts) {
    // Longest word first, so "electric car" wins over "car".
    const hit = all(c)
      .sort((a, b) => b.length - a.length)
      .find((w) => found(q, w));
    if (hit && !terms.some((t) => t.tag === c.tag)) terms.push({ said: hit, tag: c.tag });
  }
  // A word inside a longer recognised phrase yields to it: "பல் மருத்துவர்" (dentist) must not also mean
  // "மருத்துவர்" (doctor) and pull in MBBS.
  const specific = terms.filter((t) => !terms.some((o) => o !== t && o.said.length > t.said.length && norm(o.said).includes(norm(t.said))));
  const pg = all(lexicon.level.PG).some((w) => found(q, w));
  const ug = all(lexicon.level.UG).some((w) => found(q, w));
  const places = [...new Set(lexicon.places.filter((p) => p.words.some((w) => found(q, w))).flatMap((p) => p.campuses))];
  return {
    terms: specific,
    level: pg && !ug ? "PG" : ug && !pg ? "UG" : null,
    places,
    searchText: [query, ...specific.map((t) => t.tag)].join(" "),
  };
}

// ── Answer shape returned by /api/ask (kept small: < 10 KB for 3 cards) ──

export type AnswerFacts = {
  /** null = not verified yet → the UI says "Not published yet — ask admissions". Never a guess. */
  feesPerYearINR: number | null;
  eligibility: string | null;
  entrance: string | null;
  deadline: string | null;
};

export type AnswerCard = {
  slug: string;
  name: string;
  college: string;
  level: "UG" | "PG";
  durationYears: number | null;
  campuses: string[];
  summary: string;
  /** The visitor's own words that this programme matched — the "why", with nothing generated. */
  matched: string[];
  /** Places the visitor asked about that this programme isn't listed at (shown as an honest note). */
  placesNotListed: string[];
  facts: AnswerFacts;
  source: string | null;
};

export type Answer = {
  query: string;
  confidence: "high" | "low";
  level: "UG" | "PG" | null;
  cards: AnswerCard[];
};
