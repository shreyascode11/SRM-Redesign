"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

export type SeniorThread = {
  id: string;
  status: "answered" | "awaiting";
  question: string;
  answer?: { text: string; senior: string };
};
type Mine = { id: string; text: string; at: number };

// What a moderator would reject anyway — catch it before it's ever submitted.
const CONTACT = /(\+?\d[\d\s().-]{7,}\d)|([^\s@]+@[^\s@]+\.[^\s@]+)|(https?:\/\/|www\.)/i;

/**
 * Ask a Senior: moderated Q&A with verified current students.
 * Demo build: the threads are labelled sample content; a visitor's question is kept only in this browser
 * (and says so) and shown with its real lifecycle state — pending moderator review.
 */
export function AskSenior({ programmeSlug, threads }: { programmeSlug: string; threads: SeniorThread[] }) {
  const t = useTranslations("Senior");
  const id = useId();
  const storageKey = `srm-asks:${programmeSlug}`;
  const [mine, setMine] = useState<Mine[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<"tooShort" | "tooLong" | "contact" | null>(null);
  const [saved, setSaved] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    try {
      setMine(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as Mine[]);
    } catch {
      setMine([]);
    }
  }, [storageKey]);

  const persist = (next: Mine[]) => {
    setMine(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage blocked: the question stays on screen for this visit only.
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    const problem = q.length < 10 ? "tooShort" : q.length > 300 ? "tooLong" : CONTACT.test(q) ? "contact" : null;
    setError(problem);
    setSaved(false);
    if (problem) return;
    persist([{ id: `${Date.now()}`, text: q, at: Date.now() }, ...mine]);
    setText("");
    setSaved(true);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[data-mine]")?.focus());
  };

  const badge = (label: string, tone: "ok" | "wait" | "pending") => (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tone === "ok" ? "bg-tree/20 text-tree" : tone === "wait" ? "bg-line-subtle text-fg" : "border border-line text-fg"
      }`}
    >
      {label}
    </span>
  );

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div>
        <h2 id={`${id}-title`} className="font-display text-section font-bold">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-prose text-fg-muted">{t("intro")}</p>
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm">{t("demoBanner")}</p>
      </div>

      <ul ref={listRef} className="flex flex-col gap-4">
        {mine.map((m) => (
          <li key={m.id}>
            <article data-mine tabIndex={-1} className="flex flex-col gap-2 rounded-2xl border border-line p-5">
              <div className="flex flex-wrap items-center gap-2">
                {badge(t("yours"), "pending")}
                {badge(t("pending"), "pending")}
              </div>
              <h3 className="text-lg font-semibold">{m.text}</h3>
              <button
                type="button"
                onClick={() => persist(mine.filter((x) => x.id !== m.id))}
                className="inline-flex min-h-11 w-fit items-center text-sm underline"
              >
                {t("remove")}
              </button>
            </article>
          </li>
        ))}
        {threads.map((th) => (
          <li key={th.id}>
            <article className="flex flex-col gap-3 rounded-2xl border border-line-subtle p-5">
              <div>{th.status === "answered" ? badge(t("answered"), "ok") : badge(t("awaiting"), "wait")}</div>
              <h3 className="text-lg font-semibold">{th.question}</h3>
              {th.answer ? (
                <div className="border-l-2 border-tree pl-4">
                  <p>{th.answer.text}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                    <span className="inline-flex items-center gap-1 font-semibold text-tree">
                      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
                        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {t("verified")}
                    </span>
                    · {th.answer.senior}
                  </p>
                </div>
              ) : null}
            </article>
          </li>
        ))}
        {!threads.length && !mine.length ? <li className="text-fg-muted">{t("empty")}</li> : null}
      </ul>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-line-subtle p-5">
        <h3 className="font-display text-xl font-bold">{t("ask")}</h3>
        <label htmlFor={`${id}-q`} className="font-semibold">
          {t("question")}
        </label>
        <textarea
          id={`${id}-q`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={400}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
          className="block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-[#ffb4a8]"
        />
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {t("questionHint")}
        </p>
        {error ? (
          <p id={`${id}-err`} role="alert" className="text-sm font-semibold text-[#ffb4a8]">
            {t(error)}
          </p>
        ) : null}
        <p role="status" className="text-sm text-fg-muted">
          {saved ? t("savedNote") : ""}
        </p>
        <button type="submit" className="inline-flex min-h-11 w-fit items-center rounded-full bg-fg px-5 font-semibold text-bg">
          {t("submit")}
        </button>
        <details className="text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{t("rules")}</summary>
          <ul className="list-disc pl-5 text-fg-muted">
            <li>{t("rule1")}</li>
            <li>{t("rule2")}</li>
            <li>{t("rule3")}</li>
          </ul>
        </details>
      </form>
    </section>
  );
}
