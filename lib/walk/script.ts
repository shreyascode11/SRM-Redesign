import { getTranslations } from "next-intl/server";
import hostelData from "@/content/hostels.json";
import mediaCredits from "@/content/media-credits.json";
import walk from "@/content/walk.json";
import { colleges, getContent, isTodo, programmes, upcomingEvents, formatEventDate } from "@/lib/content";
import { findMedia } from "@/lib/media";
import type { Locale } from "@/lib/i18n";

/**
 * Everything Walk SRM says and shows, built on the server for one language: places (name, kind, page, photo), people
 * (their lines, with real facts filled in from the same content files the rest of the site uses), quests and UI words.
 * The game itself only renders this; it never makes up a fact.
 */

export type Outfit = { skin: number; hair: number; hairColor: number; top: number; bottom: number; shoes: number; bag: number };
export type WalkPlace = { id: string; name: string; kind: string; kindLabel: string; href?: string; photo?: string; credit?: string };
export type WalkTopic = { id: string; q: string; a: string; link?: { label: string; href: string } };
export type WalkPerson = { id: string; at: string; name: string; greet: string; topics: WalkTopic[]; outfit: Outfit; offset?: [number, number] };
/** One question of a quiz step: the options in order and which one is right. */
export type WalkQuiz = { q: string; options: string[]; answer: number };
/**
 * A quest step: talk to a person or pick something up at a place (optionally carrying an item to the next step).
 * A talk step can end in a quiz (answer every question to pass). `within` makes a step timed: it must be done within
 * that many seconds of starting it, or the quest goes back one step to try again.
 */
export type WalkStep = { talk?: string; pick?: string; item?: string; within?: number; quiz?: WalkQuiz[]; hint: string; lines: string[] };
export type WalkQuest = { id: string; stat: "build" | "think" | "connect" | "grow"; title: string; done: string; steps: WalkStep[] };
export type WalkScript = {
  locale: string;
  places: WalkPlace[];
  people: WalkPerson[];
  quests: WalkQuest[];
  items: Record<string, string>;
  stats: Record<string, string>;
  emotes: Record<string, string>;
  outfit: Record<string, string | string[]>;
  ui: Record<string, string>;
  phone: { display: string; tel: string };
};

const inr = new Intl.NumberFormat("en-IN");
const rupees = (n: number) => `₹${inr.format(n)}`;
const CREDITS = mediaCredits.credits as Record<string, { author?: string; license?: string; source: string }>;

