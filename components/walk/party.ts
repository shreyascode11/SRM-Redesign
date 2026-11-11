"use client";

import { WALK_RELAYS } from "@/lib/walk/relays";
import type { Outfit } from "@/lib/walk/script";
import { type Anim, newAnim, OUTFIT_SIZES } from "./Character";

/**
 * Multiplayer for Walk SRM: friends in a room see each other walk, emote, chat (text and voice) and share quest
 * steps. Browsers connect straight to each other over WebRTC (Trystero); public Nostr relays only help them find
 * each other, so there's no account and no game server. The library loads only when you join a room.
 *
 * Everything from a peer is untrusted: names and chat are trimmed and kept as plain text, numbers are checked,
 * outfits are clamped to real choices, and quest steps are only applied if they match your own game.
 */

export type Pose = { x: number; z: number; h: number; y: number; sp: number; d: 0 | 1 };
export type Friend = {
  id: string;
  name: string;
  outfit: Outfit;
  /** Where the friend last said they are, and where we're drawing them (eased toward it). */
  pose: Pose;
  draw: { x: number; z: number; h: number };
  seen: number;
  anim: { current: Anim };
  /** An emote or chat line floating over their head until `until` (ms). */
  bubble: { text: string; until: number } | null;
  /** Their voice, when they've turned the mic on. */
  voice: { el: HTMLAudioElement; gain: GainNode | null } | null;
};
export type ChatLine = { n: number; name: string; text: string; self: boolean; at: number };
export type PartyEvents = {
  onJoin?: (name: string) => void;
  onLeave?: (name: string) => void;
  onQuest?: (quest: string, step: number, name: string) => void;
  onEmote?: (glyph: string, id: string, name: string) => void;
};

const APP_ID = "level-up-at-srm-walk";

const MAX_FRIENDS = 8;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const num = (v: unknown, lim = 5000) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < lim ? v : 0);
const cleanOutfit = (v: unknown): Outfit => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(
    (Object.keys(OUTFIT_SIZES) as (keyof Outfit)[]).map((k) => {
      const n = Math.floor(num(o[k], 100));
      return [k, Math.max(0, Math.min(OUTFIT_SIZES[k] - 1, n))];
    }),
  ) as Outfit;
};

/** A short room code people can read out: no 0/o or 1/l. */
export const newRoomCode = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(r, (b) => a[b % a.length]).join("");
};
export const cleanRoomCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);

type Send<T> = (data: T) => void;

export class Party {
  readonly code: string;
  readonly friends = new Map<string, Friend>();
  chat: ChatLine[] = [];
  mic: MediaStream | null = null;
  private version = 0;
  private listeners = new Set<() => void>();
  private n = 0;
  private room: Awaited<ReturnType<typeof import("trystero").joinRoom>> | null = null;
  private audio: AudioContext | null = null;
  private send: {
    pose: Send<Pose>;
    hi: Send<{ name: string; outfit: Outfit }>;
    emote: Send<{ g: string; id: string }>;
    chat: Send<{ t: string }>;
    quest: Send<{ q: string; s: number }>;
  } | null = null;

  constructor(
    code: string,
    public me: { name: string; outfit: Outfit },
    private events: PartyEvents,
    private quests: Set<string>,
  ) {
    this.code = code;
  }

