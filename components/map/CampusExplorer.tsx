"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { haversineKm, project, roundKm, withOrigin } from "@/lib/geo";
import { Link } from "@/lib/i18n";
import type { LabelSide, MapCampus, MapCluster, MapGroup, MapState } from "@/lib/map";
import { StreetMap } from "./StreetMap";

type View =
  | { kind: "all" }
  | { kind: "cluster"; id: MapCluster["id"] }
  | { kind: "group"; id: MapGroup["id"] }
  | { kind: "campus"; slug: MapCampus["slug"] }
  | { kind: "home" };

/** Where the visitor is coming from: a city from the list, or their own location (kept on this device only). */
type Home = { key: string; name: string; lat: number; lng: number; x: number; y: number };
const HOME_KEY = "srm-home";
const onMap = (h: { x: number; y: number }) => h.x >= 0 && h.x <= 1 && h.y >= 0 && h.y <= 1;

/**
 * Campus constellation. Stylised India (static SVG image) with pins as real links:
 * without JS every pin and list item goes to its campus page; with JS they "fly" the camera there and open the
 * detail panel (address, directions, static street map, 360° tour in a modal).
 * The camera is one CSS transform (translate + scale) on the map stage; pins counter-scale to stay crisp.
 */
export function CampusExplorer({
  campuses,
  clusters,
  groups,
  states,
  aspect,
  mapSrc,
}: {
  campuses: MapCampus[];
  clusters: MapCluster[];
  groups: MapGroup[];
  states: MapState[];
  aspect: number;
  mapSrc: string;
}) {
  const t = useTranslations("Acts.explore");
  const [view, setView] = useState<View>({ kind: "all" });
  const [announce, setAnnounce] = useState("");
  const tourRef = useRef<HTMLDialogElement>(null);
  const [tourOpen, setTourOpen] = useState(false);
  // Narrow maps (phones) zoom further into a region so 44px pin targets never overlap (WCAG 2.2 target size).
  const mapRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [mapHeight, setMapHeight] = useState(600);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCompact((entry?.contentRect.width ?? 999) < 600);
      setMapHeight(entry?.contentRect.height || 600);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── "How far is SRM from home?" ──
  const [home, setHome] = useState<Home | null>(null);
  const [locating, setLocating] = useState(false);
  const [homeNote, setHomeNote] = useState("");
  const cityHome = (slug: string): Home | null => {
    const city = states.flatMap((s) => s.cities).find((c) => c.slug === slug);
    return city ? { key: city.slug, name: city.name, lat: city.lat, lng: city.lng, x: city.x, y: city.y } : null;
  };
  const geoHome = (lat: number, lng: number): Home => ({ key: "geo", name: t("yourLocation"), lat, lng, ...project(lat, lng) });

  // The last choice comes back on the next visit, without moving the camera.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HOME_KEY) ?? "null") as { key: string; lat?: number; lng?: number } | null;
      if (!saved) return;
      setHome(saved.key === "geo" && saved.lat !== undefined && saved.lng !== undefined ? geoHome(saved.lat, saved.lng) : cityHome(saved.key));
    } catch {
      // Storage blocked or unreadable: start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const distances = home ? new Map(campuses.map((c) => [c.slug, roundKm(haversineKm(home, c))])) : null;
  const nearest = distances ? campuses.reduce((a, b) => (distances.get(b.slug)! < distances.get(a.slug)! ? b : a)) : null;

  const chooseHome = (next: Home | null) => {
    setHome(next);
    setHomeNote("");
    try {
      if (!next) localStorage.removeItem(HOME_KEY);
      // Your own location is stored rounded to about a kilometre, and only on this device.
      else localStorage.setItem(HOME_KEY, JSON.stringify(next.key === "geo" ? { key: "geo", lat: +next.lat.toFixed(2), lng: +next.lng.toFixed(2) } : { key: next.key }));
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
    if (!next) {
      setView({ kind: "all" });
      setAnnounce(t("homeCleared"));
      return;
    }
    const near = campuses.reduce((a, b) => (haversineKm(next, b) < haversineKm(next, a) ? b : a));
    setView({ kind: "home" });
    setAnnounce(t("nearestAnnounce", { name: near.name, km: roundKm(haversineKm(next, near)) }));
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setHomeNote(t("locationUnavailable"));
    setLocating(true);
    setHomeNote("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        chooseHome(geoHome(pos.coords.latitude, pos.coords.longitude));
      },
      (err) => {
        setLocating(false);
        const note = err.code === err.PERMISSION_DENIED ? t("locationDenied") : t("locationUnavailable");
        setHomeNote(note);
        setAnnounce(note);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const bySlug = (slug: string) => campuses.find((c) => c.slug === slug)!;
  const clusterName = (id: MapCluster["id"] | MapGroup["id"]) =>
    id === "chennai" ? t("clusterChennai") : id === "delhi" ? t("clusterDelhi") : t("clusterChennaiCity");
  const selected = view.kind === "campus" ? bySlug(view.slug) : null;
  const groupOf = (slug: MapCampus["slug"]) => groups.find((g) => g.members.includes(slug));

  // Camera target: point (fraction of map) to centre + zoom.
  const camera = (() => {
    const boost = compact ? 1.5 : 1;
    if (view.kind === "cluster") {
      const cl = clusters.find((c) => c.id === view.id)!;
      return { x: cl.x, y: cl.y, z: cl.zoom * boost };
    }
    if (view.kind === "group") {
      const g = groups.find((gr) => gr.id === view.id)!;
      const parent = clusters.find((c) => c.id === g.parent)!;
      return { x: g.x, y: g.y, z: parent.zoom * boost };
    }
    if (selected) {
      const cl = selected.cluster ? clusters.find((c) => c.id === selected.cluster) : null;
      return { x: selected.x, y: selected.y, z: (cl ? cl.zoom : 7) * boost };
    }
    if (view.kind === "home" && home && nearest) {
      // Frame home and the nearest campus together; from abroad, just the nearest campus.
      if (!onMap(home)) return { x: nearest.x, y: nearest.y, z: 4 };
      const span = Math.max(Math.abs(home.x - nearest.x), Math.abs(home.y - nearest.y), 0.04);
      return { x: (home.x + nearest.x) / 2, y: (home.y + nearest.y) / 2, z: Math.min(7, Math.max(1, 0.55 / span)) };
    }
    return { x: 0.5, y: 0.5, z: 1 };
  })();
  const zoomed = view.kind !== "all";

  const select = (next: View, label: string) => (e?: React.MouseEvent) => {
    e?.preventDefault();
    setView(next);
    setAnnounce(t("selected", { name: label }));
  };

  useEffect(() => {
    const dialog = tourRef.current;
    if (!dialog) return;
    if (tourOpen && !dialog.open) dialog.showModal();
    if (!tourOpen && dialog.open) dialog.close();
  }, [tourOpen]);

  // Overview markers: one per cluster + every campus not in a cluster.
  const overviewMarkers = [
    ...clusters.map((cl) => ({
      key: cl.id,
      x: cl.x,
      y: cl.y,
      label: `${clusterName(cl.id)} · ${t("campusesCount", { count: cl.members.length })}`,
      href: `/campuses/${cl.members[0]}`,
      onClick: select({ kind: "cluster", id: cl.id }, clusterName(cl.id)),
      count: cl.members.length,
      side: cl.labelSide,
    })),
    ...campuses
      .filter((c) => !c.cluster)
      .map((c) => ({
        key: c.slug,
        x: c.x,
        y: c.y,
        label: c.name,
        href: `/campuses/${c.slug}`,
        onClick: select({ kind: "campus", slug: c.slug }, c.name),
        count: 0,
        side: c.labelSide,
      })),
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
      {/* ── Map ── */}
      <div
        ref={mapRef}
        role="group"
        aria-label={t("mapLabel")}
        data-zoomed={zoomed ? "" : undefined}
        className="campus-map relative overflow-hidden rounded-3xl border border-line-subtle bg-[#0a1640] lg:col-span-7"
        // --map-h: the arcs' SVG is 1 unit tall, so a stroke in screen pixels is px ÷ (height × zoom).
        style={{ aspectRatio: aspect, "--map-h": mapHeight } as React.CSSProperties}
      >
        <div className="campus-tilt absolute inset-0">
        <div
          className="campus-stage absolute inset-0 origin-top-left"
          style={
            {
              "--z": camera.z,
              transform: `translate(${(0.5 - camera.z * camera.x) * 100}%, ${(0.5 - camera.z * camera.y) * 100}%) scale(${camera.z})`,
            } as React.CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art; next/image adds nothing for SVG */}
          <img src={mapSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" className="campus-plane relative size-full select-none" draggable={false} />

          {home && onMap(home) ? (
            <>
              {/* Arcs from home to every campus: decoration only, the list beside the map carries the distances. */}
              <svg key={home.key + home.lat} aria-hidden="true" viewBox={`0 0 ${aspect} 1`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
                {campuses.map((c, i) => {
                  const [hx, hy, tx, ty] = [home.x * aspect, home.y, c.x * aspect, c.y];
                  const len = Math.hypot(tx - hx, ty - hy) || 1;
                  // Bow each arc upward, perpendicular to the straight line.
                  let [px, py] = [-(ty - hy) / len, (tx - hx) / len];
                  if (py > 0) [px, py] = [-px, -py];
                  const bend = len * 0.22;
                  const isNearest = c.slug === nearest?.slug;
                  return (
                    <path
                      key={c.slug}
                      d={`M${hx},${hy} Q${(hx + tx) / 2 + px * bend},${(hy + ty) / 2 + py * bend} ${tx},${ty}`}
                      pathLength={1}
                      className={`home-arc ${isNearest ? "is-nearest" : ""}`}
                      style={{ "--i": isNearest ? 0 : i + 1 } as React.CSSProperties}
                    />
                  );
                })}
              </svg>
              <span aria-hidden="true" className="campus-pin home-pin pointer-events-none absolute flex min-h-10 min-w-10 items-center justify-center" style={{ left: `${home.x * 100}%`, top: `${home.y * 100}%` }}>
                <span className="relative size-4 rounded-full border-[3px] border-paper bg-bg" />
                <span className="absolute bottom-full left-1/2 -mb-1 w-max -translate-x-1/2 rounded-md bg-paper px-2 py-0.5 text-xs leading-tight font-semibold text-ink">{home.name}</span>
              </span>
            </>
          ) : null}

          {(zoomed ? [] : overviewMarkers).map((m) => (
            <Pin key={m.key} x={m.x} y={m.y} label={m.label} href={m.href} onClick={m.onClick} count={m.count} side={m.side} cursorLabel={t("exploreCursor")} />
          ))}
          {zoomed
            ? campuses
                // Only pins inside the visible window: off-screen pins would still take (invisible) keyboard focus.
                .filter((c) => Math.abs((c.x - camera.x) * camera.z) < 0.5 && Math.abs((c.y - camera.y) * camera.z) < 0.5)
                // Grouped campuses show as one marker unless one of them is the selected campus.
                .filter((c) => !groupOf(c.slug) || selected?.slug === c.slug)
                .map((c) => (
                  <Pin
                    key={c.slug}
                    x={c.x}
                    y={c.y}
                    label={c.name}
                    href={`/campuses/${c.slug}`}
                    onClick={select({ kind: "campus", slug: c.slug }, c.name)}
                    active={selected?.slug === c.slug}
                    sister={c.kind === "sister"}
                    side={c.labelSide}
                    cursorLabel={t("exploreCursor")}
                  />
                ))
            : null}
          {zoomed
            ? groups
                .filter((g) => !(selected && g.members.includes(selected.slug)))
                .filter((g) => Math.abs((g.x - camera.x) * camera.z) < 0.5 && Math.abs((g.y - camera.y) * camera.z) < 0.5)
                .map((g) => (
                  <Pin
                    key={g.id}
                    x={g.x}
                    y={g.y}
                    label={`${clusterName(g.id)} · ${t("campusesCount", { count: g.members.length })}`}
                    href={`/campuses/${g.members[0]}`}
                    onClick={select({ kind: "group", id: g.id }, clusterName(g.id))}
                    count={g.members.length}
                    active={view.kind === "group" && view.id === g.id}
                    cursorLabel={t("exploreCursor")}
                  />
                ))
            : null}
        </div>
        </div>
        {zoomed ? (
          <button
            type="button"
            onClick={() => select({ kind: "all" }, t("back"))()}
            className="absolute top-3 left-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-bg/90 px-4 text-sm font-semibold"
          >
            <span aria-hidden="true">←</span> {t("back")}
          </button>
        ) : null}
      </div>

      {/* ── Panel ── */}
      <div className="lg:col-span-5">
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>

        <HomeFinder
          states={states}
          home={home}
          locating={locating}
          note={homeNote}
          onCity={(slug) => chooseHome(slug ? cityHome(slug) : null)}
          onLocate={locate}
          onClear={() => chooseHome(null)}
        />

        {selected ? (
          <CampusDetail campus={selected} origin={home} km={distances?.get(selected.slug) ?? null} onTour={() => setTourOpen(true)} />
        ) : view.kind === "cluster" || view.kind === "group" ? (
          <div className="flex flex-col gap-4">
            <h3 className="font-display text-3xl font-bold">{clusterName(view.id)}</h3>
            <CampusList
              items={(view.kind === "cluster" ? clusters.find((c) => c.id === view.id)! : groups.find((g) => g.id === view.id)!).members.map(bySlug)}
              onSelect={(c) => select({ kind: "campus", slug: c.slug }, c.name)}
              distances={distances}
              nearest={nearest?.slug}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h3 className="font-display text-3xl font-bold">{t("findCampus")}</h3>
            <div>
              <h4 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{t("ourCampuses")}</h4>
              <CampusList
                items={campuses.filter((c) => c.kind === "campus")}
                onSelect={(c) => select({ kind: "campus", slug: c.slug }, c.name)}
                distances={distances}
                nearest={nearest?.slug}
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{t("sisters")}</h4>
              <CampusList
                items={campuses.filter((c) => c.kind === "sister")}
                onSelect={(c) => select({ kind: "campus", slug: c.slug }, c.name)}
                distances={distances}
                nearest={nearest?.slug}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 360° tour, in the page (Sydney "Here" / Ravensbourne) ── */}
      {selected?.tour ? (
        <dialog
          ref={tourRef}
          data-lenis-prevent
          aria-label={t("tourTitle", { name: selected.name })}
          onClose={() => setTourOpen(false)}
          className="m-auto h-[90dvh] max-h-none w-[min(96vw,80rem)] max-w-none overflow-hidden rounded-3xl border border-line bg-bg p-0 text-fg backdrop:bg-ink/80"
        >
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
              <h3 className="font-display text-xl font-bold">{t("tourTitle", { name: selected.name })}</h3>
              <div className="flex items-center gap-3">
                <a href={selected.tour} target="_blank" rel="noopener" className="text-sm">
                  {t("newTab")}
                </a>
                <button
                  type="button"
                  onClick={() => setTourOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold"
                >
                  {t("closeTour")}
                </button>
              </div>
            </div>
            {tourOpen ? (
              <iframe src={selected.tour} title={t("tourTitle", { name: selected.name })} allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" allowFullScreen className="w-full flex-1 border-0" />
            ) : null}
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

function CampusDetail({
  campus,
  origin,
  km,
  onTour,
}: {
  campus: MapCampus;
  origin: Home | null;
  km: number | null;
  onTour: () => void;
}) {
  const t = useTranslations("Acts.explore");
  return (
    <article aria-labelledby={`campus-${campus.slug}`} className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
          {campus.kind === "sister" ? t("sisterBadge") : campus.isMain ? t("main") : `${campus.city}, ${campus.state}`}
        </p>
        <h3 id={`campus-${campus.slug}`} className="mt-1 font-display text-3xl font-bold">
          {campus.name}
        </h3>
        <p className="mt-2 text-fg-muted">
          {campus.address ? <span lang="en">{campus.address}</span> : `${campus.city}, ${campus.state}`}
        </p>
        {km !== null && origin ? (
          <p className="mt-2 font-semibold">
            {t("kmFrom", { km, place: origin.name })} <span className="font-normal text-fg-muted">({t("crowFlies")})</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {campus.tour ? (
          <button
            type="button"
            onClick={onTour}
            data-magnetic
            className="relative inline-flex min-h-12 items-center overflow-hidden rounded-full bg-action px-6 font-semibold text-on-action"
          >
            {t("tour")}
          </button>
        ) : null}
        <a href={withOrigin(campus.directions, origin)} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold text-fg no-underline hover:border-fg">
          {t("directions")}
        </a>
        {campus.kind === "sister" ? (
          <a href={campus.website} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold text-fg no-underline hover:border-fg">
            {t("website")}
          </a>
        ) : (
          <Link href={`/campuses/${campus.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold text-fg no-underline hover:border-fg">
            {t("campusPage")}
          </Link>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">{t("streetMap")}</h4>
        <StreetMap
          image={campus.street.image}
          link={campus.street.link}
          alt={`${t("streetMap")}: ${campus.name}`}
          linkLabel={t("openMap")}
          approx={campus.coordsApprox}
        />
        {campus.coordsApprox ? <p className="mt-2 text-sm text-fg-muted">{t("approx")}</p> : null}
      </div>
    </article>
  );
}

function CampusList({
  items,
  onSelect,
  distances,
  nearest,
}: {
  items: MapCampus[];
  onSelect: (c: MapCampus) => (e?: React.MouseEvent) => void;
  distances?: Map<string, number> | null;
  nearest?: string;
}) {
  const t = useTranslations("Acts.explore");
  // Nearest first once we know where the visitor is coming from.
  const rows = distances ? [...items].sort((a, b) => distances.get(a.slug)! - distances.get(b.slug)!) : items;
  return (
    <ul className="grid border-t border-line-subtle sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1">
      {rows.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/campuses/${c.slug}`}
            onClick={onSelect(c)}
            data-no-transition
            className="group flex min-h-11 flex-col justify-between gap-x-4 border-b border-line-subtle py-2.5 text-fg no-underline hover:border-line sm:flex-row sm:flex-wrap sm:items-baseline"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold underline-offset-4 group-hover:underline">{c.name}</span>
              {c.slug === nearest ? <span className="rounded-full bg-tree px-2 py-0.5 text-xs font-semibold text-ink">{t("nearest")}</span> : null}
            </span>
            <span className="text-sm text-fg-muted">
              {distances ? `${t("kmAway", { km: distances.get(c.slug)! })} · ` : ""}
              {c.city}, {c.state}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const LABEL_PLACEMENT: Record<LabelSide, string> = {
  left: "top-1/2 right-full mr-0.5 -translate-y-1/2",
  right: "top-1/2 left-full ml-0.5 -translate-y-1/2",
  above: "bottom-full left-1/2 -mb-1 -translate-x-1/2 text-center",
  below: "top-full left-1/2 -mt-1 -translate-x-1/2 text-center",
};

function Pin({
  x,
  y,
  label,
  href,
  onClick,
  count = 0,
  active = false,
  sister = false,
  side = "right",
  cursorLabel,
}: {
  x: number;
  y: number;
  label: string;
  href: string;
  onClick: (e?: React.MouseEvent) => void;
  count?: number;
  active?: boolean;
  sister?: boolean;
  side?: LabelSide;
  cursorLabel: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      data-no-transition
      aria-current={active ? "true" : undefined}
      data-cursor-label={cursorLabel}
      // True positions can sit closer than a 44 px box (Chennai and Trichy are 26 px apart on a 360 px map).
      // On phones the box is 40 px so no box covers a neighbour's dot centre; the label is part of the target,
      // so box + label still exceeds 44 px. Cluster pins stack above plain ones.
      className={`campus-pin group absolute flex min-h-10 min-w-10 items-center justify-center text-fg no-underline focus-visible:z-20 sm:min-h-11 sm:min-w-11 ${count ? "z-10" : ""}`}
      style={
        {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
        } as React.CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className={`campus-pin-dot relative grid place-items-center rounded-full border-2 font-display text-xs font-bold ${
          count && active ? "size-6 border-bg bg-action text-ink sm:size-8" : count ? "size-6 border-bg bg-tree text-ink sm:size-8" : active ? "size-5 border-bg bg-action" : sister ? "size-4 border-tree bg-bg" : "size-4 border-bg bg-tree"
        }`}
      >
        {count || null}
      </span>
      {/* The visible label is the link's name (WCAG 2.5.3); the count dot is decoration. */}
      <span
        className={`absolute w-max max-w-32 rounded-md bg-bg/85 px-2 py-0.5 text-xs leading-tight font-semibold sm:max-w-none sm:whitespace-nowrap ${
          LABEL_PLACEMENT[side]
        } ${active ? "text-action" : ""}`}
      >
        {label}
      </span>
    </Link>
  );
}

/** "Where are you coming from?": a city picker, or the visitor's own location, asked for only when they press the button. */
function HomeFinder({
  states,
  home,
  locating,
  note,
  onCity,
  onLocate,
  onClear,
}: {
  states: MapState[];
  home: Home | null;
  locating: boolean;
  note: string;
  onCity: (slug: string) => void;
  onLocate: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("Acts.explore");
  return (
    // Hidden without JavaScript (it would do nothing); the map and list work as before.
    <div className="needs-js mb-8 flex flex-col gap-3 border-b border-line-subtle pb-6">
      <label htmlFor="home-city" className="font-display text-xl font-bold">
        {t("fromLabel")}
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="home-city"
          value={home && home.key !== "geo" ? home.key : ""}
          onChange={(e) => onCity(e.target.value)}
          className="min-h-11 min-w-0 flex-1 basis-56 rounded-xl border border-line bg-bg px-3 text-base text-fg"
        >
          <option value="">{t("chooseCity")}</option>
          {states.map((s) => (
            <optgroup key={s.slug} label={s.name}>
              {s.cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={onLocate} disabled={locating} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:border-fg disabled:opacity-70">
          {locating ? t("locating") : t("useLocation")}
        </button>
        {home ? (
          <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">
            {t("clear")}
          </button>
        ) : null}
      </div>
      <p className="min-h-5 text-sm text-fg-muted">{note || (home ? t("straightLine") : t("locationPrivacy"))}</p>
    </div>
  );
}