export async function getWalkScript(locale: Locale): Promise<WalkScript> {
  const t = await getTranslations({ locale, namespace: "Walk" });
  const say = t as unknown as ((k: string, v?: Record<string, string | number>) => string) & { raw: (k: string) => unknown; has: (k: string) => boolean };
  const content = getContent(locale);
  const { site, researchStats, startups, startupsCount, events, getStory } = content;
  const phones = site.admissions.phones;
  const base = locale === "en" ? "" : `/${locale}`;
  const href = (h: string) => (h.startsWith("/") ? `${base}${h}` : h);

  const places: WalkPlace[] = walk.places.map((p) => {
    const photo = "photo" in p && p.photo ? findMedia(p.photo) : undefined;
    const c = "photo" in p && p.photo ? CREDITS[p.photo] : undefined;
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      kindLabel: say(`kinds.${p.kind}`),
      ...("href" in p && p.href ? { href: href(p.href) } : {}),
      ...(photo ? { photo } : {}),
      ...(c?.license ? { credit: `Photo: ${c.author}, ${c.license}` } : {}),
    };
  });

  // Facts for the people, from the same data the pages use.
  const camber = getStory("camber-racing-formula-bharat-2026");
  const cse = programmes.find((p) => p.slug === "btech-cse");
  const feeRows = [...hostelData.fees.men, ...hostelData.fees.women].map((r) => r.total);
  const upcoming = upcomingEvents(events).slice(0, 2);
  const facts: Record<string, Record<string, string | number>> = {
    phones: {
      p1label: phones[0]!.label, p1: phones[0]!.display, p2label: phones[1]!.label, p2: phones[1]!.display, p3label: phones[2]!.label, p3: phones[2]!.display,
    },
    research: { stats: researchStats.map((s) => `${s.display} ${s.label}`).join(", ") },
    camber: { title: camber && !isTodo(camber.title) ? camber.title : "", dek: camber?.dek ?? "" },
    programmes: { n: programmes.length, c: colleges.length, fee: cse && typeof cse.feesPerYearINR === "number" ? rupees(cse.feesPerYearINR) : "" },
    startups: { count: startupsCount, names: startups.slice(0, 5).map((s) => s.name).join(", ") },
    events: { events: upcoming.map((e) => `${e.title} (${formatEventDate(e, locale)})`).join("; ") },
    hostels: {
      men: hostelData.men.length,
      women: hostelData.women.length,
      year: hostelData.fees.year,
      min: rupees(Math.min(...feeRows)),
      max: rupees(Math.max(...feeRows)),
    },
  };
  const links: Record<string, string> = {
    apply: "/admissions",
    research: "/research",
    seniors: "/programmes",
    clubs: "/student-life",
    camber: "/stories/camber-racing-formula-bharat-2026",
    programmes: "/programmes",
    startups: "/stories#student-work",
    events: "/stories#this-week",
    hostels: "/hostels",
  };

  const people: WalkPerson[] = walk.people.map((p) => {
    const raw = say.raw(`people.${p.id}.topics`) as Record<string, { q: string; a: string; aNone?: string; link?: string }>;
    const topics: WalkTopic[] = Object.entries(raw).map(([id, x]) => {
      let a = say(`people.${p.id}.topics.${id}.a`, facts[id] ?? {});
      if (id === "events" && !upcoming.length && x.aNone) a = x.aNone;
      return { id, q: x.q, a, ...(x.link && links[id] ? { link: { label: x.link, href: href(links[id]!) } } : {}) };
    });
    const offset = "offset" in p ? (p.offset as [number, number]) : undefined;
    return { id: p.id, at: p.at, name: say(`people.${p.id}.name`), greet: say(`people.${p.id}.greet`), topics, outfit: p.outfit, ...(offset ? { offset } : {}) };
  });

  const quests: WalkQuest[] = walk.quests.map((q) => {
    const steps = say.raw(`quests.${q.id}.steps`) as { hint: string; lines: string[]; quiz?: { q: string; options: string[] }[] }[];
    return {
      id: q.id,
      stat: q.stat as WalkQuest["stat"],
      title: say(`quests.${q.id}.title`),
      done: say(`quests.${q.id}.done`),
      steps: q.steps.map((s, i) => {
        // Quiz text comes from the messages (in the visitor's language); which option is right comes from walk.json.
        const answers = "answers" in s ? (s.answers as number[]) : undefined;
        const quiz = answers && steps[i]!.quiz ? steps[i]!.quiz!.map((x, k) => ({ q: x.q, options: x.options, answer: answers[k] ?? 0 })) : undefined;
        const { answers: _a, ...rest } = s as typeof s & { answers?: number[] };
        void _a;
        return { ...rest, hint: steps[i]!.hint, lines: steps[i]!.lines, ...(quiz ? { quiz } : {}) };
      }),
    };
  });

  return {
    locale,
    places,
    people,
    quests,
    items: say.raw("items") as Record<string, string>,
    stats: say.raw("stats") as Record<string, string>,
    emotes: say.raw("emotes") as Record<string, string>,
    outfit: say.raw("outfit") as Record<string, string | string[]>,
    ui: { ...(say.raw("ui") as Record<string, string>), loading: say("hero.loading") },
    phone: { display: phones[0]!.display, tel: phones[0]!.tel },
  };
}
