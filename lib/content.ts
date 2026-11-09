import alumniData from "@/content/alumni.json";
import campusesData from "@/content/campuses.json";
import collegesData from "@/content/colleges.json";
import programmesData from "@/content/programmes.json";
import researchData from "@/content/research.json";
import siteData from "@/content/site.json";
import statsData from "@/content/stats.json";
import startupsData from "@/content/startups.json";
import storiesData from "@/content/stories.json";
import seniorsData from "@/content/seniors.json";
import hiData from "@/content/i18n/hi.json";
import taData from "@/content/i18n/ta.json";

import { isTodo, type OrTodo } from "./todo";

/**
 * Typed access to content/*.json. Shapes are enforced at build time by scripts/check-content.mts (prebuild).
 * Server components only — importing this from a client component ships every JSON file to the browser.
 */
export { isTodo, type OrTodo } from "./todo";

export type CampusSlug =
  | "kattankulathur"
  | "ramapuram"
  | "vadapalani"
  | "tiruchirappalli"
  | "delhi-ncr"
  | "baburayanpettai"
  | "srm-ap"
  | "srm-haryana"
  | "srm-sikkim";

export type CollegeSlug =
  | "engineering"
  | "medicine"
  | "dental"
  | "law"
  | "management"
  | "architecture"
  | "science-humanities"
  | "agriculture"
  | "pharmacy"
  | "nursing";

export type Programme = {
  slug: string;
  name: string;
  /** SRM's official (English) programme name — set on localised copies so pages can show it. */
  officialName?: string;
  college: CollegeSlug;
  campuses: CampusSlug[];
  level: "UG" | "PG";
  durationYears: OrTodo<number>;
  eligibility: OrTodo<string>;
  entrance: OrTodo<string>;
  feesPerYearINR: OrTodo<number>;
  deadline: OrTodo<string>;
  summary: string;
  tags: string[];
  /** Typical career paths for the discipline — not SRM placement claims. */
  outcomes: string[];
  sources: string[];
};

export type College = {
  slug: CollegeSlug;
  name: string;
  shortName: string;
  campus: CampusSlug;
  outcome: { value: OrTodo<string>; label: string };
  photo: string;
};

export type Campus = {
  slug: CampusSlug;
  name: string;
  city: string;
  state: string;
  kind: "campus" | "sister";
  isMain: boolean;
  lat: number;
  lng: number;
  tour360Url: string | null;
  distanceFromChennai?: OrTodo<string>;
  website: string;
  address: OrTodo<string>;
  /** Official name Google Maps resolves to the campus gate (more reliable than coordinates for directions). */
  directionsQuery: string;
  /** Town-level position: the campus itself isn't mapped in OpenStreetMap. */
  coordsApprox?: boolean;
  cluster?: "chennai" | "delhi";
  photo: string;
};

type CampusCluster = { id: "chennai" | "delhi"; name: string; members: CampusSlug[]; zoom: number };

type Alumnus = {
  slug: string;
  name: string;
  role: string;
  /** A sourced public quote. Omitted when there isn't one — never a placeholder. */
  line?: string;
  degree: OrTodo<string>;
  path: OrTodo<string>[];
  photo: string;
};

/** A talk by a visiting leader (SRM's "Legacy Beyond Curriculum"): YouTube Short, played on demand. */
type Startup = { slug: string; name: string; logo: string };

export type Story = {
  slug: string;
  kind: "student-work" | "news";
  title: string;
  dek: string;
  date: OrTodo<string>;
  people: { name: string; role: string }[];
  facts: { key: string; label: string; value: string }[];
  body: string[];
  media: { photo?: string; poster?: { name: string; tagline: string } };
  tags: string[];
};

type SrmEvent = {
  slug: string;
  title: string;
  /** Display label, e.g. "25–28 Oct 2026". */
  date: string;
  /** ISO dates for <time> and Event JSON-LD. */
  start: string;
  end: string;
  campus?: CampusSlug;
  url: string;
};

