"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n";
import { bestFor, fmtTime, huntNumber, huntPlaces, KIND_EMOJI, streak } from "./hunt";

type Place = { id: string; name: string; kind: string; door: [number, number] };

/**
 * Today's Daily Campus Hunt, on the homepage: the hunt number and its five places, your streak and best time if you
 * have one, and a button straight into it. Worked out in the browser (the page is static; the hunt changes at
 * midnight, Chennai time), with the same picker as the game, so it always matches.
 */
export function TodayHunt({ places, gate, labels }: { places: Place[]; gate: [number, number]; labels: { kicker: string; text: string; cta: string; streak: string; best: string } }) {
  const [today, setToday] = useState<{ n: number; list: Place[]; streak: number; best: number | null } | null>(null);
  useEffect(() => {
    const n = huntNumber();
    const ids = huntPlaces(n, places, gate);
    setToday({ n, list: ids.map((id) => places.find((p) => p.id === id)!).filter(Boolean), streak: streak(), best: bestFor(n) });
  }, [places, gate]);
  const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
  if (!today) return <div className="mt-6 min-h-56 rounded-2xl border border-white/15 bg-black/30" aria-hidden="true" />;
  return (
    <section aria-label={fill(labels.kicker, { n: today.n })} className="mt-6 rounded-2xl border border-[#ffd166]/40 bg-black/35 p-4 backdrop-blur">
      <p className="text-sm font-bold text-[#ffd166]">🏁 {fill(labels.kicker, { n: today.n })}</p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{labels.text}</p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {today.list.map((p, i) => (
          <li key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-[var(--fg)]">
            <span aria-hidden="true">{KIND_EMOJI[p.kind] ?? "📍"}</span>
            <span className="text-[var(--fg-muted)]">{i + 1}.</span> {p.name}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={`/walk?hunt=${today.n}`} className="inline-flex min-h-11 items-center rounded-full bg-[#ffd166] px-5 font-bold text-black no-underline">
          {labels.cta} ▸
        </Link>
        {today.streak > 0 ? <span className="text-sm text-[var(--fg)]">{fill(labels.streak, { n: today.streak })}</span> : null}
        {today.best !== null ? <span className="text-sm text-[var(--fg)]">{fill(labels.best, { t: fmtTime(today.best) })}</span> : null}
      </div>
    </section>
  );
}