  async connect() {
    const { joinRoom } = await import("trystero");
    // The room code doubles as the password, so the relays only ever see encrypted connection offers.
    const room = joinRoom({ appId: APP_ID, password: `srm-${this.code}`, relayConfig: { urls: WALK_RELAYS } }, this.code);
    this.room = room;
    const pose = room.makeAction<Pose>("pose");
    const hi = room.makeAction<{ name: string; outfit: Outfit }>("hi");
    const emote = room.makeAction<{ g: string; id: string }>("emote");
    const chat = room.makeAction<{ t: string }>("chat");
    const quest = room.makeAction<{ q: string; s: number }>("quest");
    this.send = {
      pose: (d) => void pose.send(d).catch(() => {}),
      hi: (d) => void hi.send(d).catch(() => {}),
      emote: (d) => void emote.send(d).catch(() => {}),
      chat: (d) => void chat.send(d).catch(() => {}),
      quest: (d) => void quest.send(d).catch(() => {}),
    };

    room.onPeerJoin = (id) => {
      if (this.friends.size >= MAX_FRIENDS) return;
      void hi.send(this.me, { target: id }).catch(() => {});
      if (this.mic) void Promise.all(room.addStream(this.mic, { target: id })).catch(() => {});
    };
    room.onPeerLeave = (id) => {
      const f = this.friends.get(id);
      if (!f) return;
      f.voice?.el.remove();
      this.friends.delete(id);
      this.events.onLeave?.(f.name);
      this.bump();
    };
    hi.onMessage = (d, { peerId }) => {
      const name = str(d?.name, 20) || "Friend";
      const outfit = cleanOutfit(d?.outfit);
      const f = this.friends.get(peerId);
      if (f) {
        f.name = name;
        f.outfit = outfit;
      } else {
        if (this.friends.size >= MAX_FRIENDS) return;
        this.friends.set(peerId, {
          id: peerId,
          name,
          outfit,
          pose: { x: 0, z: 0, h: 0, y: 0, sp: 0, d: 0 },
          draw: { x: 0, z: 0, h: 0 },
          seen: 0,
          anim: { current: newAnim() },
          bubble: null,
          voice: null,
        });
        this.events.onJoin?.(name);
        // Say hello back, so both sides know each other's name and outfit.
        void hi.send(this.me, { target: peerId }).catch(() => {});
      }
      this.bump();
    };
    pose.onMessage = (d, { peerId }) => {
      const f = this.friends.get(peerId);
      if (!f || !d || typeof d !== "object") return;
      const p: Pose = { x: num(d.x), z: num(d.z), h: num(d.h, 100), y: Math.max(0, num(d.y, 20)), sp: Math.max(0, num(d.sp, 30)), d: d.d ? 1 : 0 };
      if (!f.seen) f.draw = { x: p.x, z: p.z, h: p.h };
      f.pose = p;
      f.seen = performance.now();
    };
    emote.onMessage = (d, { peerId }) => {
      const f = this.friends.get(peerId);
      if (!f) return;
      const glyph = str(d?.g, 8);
      const id = str(d?.id, 16);
      if (!glyph) return;
      f.bubble = { text: glyph, until: performance.now() + 2500 };
      if (id === "wave" || id === "vanakkam") f.anim.current.wave = 1.4;
      if (id === "cheer" || id === "party") f.anim.current.cheer = 1.2;
      this.events.onEmote?.(glyph, id, f.name);
    };
    chat.onMessage = (d, { peerId }) => {
      const f = this.friends.get(peerId);
      const text = str(d?.t, 140);
      if (!f || !text) return;
      f.bubble = { text, until: performance.now() + 6000 };
      f.anim.current.talk = 1.5;
      this.addChat(f.name, text, false);
    };
    quest.onMessage = (d, { peerId }) => {
      const f = this.friends.get(peerId);
      const q = str(d?.q, 40);
      const s = Math.floor(num(d?.s, 50));
      if (!f || !this.quests.has(q) || s < 0) return;
      this.events.onQuest?.(q, s, f.name);
    };
    room.onPeerStream = (stream, peerId) => this.hear(stream, peerId);
    void hi.send(this.me).catch(() => {});
  }

  // ── Sending ──
  pose(p: Pose) {
    this.send?.pose(p);
  }
  profile(me: { name: string; outfit: Outfit }) {
    this.me = me;
    this.send?.hi(me);
  }
  emote(glyph: string, id: string) {
    this.send?.emote({ g: glyph, id });
  }
  say(text: string) {
    const t = str(text, 140);
    if (!t) return;
    this.send?.chat({ t });
    this.addChat(this.me.name, t, true);
  }
  quest(q: string, s: number) {
    this.send?.quest({ q, s });
  }

  // ── Voice: your mic to everyone in the room; their voices louder the closer they stand ──
  async micOn() {
    if (this.mic || !this.room) return;
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    await Promise.all(this.room.addStream(this.mic)).catch(() => {});
    this.bump();
  }
  micOff() {
    if (!this.mic) return;
    this.room?.removeStream(this.mic);
    this.mic.getTracks().forEach((t) => t.stop());
    this.mic = null;
    this.bump();
  }
  private hear(stream: MediaStream, peerId: string) {
    const f = this.friends.get(peerId);
    if (!f) return;
    f.voice?.el.remove();
    // Chrome only plays a WebRTC stream through Web Audio while an element holds it too (muted here); the gain node
    // then sets the volume by distance, which also works on iPhones (where element volume can't be changed).
    const el = new Audio();
    el.srcObject = stream;
    el.muted = true;
    void el.play().catch(() => {});
    let gain: GainNode | null = null;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      gain = this.audio.createGain();
      this.audio.createMediaStreamSource(stream).connect(gain).connect(this.audio.destination);
    } catch {
      el.muted = false;
    }
    f.voice = { el, gain };
    this.bump();
  }
  /** Full volume within 6 m, silent beyond 45 m. */
  setVolumes(x: number, z: number) {
    for (const f of this.friends.values()) {
      if (!f.voice) continue;
      const d = Math.hypot(f.draw.x - x, f.draw.z - z);
      const v = Math.max(0, Math.min(1, 1 - (d - 6) / 39));
      if (f.voice.gain) f.voice.gain.gain.value = v;
      else f.voice.el.volume = v;
    }
  }

  // ── Store for React (useSyncExternalStore) ──
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  snapshot = () => this.version;
  private bump() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private addChat(name: string, text: string, self: boolean) {
    this.chat = [...this.chat.slice(-49), { n: ++this.n, name, text, self, at: Date.now() }];
    this.bump();
  }

  async leave() {
    this.micOff();
    for (const f of this.friends.values()) f.voice?.el.remove();
    this.friends.clear();
    await this.room?.leave().catch(() => {});
    void this.audio?.close().catch(() => {});
    this.room = null;
    this.bump();
  }
}
