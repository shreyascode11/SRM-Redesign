"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Outfit, WalkPerson, WalkPlace, WalkScript, WalkTopic } from "@/lib/walk/script";
import type { World, XZ } from "@/lib/walk/world";
import { OUTFIT_SIZES, PALETTE } from "./Character";
import { EMOTES, type Game, type Progress } from "./state";

export const fmt = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? `{${k}}`));

const glass = "pointer-events-auto rounded-2xl border border-white/15 bg-[#14101a]/85 text-white shadow-2xl backdrop-blur-md";
const chip =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-black hover:bg-[#ffe9b0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fd8]";
const darkBtn =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-[#14101a]/80 px-3 text-sm font-semibold text-white backdrop-blur hover:bg-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#ffd166]";
export const hudBtn = darkBtn;

// ─────────────────────────── Talking (NPC interaction) ───────────────────────────

export type Talk = {
  person: string;
  lines: string[];
  idx: number;
  kind: "quest" | "offer" | "chat";
  quest?: string;
  step?: number;
  topic?: WalkTopic | null;
  asking?: boolean;
  answer?: { text: string; links: { label: string; href: string }[]; error?: boolean } | null;
  busy?: boolean;
};

const ROLE_ICON: Record<string, string> = {
  counsellor: "🎓",
  librarian: "📚",
  senior: "🧑‍🎓",
  friend: "😊",
  camber: "🏎️",
  techpark: "💻",
  founder: "🚀",
  host: "🎤",
  warden: "🏠",
};

export function Dialogue({
  talk,
  person,
  place,
  script,
  onNext,
  onAccept,
  onDecline,
  onTopic,
  onAsk,
  onAskMode,
  onBye,
}: {
  talk: Talk;
  person: WalkPerson;
  place?: WalkPlace;
  script: WalkScript;
  onNext: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onTopic: (t: WalkTopic | null) => void;
  onAsk: (q: string) => void;
  onAskMode: () => void;
  onBye: () => void;
}) {
  const ui = script.ui;
  const first = useRef<HTMLButtonElement>(null);
  const [q, setQ] = useState("");
  const last = talk.idx >= talk.lines.length - 1;
  const quest = talk.quest ? script.quests.find((x) => x.id === talk.quest) : undefined;
  const text = talk.topic ? talk.topic.a : talk.answer ? talk.answer.text : talk.asking ? null : talk.lines[talk.idx];
  // Type the line in quickly; a tap shows it all (and reduced motion shows it at once).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!text) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(id), n) : n + 2)), 16);
    return () => clearInterval(id);
  }, [text]);
  useEffect(() => {
    first.current?.focus();
  }, [talk.idx, talk.topic, talk.kind, talk.asking, talk.answer]);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="walk-talk-name"
      className="walk-sheet pointer-events-auto fixed inset-x-3 bottom-3 z-30 mx-auto max-w-2xl rounded-[26px] border-4 border-[#14101a] bg-[#fffaf0] p-4 text-black shadow-2xl sm:bottom-6 sm:p-5"
    >
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-[#ffd166] text-2xl">
          {ROLE_ICON[person.id] ?? "🙂"}
        </span>
        <div className="min-w-0">
          <h2 id="walk-talk-name" className="text-lg leading-tight font-bold">
            {person.name}
          </h2>
          {place ? <p className="truncate text-sm text-black/60">{place.name}</p> : null}
        </div>
        {quest && talk.step !== undefined ? (
          <p className="ml-auto shrink-0 rotate-2 rounded-md border-2 border-[#c1121f] px-2 py-0.5 text-xs font-bold text-[#c1121f] uppercase">
            {quest.title} · {fmt(ui.step!, { n: talk.step + 1, total: quest.steps.length })}
          </p>
        ) : null}
      </header>

      <div aria-live="polite" className="mt-3 min-h-[3.5rem] text-lg leading-snug" onClick={() => text && setShown(text.length)}>
        {text ? (
          <p>
            <span>{text.slice(0, shown)}</span>
            <span aria-hidden="true" className="opacity-0">
              {text.slice(shown)}
            </span>
          </p>
        ) : null}
        {talk.busy ? <p className="text-black/60">{ui.thinking}</p> : null}
        {talk.answer && !talk.answer.error ? <p className="mt-1 text-xs text-black/55">{ui.aiNote}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {talk.topic?.link || talk.answer?.links.length ? (
          [...(talk.topic?.link ? [talk.topic.link] : []), ...(talk.answer?.links ?? [])].slice(0, 3).map((l) => (
            <a key={l.href + l.label} href={l.href} className={`${chip} border-[#1f4fd8] text-[#1f4fd8]`}>
              {l.label} →
            </a>
          ))
        ) : null}

        {talk.asking && !talk.busy ? (
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim().length > 1) onAsk(q.trim());
            }}
          >
            <label htmlFor="walk-ask" className="sr-only">
              {ui.askLabel}
            </label>
            <input
              id="walk-ask"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={200}
              placeholder={ui.askPlaceholder}
              className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-black/20 bg-white px-4 text-base outline-none focus:border-[#1f4fd8]"
            />
            <button type="submit" className={`${chip} bg-[#ffd166]`}>
              {ui.send}
            </button>
          </form>
        ) : null}

        {!last && !talk.topic && !talk.asking ? (
          <button ref={first} type="button" onClick={onNext} className={`${chip} bg-[#ffd166]`}>
            {ui.next} ▸
          </button>
        ) : talk.kind === "offer" && !talk.topic ? (
          <>
            <button ref={first} type="button" onClick={onAccept} className={`${chip} bg-[#ffd166]`}>
              {ui.sure}
            </button>
            <button type="button" onClick={onDecline} className={chip}>
              {ui.notNow}
            </button>
          </>
        ) : talk.kind === "quest" ? (
          <button ref={first} type="button" onClick={onNext} className={`${chip} bg-[#ffd166]`}>
            {ui.next} ▸
          </button>
        ) : (
          <>
            {person.topics
              .filter((x) => x.id !== talk.topic?.id)
              .map((x, i) => (
                <button key={x.id} ref={i === 0 ? first : undefined} type="button" onClick={() => onTopic(x)} className={chip}>
                  {x.q}
                </button>
              ))}
            {!talk.asking ? (
              <button type="button" ref={person.topics.length === 0 ? first : undefined} onClick={onAskMode} className={chip}>
                {ui.askOther}
              </button>
            ) : null}
            <button type="button" onClick={onBye} className={chip}>
              {ui.bye}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────── Quests ───────────────────────────

export function QuestLog({ script, progress, onClose, onTrack }: { script: WalkScript; progress: Progress; onClose: () => void; onTrack: (id: string) => void }) {
  const ui = script.ui;
  const stats = (["build", "think", "connect", "grow"] as const).map((s) => ({
    s,
    n: script.quests.filter((q) => q.stat === s && progress.done.includes(q.id)).length,
    of: script.quests.filter((q) => q.stat === s).length,
  }));
  return (
    <Panel title={ui.quests!} onClose={onClose} closeLabel={ui.close!}>
      <h3 className="text-sm font-semibold text-white/70 uppercase">{ui.stats}</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {stats.map(({ s, n, of }) => (
          <li key={s} className="rounded-xl bg-white/10 p-3">
            <p className="flex justify-between text-sm font-semibold">
              <span>{script.stats[s]}</span>
              <span>{fmt(ui.level!, { n: n + 1 })}</span>
            </p>
            <span aria-hidden="true" className="mt-2 block h-2 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full rounded-full bg-[#ffd166] transition-[width] duration-500" style={{ width: `${(n / of) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-col gap-2">
        {script.quests.map((q) => {
          const done = progress.done.includes(q.id);
          const step = progress.active[q.id];
          const state = done ? ui.completed : step !== undefined ? ui.active : ui.available;
          const hint = done ? q.done : q.steps[step ?? 0]?.hint;
          return (
            <li key={q.id} className={`rounded-xl border p-3 ${progress.tracked === q.id ? "border-[#ffd166]" : "border-white/15"}`}>
              <p className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {done ? "✓ " : ""}
                  {q.title}
                </span>
                <span className="text-xs text-white/70">
                  {script.stats[q.stat]} · {state}
                </span>
              </p>
              <p className="mt-1 text-sm text-white/80">{hint}</p>
              {step !== undefined && progress.tracked !== q.id ? (
                <button type="button" onClick={() => onTrack(q.id)} className={`${darkBtn} mt-2 border border-white/20`}>
                  {ui.target}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!Object.keys(progress.active).length && progress.done.length < script.quests.length ? <p className="mt-3 text-sm text-white/75">{ui.noQuests}</p> : null}
    </Panel>
  );
}

// ─────────────────────────── Maps (navigation) ───────────────────────────

const kindColor = (k: number) => ["#cfc6b6", "#e8d29a", "#f2a7a0", "#ffc061", "#93c5e8", "#c9e7e0", "#ffd2a0", "#b8b0d8", "#e6b6e0", "#ddd5c8"][k] ?? "#cfc6b6";

function drawMap(ctx: CanvasRenderingContext2D, world: World, w: number, h: number, view: { cx: number; cz: number; scale: number }, game: Game | null, extra: { target: XZ | null; people: XZ[] }) {
  const sx = (x: number) => w / 2 + (x - view.cx) * view.scale;
  const sz = (z: number) => h / 2 + (z - view.cz) * view.scale;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#b4d891";
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const r of world.roads) {
    ctx.strokeStyle = r.f ? "#e9d9b8" : "#8d8f99";
    ctx.lineWidth = Math.max(1, r.w * view.scale);
    ctx.beginPath();
    r.p.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x), sz(z)) : ctx.moveTo(sx(x), sz(z))));
    ctx.stroke();
  }
  ctx.fillStyle = "#6cc3e0";
  for (const wtr of world.water) {
    ctx.beginPath();
    wtr.p.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x), sz(z)) : ctx.moveTo(sx(x), sz(z))));
    ctx.fill();
  }
  for (const b of world.buildings) {
    ctx.fillStyle = kindColor(b.k);
    ctx.beginPath();
    b.p.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x), sz(z)) : ctx.moveTo(sx(x), sz(z))));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = "#1f4fd8";
  for (const [x, z] of extra.people) {
    ctx.beginPath();
    ctx.arc(sx(x), sz(z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (extra.target) {
    ctx.fillStyle = "#ffd166";
    ctx.strokeStyle = "#14101a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(extra.target[0]), sz(extra.target[1]), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (game) {
    const px = sx(game.pos.x);
    const pz = sz(game.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-game.heading + Math.PI);
    ctx.fillStyle = "#c1121f";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** The small map in the corner: ±150 m around you, north up, with your heading and the next stop. */
export function Minimap({ world, game, people, label }: { world: World; game: React.RefObject<Game>; people: XZ[]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    let n = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (n++ % 4) return;
      const g = game.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMap(ctx, world, c.clientWidth, c.clientHeight, { cx: g.pos.x, cz: g.pos.z, scale: c.clientWidth / 300 }, g, { target: g.target, people });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [world, game, people]);
  return <canvas ref={ref} role="img" aria-label={label} className="pointer-events-auto size-28 rounded-full border-4 border-white/80 shadow-xl sm:size-36" />;
}

export function MapPanel({
  script,
  world,
  game,
  people,
  onWalk,
  onJump,
  onClose,
}: {
  script: WalkScript;
  world: World;
  game: React.RefObject<Game>;
  people: XZ[];
  onWalk: (id: string) => void;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  const ui = script.ui;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = world.bounds;
    const scale = Math.min(c.clientWidth / (b.maxX - b.minX), c.clientHeight / (b.maxZ - b.minZ));
    drawMap(ctx, world, c.clientWidth, c.clientHeight, { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, scale }, game.current, { target: game.current.target, people });
  }, [world, game, people]);
  const groups = new Map<string, WalkPlace[]>();
  for (const p of script.places) groups.set(p.kindLabel, [...(groups.get(p.kindLabel) ?? []), p]);
  return (
    <Panel title={ui.map!} onClose={onClose} closeLabel={ui.close!} wide>
      <canvas ref={ref} role="img" aria-label={ui.minimap} className="aspect-[4/3] w-full rounded-xl" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[...groups].map(([k, list]) => (
          <section key={k}>
            <h3 className="text-xs font-semibold text-white/70 uppercase">{k}</h3>
            <ul className="mt-1 flex flex-col">
              {list.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-white/10 py-1">
                  <span className="text-sm">{p.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => onWalk(p.id)} className={`${darkBtn} min-h-10 border border-white/20 px-2 text-xs`}>
                      {ui.walkThere}
                    </button>
                    <button type="button" onClick={() => onJump(p.id)} className={`${darkBtn} min-h-10 border border-white/20 px-2 text-xs`}>
                      {ui.jumpThere}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}

// ─────────────────────────── Character configuration ───────────────────────────

const CATS: (keyof Outfit)[] = ["hair", "hairColor", "skin", "top", "bottom", "shoes", "bag"];
const swatch = (cat: keyof Outfit, i: number): string | null =>
  cat === "skin"
    ? PALETTE.skin[i]!
    : cat === "hairColor"
      ? PALETTE.hairColor[i]!
      : cat === "top"
        ? PALETTE.top[i]![0]!
        : cat === "bottom"
          ? PALETTE.bottom[i]!
          : cat === "shoes"
            ? PALETTE.shoes[i]!
            : cat === "bag" && i > 0
              ? PALETTE.bag[i]!
              : null;

export function OutfitPanel({ script, outfit, onChange, onDone }: { script: WalkScript; outfit: Outfit; onChange: (o: Outfit) => void; onDone: () => void }) {
  const o = script.outfit;
  const ui = script.ui;
  const [cat, setCat] = useState<keyof Outfit>("top");
  const names = o[`${cat}Names`] as string[];
  return (
    <section
      aria-labelledby="walk-outfit-title"
      className={`${glass} fixed inset-x-0 bottom-0 z-30 max-h-[48svh] overflow-y-auto rounded-b-none p-4 sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-auto sm:max-h-[calc(100svh-7rem)] sm:w-[22rem] sm:rounded-2xl`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="walk-outfit-title" className="grail-display text-2xl">
          {o.title as string}
        </h2>
        <button
          type="button"
          onClick={() => {
            const n = Object.fromEntries(CATS.map((c) => [c, Math.floor(Math.random() * OUTFIT_SIZES[c])])) as Outfit;
            onChange(n);
          }}
          className={`${darkBtn} border border-white/20`}
        >
          🎲 {ui.random}
        </button>
      </div>
      <div role="tablist" aria-label={o.title as string} className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            type="button"
            onClick={() => setCat(c)}
            className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold aria-selected:bg-[#ffd166] aria-selected:text-black"
          >
            {o[c] as string}
          </button>
        ))}
      </div>
      <fieldset className="mt-3">
        <legend className="sr-only">{o[cat] as string}</legend>
        <div className="grid grid-cols-2 gap-2">
          {names.map((n, i) => {
            const sw = swatch(cat, i);
            return (
              <label key={n} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 has-[:checked]:border-[#ffd166] has-[:checked]:bg-white/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#ffd166]">
                <input type="radio" name="walk-outfit" checked={outfit[cat] === i} onChange={() => onChange({ ...outfit, [cat]: i })} className="sr-only" />
                {sw ? <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-2 border-white/60" style={{ background: sw }} /> : null}
                <span className="text-sm">{n}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <button type="button" onClick={onDone} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#ffd166] font-bold text-black">
        {ui.done}
      </button>
    </section>
  );
}

// ─────────────────────────── Emotes, pause, finish, panel shell ───────────────────────────

export function EmoteWheel({ script, onPick, onClose }: { script: WalkScript; onPick: (glyph: string, id: string) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div role="group" aria-label={script.ui.emote} className={`${glass} fixed right-3 bottom-24 z-30 grid grid-cols-5 gap-1 p-2`} onKeyDown={(e) => {
        // Close this panel only: the game's own Escape (open the pause menu) must not also run.
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onClose();
      }}>
      {EMOTES.map(([id, glyph], i) => (
        <button
          key={id}
          ref={i === 0 ? first : undefined}
          type="button"
          aria-label={script.emotes[id]}
          title={script.emotes[id]}
          onClick={() => onPick(glyph, id)}
          className="grid size-12 place-items-center rounded-xl text-2xl hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-[#ffd166]"
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, onClose, closeLabel, wide, children }: { title: string; onClose: () => void; closeLabel: string; wide?: boolean; children: React.ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => {
        // Close this panel only: the game's own Escape (open the pause menu) must not also run.
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onClose();
      }}
      className={`${glass} fixed inset-3 z-40 mx-auto my-auto h-fit max-h-[calc(100svh-1.5rem)] overflow-y-auto p-4 sm:p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="grail-display text-3xl">{title}</h2>
        <button ref={close} type="button" onClick={onClose} className={`${darkBtn} border border-white/20`}>
          ✕ <span className="sr-only">{closeLabel}</span>
        </button>
      </div>
      {children}
    </section>
  );
}

export function PauseMenu({
  script,
  quality,
  onQuality,
  light,
  onLight,
  pace,
  onPace,
  onResume,
  onExit,
}: {
  script: WalkScript;
  quality: "auto" | "low" | "high";
  onQuality: (q: "auto" | "low" | "high") => void;
  light: "live" | "day";
  onLight: (l: "live" | "day") => void;
  pace: number;
  onPace: (p: number) => void;
  onResume: () => void;
  onExit: () => void;
}) {
  const ui = script.ui;
  return (
    <Panel title={ui.paused!} onClose={onResume} closeLabel={ui.resume!}>
      <button type="button" onClick={onResume} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#ffd166] font-bold text-black">
        {ui.resume}
      </button>
      <h3 className="mt-5 text-sm font-semibold text-white/70 uppercase">{ui.help}</h3>
      <p className="mt-1 text-sm">{ui.keys}</p>
      <p className="mt-1 text-sm">{ui.touch}</p>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-white/70 uppercase">{ui.quality}</legend>
        <div className="mt-2 flex gap-2">
          {(["auto", "low", "high"] as const).map((q) => (
            <button key={q} type="button" aria-pressed={quality === q} onClick={() => onQuality(q)} className={`${darkBtn} border border-white/20 aria-pressed:bg-[#ffd166] aria-pressed:text-black`}>
              {ui[`quality${q[0]!.toUpperCase()}${q.slice(1)}`]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-white/70 uppercase">{ui.light}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["live", "day"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={light === l} onClick={() => onLight(l)} className={`${darkBtn} border border-white/20 aria-pressed:bg-[#ffd166] aria-pressed:text-black`}>
              {l === "live" ? ui.lightLive : ui.lightDay}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-white/70 uppercase">{ui.speed}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              [1, ui.speedNormal],
              [1.3, ui.speedFast],
              [1.6, ui.speedTurbo],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={pace === v} onClick={() => onPace(v)} className={`${darkBtn} border border-white/20 aria-pressed:bg-[#ffd166] aria-pressed:text-black`}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" onClick={onExit} className={`${darkBtn} mt-5 w-full border border-white/20`}>
        {ui.exit}
      </button>
    </Panel>
  );
}

export function Finish({ script, onClose, apply, findProgramme }: { script: WalkScript; onClose: () => void; apply: string; findProgramme: string }) {
  const ui = script.ui;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split("#")[0]!;
    try {
      if (navigator.share) await navigator.share({ title: "Walk SRM", text: ui.shareText, url });
      else {
        await navigator.clipboard.writeText(`${ui.shareText} ${url}`);
        setCopied(true);
      }
    } catch {
      // Share cancelled.
    }
  };
  return (
    <Panel title={ui.allDoneTitle!} onClose={onClose} closeLabel={ui.close!}>
      <p className="text-lg">{ui.allDoneText}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {(["build", "think", "connect", "grow"] as const).map((s) => (
          <li key={s} className="rounded-xl bg-white/10 p-3 text-center">
            <span className="grail-display block text-3xl">{script.stats[s]}</span>
            <span className="text-sm text-white/75">
              {fmt(ui.level!, { n: script.quests.filter((q) => q.stat === s).length + 1 })}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href={findProgramme} className="inline-flex min-h-12 items-center rounded-full bg-[#ffd166] px-5 font-bold text-black no-underline">
          {ui.findProgramme}
        </a>
        <a href={apply} className={`${darkBtn} min-h-12 border border-white/30 px-5`}>
          {ui.apply}
        </a>
        <button type="button" onClick={share} className={`${darkBtn} min-h-12 border border-white/30 px-5`}>
          {copied ? ui.copied : ui.share}
        </button>
        <button type="button" onClick={onClose} className={`${darkBtn} min-h-12 px-5`}>
          {ui.keepWalking}
        </button>
      </div>
    </Panel>
  );
}

/** The thumb stick (touch screens): drag from the base; past the outer ring you run. */
export function Joystick({ game, label }: { game: React.RefObject<Game>; label: string }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = base.current;
    if (!el) return;
    let id: number | null = null;
    const R = 46;
    const set = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      let x = e.clientX - (r.left + r.width / 2);
      let y = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(x, y);
      if (d > R) {
        x = (x / d) * R;
        y = (y / d) * R;
      }
      game.current.joy = { x: x / R, y: y / R };
      if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    const down = (e: PointerEvent) => {
      id = e.pointerId;
      el.setPointerCapture(e.pointerId);
      set(e);
    };
    const move = (e: PointerEvent) => e.pointerId === id && set(e);
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      game.current.joy = { x: 0, y: 0 };
      if (knob.current) knob.current.style.transform = "";
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [game]);
  return (
    <div ref={base} aria-label={label} role="img" className="walk-joystick pointer-events-auto fixed bottom-6 left-6 z-20 grid size-32 touch-none place-items-center rounded-full border-2 border-white/40 bg-black/25 backdrop-blur-sm">
      <div ref={knob} className="size-14 rounded-full bg-white/85 shadow-lg transition-transform duration-75" />
    </div>
  );
}

export function PlaceCard({ place, ui }: { place: WalkPlace; ui: Record<string, string> }) {
  return (
    <div className="walk-card pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-white p-2 pr-3 text-black shadow-xl">
      {place.photo ? (
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
          <Image src={place.photo} alt="" fill sizes="56px" className="object-cover" />
        </span>
      ) : (
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#ffd166] text-2xl">
          🏛️
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-bold">{place.name}</span>
        <span className="block text-xs text-black/60">{place.kindLabel}</span>
        {place.credit ? <span className="block text-[10px] text-black/50">{place.credit}</span> : null}
      </span>
      {place.href ? (
        <a href={place.href} className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full bg-[#14101a] px-3 text-sm font-semibold text-white no-underline">
          {ui.openPage}
        </a>
      ) : null}
    </div>
  );
}

