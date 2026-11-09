// node scripts/build-campus-walk.mjs <overpass.json> [more.json …]
//
// Builds public/walk/ktr-world.json for Walk SRM (app/[locale]/walk): the Kattankulathur campus as building footprints
// (metres around the campus centre) with heights and a kind, roads and footpaths, water, trees, and every place in
// content/walk.json positioned with a "door" (where its person stands). Footprints, roads and names are
// © OpenStreetMap contributors (ODbL). Heights come from OSM building:levels, our hostels.json floor counts, or a
// modest estimate; the page says heights are approximate.
//
// To refresh, run this Overpass query (overpass-turbo.eu or any mirror) and pass the JSON in (several files are merged):
//   [out:json][timeout:90];(way["building"](12.8155,80.0360,12.8275,80.0510);way["highway"](12.8155,80.0360,12.8275,80.0510);
//   way["natural"="water"](12.8155,80.0360,12.8275,80.0510);way["leisure"~"park|pitch|garden"](12.8155,80.0360,12.8275,80.0510);
//   node["name"](12.8155,80.0360,12.8275,80.0510););out geom tags center;
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("usage: node scripts/build-campus-walk.mjs <overpass.json> [more.json …]");
// The same OSM object in several files: keep any geometry, and take the tags from the file given last (the newest).
const byId = new Map();
for (const f of inputs)
  for (const e of JSON.parse(readFileSync(f, "utf8")).elements) {
    const k = `${e.type}/${e.id}`;
    const old = byId.get(k);
    byId.set(k, old ? { ...old, ...e, geometry: e.geometry ?? old.geometry, tags: { ...old.tags, ...e.tags } } : e);
  }
const elements = [...byId.values()];
const walk = JSON.parse(readFileSync(new URL("../content/walk.json", import.meta.url), "utf8"));
const hostels = JSON.parse(readFileSync(new URL("../content/hostels.json", import.meta.url), "utf8"));

// Campus centre (between the University Building and the hostels) and the area we keep.
const LAT0 = 12.8222;
const LON0 = 80.0437;
const BOX = { south: 12.8168, north: 12.8268, west: 80.0372, east: 80.0505 };
const PAD = 0.0015; // roads are kept a little beyond the box so they don't stop dead at the edge
// The campus is drawn at 0.65 of its real size, so walking between buildings takes a game's time, not a real
// walk's. Footprints and distances shrink together (keeping buildings full size would put them on the roads);
// heights, people, trees and furniture stay real size, and roads shrink a little less (ROAD_SCALE).
const SCALE = 0.65;
const ROAD_SCALE = 0.8;
const MX = Math.cos((LAT0 * Math.PI) / 180) * 111320 * SCALE;
const MZ = 110540 * SCALE;
const r = (n) => Math.round(n * 2) / 2;
const toXZ = (p) => [r((p.lon - LON0) * MX), r(-(p.lat - LAT0) * MZ)];
const inBox = (p, pad = 0) => p.lat >= BOX.south - pad && p.lat <= BOX.north + pad && p.lon >= BOX.west - pad && p.lon <= BOX.east + pad;

// OSM hostel names → hostels.json slugs, for real floor counts ("G+9").
const HOSTEL_FLOORS = {
  "Paari Hostel": "paari", "Kaari Hostel": "kaari", "Oori Hostel": "oori", "Adhyaman Hostel": "adhiyaman", "Nelson Mandela Hostel": "nelson-mandela",
  "Manoranjitham Hostel": "manoranjitham", "Agasthayar Hostel": "agasthiyar", "N Block Mens Hostel": "n-block", "M Block Girls Hostel": "kopperundevi",
  "Kalpana Chawla Hostel": "kalpana-chawla", "Menakshi Hostel Block": "meenakshi", "Sannasi C Block, Hostel": "sannasi-c",
};
const floorsBySlug = Object.fromEntries(["men", "women", "international"].flatMap((g) => hostels[g].map((b) => [b.slug, b.floors])));
const storeys = (f) => {
  const m = /G\+(\d+)/.exec(f ?? "");
  return m ? Number(m[1]) + 1 : null;
};

