import hostelsData from "@/content/hostels.json";

/**
 * Kattankulathur hostels (content/hostels.json). Data only — names, room types, fees, timings, contacts — so it is
 * the same in every language; all prose lives in messages/{en,ta,hi}.json under "Hostels".
 */
export type Aircon = "ac" | "non-ac" | "both";
export type Washroom = "attached" | "common" | "both";

export type HostelBlock = {
  slug: string;
  name: string;
  ac?: Aircon;
  washroom?: Washroom;
  /** e.g. "2 & 3" — shown as "{n} sharing". */
  sharing?: string;
  floors?: string;
  email: string;
  phone: string;
  phoneAlt?: string;
  photo?: string;
  offCampus?: boolean;
  extras?: string[];
};

export type FeeRow = {
  ac: boolean;
  washroom: "attached" | "common";
  sharing: string;
  block: string;
  hostel: number;
  mess: number;
  total: number;
  offCampus?: boolean;
  note?: "bunker";
};

type Cohort = { key: string; men?: string; women?: string; both?: string };
export type Meal = "breakfast" | "lunch" | "snacks" | "dinner" | "special";
type MealTime = [Meal, string, string];
type Canteen = { slug: string; name: string; hours: [string, string] | "24h" };

type Hostels = {
  sources: Record<"hub" | "men" | "women" | "international" | "dining" | "rules" | "codeOfConduct" | "portal" | "staff", string>;
  capacity: Record<"men" | "women" | "international", string>;
  heroPhoto: string;
  men: HostelBlock[];
  women: HostelBlock[];
  international: HostelBlock[];
  fees: {
    year: string;
    bookingOpened: string;
    men: FeeRow[];
    women: FeeRow[];
    laundry: { men: number; women: number };
    sources: { men: string; women: string };
    otherCohorts: Cohort[];
  };
  dining: {
    mess: { working: MealTime[]; holidays: MealTime[] };
    guestRates: [Meal, number][];
    canteens: Canteen[];
  };
  contacts: {
    director: { name: string; email: string; phone: string };
    men: { blocks: string; email: string; accounts: string; office: string[]; mobile: string };
    women: { blocks: string; email: string; accounts: string; office: string[]; mobile: string };
    kopperundevi: { email: string; mobile: string };
    pierreFauchard: { email: string; mobile: string; accounts: string };
  };
};

export const hostels = hostelsData as unknown as Hostels;

/** Section anchors on /hostels, in page order (also used by the nav and the footer). */
export const HOSTEL_SECTIONS = ["accommodation", "women", "men", "international", "fees", "apply", "dining", "safety", "contact"] as const;
export type HostelSection = (typeof HOSTEL_SECTIONS)[number];

/** "8056016611" → "tel:+918056016611"; landlines like "044-27434507" keep their STD code. */
export const telHref = (n: string) => {
  const digits = n.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) return `tel:+91${digits.slice(1)}`;
  return `tel:+91${digits}`;
};
