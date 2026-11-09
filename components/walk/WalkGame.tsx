"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Outfit, WalkScript } from "@/lib/walk/script";
import { chennaiHour, Collider, Paths, type World, type XZ } from "@/lib/walk/world";
import { Dialogue, EmoteWheel, Finish, fmt, hudBtn, Joystick, MapPanel, Minimap, OutfitPanel, PauseMenu, PlaceCard, QuestLog, type Talk } from "./Panels";
import { type Npc, type Overlay, Scene, type Sky } from "./Scene";
import { carrying, type Game, jump, loadOutfit, loadProgress, newGame, type Progress, saveOutfit, saveProgress, stepTarget } from "./state";

/** Light and sky: a painted teal day by default (anime style), or Chennai's real time of day. */
function skyFor(h: number): Sky {
  if (h >= 6 && h < 10)
    return { fog: "#e6e4d6", sun: "#ffe2bf", sunI: 2.2, hemiTop: "#f3ece0", hemiBottom: "#8f9f98", hemiI: 1.2, night: 0, top: "#7fc4cc", horizon: "#f2dcc6", cloud: "#fff6ec", cloudShade: "#e3c6b8" };
  if (h >= 10 && h < 16)
    return { fog: "#cfe6df", sun: "#fff3df", sunI: 2.4, hemiTop: "#eaf6f2", hemiBottom: "#87a29f", hemiI: 1.25, night: 0, top: "#62bdbb", horizon: "#d3ebe3", cloud: "#f6fbf8", cloudShade: "#b9dcd5" };
  if (h >= 16 && h < 19)
    return { fog: "#e9cfc4", sun: "#ffc9a0", sunI: 2.0, hemiTop: "#f6dcd8", hemiBottom: "#7f8c99", hemiI: 1.1, night: 0.2, top: "#7f8fc0", horizon: "#f1c9b6", cloud: "#ffe6d8", cloudShade: "#c99db0" };
  return { fog: "#34436a", sun: "#cdd8ff", sunI: 0.9, hemiTop: "#9fb3e0", hemiBottom: "#3a4a5a", hemiI: 0.9, night: 1, top: "#17213d", horizon: "#3a4c78", cloud: "#5a6a92", cloudShade: "#36436a" };
}

/**
 * Props for a game button that works while another finger is on the thumb stick. iOS sends no click for a second
 * finger while the first is still down, so on touch it fires on pointerdown (and swallows the click that may follow);
 * mouse and keyboard use the ordinary click.
 */
const tap = (fn: () => void) => ({
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
    // A mouse click must not leave focus on the button: Space would then press it again instead of jumping.
    if (e.pointerType === "mouse") return void e.preventDefault();
    e.preventDefault();
    e.currentTarget.dataset.tapped = "1";
    fn();
  },
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.dataset.tapped) {
      delete e.currentTarget.dataset.tapped;
      return;
    }
    fn();
  },
});

const QUALITY_DPR = { auto: [1, 1.6], low: [0.7, 0.85], high: [1.5, 2] } as const;