// Kinds (k): 0 other · 1 academic · 2 hostel · 3 food · 4 tech · 5 health · 6 faith · 7 workshop · 8 admin/events · 9 homes
const KIND = { other: 0, academic: 1, hostel: 2, food: 3, tech: 4, health: 5, faith: 6, workshop: 7, admin: 8, library: 8, events: 8, arrival: 0, park: 0, homes: 9 };
const kindOf = (t) => {
  const n = (t.name ?? "").toLowerCase();
  if (t.tourism === "hostel" || n.includes("hostel")) return KIND.hostel;
  if (t.amenity === "hospital" || t.building === "hospital" || n.includes("hospital")) return KIND.health;
  if (t.amenity === "place_of_worship" || /temple|church|mosque/.test(n)) return KIND.faith;
  if (/food court|canteen|restaurant|cafe|vendhar|tea stall/.test(n) || ["food_court", "restaurant", "cafe", "fast_food"].includes(t.amenity)) return KIND.food;
  if (/tech park|incubation|bel lab/.test(n)) return KIND.tech;
  if (t.building === "industrial" || /hang[ae]r/.test(n)) return KIND.workshop;
  if (t.building === "apartments" || t.building === "residential" || t.building === "house") return KIND.homes;
  if (/block|college|university|auditorium|library/.test(n) || ["university", "college", "school"].includes(t.building)) return KIND.academic;
  return KIND.other;
};

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const closeRing = (pts) => {
  if (pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  return pts;
};
/** Split a polyline into runs that stay inside the padded box. */
const clipLine = (geom) => {
  const runs = [];
  let cur = [];
  for (const p of geom) {
    if (inBox(p, PAD)) cur.push(toXZ(p));
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((run) => run.length > 1);
};

const buildings = [];
const buildingByOsmId = new Map(); // OSM way id → index, for places OSM doesn't name (content/walk.json "osmId")
const osmNames = []; // [name, x, z, tags] for every named building or node, to find places by name
const roads = [];
const roundabouts = new Map(); // OSM way id → { p, w }, for landmarks on traffic islands (content/walk.json "roundabout")
const water = [];
const green = [];
for (const e of elements) {
  const t = e.tags ?? {};
  if (e.type === "node" || (!e.geometry && e.center)) {
    const p = e.type === "node" ? e : e.center;
    if (t.name && p && inBox(p, PAD)) osmNames.push({ name: t.name, x: toXZ(p)[0], z: toXZ(p)[1], tags: t, ll: [p.lat, p.lon] });
    continue;
  }
  if (!e.geometry || !e.geometry.some((p) => inBox(p))) continue;
  if (t.building) {
    const pts = closeRing(e.geometry.map(toXZ));
    if (pts.length < 3) continue;
    const levels = Number(t["building:levels"]) || null;
    const slug = HOSTEL_FLOORS[t.name];
    const name = (t.name ?? "").toLowerCase();
    let h;
    if (slug && storeys(floorsBySlug[slug])) h = storeys(floorsBySlug[slug]) * 3.3;
    else if (levels) h = levels * 3.4;
    else if (/tech park|university building/.test(name)) h = 45;
    else if (name.includes("hostel")) h = 20;
    else if (/hang[ae]r/.test(name) || t.building === "industrial") h = 9;
    else if (/block|building|lab|hall|centre|center|hospital|auditorium/.test(name)) h = 17;
    else h = 6 + Math.round(rand() * 6);
    const b = { p: pts, h: Math.round(h), k: kindOf(t) };
    buildings.push(b);
    buildingByOsmId.set(e.id, buildings.length - 1);
    if (t.name) {
      const c = pts.reduce((s, q) => [s[0] + q[0] / pts.length, s[1] + q[1] / pts.length], [0, 0]);
      osmNames.push({ name: t.name, x: c[0], z: c[1], tags: t, building: buildings.length - 1 });
    }
  } else if (t.highway) {
    const foot = ["footway", "path", "steps", "pedestrian", "cycleway", "corridor"].includes(t.highway);
    const real = foot ? 2.5 : ({ trunk: 16, trunk_link: 8, primary: 12, secondary: 10, tertiary: 8, residential: 6, unclassified: 6, living_street: 5, service: 4.5, road: 6 }[t.highway] ?? 4);
    const w = Math.round(real * ROAD_SCALE * 2) / 2;
    if (t.junction === "roundabout") roundabouts.set(e.id, { p: closeRing(e.geometry.map(toXZ)), w });
    for (const run of clipLine(e.geometry)) roads.push(foot ? { p: run, w, f: 1 } : { p: run, w });
  } else if (t.natural === "water") {
    const pts = closeRing(e.geometry.map(toXZ));
    if (pts.length > 2) water.push({ p: pts });
  } else if (t.leisure || t.landuse) {
    const pts = closeRing(e.geometry.map(toXZ));
    if (pts.length > 2) green.push({ p: pts });
  }
}

// ── Geometry helpers ──
const inside = (x, z, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const closestOnSeg = (x, z, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return [a[0] + t * dx, a[1] + t * dz];
};
const closestOnRing = (x, z, poly) => {
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const q = closestOnSeg(x, z, poly[i], poly[(i + 1) % poly.length]);
    const d = Math.hypot(q[0] - x, q[1] - z);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
};
const nearestRoadPoint = (x, z) => {
  let best = [x, z];
  let bd = Infinity;
  for (const { p } of roads)
    for (let i = 0; i < p.length - 1; i++) {
      const q = closestOnSeg(x, z, p[i], p[i + 1]);
      const d = Math.hypot(q[0] - x, q[1] - z);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
  return best;
};
/** A spot just outside the footprint, on the side facing `toward`. */
const doorOf = (poly, toward) => {
  const q = closestOnRing(toward[0], toward[1], poly);
  const c = poly.reduce((s, v) => [s[0] + v[0] / poly.length, s[1] + v[1] / poly.length], [0, 0]);
  let nx = q[0] - c[0];
  let nz = q[1] - c[1];
  const len = Math.hypot(nx, nz) || 1;
  nx /= len;
  nz /= len;
  for (let push = 2.5; push < 30; push += 1.5) {
    const d = [q[0] + nx * push, q[1] + nz * push];
    if (!buildings.some((b) => inside(d[0], d[1], b.p))) return d.map(r);
  }
  return q.map(r);
};

// ── Places ──
const places = {};
const missing = [];
for (const pl of walk.places) {
  if (pl.roundabout) continue; // built below
  // A building OSM maps but doesn't name (the CRC Block): matched by its OSM way id.
  if (pl.osmId !== undefined) {
    const bi = buildingByOsmId.get(pl.osmId);
    if (bi === undefined) {
      missing.push(pl.id);
      continue;
    }
    const bb = buildings[bi];
    if (pl.floors) bb.h = Math.round(pl.floors * 3.4);
    bb.k = KIND[pl.kind] ?? bb.k;
    bb.n = pl.id;
    const c = bb.p.reduce((s, q) => [s[0] + q[0] / bb.p.length, s[1] + q[1] / bb.p.length], [0, 0]);
    places[pl.id] = { x: r(c[0]), z: r(c[1]), door: doorOf(bb.p, nearestRoadPoint(c[0], c[1])), b: bi };
    continue;
  }
  let cands = osmNames.filter((n) => n.name === pl.osm);
  if (pl.osmType) cands = cands.filter((n) => n.tags[pl.osmType]);
  if (pl.osmNear) {
    const [la, lo] = pl.osmNear;
    cands.sort((a, b) => Math.hypot((a.ll?.[0] ?? 0) - la, (a.ll?.[1] ?? 0) - lo) - Math.hypot((b.ll?.[0] ?? 0) - la, (b.ll?.[1] ?? 0) - lo));
  } else cands.sort((a, b) => (b.building !== undefined) - (a.building !== undefined));
  const n = cands[0];
  if (!n) {
    missing.push(pl.id);
    continue;
  }
  let bi = n.building;
  if (bi === undefined) bi = buildings.findIndex((b) => inside(n.x, n.z, b.p));
  let door;
  if (bi >= 0) {
    // A named point inside a building (the library in the University Building): its door faces that point;
    // otherwise the door faces the nearest road.
    door = n.building === undefined ? doorOf(buildings[bi].p, [n.x, n.z]) : doorOf(buildings[bi].p, nearestRoadPoint(n.x, n.z));
    // First place wins (the University Building, not the library inside it).
    if (pl.kind !== "arrival" && pl.kind !== "park" && !buildings[bi].n) buildings[bi].n = pl.id;
  } else door = [r(n.x), r(n.z)];
  places[pl.id] = { x: r(n.x), z: r(n.z), door, ...(bi >= 0 ? { b: bi } : {}) };
}

// A landmark on a traffic island (content/walk.json "roundabout": the OSM way of the roundabout): the island is its
// footprint (so you walk round it, not through it); its "door" is on the far side of the ring road, facing "face".
for (const pl of walk.places.filter((x) => x.roundabout)) {
  const ring = roundabouts.get(pl.roundabout);
  if (!ring) {
    missing.push(pl.id);
    continue;
  }
  const c = ring.p.reduce((s, q) => [s[0] + q[0] / ring.p.length, s[1] + q[1] / ring.p.length], [0, 0]);
  const R = ring.p.reduce((s, q) => s + Math.hypot(q[0] - c[0], q[1] - c[1]), 0) / ring.p.length;
  const island = Math.max(3.5, R - ring.w / 2 - 0.4);
  const poly = Array.from({ length: 16 }, (_, i) => [r(c[0] + Math.cos((i / 16) * Math.PI * 2) * island), r(c[1] + Math.sin((i / 16) * Math.PI * 2) * island)]);
  buildings.push({ p: poly, h: 15, k: KIND[pl.kind] ?? 0, n: pl.id });
  const toward = places[pl.face] ?? { x: c[0] - 1, z: c[1] };
  const dx = toward.x - c[0];
  const dz = toward.z - c[1];
  const d = Math.hypot(dx, dz) || 1;
  const out = R + ring.w / 2 + 2.5;
  places[pl.id] = { x: r(c[0]), z: r(c[1]), door: [r(c[0] + (dx / d) * out), r(c[1] + (dz / d) * out)], b: buildings.length - 1, island: r(island * 10) / 10 };
}

// The arch gate (content/walk.json "archGate"): the campus entrance is a divided avenue, two one-way roads side by
// side, and the gate stands across both, one arch over each. Its piers are footprints, so you walk through the arches.
let gate = null;
for (const pl of walk.places.filter((x) => x.archGate)) {
  const P = places[pl.id];
  if (!P) continue;
  const ends = [];
  for (const rd of roads) {
    if (rd.f) continue;
    for (const [i, j] of [[0, 1], [rd.p.length - 1, rd.p.length - 2]]) {
      const a = rd.p[i];
      const b = rd.p[j];
      if (Math.hypot(a[0] - P.x, a[1] - P.z) > 12) continue;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      ends.push({ a, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], w: rd.w });
    }
  }
  let pair = null;
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const dot = ends[i].u[0] * ends[j].u[0] + ends[i].u[1] * ends[j].u[1];
      if (dot > 0.95 && (!pair || dot > pair.dot)) pair = { e: [ends[i], ends[j]], dot };
    }
  if (!pair) continue;
  const [e1, e2] = pair.e;
  let ux = e1.u[0] + e2.u[0];
  let uz = e1.u[1] + e2.u[1];
  const ul = Math.hypot(ux, uz);
  ux /= ul;
  uz /= ul;
  const inset = 9;
  const cx = (e1.a[0] + e2.a[0]) / 2 + ux * inset;
  const cz = (e1.a[1] + e2.a[1]) / 2 + uz * inset;
  // Across the avenue (local x) and how far apart the two roads are.
  const vx = uz;
  const vz = -ux;
  const span = Math.max(8.2, Math.abs((e2.a[0] - e1.a[0]) * vx + (e2.a[1] - e1.a[1]) * vz));
  const A = 5.4;
  const pier = 4.6;
  const W = span + A + 2 * pier;
  gate = { x: r(cx * 10) / 10, z: r(cz * 10) / 10, ry: Math.round(Math.atan2(ux, uz) * 1000) / 1000, span: r(span * 10) / 10 };
  const rect = (x0, x1, z0, z1) =>
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map(([a, b]) => [r(cx + vx * a + ux * b), r(cz + vz * a + uz * b)]);
  buildings.push({ p: rect(-W / 2, -W / 2 + pier, -1.8, 1.8), h: 1, k: 0, n: "gate-pier" });
  buildings.push({ p: rect(W / 2 - pier, W / 2, -1.8, 1.8), h: 1, k: 0, n: "gate-pier" });
  buildings.push({ p: rect(-(span - A) / 2, (span - A) / 2, -1.5, 1.5), h: 1, k: 0, n: "gate-pier" });
  // The statue on its round pedestal, out in front between the two roads.
  buildings.push({ p: rect(-0.9, 0.9, -7.9, -6.1), h: 1, k: 0, n: "gate-statue" });
  // Arrive just outside the gate, looking through it.
  P.door = [r(cx - ux * 15 + vx * (span / 2)), r(cz - uz * 15 + vz * (span / 2))];
  P.x = P.door[0];
  P.z = P.door[1];
}

// Two places on one building (library, University Building) must not share a door: nudge the second along the wall.
const doors = Object.entries(places);
for (let i = 0; i < doors.length; i++)
  for (let j = 0; j < i; j++) {
    const a = doors[i][1].door;
    const b = doors[j][1].door;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 6) doors[i][1].door = [a[0] + 8, a[1]];
  }

// ── Trees: on open ground, not in buildings, water or roads ──
const nearRoad = (x, z) =>
  roads.some(({ p, w }) => p.some((a, i) => i < p.length - 1 && Math.hypot(...[x, z].map((v, k) => v - closestOnSeg(x, z, a, p[i + 1])[k])) < w / 2 + 3));
const bounds = { minX: r((BOX.west - LON0) * MX), maxX: r((BOX.east - LON0) * MX), minZ: r(-(BOX.north - LAT0) * MZ), maxZ: r(-(BOX.south - LAT0) * MZ) };
const trees = [];
for (let tries = 0; trees.length < 850 && tries < 40000; tries++) {
  const x = bounds.minX + rand() * (bounds.maxX - bounds.minX);
  const z = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
  if (buildings.some((b) => inside(x, z, b.p)) || water.some((w) => inside(x, z, w.p)) || nearRoad(x, z)) continue;
  if (Object.values(places).some((p) => Math.hypot(p.door[0] - x, p.door[1] - z) < 7)) continue;
  trees.push([r(x), r(z), Math.round((0.7 + rand() * 0.8) * 10) / 10]);
}

// Bus stops (one shelter per stop; pairs a few metres apart are one stop).
const stops = [];
for (const n of osmNames.filter((x) => x.tags.highway === "bus_stop" && x.building === undefined)) {
  const xz = [r(n.x), r(n.z)];
  if (xz[0] < bounds.minX || xz[0] > bounds.maxX || xz[1] < bounds.minZ || xz[1] > bounds.maxZ) continue;
  if (stops.some(([sx, sz]) => Math.hypot(sx - xz[0], sz - xz[1]) < 12)) continue;
  // Stand the shelter beside the road, not on it.
  const q = nearestRoadPoint(xz[0], xz[1]);
  const dx = xz[0] - q[0];
  const dz = xz[1] - q[1];
  const d = Math.hypot(dx, dz) || 1;
  stops.push(d < 6 ? [r(q[0] + (dx / d) * 6), r(q[1] + (dz / d) * 6)] : xz);
}

const out = { origin: [LAT0, LON0], scale: SCALE, bounds, spawn: walk.spawn, buildings, roads, water, green, trees, stops, places, ...(gate ? { gate } : {}) };
mkdirSync(new URL("../public/walk/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/walk/ktr-world.json", import.meta.url), JSON.stringify(out));
console.log(
  `${buildings.length} buildings, ${stops.length} bus stops, ${roads.length} roads (${roads.filter((x) => x.f).length} footpaths), ${water.length} water, ${green.length} green, ${trees.length} trees, ${Object.keys(places).length}/${walk.places.length} places` +
    (missing.length ? `\nnot found in OSM: ${missing.join(", ")}` : ""),
);
