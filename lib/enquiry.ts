/**
 * Admission enquiry: one schema shared by the form (instant feedback) and /api/enquiry (the real check).
 * Pure module — safe to import from client and server.
 */

export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;
export const OUTSIDE_INDIA = "outside-india";

export type EnquiryField = "name" | "phone" | "email" | "state" | "programme" | "message" | "consent";
export type EnquiryError = "required" | "tooShort" | "tooLong" | "invalidPhone" | "invalidEmail" | "invalidChoice";

type Enquiry = {
  name: string;
  phone: string;
  email: string;
  state: string;
  programme: string;
  message: string;
  consent: boolean;
  locale: string;
};

type EnquiryResult =
  | { ok: true; data: Enquiry }
  | { ok: false; errors: Partial<Record<EnquiryField, EnquiryError>> };

const clean = (v: unknown, max = 2000) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Indian mobile (with or without +91) or any international number in +country format. */
function normalisePhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, "");
  const indian = compact.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  if (indian) return `+91${indian[1]}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export function validateEnquiry(input: Record<string, unknown>, programmeSlugs: readonly string[]): EnquiryResult {
  const errors: Partial<Record<EnquiryField, EnquiryError>> = {};
  const name = clean(input.name, 120);
  const phoneRaw = clean(input.phone, 40);
  const email = clean(input.email, 200);
  const state = clean(input.state, 80);
  const programme = clean(input.programme, 80);
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const consent = input.consent === true || input.consent === "on" || input.consent === "true";

  if (!name) errors.name = "required";
  else if (name.length < 2) errors.name = "tooShort";
  else if (name.length > 80) errors.name = "tooLong";

  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (!phoneRaw) errors.phone = "required";
  else if (!phone) errors.phone = "invalidPhone";

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "invalidEmail";

  if (!state) errors.state = "required";
  else if (state !== OUTSIDE_INDIA && !(STATES as readonly string[]).includes(state)) errors.state = "invalidChoice";

  if (programme && programme !== "undecided" && !programmeSlugs.includes(programme)) errors.programme = "invalidChoice";

  if (message.length > 1000) errors.message = "tooLong";
  if (!consent) errors.consent = "required";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      phone: phone!,
      email,
      state,
      programme: programme || "undecided",
      message,
      consent,
      locale: clean(input.locale, 5) || "en",
    },
  };
}
