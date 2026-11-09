import { Gloock, Inter, Noto_Sans_Devanagari, Noto_Sans_Tamil, Space_Grotesk } from "next/font/google";
import type { Locale } from "./i18n";

// next/font downloads these at build time and serves them from our own origin — no Google request at runtime.

export const fontText = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

// "Level Up at SRM" display face (docs/DESIGN-REFERENCE.md): a wide, high-contrast serif set in capitals, the closest free (OFL)
// match to the reference's paid face. One weight, Latin only; Tamil and Hindi fall back to their scripts' own faces.
export const fontSerif = Gloock({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-grail-serif",
});

// Script fonts are only attached (and only downloaded) on their own locale.
// display "optional": use the web font only if it's ready at first paint, otherwise keep the system Tamil /
// Devanagari font (Noto on Android) — no swap, so no layout shift (Tamil CLS was 0.31 with "swap").
export const fontTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  display: "optional",
  variable: "--font-noto-tamil",
  preload: false,
});

export const fontDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "optional",
  variable: "--font-noto-devanagari",
  preload: false,
});

export function fontVariables(locale: Locale): string {
  const vars = [fontText.variable, fontDisplay.variable, fontSerif.variable];
  if (locale === "ta") vars.push(fontTamil.variable);
  if (locale === "hi") vars.push(fontDevanagari.variable);
  return vars.join(" ");
}