export default function WalkGame({ script, onExit, startWithOutfit }: { script: WalkScript; onExit: () => void; startWithOutfit: boolean }) {
  const ui = script.ui;
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState(false);
  const game = useRef<Game>(null as unknown as Game);
  const [outfit, setOutfit] = useState<Outfit>(() => loadOutfit());
  const [progress, setProgress] = useState<Progress>(() => loadProgress(script.quests));
  const [near, setNear] = useState<{ person: string | null; place: string | null }>({ person: null, place: null });
  const [talk, setTalk] = useState<Talk | null>(null);
  const [walker, setWalker] = useState<{ i: number; name: string; to: string } | null>(null);
  /** True once you move around with Tab, until the next mouse or finger press. */
  const tabNav = useRef(false);
  // The "Next stop" banner can be folded away on a small screen (remembered for this visit).
  const [bannerHidden, setBannerHidden] = useState(() => {
    try {
      return sessionStorage.getItem("srm-walk-banner") === "hidden";
    } catch {
      return false;
    }
  });
  const toggleBanner = (hidden: boolean) => {
    setBannerHidden(hidden);
    try {
      sessionStorage.setItem("srm-walk-banner", hidden ? "hidden" : "shown");
    } catch {}
  };
  const [panel, setPanel] = useState<null | "quests" | "map" | "outfit" | "emote" | "pause" | "finish">(startWithOutfit ? "outfit" : null);
  const [toast, setToast] = useState<string | null>(null);
  const [quality, setQuality] = useState<"auto" | "low" | "high">("auto");
  const [touch, setTouch] = useState(false);
  const overlay = useMemo<Overlay>(() => ({ els: new Map(), anchors: new Map(), range: new Map() }), []);
  const [light, setLight] = useState<"live" | "day">("day");
  // Run toggle (the 🏃 button or R) and walking speed (pause menu), remembered between visits.
  const [running, setRunning] = useState(false);
  const [pace, setPace] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("srm-walk-pace"));
      return [1, 1.3, 1.6].includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("srm-walk-pace", String(pace));
    } catch {}
  }, [pace]);
  const sky = useMemo(() => skyFor(light === "day" ? 12 : chennaiHour()), [light]);
  const base = script.locale === "en" ? "" : `/${script.locale}`;
  const placeNames = useMemo(() => Object.fromEntries(script.places.map((p) => [p.id, p.name])), [script.places]);

  // ── Load the campus ──
  useEffect(() => {
    let alive = true;
    fetch("/walk/ktr-world.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((w: World) => alive && setWorld(w))
      .catch(() => alive && setError(true));
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    return () => {
      alive = false;
    };
  }, []);

  const tools = useMemo(() => {
    if (!world) return null;
    const collider = new Collider([...world.buildings.map((b) => b.p), ...world.water.map((w) => w.p)], world.bounds);
    return { collider, paths: new Paths(world.roads, collider) };
  }, [world]);

  // People stand just outside their building's door, facing out.
  const npcs = useMemo<Npc[]>(() => {
    if (!world) return [];
    return script.people.flatMap((p) => {
      const pl = world.places[p.at];
      if (!pl) return [];
      const b = pl.b !== undefined ? world.buildings[pl.b] : undefined;
      const c = b ? b.p.reduce((s, q) => [s[0] + q[0] / b.p.length, s[1] + q[1] / b.p.length], [0, 0]) : [pl.x, pl.z];
      const face = Math.atan2(pl.door[0] - c[0]!, pl.door[1] - c[1]!);
      return [{ id: p.id, x: pl.door[0], z: pl.door[1], face, outfit: p.outfit }];
    });
  }, [world, script.people]);
  const peopleXZ = useMemo<XZ[]>(() => npcs.map((n) => [n.x, n.z]), [npcs]);

  if (world && !game.current) {
    const spawn = world.places[world.spawn];
    game.current = newGame(spawn ? [spawn.door[0], spawn.door[1] + 6] : [0, 0], script.people.map((p) => p.id));
    game.current.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Arriving at the main gate: face up the avenue, through the arches.
    if (world.gate && world.spawn === "gate") {
      game.current.pos = { x: spawn!.door[0], z: spawn!.door[1] };
      game.current.heading = world.gate.ry;
      game.current.cam.yaw = world.gate.ry + Math.PI;
    }
  }
  if (game.current) {
    game.current.pace = pace;
    game.current.run = running;
  }

  // ── Progress, wayfinding target and saving ──
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveOutfit(outfit), [outfit]);
  const tracked = progress.tracked && progress.active[progress.tracked] !== undefined ? progress.tracked : (Object.keys(progress.active)[0] ?? null);
  const targetInfo = useMemo(() => {
    if (!world) return null;
    const q = tracked ? script.quests.find((x) => x.id === tracked) : null;
    if (q) {
      const s = stepTarget(q, progress.active[q.id]!);
      if (s && "person" in s) {
        const n = npcs.find((x) => x.id === s.person);
        if (n) return { xz: [n.x, n.z] as XZ, hint: q.steps[progress.active[q.id]!]!.hint, pick: null };
      }
      if (s && "place" in s) {
        const p = world.places[s.place];
        if (p) return { xz: p.door, hint: q.steps[progress.active[q.id]!]!.hint, pick: p.door };
      }
    }
    // Nothing started yet: point to the first quest's first person.
    const first = script.quests.find((x) => !progress.done.includes(x.id) && progress.active[x.id] === undefined);
    if (first && progress.done.length === 0 && !Object.keys(progress.active).length) {
      const n = npcs.find((x) => x.id === first.steps[0]!.talk);
      if (n) return { xz: [n.x, n.z] as XZ, hint: first.steps[0]!.hint, pick: null };
    }
    return null;
  }, [world, tracked, progress, script.quests, npcs]);
  useEffect(() => {
    if (game.current) game.current.target = targetInfo?.xz ?? null;
  }, [targetInfo]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const advance = useCallback(
    (questId: string, step: number) => {
      const q = script.quests.find((x) => x.id === questId)!;
      setProgress((p) => {
        const next = step + 1;
        const active = { ...p.active };
        let done = p.done;
        if (next >= q.steps.length) {
          delete active[questId];
          done = [...p.done, questId];
          flash(fmt(ui.questDone!, { title: q.title }));
          game.current.anim.cheer = 1.6;
          if (done.length === script.quests.length) window.setTimeout(() => setPanel("finish"), 1400);
          return { active, done, tracked: Object.keys(active)[0] ?? null };
        }
        active[questId] = next;
        if (step === 0) flash(fmt(ui.newQuest!, { title: q.title }));
        return { active, done, tracked: questId };
      });
    },
    [script.quests, ui, flash],
  );

  // ── Talking ──
  const startTalk = useCallback(
    (personId: string) => {
      const g = game.current;
      g.route = [];
      g.frozen = true;
      g.talkingTo = personId;
      g.npc[personId]!.wave = 1.2;
      g.npc[personId]!.talk = 2;
      // Face the person.
      const n = npcs.find((x) => x.id === personId);
      if (n) g.heading = Math.atan2(n.x - g.pos.x, n.z - g.pos.z);
      for (const q of script.quests) {
        const s = progress.active[q.id];
        if (s !== undefined && q.steps[s]?.talk === personId) {
          setTalk({ person: personId, lines: q.steps[s]!.lines, idx: 0, kind: "quest", quest: q.id, step: s });
          return;
        }
      }
      for (const q of script.quests) {
        if (progress.active[q.id] === undefined && !progress.done.includes(q.id) && q.steps[0]!.talk === personId) {
          setTalk({ person: personId, lines: q.steps[0]!.lines, idx: 0, kind: "offer", quest: q.id, step: 0 });
          return;
        }
      }
      const person = script.people.find((p) => p.id === personId)!;
      setTalk({ person: personId, lines: [person.greet], idx: 0, kind: "chat" });
    },
    [npcs, progress, script],
  );
  const endTalk = useCallback(() => {
    const g = game.current;
    g.frozen = false;
    g.talkingTo = null;
    setTalk(null);
  }, []);
  const walkToPerson = useCallback(
    (personId: string) => {
      const g = game.current;
      const n = npcs.find((x) => x.id === personId);
      if (!n || !tools || g.frozen) return;
      if (Math.hypot(n.x - g.pos.x, n.z - g.pos.z) < 3.2) return startTalk(personId);
      // Stop just in front of them.
      const stand: XZ = [n.x + Math.sin(n.face) * 1.4, n.z + Math.cos(n.face) * 1.4];
      g.route = tools.paths.route([g.pos.x, g.pos.z], stand);
      g.onArrive = () => startTalk(personId);
    },
    [npcs, tools, startTalk],
  );
  const pickHere = useMemo(() => {
    for (const q of script.quests) {
      const s = progress.active[q.id];
      const st = s !== undefined ? q.steps[s] : undefined;
      if (st?.pick && st.pick === near.place) return { q: q.id, s: s!, item: st.item ?? "" };
    }
    return null;
  }, [progress, script.quests, near.place]);

  const action = useCallback(() => {
    if (talk || panel) return;
    if (near.person) startTalk(near.person);
    else if (walker) {
      // A student walking by: they stop, wave, and tell you where they're off to.
      const lines = [ui.crowdHi1, ui.crowdHi2, ui.crowdHi3].filter(Boolean) as string[];
      const line = lines[(walker.i + Math.floor(Date.now() / 7000)) % lines.length] ?? "";
      flash(`${walker.name}: ${fmt(line, { place: placeNames[walker.to] ?? ui.crowdSomewhere ?? "" })}`);
      game.current.crowd.greet = walker.i;
    } else if (pickHere) {
      const q = script.quests.find((x) => x.id === pickHere.q)!;
      flash(q.steps[pickHere.s]!.lines[0]!);
      game.current.anim.cheer = 0.8;
      advance(pickHere.q, pickHere.s);
    }
  }, [talk, panel, near.person, walker, pickHere, startTalk, advance, flash, script.quests, ui, placeNames]);

  const emote = useCallback((glyph: string, id: string) => {
    const g = game.current;
    g.emote = { glyph, t: 2 };
    g.crowd.emoteAt = performance.now() / 1000;
    if (id === "wave" || id === "vanakkam") g.anim.wave = 1.4;
    if (id === "cheer" || id === "party") g.anim.cheer = 1.2;
    // People nearby answer a wave with a wave.
    for (const n of npcs) if (Math.hypot(n.x - g.pos.x, n.z - g.pos.z) < 14) g.npc[n.id]!.wave = 1.4;
    const el = overlay.els.get("emote");
    if (el) el.textContent = glyph;
    setPanel(null);
  }, [npcs, overlay]);

  // ── Keyboard ──
  useEffect(() => {
    const isField = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || isField(e)) return;
      const k = e.key.toLowerCase();
      // A button or link you reached with Tab keeps Space and Enter for itself. One that only holds focus because you
      // clicked it (the start screen's "Begin", a HUD button) doesn't: the key belongs to the game. (Not :focus-visible:
      // Chrome turns that on for the focused element during this very key press.)
      if (k === "tab") tabNav.current = true;
      const tabbedTo = tabNav.current && (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement);
      if (k === " " && !talk && (!panel || panel === "emote")) {
        if (tabbedTo) return;
        e.preventDefault();
        (e.target as HTMLElement).blur?.();
        jump(g);
        return;
      }
      if (k === "r" && !talk && !panel) {
        setRunning((v) => !v);
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        g.keys.add(k);
        if (k.startsWith("arrow")) e.preventDefault();
        return;
      }
      if (k === "escape") {
        if (talk) endTalk();
        else setPanel((p) => (p ? null : "pause"));
        return;
      }
      if (talk || (panel && panel !== "emote")) return;
      if (k === "e" || k === "enter") {
        if (k === "enter" && tabbedTo) return;
        e.preventDefault();
        action();
      } else if (k === "q") setPanel((p) => (p === "emote" ? null : "emote"));
      else if (k === "m") setPanel("map");
      else if (k === "j") setPanel("quests");
      else if (k === "c") setPanel("outfit");
    };
    const up = (e: KeyboardEvent) => game.current?.keys.delete(e.key.toLowerCase());
    const blur = () => game.current?.keys.clear();
    const pointer = () => {
      tabNav.current = false;
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [talk, panel, action, endTalk]);

  // Panels pause movement; the outfit screen brings the camera in close.
  useEffect(() => {
    const g = game.current;
    if (!g) return;
    g.paused = panel === "pause" || panel === "map" || panel === "quests" || panel === "finish";
    if (panel === "outfit") {
      g.cam.dist = 3.2;
      g.cam.pitch = 0.12;
      g.cam.yaw = g.heading;
      g.frozen = true;
    } else if (!talk) {
      g.cam.dist = g.cam.minDist;
      g.cam.pitch = Math.max(g.cam.pitch, 0.22);
      g.frozen = false;
    }
  }, [panel, talk, world]);

  const onNear = useCallback((person: string | null, place: string | null) => setNear({ person, place }), []);

  // Anchors for the floating labels: building names, people, the pickup.
  useEffect(() => {
    if (!world) return;
    for (const p of script.places) {
      const w = world.places[p.id];
      if (!w || w.b === undefined) continue;
      const b = world.buildings[w.b]!;
      overlay.anchors.set(`place:${p.id}`, [w.x, b.h + 3, w.z]);
      overlay.range.set(`place:${p.id}`, 90);
    }
    for (const n of npcs) {
      overlay.anchors.set(`person:${n.id}`, [n.x, 2.25, n.z]);
      overlay.range.set(`person:${n.id}`, 45);
    }
  }, [world, npcs, script.places, overlay]);
  useEffect(() => {
    if (targetInfo?.pick) {
      overlay.anchors.set("pick", [targetInfo.pick[0], 2.6, targetInfo.pick[1]]);
      overlay.range.set("pick", 60);
    } else overlay.anchors.delete("pick");
  }, [targetInfo, overlay]);
  const reg = (k: string) => (el: HTMLElement | null) => {
    if (el) overlay.els.set(k, el);
    else overlay.els.delete(k);
  };

  // Lock the page behind the game.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const held = carrying(script, progress);
  const talkingPerson = talk ? script.people.find((p) => p.id === talk.person) : undefined;
  const nearPlace = near.place ? script.places.find((p) => p.id === near.place) : undefined;
  const placeOfPerson = (id: string) => script.places.find((p) => p.id === script.people.find((x) => x.id === id)?.at);
  const questCount = Object.keys(progress.active).length;

  if (error)
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-[#14101a] p-6 text-center text-white">
        <p>
          {ui.askFailed?.replace("{phone}", script.phone.display)}{" "}
          <button type="button" onClick={onExit} className={hudBtn}>
            {ui.exit}
          </button>
        </p>
      </div>
    );

  return (
    <div className="walk-root fixed inset-0 z-[70] overflow-hidden bg-[#d9ecf3] select-none" data-lenis-prevent>
      {!world || !tools ? (
        <div className="grid h-full place-items-center bg-[#14101a] text-white">
          <p aria-live="polite" className="flex items-center gap-3 text-lg">
            <span aria-hidden="true" className="walk-spinner size-6 rounded-full border-4 border-white/25 border-t-[#ffd166]" />
            {script.ui.loading ?? "…"}
          </p>
        </div>
      ) : (
        <>
          <Canvas
            aria-hidden="true"
            dpr={QUALITY_DPR[quality] as unknown as [number, number]}
            camera={{ fov: 56, near: 0.3, far: 1400, position: [0, 30, 30] }}
            flat
            shadows={quality !== "low" ? "percentage" : false}
            gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
            frameloop={panel === "pause" || panel === "finish" ? "demand" : "always"}
            className="!absolute inset-0"
            style={{ touchAction: "none" }}
          >
            <Scene
              world={world}
              collider={tools.collider}
              paths={tools.paths}
              game={game}
              outfit={outfit}
              npcs={npcs}
              overlay={overlay}
              onNear={onNear}
              onWalker={setWalker}
              highlight={near.place}
              pickAt={targetInfo?.pick ?? null}
              sky={sky}
              quality={quality}
              names={placeNames}
            />
          </Canvas>

          {/* Floating labels over the 3D world (positioned each frame by the scene). */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {script.places.map((p) =>
              world.places[p.id]?.b !== undefined ? (
                <span key={p.id} ref={reg(`place:${p.id}`)} className="walk-label absolute top-0 left-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-black shadow" style={{ visibility: "hidden" }}>
                  {p.name}
                </span>
              ) : null,
            )}
            {npcs.map((n) => {
              const person = script.people.find((p) => p.id === n.id)!;
              const hasQuest = script.quests.some(
                (q) =>
                  (progress.active[q.id] !== undefined && q.steps[progress.active[q.id]!]?.talk === n.id) ||
                  (progress.active[q.id] === undefined && !progress.done.includes(q.id) && q.steps[0]!.talk === n.id),
              );
              return (
                <button
                  key={n.id}
                  ref={reg(`person:${n.id}`)}
                  type="button"
                  tabIndex={-1}
                  onClick={() => walkToPerson(n.id)}
                  className={`walk-bubble pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 rounded-full border-2 border-[#14101a] px-2.5 py-1 text-xs font-bold whitespace-nowrap shadow-lg ${hasQuest ? "bg-[#ffd166] text-black" : "bg-white text-black"}`}
                  style={{ visibility: "hidden" }}
                >
                  <span aria-hidden="true">{hasQuest ? "❗" : "💬"}</span>
                  {person.name}
                </button>
              );
            })}
            <span ref={reg("pick")} className="walk-bubble absolute top-0 left-0 rounded-full border-2 border-[#14101a] bg-[#ffd166] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-black shadow-lg" style={{ visibility: "hidden" }}>
              📦 {pickHere ? script.items[pickHere.item] : ""}
            </span>
            <span ref={reg("emote")} className="walk-emote absolute top-0 left-0 text-4xl" style={{ visibility: "hidden" }} />
            <span ref={reg("ripple")} className="walk-ripple absolute top-0 left-0 size-10 rounded-full border-4 border-white" style={{ visibility: "hidden" }} />
          </div>

          {/* ── HUD ── */}
          <div className="pointer-events-none absolute inset-0 z-20 p-3 sm:p-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPanel("pause")} className={`${hudBtn} pointer-events-auto`}>
                  <span aria-hidden="true">❚❚</span>
                  <span className="sr-only">{ui.pause}</span>
                </button>
                <button type="button" onClick={onExit} className={`${hudBtn} pointer-events-auto`}>
                  {ui.exit}
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPanel("quests")} className={`${hudBtn} pointer-events-auto relative`}>
                    📜 <span className="hidden sm:inline">{ui.quests}</span>
                    <span className="sr-only sm:hidden">{ui.quests}</span>
                    {questCount ? <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[#ffd166] text-xs text-black">{questCount}</span> : null}
                  </button>
                  <button type="button" onClick={() => setPanel("map")} className={`${hudBtn} pointer-events-auto`}>
                    🗺️ <span className="hidden sm:inline">{ui.map}</span>
                    <span className="sr-only sm:hidden">{ui.map}</span>
                  </button>
                </div>
                <Minimap world={world} game={game} people={peopleXZ} label={ui.minimap!} />
              </div>
            </div>

            {/* Next stop and what you're carrying. It can be folded into a small pill, so it never hides the game. */}
            {targetInfo && !talk ? (
              bannerHidden ? (
                <button
                  type="button"
                  onClick={() => toggleBanner(false)}
                  className="pointer-events-auto absolute top-16 left-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#14101a]/80 px-4 text-sm font-semibold text-white backdrop-blur sm:top-3 sm:left-1/2 sm:-translate-x-1/2"
                >
                  <span aria-hidden="true">🎯</span>
                  {ui.showTarget}
                </button>
              ) : (
                <div className="pointer-events-none absolute top-16 left-3 flex max-w-[calc(100vw-9rem)] items-start gap-1 rounded-2xl bg-[#14101a]/80 py-2 pr-1 pl-4 text-left text-sm font-semibold text-white backdrop-blur sm:top-3 sm:left-1/2 sm:w-max sm:max-w-[min(34rem,56vw)] sm:-translate-x-1/2">
                  <p aria-live="polite" className="py-0.5">
                    <span className="text-[#ffd166]">{ui.target}:</span> {targetInfo.hint}
                    {held.length ? <span className="block text-xs font-normal text-white/80">{ui.carrying}: {held.map((i) => script.items[i]).join(", ")}</span> : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleBanner(true)}
                    className="pointer-events-auto -my-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">{ui.hideTarget}</span>
                  </button>
                </div>
              )
            ) : null}
            {toast ? (
              <p role="status" className="walk-toast absolute top-40 left-3 max-w-[calc(100vw-10rem)] rounded-2xl sm:top-20 sm:left-1/2 sm:w-max sm:max-w-[60vw] sm:-translate-x-1/2 bg-[#ffd166] px-5 py-2 text-center font-bold text-black shadow-xl">
                {toast}
              </p>
            ) : null}

            {/* Bottom: place card, action buttons */}
            {!talk && !panel ? (
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-end gap-2 sm:bottom-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                {nearPlace ? (
                  <div className="mr-auto hidden sm:block">
                    <PlaceCard place={nearPlace} ui={ui} />
                  </div>
                ) : null}
                <div className="flex flex-col items-end gap-2">
                  {near.person || pickHere || walker ? (
                    <button type="button" {...tap(action)} className="walk-act walk-tap pointer-events-auto inline-flex min-h-14 items-center gap-2 rounded-full bg-[#ffd166] px-6 text-lg font-bold text-black shadow-xl">
                      {near.person ? `💬 ${ui.talk}` : walker && !pickHere ? `👋 ${fmt(ui.crowdSay!, { name: walker.name })}` : `📦 ${fmt(ui.pick!, { item: script.items[pickHere!.item] ?? "" })}`}
                      <kbd className="hidden rounded bg-black/15 px-1.5 text-xs sm:inline">E</kbd>
                    </button>
                  ) : null}
                  {/* Phones: round thumb buttons that fire the moment a finger lands, so they work while the other thumb
                      is on the stick; they sit clear of it. Wider screens: labelled pills with their keys. */}
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      aria-pressed={running}
                      {...tap(() => setRunning((v) => !v))}
                      className={`${hudBtn} walk-tap pointer-events-auto size-14 gap-1.5 aria-pressed:bg-[#ffd166] aria-pressed:text-black sm:size-auto sm:min-h-12 sm:px-4`}
                    >
                      <span aria-hidden="true" className="text-xl sm:text-base">
                        {running ? "🏃" : "🚶"}
                      </span>
                      <span className="sr-only text-sm font-bold sm:not-sr-only">{running ? ui.run : ui.walkMode}</span>
                      <kbd className="hidden rounded bg-white/15 px-1.5 text-xs sm:inline">R</kbd>
                    </button>
                    <button type="button" {...tap(() => jump(game.current))} className="walk-tap pointer-events-auto inline-flex size-16 items-center justify-center gap-1.5 rounded-full bg-[#ffd166] text-sm font-semibold text-black shadow-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-auto sm:min-h-12 sm:min-w-11 sm:px-4">
                      <span aria-hidden="true" className="text-2xl sm:text-base">
                        ⤒
                      </span>
                      <span className="sr-only text-sm font-bold sm:not-sr-only">{ui.jump}</span>
                      <kbd className="hidden rounded bg-white/15 px-1.5 text-xs sm:inline">Space</kbd>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" {...tap(() => setPanel("emote"))} className={`${hudBtn} walk-tap pointer-events-auto size-12`}>
                      😊<span className="sr-only">{ui.emote}</span>
                    </button>
                    <button type="button" {...tap(() => setPanel("outfit"))} className={`${hudBtn} walk-tap pointer-events-auto size-12`}>
                      👕<span className="sr-only">{ui.outfit}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {nearPlace && !talk && !panel ? (
              <div className="absolute inset-x-3 bottom-36 flex justify-center sm:hidden">
                <PlaceCard place={nearPlace} ui={ui} />
              </div>
            ) : null}
            {!talk && !panel && !nearPlace ? <p className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-xs font-semibold text-white/90 drop-shadow lg:block">{ui.keys}</p> : null}
          </div>

          {touch && !talk && !panel ? <Joystick game={game} label={ui.touch!} /> : null}

          {talk && talkingPerson ? (
            <Dialogue
              talk={talk}
              person={talkingPerson}
              place={placeOfPerson(talk.person)}
              script={script}
              onNext={() => {
                if (talk.idx < talk.lines.length - 1) setTalk({ ...talk, idx: talk.idx + 1 });
                else {
                  if (talk.kind === "quest" && talk.quest) advance(talk.quest, talk.step!);
                  if (talk.kind === "quest") endTalk();
                }
              }}
              onAccept={() => {
                advance(talk.quest!, 0);
                endTalk();
              }}
              onDecline={endTalk}
              onTopic={(tp) => setTalk({ ...talk, topic: tp, asking: false, answer: null })}
              onAskMode={() => setTalk({ ...talk, topic: null, asking: true, answer: null })}
              onAsk={async (q) => {
                setTalk({ ...talk, busy: true, asking: true, answer: null, topic: null });
                try {
                  const r = await fetch(`/api/assistant?q=${encodeURIComponent(q)}&locale=${script.locale}`);
                  const data = (await r.json()) as { blocks: { type: string; text?: string; rows?: { label: string; value: string }[]; links?: { label: string; href: string }[] }[] };
                  const text = data.blocks
                    .flatMap((b) => (b.type === "text" ? [b.text!] : b.type === "facts" ? b.rows!.slice(0, 4).map((r) => `${r.label}: ${r.value}`) : []))
                    .join(" ")
                    .slice(0, 600);
                  const links = data.blocks.flatMap((b) => (b.type === "links" ? b.links! : [])).slice(0, 2);
                  setTalk((cur) => (cur ? { ...cur, busy: false, asking: true, answer: { text: text || fmt(ui.askFailed!, { phone: script.phone.display }), links, error: !text } } : cur));
                } catch {
                  setTalk((cur) => (cur ? { ...cur, busy: false, asking: true, answer: { text: fmt(ui.askFailed!, { phone: script.phone.display }), links: [], error: true } } : cur));
                }
              }}
              onBye={endTalk}
            />
          ) : null}

          {panel === "quests" ? (
            <QuestLog script={script} progress={progress} onClose={() => setPanel(null)} onTrack={(id) => setProgress((p) => ({ ...p, tracked: id }))} />
          ) : null}
          {panel === "map" ? (
            <MapPanel
              script={script}
              world={world}
              game={game}
              people={peopleXZ}
              onClose={() => setPanel(null)}
              onWalk={(id) => {
                const p = world.places[id];
                if (!p) return;
                game.current.route = tools.paths.route([game.current.pos.x, game.current.pos.z], p.door);
                setPanel(null);
              }}
              onJump={(id) => {
                const p = world.places[id];
                if (!p) return;
                const [x, z] = tools.collider.resolve(p.door[0] + 2, p.door[1] + 2, 0.8);
                game.current.pos = { x, z };
                game.current.route = [];
                setPanel(null);
              }}
            />
          ) : null}
          {panel === "outfit" ? <OutfitPanel script={script} outfit={outfit} onChange={setOutfit} onDone={() => setPanel(null)} /> : null}
          {panel === "emote" ? <EmoteWheel script={script} onPick={emote} onClose={() => setPanel(null)} /> : null}
          {panel === "pause" ? <PauseMenu script={script} quality={quality} onQuality={setQuality} light={light} onLight={setLight} pace={pace} onPace={setPace} onResume={() => setPanel(null)} onExit={onExit} /> : null}
          {panel === "finish" ? <Finish script={script} onClose={() => setPanel(null)} apply={`${base}/admissions#apply`} findProgramme={`${base}/programmes`} /> : null}
        </>
      )}
    </div>
  );
}
