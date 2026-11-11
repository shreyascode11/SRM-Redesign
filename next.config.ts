import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { WALK_RELAYS } from "./lib/walk/relays";

const withNextIntl = createNextIntlPlugin("./lib/i18n-request.ts");

const nextConfig: NextConfig = {
  // Verification builds use NEXT_DIST_DIR=.next-verify so they never overwrite the .next/ a running `npm run dev` reads.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep metadata in <head> for everyone, including on /compare, the one dynamic page, where Next would otherwise stream it into <body>.
  htmlLimitedBots: /.*/,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // srmist.edu.in's firewall answers visits referred from another site with a "confirm you are human" check (405), then
  // 403 Forbidden, so links out send no referrer. The YouTube embeds opt back in: YouTube won't play without one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "same-origin" },
          // Stop browsers guessing file types, and stop other sites framing ours (clickjacking).
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Geolocation is used only by "How far is SRM from home?"; nothing else needs a sensor.
          // The microphone is for Walk SRM's voice chat with friends (off until you turn it on).
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), payment=(), usb=(), geolocation=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Content-Security-Policy: our own files only, plus the two embeds we use (SRM's 360° tour, YouTube without
          // cookies). Next.js needs inline scripts and styles to hydrate, hence 'unsafe-inline'. Production only, so
          // `npm run dev` (which needs eval for hot reload) is untouched.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob:",
                    "font-src 'self' data:",
                    // Walk SRM multiplayer: the relays that introduce friends' browsers to each other.
                    `connect-src 'self' ${WALK_RELAYS.join(" ")}`,
                    "media-src 'self'",
                    "frame-src https://webstor.srmist.edu.in https://www.youtube-nocookie.com",
                    "worker-src 'self' blob:",
                    "manifest-src 'self'",
                    "object-src 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                    "frame-ancestors 'self'",
                  ].join("; "),
                },
              ]
            : []),
        ],
      },
      // Files in /public are served with max-age=0 by default. Photos, maps and brand art change rarely: cache them for a
      // day (and serve stale while refreshing for a week); the intro frames never change: cache them for a year.
      ...["/media/:path*", "/map/:path*", "/brand/:path*", "/icons/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
      { source: "/media/intro/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The service worker must never be cached, or a fix (or the kill switch) couldn't reach visitors.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
