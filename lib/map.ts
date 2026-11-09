import citiesData from "@/content/map/cities.json";
import projection from "@/content/map/projection.json";
import { getContent, isTodo, type Campus } from "./content";
import { project, withOrigin } from "./geo";


/**
 * Campus map data for the client (server-side; keeps content JSON out of the bundle).
 * Positions are fractions (0..1) of the map art in public/map/india.svg, from the same projection
 * scripts/build-map.mts used to draw it.
 */
export const mapAspect = projection.width / projection.height;

/** Google Maps directions to the campus gate; from `origin` when the visitor has told us where they are. */
export const directionsUrl = (c: Campus, origin: { lat: number; lng: number } | null = null) =>
  withOrigin(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.directionsQuery)}`, origin);

/** Pre-rendered street map image (scripts/build-street-maps.mts) + link to the interactive OpenStreetMap. */
export function streetMap(c: Campus) {
  return {
    image: `/map/street/${c.slug}.jpg`,
    link: `https://www.openstreetmap.org/?${c.coordsApprox ? "" : `mlat=${c.lat}&mlon=${c.lng}`}#map=${c.coordsApprox ? 13 : 16}/${c.lat}/${c.lng}`,
  };
}

/**
 * Campuses closer together than a tap target is wide even when zoomed into their region (Ramapuram and
 * Vadapalani are 3.5 km apart). They share one marker at their true midpoint until one is chosen; pins are
 * never displaced from their real coordinates.
 */
const NEAR_GROUPS = [{ id: "chennai-city", members: ["ramapuram", "vadapalani"], parent: "chennai" }] as const;
// Which side a pin's label sits on (default right), so labels don't collide — checked down to a 360 px map,
// where Delhi's and Sikkim's labels met head-on when both sat beside their pins.
export type LabelSide = "left" | "right" | "above" | "below";
const LABEL_SIDE: Record<string, LabelSide> = { tiruchirappalli: "below", ramapuram: "left", "srm-sikkim": "below", delhi: "above" };

export type MapCampus = {
  slug: Campus["slug"];
  name: string;
  city: string;
  state: string;
  kind: Campus["kind"];
  isMain: boolean;
  lat: number;
  lng: number;
  x: number;
  y: number;
  labelSide: LabelSide;
  cluster: Campus["cluster"] | null;
  address: string | null;
  coordsApprox: boolean;
  website: string;
  directions: string;
  street: { image: string; link: string };
  tour: string | null;
};
export type MapCluster = { id: "chennai" | "delhi"; members: Campus["slug"][]; zoom: number; x: number; y: number; labelSide: LabelSide };
export type MapGroup = { id: "chennai-city"; members: Campus["slug"][]; parent: MapCluster["id"]; x: number; y: number };

export function getMapData(locale = "en"): { campuses: MapCampus[]; clusters: MapCluster[]; groups: MapGroup[] } {
  const { campuses, campusClusters } = getContent(locale);
  const list: MapCampus[] = campuses.map((c) => ({
    slug: c.slug,
    name: c.name,
    city: c.city,
    state: c.state,
    kind: c.kind,
    isMain: c.isMain,
    lat: c.lat,
    lng: c.lng,
    ...project(c.lat, c.lng),
    labelSide: LABEL_SIDE[c.slug] ?? "right",
    cluster: c.cluster ?? null,
    address: isTodo(c.address) ? null : c.address,
    coordsApprox: !!c.coordsApprox,
    website: c.website,
    directions: directionsUrl(c),
    street: streetMap(c),
    tour: c.tour360Url,
  }));
  const clusters = campusClusters.map((cl) => {
    const members = list.filter((c) => cl.members.includes(c.slug));
    const x = members.reduce((s, m) => s + m.x, 0) / members.length;
    const y = members.reduce((s, m) => s + m.y, 0) / members.length;
    return { id: cl.id, members: cl.members, zoom: cl.zoom, x, y, labelSide: LABEL_SIDE[cl.id] ?? "right" };
  });
  const groups = NEAR_GROUPS.map((g) => {
    const members = list.filter((c) => (g.members as readonly string[]).includes(c.slug));
    return {
      id: g.id,
      members: members.map((m) => m.slug),
      parent: g.parent,
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
    };
  });
  return { campuses: list, clusters, groups };
}

/** A city to measure from: name and state in the page's language, plus its map position. */
export type MapCity = { slug: string; name: string; lat: number; lng: number; x: number; y: number };
export type MapState = { slug: string; name: string; cities: MapCity[] };

/** Cities grouped by state for the "Where are you coming from?" picker, trimmed to one language. */
export function getCities(locale: string): MapState[] {
  const pick = (o: { name: string; nameTa: string; nameHi: string }) => (locale === "ta" ? o.nameTa : locale === "hi" ? o.nameHi : o.name);
  return citiesData.states.map((s) => ({
    slug: s.slug,
    name: pick(s),
    cities: citiesData.cities
      .filter((c) => c.state === s.slug)
      .map((c) => ({ slug: c.slug, name: pick(c), lat: c.lat, lng: c.lng, ...project(c.lat, c.lng) })),
  }));
}
