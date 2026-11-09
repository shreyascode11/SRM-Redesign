import lifeData from "@/content/student-life.json";
import type messages from "@/messages/en.json";

/**
 * Kattankulathur student life (content/student-life.json). Data only — photos, events, clubs, contacts — so it is
 * the same in every language; all prose lives in messages/{en,ta,hi}.json under "Life".
 */
type Person = { name: string; email?: string; phone?: string };
type LifeMessages = (typeof messages)["Life"];

type StudentLife = {
  sources: Record<LifeSection, string>;
  stats: Record<"acres" | "clubs" | "houses" | "events" | "counselling", string>;
  photos: Record<"holistic" | "cycling" | "transport" | "affairs" | "wellness" | "community", string>;
  events: { slug: keyof LifeMessages["affairs"]["events"]; name: string; photo: string }[];
  clubs: (keyof LifeMessages["clubs"]["items"])[];
  worship: { slug: "temple" | "mosque" | "church"; photo: string }[];
  contacts: {
    campusLife: Person;
    security: string;
    parking: string;
    dsa: (Person & { role: "director" | "deputy" | "assistant" })[];
    counsellors: (Person & { role: "hod" | "asst" })[];
    wellness: { uwp: string; centre: string };
    teleManas: string;
    antiRagging: {
      helpline: string[];
      email: string;
      national: { phone: string; email: string; url: string };
      ugc: { email: string; url: string };
      squad: Person;
      committee: Person;
    };
    eoc: Person;
  };
};

export const studentLife = lifeData as unknown as StudentLife;

/** Sections on /student-life in page order (message key → URL anchor); also used by the nav. */
export const LIFE_SECTIONS = {
  holistic: "holistic-development",
  green: "green-campus",
  affairs: "student-affairs",
  diversity: "diversity",
  counselling: "counselling",
  community: "community-centres",
  clubs: "clubs",
  antiRagging: "anti-ragging",
  antiDiscrimination: "anti-discrimination",
  religious: "religious-life",
  eoc: "equal-opportunity",
} as const;
export type LifeSection = keyof typeof LIFE_SECTIONS;
export const lifeSections = Object.keys(LIFE_SECTIONS) as LifeSection[];