export type Stat = {
  id: string;
  label: string;
  value: number;
  display: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

type NirfRank = { id: string; label: string; rank: number };

type Mission = {
  slug: string;
  name: string;
  question: string;
  highlights: OrTodo<string>[];
  photo: string;
};

export const site = siteData;
export const programmes = programmesData.programmes as Programme[];
export const colleges = collegesData.colleges as College[];
export const campuses = campusesData.campuses as Campus[];
const campusClusters = campusesData.clusters as CampusCluster[];
const alumni = alumniData.alumni as Alumnus[];
export const stories = storiesData.stories as Story[];
const events = storiesData.events as SrmEvent[];
const missions = researchData.missions as Mission[];

const placements = {
  season: statsData.placements.season,
  items: statsData.placements.items as Stat[],
};
const researchStats = statsData.research.items as Stat[];

const currentNirfYear = statsData.nirf.current as "2025";
const nirf = {
  year: currentNirfYear,
  ranks: statsData.nirf.years[currentNirfYear].ranks as NirfRank[],
  source: statsData.nirf.years[currentNirfYear].source,
};
const naacGrade = statsData.naac.grade;

/** Events still to come (or running today), as of the last time the page was built. */
export const upcomingEvents = <T extends { end: string }>(list: T[]) => {
  const today = new Date().toISOString().slice(0, 10);
  return list.filter((e) => e.end >= today);
};


// ── Localised content (build step 12) ────────────────────────────────────────────────────────────────────
// content/i18n/{ta,hi}.json override display text by id. Anything missing falls back to English, and an
// override is only applied where the English value is itself verified (a TODO is never "translated").

type FactOverride = { label?: string; value?: string };
type StatOverride = { label?: string; display?: string; suffix?: string };
type Overrides = {
  programmes?: Record<string, { name?: string; summary?: string; outcomes?: string[]; eligibility?: string; entrance?: string }>;
  colleges?: Record<string, { name?: string; shortName?: string; outcomeLabel?: string }>;
  campuses?: Record<string, { name?: string; city?: string; state?: string; distanceFromChennai?: string }>;
  stories?: Record<
    string,
    { title?: string; dek?: string; date?: string; posterTagline?: string; body?: (string | null)[]; facts?: Record<string, FactOverride>; peopleRoles?: string[] }
  >;
  missions?: Record<string, { name?: string; question?: string; highlights?: (string | null)[] }>;
  nirf?: Record<string, string>;
  placements?: Record<string, StatOverride>;
  research?: Record<string, StatOverride>;
  alumni?: Record<string, { role?: string; degree?: string; path?: string[] }>;
  phones?: Record<string, string>;
  site?: { status?: string; location?: string };
  seniors?: Record<string, { question?: string; answer?: string; senior?: string }>;
};

type SeniorThreadData = {
  id: string;
  status: "answered" | "awaiting";
  question: string;
  answer?: { text: string; senior: string };
};

const OVERRIDES: Record<string, Overrides> = { ta: taData as Overrides, hi: hiData as Overrides };
const pick = <T,>(v: T | null | undefined, fallback: T): T => (v === null || v === undefined || v === "" ? fallback : v);
/** Translate a verified value; leave a TODO untouched so it stays visibly unverified. */
const verifiedPick = <T,>(original: OrTodo<T>, translated: T | undefined): OrTodo<T> =>
  isTodo(original) ? original : pick(translated, original as T);

function build(o: Overrides | undefined) {
  const ps: Programme[] = programmes.map((p) => {
    const x = o?.programmes?.[p.slug];
    return {
      ...p,
      officialName: p.name,
      name: pick(x?.name, p.name),
      summary: pick(x?.summary, p.summary),
      outcomes: x?.outcomes?.length ? x.outcomes : p.outcomes,
      eligibility: verifiedPick(p.eligibility, x?.eligibility),
      entrance: verifiedPick(p.entrance, x?.entrance),
    };
  });
  const cs: College[] = colleges.map((c) => {
    const x = o?.colleges?.[c.slug];
    return {
      ...c,
      name: pick(x?.name, c.name),
      shortName: pick(x?.shortName, c.shortName),
      outcome: { ...c.outcome, label: isTodo(c.outcome.label) ? c.outcome.label : pick(x?.outcomeLabel, c.outcome.label) },
    };
  });
  const ks: Campus[] = campuses.map((c) => {
    const x = o?.campuses?.[c.slug];
    return {
      ...c,
      name: pick(x?.name, c.name),
      city: pick(x?.city, c.city),
      state: pick(x?.state, c.state),
      ...(c.distanceFromChennai !== undefined ? { distanceFromChennai: verifiedPick(c.distanceFromChennai, x?.distanceFromChennai) } : {}),
    };
  });
  const ss: Story[] = stories.map((st) => {
    const x = o?.stories?.[st.slug];
    if (!x) return st;
    return {
      ...st,
      title: isTodo(st.title) ? st.title : pick(x.title, st.title),
      dek: isTodo(st.dek) ? st.dek : pick(x.dek, st.dek),
      date: verifiedPick(st.date, x.date),
      media: st.media.poster ? { ...st.media, poster: { ...st.media.poster, tagline: pick(x.posterTagline, st.media.poster.tagline) } } : st.media,
      body: st.body.map((para, i) => (isTodo(para) ? para : pick(x.body?.[i], para))),
      facts: st.facts.map((f) => ({ ...f, label: pick(x.facts?.[f.key]?.label, f.label), value: pick(x.facts?.[f.key]?.value, f.value) })),
      people: st.people.map((pp, i) => ({ ...pp, role: isTodo(pp.role) ? pp.role : pick(x.peopleRoles?.[i], pp.role) })),
    };
  });
  const ms: Mission[] = missions.map((m) => {
    const x = o?.missions?.[m.slug];
    return {
      ...m,
      name: pick(x?.name, m.name),
      question: pick(x?.question, m.question),
      highlights: m.highlights.map((h, i) => (isTodo(h) ? h : pick(x?.highlights?.[i], h))),
    };
  });
  const stat = (items: Stat[], tr?: Record<string, StatOverride>) =>
    items.map((it) => ({
      ...it,
      label: pick(tr?.[it.id]?.label, it.label),
      display: pick(tr?.[it.id]?.display, it.display),
      suffix: pick(tr?.[it.id]?.suffix, it.suffix ?? ""),
    }));
  const getStoryL = (slug: string) => ss.find((x) => x.slug === slug);
  const seniorsByCollege = Object.fromEntries(
    Object.entries(seniorsData.byCollege as Record<string, SeniorThreadData[]>).map(([college, threads]) => [
      college,
      threads.map((th) => {
        const x = o?.seniors?.[th.id];
        return {
          ...th,
          question: pick(x?.question, th.question),
          answer: th.answer ? { text: pick(x?.answer, th.answer.text), senior: pick(x?.senior, th.answer.senior) } : undefined,
        };
      }),
    ]),
  ) as Record<string, SeniorThreadData[]>;

  return {
    site: {
      ...site,
      location: pick(o?.site?.location, site.location),
      admissions: {
        ...site.admissions,
        status: pick(o?.site?.status, site.admissions.status),
        phones: site.admissions.phones.map((ph) => ({ ...ph, label: pick(o?.phones?.[ph.id], ph.label) })),
      },
    },
    programmes: ps,
    colleges: cs,
    campuses: ks,
    campusClusters,
    alumni: alumni.map((a) => {
      const x = o?.alumni?.[a.slug];
      return {
        ...a,
        role: pick(x?.role, a.role),
        degree: verifiedPick(a.degree, x?.degree),
        // A translated path only replaces the English one when it lines up item for item.
        path: x?.path && x.path.length === a.path.length && !a.path.some(isTodo) ? x.path : a.path,
      };
    }),
    stories: ss,
    startups: startupsData.startups as Startup[],
    startupsCount: startupsData.count,
    events,
    missions: ms,
    placements: { season: placements.season, items: stat(placements.items, o?.placements) },
    researchStats: stat(researchStats, o?.research),
    nirf: { ...nirf, ranks: nirf.ranks.map((r) => ({ ...r, label: pick(o?.nirf?.[r.id], r.label) })) },
    naacGrade,
    seniorsByCollege,
    getProgramme: (slug: string) => ps.find((x) => x.slug === slug),
    getCollege: (slug: string) => cs.find((x) => x.slug === slug),
    getCampus: (slug: string) => ks.find((x) => x.slug === slug),
    getStory: getStoryL,
    featuredStory: getStoryL(storiesData.featured),
    studentWork: storiesData.studentWork.map(getStoryL).filter((x): x is Story => x !== undefined),
  };
}

type LocalContent = ReturnType<typeof build>;
const cache = new Map<string, LocalContent>();

/** All display content in the visitor's language (English fallback per field). Server-side only. */
export function getContent(locale: string): LocalContent {
  let c = cache.get(locale);
  if (!c) {
    c = build(locale === "en" ? undefined : OVERRIDES[locale]);
    cache.set(locale, c);
  }
  return c;
}

/** "25–28 Oct 2026" in the visitor's language, from the event's ISO dates. */
export function formatEventDate(e: SrmEvent, locale: string): string {
  const fmt = new Intl.DateTimeFormat(`${locale}-IN`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const start = new Date(`${e.start}T00:00:00Z`);
  const end = new Date(`${e.end}T00:00:00Z`);
  return e.start === e.end ? fmt.format(start) : fmt.formatRange(start, end);
}
