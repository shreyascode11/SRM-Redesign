import type { Outfit, WalkQuest, WalkScript } from "@/lib/walk/script";
import type { XZ } from "@/lib/walk/world";
import { type Anim, DEFAULT_OUTFIT, newAnim, OUTFIT_SIZES } from "./Character";

/**
 * The live game state that changes every frame (position, input, camera) lives in one mutable object, read by the 3D
 * scene and the HUD without React re-renders. Things the HUD shows as UI (dialogue, quests, panels) are React state.
 */
/** Start a jump if you're on the ground and free to move. */
export const jump = (g: Game) => {
  if (g.jumpY > 0 || g.frozen || g.paused) return;
  g.jumpV = 6.4;
  g.jumpY = 0.001;
};

export type Game = {
  pos: { x: number; z: number };
  heading: number;
  speed: number;
  keys: Set<string>;
  joy: { x: number; y: number };
  run: boolean;
  /** Walking speed setting: 1 normal · 1.3 fast · 1.6 turbo. */
  pace: number;
  /** Jumping: height above the ground and upward speed. */
  jumpY: number;
  jumpV: number;
  route: XZ[];
  onArrive: (() => void) | null;
  cam: { yaw: number; pitch: number; dist: number; minDist: number };
  frozen: boolean;
  paused: boolean;
  anim: Anim;
  npc: Record<string, Anim>;
  talkingTo: string | null;
  emote: { glyph: string; t: number } | null;
  target: XZ | null;
  near: { person: string | null; place: string | null };
  reduced: boolean;
  /** Students walking about: the one you're next to, one you just said hello to, and when you last emoted. */
  crowd: { near: number | null; greet: number | null; emoteAt: number };
};

export const newGame = (start: XZ, people: string[]): Game => ({
  pos: { x: start[0], z: start[1] },
  heading: Math.PI,
  speed: 0,
  keys: new Set(),
  joy: { x: 0, y: 0 },
  run: false,
  pace: 1,
  jumpY: 0,
  jumpV: 0,
  route: [],
  onArrive: null,
  cam: { yaw: 0.6, pitch: 0.2, dist: 5.2, minDist: 5.2 },
  frozen: false,
  paused: false,
  anim: newAnim(),
  npc: Object.fromEntries(people.map((p) => [p, newAnim()])),
  talkingTo: null,
  emote: null,
  target: null,
  near: { person: null, place: null },
  reduced: false,
  crowd: { near: null, greet: null, emoteAt: 0 },
});

export type Progress = { active: Record<string, number>; done: string[]; tracked: string | null };
const EMPTY_PROGRESS: Progress = { active: {}, done: [], tracked: null };

const PROGRESS_KEY = "srm-walk-progress";
const OUTFIT_KEY = "srm-walk-outfit";

export const loadProgress = (quests: WalkQuest[]): Progress => {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") as Progress | null;
    if (!p) return EMPTY_PROGRESS;
    const ids = new Set(quests.map((q) => q.id));
    return {
      active: Object.fromEntries(Object.entries(p.active ?? {}).filter(([k, v]) => ids.has(k) && typeof v === "number")),
      done: (p.done ?? []).filter((d) => ids.has(d)),
      tracked: p.tracked && ids.has(p.tracked) ? p.tracked : null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
};
export const saveProgress = (p: Progress) => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: progress lasts for this visit only.
  }
};
export const loadOutfit = (): Outfit => {
  try {
    const o = JSON.parse(localStorage.getItem(OUTFIT_KEY) || "null") as Partial<Outfit> | null;
    if (!o) return DEFAULT_OUTFIT;
    const out = { ...DEFAULT_OUTFIT };
    for (const k of Object.keys(OUTFIT_SIZES) as (keyof Outfit)[]) {
      const v = o[k];
      if (typeof v === "number" && v >= 0 && v < OUTFIT_SIZES[k]) out[k] = v;
    }
    return out;
  } catch {
    return DEFAULT_OUTFIT;
  }
};
export const saveOutfit = (o: Outfit) => {
  try {
    localStorage.setItem(OUTFIT_KEY, JSON.stringify(o));
  } catch {
    // ignore
  }
};

/** What the player is carrying: the item handed over at the step before the current one, per active quest. */
export const carrying = (script: WalkScript, p: Progress) =>
  script.quests.flatMap((q) => {
    const s = p.active[q.id];
    const prev = s !== undefined && s > 0 ? q.steps[s - 1] : undefined;
    return prev?.item ? [prev.item] : [];
  });

/** Where the current step happens: a person's id or a place's id. */
export const stepTarget = (q: WalkQuest, step: number): { person: string } | { place: string } | null => {
  const s = q.steps[step];
  return s ? (s.talk ? { person: s.talk } : s.pick ? { place: s.pick } : null) : null;
};

export const EMOTES: [string, string][] = [
  ["wave", "👋"],
  ["thumbs", "👍"],
  ["laugh", "😂"],
  ["heart", "❤️"],
  ["vanakkam", "🙏"],
  ["cheer", "🙌"],
  ["party", "🎉"],
  ["question", "❓"],
  ["wow", "😮"],
  ["leaf", "🌱"],
];
