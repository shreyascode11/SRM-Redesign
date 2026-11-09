import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const locales = ["en", "ta", "hi"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  ta: "தமிழ்",
  hi: "हिन्दी",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  // English lives at "/", Tamil at "/ta", Hindi at "/hi".
  localePrefix: "as-needed",
});

export const { Link, usePathname, getPathname } = createNavigation(routing);
