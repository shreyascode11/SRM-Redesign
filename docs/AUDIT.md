# Accessibility, performance and security audit

Measured on 5 Nov 2026 with Lighthouse 13.5 (mobile, simulated slow 4G, a fresh visit) and axe-core. Old site = the
public homepage of www.srmist.edu.in, loaded like any browser would. Ours = the production build of this repo.
Scores move a little between runs and with server load; treat them as a snapshot, not a promise.

## 1. Gaps on the existing website, with fixes

### Accessibility (Lighthouse 81 / 100)
| Gap found | How much | Recommended fix | In our build |
|---|---|---|---|
| Low text contrast, e.g. light-blue `#7a9bc5` label text at 2.34:1, white link text on white at 1.08:1 (WCAG AA needs 4.5:1) | 15 elements | Darken text or its ground until 4.5:1 (3:1 for large text); check in the design tokens, not page by page | Every colour pair tokenised and checked; axe reports 0 contrast failures |
| Links with no accessible name (icon-only links) | 35 | Give each an `aria-label` or visible text | Every icon link is labelled; axe 0 |
| Buttons with no accessible name | 2 | Label them | Labelled |
| Touch targets too small or too close | 37 | At least 44 px square, with spacing | 44 px minimum, enforced in components; logo and source links fixed in this task |
| "Skip to content" link exists but is not focusable; an element uses `tabindex` above 0 | 2 | Make the skip link reachable by keyboard; never use tabindex above 0 | Skip link works; no positive tabindex |
| 64 links that go to `#`, and links with no descriptive text | 64 + 3 | Real destinations or buttons; descriptive link text | Real URLs; "Read more" style links avoided |

### Fonts, contrast and readability
| Gap | Recommended fix | In our build |
|---|---|---|
| A 449 KB icon font (`elementskit.woff`) is downloaded for a few icons | Use inline SVG icons | No icon font; icons are inline SVG |
| Fonts from Google Fonts, an extra third-party request | Self-host with `font-display: swap` | All fonts self-hosted via `next/font`; Tamil and Devanagari get proper script fonts, never faked bold |
| 81 `h2` headings with one `h1`, many layered inline styles (35) | A clean heading outline and CSS classes | One `h1` per page, headings in order |
| Dense text, small body size | 16 to 17 px body, 1.5+ line height, line length near 65 characters | 17 px body, 1.6 line height, prose capped at about 65 characters, large serif headings |

### Slow-loading pages (Lighthouse performance 49)
| Finding | Evidence | Recommended fix | In our build |
|---|---|---|---|
| Very heavy page | 386 requests, 10.1 MB (homepage HTML alone 709 KB, 104 KB gzipped) | Fewer, smaller assets | 28 to 101 requests, 0.4 to 1.1 MB per page |
| Main content appears very late | First paint 21.8 s, largest content 56.3 s (simulated slow 4G) | Remove render-blocking work, defer heavy media | First paint 1.1 to 1.2 s |
| 62 scripts (39 block rendering) and 46 stylesheets | jQuery loaded 45 times in the page source | Bundle, defer, load only what a page uses | One bundle per page, hydrated lazily |
| Unused code shipped | 343 KB unused JavaScript, 231 KB unused CSS | Code-splitting, purge CSS | Tailwind purge; 3D, GSAP and the chat panel load only when needed |
| Autoplay video embed | About 1.6 MB fetched plus a 472 KB player script | Load a poster image first; start video on tap | No autoplay video; Lite Mode strips all heavy media |
| Large uncompressed-format images | 377 KB WebP banner, 303 KB PNG brochure | Resize, AVIF/WebP, correct dimensions | Every photo goes through `next/image` (AVIF/WebP, sized) |
| HTML sent with `Cache-Control: max-age=0` | Every visit re-downloads | Cache static assets for long, HTML briefly | Hashed assets cached 1 year; media 1 day; intro frames 1 year |

## 2. Optimisation and security

### What we found on our own build, and fixed here
| Area | Before | After |
|---|---|---|
| Security headers | Only `Referrer-Policy` | Added Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` (Vercel adds HSTS). The old site sent none of these |
| Content-Security-Policy | None | Own files only, plus SRM's 360° tour and YouTube (no cookies); `object-src 'none'`, `frame-ancestors 'self'`. Tested on every page type, the 3D hostels, AI search, chat and the 360° tour: no violations |
| JSON-LD in `<script>` tags | `JSON.stringify` left `<` unescaped | Escaped, so content can never close the tag early (`lib/jsonld.ts`) |
| Static media caching | `max-age=0` on photos, maps, brand art | 1 day with stale-while-revalidate; intro frames 1 year, immutable |
| Homepage first-visit weight | 2,964 KB (all 73 intro frames at once) | 1,112 KB: frame 1 now, the rest after the page finishes loading |
| Homepage blocking time | 210 ms | 20 ms |
| Secrets | `.env.local` holds the AI key | Git-ignored; scanned the repo and history: no keys committed |
| AI endpoint abuse | n/a | Per-IP rate limit, query length cap, only real programme slugs accepted |

### Lighthouse, mobile (performance / accessibility / best practices / SEO)
| Page | Old site | Ours |
|---|---|---|
| Homepage | 49 / 81 / 77 / 85 | **94 / 100 / 100 / 100** |
| Programmes | n/a | 95 / 100 / 100 / 100 |
| A programme page | n/a | 95 / 100 / 100 / 100 |
| Hostels (3D) | n/a | 94 / 100 / 100 / 100 |
| Tamil homepage | n/a | 94 / 100 / 100 / 100 |

Homepage detail: transfer 10.1 MB to 1.1 MB, 386 requests to 101, first paint 21.8 s to 1.2 s, layout shift 0.044 to 0.001.

### Dependency audit (`npm audit`)
8 findings remain, none introduced by our code, none exploitable in the running site:
- **PostCSS (high):** inside Next.js's own build tooling. It concerns stringifying untrusted CSS, which we never do. The fix needs Next.js 16, a major upgrade; scheduled, not rushed.
- **7 moderate:** dev-only lint tools (`typescript-eslint`, `minimatch`). They never ship to visitors.
`npm audit fix` changed the lockfile without fixing any of them, so it was not applied.

## 3. Still open (honest list)
- Largest content paint is about 3 s in Lighthouse's slow-phone simulation (real measurement on a fast network is far lower). Next step: trim the first stylesheet and font weights.
- The Content-Security-Policy allows inline scripts, because Next.js needs them to start up. A nonce-based policy is the stronger version.
- Tested in Chrome only. Safari, Firefox and Samsung Internet need a manual pass.
- Next.js 16 upgrade (clears the PostCSS finding) not done.
- 360° tour and YouTube are third-party content, outside our control.

## How to repeat
`NEXT_PUBLIC_SITE_URL=http://localhost:3123 npm run build:verify`, then `npm run start:verify -- -p 3123`, then
`npx lighthouse@13.5.0 http://localhost:3123/ --preset=perf --form-factor=mobile`. Accessibility: axe-core runs against
every page type (0 violations at the last check, English, Tamil and Hindi).
