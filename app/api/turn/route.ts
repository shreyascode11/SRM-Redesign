import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/turn: relay (TURN) servers for Walk SRM multiplayer.
 *
 * Friends' browsers connect straight to each other, but many networks (mobile data behind carrier NAT, some college
 * and office Wi-Fi) won't allow it; a TURN server relays the game's traffic for them. This hands out credentials
 * without putting any secret in the page:
 * - Cloudflare Realtime TURN (free tier): set CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN, and short-lived
 *   credentials are generated here (cached for an hour);
 * - or any TURN service with fixed credentials: TURN_URLS (comma-separated), TURN_USERNAME, TURN_CREDENTIAL.
 * With neither set, it returns an empty list and the game connects directly, as before.
 */

type Ice = { urls: string | string[]; username?: string; credential?: string };

let cached: { at: number; servers: Ice[] } | null = null;
const TTL = 6 * 60 * 60; // credentials last six hours…
const REFRESH = 60 * 60 * 1000; // …and are refreshed every hour

const hits = new Map<string, number[]>();
const limited = (ip: string) => {
  const now = Date.now();
  if (hits.size > 2000) hits.clear();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
};

async function cloudflare(keyId: string, token: string): Promise<Ice[]> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: TTL }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Cloudflare TURN ${res.status}`);
  const data = (await res.json()) as { iceServers?: Ice | Ice[] };
  const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
  // Only the TURN entries (the game already has STUN), with their credentials.
  return list
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/.test(u)) }))
    .filter((s) => s.urls.length && s.username && s.credential);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (ip && limited(ip)) return new NextResponse(null, { status: 429 });
  const headers = { "Cache-Control": "no-store" };

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (keyId && token) {
    if (!cached || Date.now() - cached.at > REFRESH) {
      try {
        cached = { at: Date.now(), servers: await cloudflare(keyId, token) };
      } catch (e) {
        console.error("turn:", e instanceof Error ? e.message : e);
        if (!cached) return NextResponse.json({ iceServers: [] }, { headers });
      }
    }
    return NextResponse.json({ iceServers: cached.servers }, { headers });
  }

  const urls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/.test(u));
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    return NextResponse.json({ iceServers: [{ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }] }, { headers });
  }
  return NextResponse.json({ iceServers: [] }, { headers });
}
