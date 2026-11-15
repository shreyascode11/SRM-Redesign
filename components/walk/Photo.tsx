"use client";

import { useEffect, useRef, useState } from "react";
import { fmt } from "./Panels";

/**
 * Photo mode: the HUD goes away, you frame the shot (drag to turn, pinch or scroll to zoom), strike a pose, pick a
 * filter, and take a postcard: the picture in a white border with the place, the date and the game's link, ready to
 * share or save. Filters are done on the pixels (Safari has no canvas filters); the live view previews them in CSS.
 */

type Filter = "none" | "warm" | "vivid" | "mono" | "retro";
const CSS: Record<Filter, string> = {
  none: "",
  warm: "sepia(0.18) saturate(1.15) brightness(1.04)",
  vivid: "saturate(1.4) contrast(1.06)",
  mono: "grayscale(1) contrast(1.1)",
  retro: "sepia(0.45) saturate(0.85) contrast(0.95) brightness(1.05)",
};

function applyFilter(ctx: CanvasRenderingContext2D, w: number, h: number, f: Filter) {
  if (f === "none") return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!;
    let g = d[i + 1]!;
    let b = d[i + 2]!;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (f === "mono") r = g = b = Math.min(255, (l - 128) * 1.1 + 128);
    else if (f === "vivid") {
      r = l + (r - l) * 1.4;
      g = l + (g - l) * 1.4;
      b = l + (b - l) * 1.4;
    } else if (f === "warm") {
      r = r * 1.08 + 6;
      g = g * 1.02;
      b = b * 0.9;
    } else if (f === "retro") {
      const sr = l * 1.07 + 22;
      const sg = l * 0.95 + 12;
      const sb = l * 0.78;
      r = r * 0.45 + sr * 0.55;
      g = g * 0.45 + sg * 0.55;
      b = b * 0.45 + sb * 0.55;
    }
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(img, 0, 0);
  if (f === "retro") {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(40,20,0,0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}

/** The postcard: picture, white border, and a caption strip. */
async function postcard(src: HTMLCanvasElement, f: Filter, place: string, line2: string, brand: string, link: string) {
  const scale = Math.min(1, 1600 / src.width);
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const pad = Math.round(w * 0.035);
  const strip = Math.round(w * 0.12);
  const c = document.createElement("canvas");
  c.width = w + pad * 2;
  c.height = h + pad * 2 + strip;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fbf8f1";
  x.fillRect(0, 0, c.width, c.height);
  const photo = document.createElement("canvas");
  photo.width = w;
  photo.height = h;
  const px = photo.getContext("2d", { willReadFrequently: true })!;
  px.drawImage(src, 0, 0, w, h);
  applyFilter(px, w, h, f);
  x.drawImage(photo, pad, pad);
  x.strokeStyle = "rgba(0,0,0,0.12)";
  x.lineWidth = 2;
  x.strokeRect(pad, pad, w, h);
  const base = pad + h + strip * 0.5;
  x.fillStyle = "#14101a";
  x.textBaseline = "middle";
  x.font = `700 ${Math.round(strip * 0.3)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  x.fillText(place, pad, base - strip * 0.14, w * 0.62);
  x.fillStyle = "#5a5560";
  x.font = `500 ${Math.round(strip * 0.18)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  x.fillText(line2, pad, base + strip * 0.22, w * 0.62);
  x.textAlign = "right";
  x.fillStyle = "#c1121f";
  x.font = `800 ${Math.round(strip * 0.26)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  x.fillText(brand, pad + w, base - strip * 0.14);
  x.fillStyle = "#5a5560";
  x.font = `500 ${Math.round(strip * 0.15)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  x.fillText(link, pad + w, base + strip * 0.22);
  return new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
}

export function PhotoMode({
  canvas,
  ui,
  place,
  onPose,
  onClose,
}: {
  canvas: () => HTMLCanvasElement | null;
  ui: Record<string, string>;
  place: string;
  onPose: (pose: "wave" | "cheer" | "dance") => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("none");
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Preview the filter on the live view.
  useEffect(() => {
    const c = canvas();
    if (c) c.style.filter = CSS[filter];
    return () => {
      if (c) c.style.filter = "";
    };
  }, [filter, canvas]);
  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.url)), [shot]);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);

  const take = async () => {
    const c = canvas();
    if (!c || busy) return;
    setBusy(true);
    const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    const link = `${window.location.host}${window.location.pathname}`;
    const blob = await postcard(c, filter, place, fmt(ui.postcardLine!, { date }), "Walk SRM", link);
    setBusy(false);
    if (blob) setShot({ url: URL.createObjectURL(blob), blob });
  };
  const file = () => new File([shot!.blob], `walk-srm-${Date.now()}.jpg`, { type: "image/jpeg" });
  const share = async () => {
    if (!shot) return;
    const f = file();
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], text: `${place} · Walk SRM ${window.location.origin}${window.location.pathname}` });
        return;
      }
    } catch {
      return; // cancelled
    }
    save();
  };
  const save = () => {
    if (!shot) return;
    const a = document.createElement("a");
    a.href = shot.url;
    a.download = file().name;
    a.click();
    setMsg(ui.photoSaved!);
  };

  const chip = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold";
  return (
    <div
      role="dialog"
      aria-label={ui.photo}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (shot) setShot(null);
        else onClose();
      }}
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-end p-3 sm:p-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {shot ? (
        <div className="pointer-events-auto mx-auto flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl bg-[#14101a]/90 p-3 text-white shadow-2xl backdrop-blur-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob of the picture just taken */}
          <img src={shot.url} alt={fmt(ui.photoAlt!, { place })} className="max-h-[60svh] w-full rounded-xl object-contain" />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => void share()} className={`${chip} bg-[#ffd166] text-black`}>
              {ui.photoShare}
            </button>
            <button type="button" onClick={save} className={`${chip} border border-white/25`}>
              {ui.photoSave}
            </button>
            <button type="button" onClick={() => setShot(null)} className={`${chip} border border-white/25`}>
              {ui.photoAgain}
            </button>
            <span role="status" className="text-sm text-white/80">
              {msg}
            </span>
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl bg-[#14101a]/75 p-3 text-white shadow-2xl backdrop-blur-md">
          <p className="text-center text-xs text-white/75">{ui.photoTip}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(["none", "warm", "vivid", "mono", "retro"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`${chip} border border-white/20 aria-pressed:bg-white aria-pressed:text-black`}>
                {ui[`filter${f[0]!.toUpperCase()}${f.slice(1)}`]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-white/75">{ui.photoPose}</span>
            {(
              [
                ["wave", "👋"],
                ["cheer", "🙌"],
                ["dance", "💃"],
              ] as const
            ).map(([p, e]) => (
              <button key={p} type="button" onClick={() => onPose(p)} className={`${chip} min-w-11 justify-center border border-white/20 text-lg`} aria-label={ui[`pose${p[0]!.toUpperCase()}${p.slice(1)}`]}>
                {e}
              </button>
            ))}
            <button type="button" onClick={() => void take()} disabled={busy} className="inline-flex size-16 items-center justify-center rounded-full border-4 border-white bg-[#c1121f] text-2xl shadow-lg disabled:opacity-60" aria-label={ui.photoTake}>
              📸
            </button>
            <button ref={close} type="button" onClick={onClose} className={`${chip} border border-white/25`}>
              {ui.photoDone}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
