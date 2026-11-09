import data from "@/content/research-centres.json";
import type messages from "@/messages/en.json";

/**
 * Central research laboratories and facilities, and SRM's patent register (content/research-centres.json). Data only —
 * contacts, photos, counts, links; all prose lives in messages/{en,ta,hi}.json under "Centres".
 */
type CentresMessages = (typeof messages)["Centres"];
export type CentreSlug = keyof CentresMessages["centres"];

type Centre = {
  slug: CentreSlug;
  acronym: string;
  established?: string;
  photo?: string;
  source: string;
  booking?: string;
  contact: { name?: string; role: keyof CentresMessages["roles"]; email: string; phone?: string };
};

type ResearchCentres = {
  source: string;
  heroPhoto: string;
  dean: { name: string; email: string; phone: string; office: string };
  centres: Centre[];
  patents: {
    granted: { total: number; byOffice: Record<keyof CentresMessages["patents"]["offices"], number>; years: string };
    published: { total: number; years: string };
    transfers: number;
    usGranted: { number: string; year: string; title: keyof CentresMessages["patents"]["us"] }[];
    transferList: (keyof CentresMessages["patents"]["transferList"])[];
    sources: Record<"patents" | "granted" | "published" | "transfers", string>;
  };
};

export const researchCentres = data as unknown as ResearchCentres;

/** Copy for one centre: every centre has a brief; the lists appear only where SRM publishes them. */
export type CentreCopy = { name: string; brief: string; focus?: string[]; facilities?: string[]; highlights?: string[] };
