# SRM Institute of Science and Technology — Next-Gen Website Redesign

**Redesigned by Shreyas** ([@shreyascode11](https://github.com/shreyascode11)) · An entry for the *Next-Gen SRM Website Design Challenge*

A redesign of [srmist.edu.in](https://www.srmist.edu.in/) built around the idea **"Level Up at SRM"**: a student's years played as a character who levels up, with SRM's own tagline **Learn. Leap. Lead.** as the structure. It opens with a scroll-driven walk through SRM's gate, then turns programmes, hostels, campuses and rankings into things you can search, compare, fly to and trust. Underneath, it is a fast, accessible site in English, Tamil and Hindi, built so that a parent on a budget Android phone can find B.Tech CSE fees in a few taps.

> This is an independent design-challenge entry, not the official SRM website. Facts, fees and dates come from SRM's published pages (see [Content you can trust](#content-you-can-trust)); always confirm admissions details with SRM.

**Live preview:** https://srm-redesign-one.vercel.app · **Demo script:** [DEMO.md](DEMO.md) · **Audit:** [docs/AUDIT-TASK4.md](docs/AUDIT-TASK4.md)

---

## Highlights

### The experience
| | |
|---|---|
| **Gate intro** | On a first visit, scrolling plays a camera glide towards SRM's gate (a short image sequence), which fades into the homepage as it passes under the arch. Skippable, once per session, and off in Lite Mode, with reduced motion and on Save-Data. |
| **Level up at SRM** | A turning helix of real quests around SRM's emblem. Pick a path (Building, Research, People, Sport, Startups) and a character card levels up and shows verified SRM quests. |
| **Learn. Leap. Lead.** | The tagline as a chapter: Learn (find a programme), Leap (real student work), Lead (rankings, placements, research), each linking to its part of the site. |
| **Quest accepted, clock's running** | An ink-blot reveal into a lilac chapter with the live time at Kattankulathur behind a phone showing a real quest. |
| **Leafy** | An original mascot on every page: it hops between pages, waves, and thinks while the assistant answers. |

### Finding and choosing
| | |
|---|---|
| **Programme finder** | Instant search over 29 programmes with level and college filters, fees and campus on every card. |
| **AI search** | Type what you mean ("help sick people", "something with sketching and circuits"). After a short pause a free AI picks the best programmes from SRM's list with a one-line reason each. Only real programmes can be chosen, and fees always come from our data. Falls back to keyword search if the AI is off or busy. |
| **Recommendations** | "Programmes like this" on every programme page and "Suggested for you" in the finder, matched on shared topics. Free, and the history stays on your device. |
| **Compare** | Pin up to three programmes and see fees, eligibility, entrance and deadlines side by side, with differences picked out and a shareable link. Works without JavaScript. |
| **Programme pages** | An at-a-glance strip (level, duration, fees, campus), a floating section menu, key facts, careers, placements and Ask a Senior (demo threads with real moderation states). |
| **What will it cost?** | On every programme page: tuition + hostel + mess (+ optional laundry) for the whole course, from SRM's published 2026–27 fee tables and hostel circulars only. Says so when SRM hasn't published a figure. |
| **Stories** | `/stories`: this week at SRM (the curated story and what's coming up), all student work, and alumni with their career paths. |
| **Parent Mode** | One toggle rewrites a programme page into plain answers about cost, admission, location, safety, hostel and jobs, with large call buttons. |
| **Command palette** | ⌘K or Ctrl+K for every programme, page and action, in all three languages. |

### Campuses and hostels
| | |
|---|---|
| **3D hostel finder** | A 3D model of Kattankulathur built from OpenStreetMap. Tap a hostel and the camera flies there and opens its card: entrance photo, room types, this year's lowest fee, the office phone. A plain list does the same job. 12 hostel blocks are modelled; heights are approximate. |
| **Walk SRM** | `/walk` (or **🎮 Play 3D** in the header and the homepage hero): the real Kattankulathur campus as a small walkable game world, in an anime ink style inspired by Abeto's Messenger. You arrive at the pink **arch gate** (modelled on the site's intro video) as a student you dress yourself (our own anime-style students, built in code), walk real roads up the avenue to the **clock tower** on its roundabout (modelled on the team's video, with live-time clocks), and on to real buildings: the **University Building**, **Tech Park** and the orange **Tech Park 2**, hostels with balconies, **SRM Global Hospitals** and more. Walk, run (R or the 🏃 button) or **jump** (Space), choose your walking speed, and say hi to the 16 students walking the roads: they wave, answer your emotes and tell you where they're going. Talk to nine people at real buildings and take six small quests that raise Build, Think, Connect and Grow. Every fact a character says comes from our content files; every building opens its page. Built from OpenStreetMap at 0.65 scale so walks stay short (heights are real); places OSM only marks with a pin, like the hospitals, get approximate blocks. Loads only after Begin; Lite Mode and no-WebGL get a full text tour. |
| **Campus map** | India in 3D with all six campuses and three sister universities. Pick your city to see how far each campus is (your location never leaves your device). |
| **360° · VR tour** | SRM's own virtual tour opens inside the page, with fullscreen and headset support (VR not yet tried on a real headset). |
| **Hostels, student life, research** | Full pages with photos, 2026-27 fee tables, contacts, mess timings, clubs, counselling, research centres and the patent register, all sourced from SRM's pages. |

### Ask SRM (free AI, grounded in verified data)
Open Leafy on any page. Questions about fees, deadlines, hostels, rankings and campuses are answered by rules from SRM's data, with source links, in English, Tamil and Hindi. If the rules can't answer, an optional free AI (any OpenAI-compatible endpoint, tested with Groq's free tier) answers only from the closest verified records, labels itself AI-written, and says "unsure" rather than guess; then it hands you to admissions with the phone numbers. No paid service is needed, and with no AI configured everything still works.

### For everyone
| | |
|---|---|
| **Three languages** | English, தமிழ் and हिन्दी, including programme names, fees and the assistant. |
| **Lite Mode** | Automatic on Save-Data, slow connections or reduced motion: strips video, 3D and smooth scrolling, keeps all the information. |
| **Works offline** | A hand-written service worker keeps key pages and any programme you save working with no signal. |
| **Link previews** | Programme, campus and story links shared on WhatsApp, X or LinkedIn show a branded card with the real fee and NIRF rank. |

### Testing what works (A/B)
Built-in, private A/B testing (`lib/ab.ts`): a visitor gets variant A or B of each experiment at random, chosen before first paint so pages stay static and never flicker; no cookies, no personal data. Running now: a search-first homepage hero vs the game-style button, and "What will it cost?" first vs "Apply" first on programme pages. Results with a significance test at `/lab` (not indexed); force a variant with `?ab=hero-cta:b`.

## Performance, accessibility and security

Lighthouse, mobile, simulated slow 4G, production build, 5 Nov 2026 (full audit and the existing site's gaps in [docs/AUDIT-TASK4.md](docs/AUDIT-TASK4.md)):

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Homepage | 94 | 100 | 100 | 100 |
| Programmes | 95 | 100 | 100 | 100 |
| A programme page | 95 | 100 | 100 | 100 |
| Hostels (3D) | 94 | 100 | 100 | 100 |
| Tamil homepage | 94 | 100 | 100 | 100 |

For comparison, the existing srmist.edu.in homepage scored 49 / 81 / 77 / 85 in the same test (386 requests, 10 MB).

- **Accessibility:** every page type passes axe-core (WCAG 2.2 AA); one `h1` per page; a skip link first; visible focus rings; 44 px tap targets; no sideways scrolling from 360 px up.
- **JavaScript:** about 139 kB on the homepage's first load (budget 180 kB). 3D, motion libraries, the chat panel and the intro frames load only when needed, and never in Lite Mode.
- **Security:** Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy` and COOP headers; escaped JSON-LD; rate-limited API routes; no secrets in git. Open items (a Next.js 16 upgrade, Safari and Firefox testing) are listed in the audit.
- **Reduced motion:** everything is static, nothing is pinned, and the intro and 3D stay off.

## Tech stack

- **Next.js 15** (App Router) with **TypeScript** (strict mode) and **React 19**
- **Tailwind CSS v4**, with design tokens as CSS variables
- **GSAP + ScrollTrigger** for scroll choreography and **Lenis** for smooth scroll, both loaded after page load and switched off in Lite Mode
- **next-intl** for English, Tamil and Hindi
- **Fuse.js** for instant client-side search; an optional free LLM (any OpenAI-compatible endpoint) for AI search and the assistant, called with plain `fetch`
- **three.js, React Three Fiber and drei** for the 3D hostel finder and Walk SRM, loaded only when needed and never in Lite Mode
- **next/image** for every image, served as AVIF or WebP; **next/font** for self-hosted fonts
- Deploy target: **Vercel**

## Getting started

```sh
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run build` | Production build; runs the content checks first |
| `npm run lint` / `npm run typecheck` | ESLint (zero warnings allowed) and the TypeScript compiler |
| `npm run check:content` | Validates every content file: references, TODO format, stats and translation coverage |
| `npm run media:status` | Lists every photo and video the site expects and marks which have arrived |
| `npm run i18n:review` | Exports every Tamil and Hindi string to `docs/translation-review.csv` for a native-speaker review |
| `npm run build:verify` / `npm run start:verify` | Builds and serves into `.next-verify/`, so a running `npm run dev` is never disturbed |

### Offline support and the kill switch

In production, a hand-written service worker (`public/sw.js`) keeps key pages, programme pages people save, and the
search index working offline. To ship a change to it, bump `VERSION` at the top: old caches are deleted on the next
visit. If a bad worker ever ships, replace `public/sw.js` with this and deploy; every visitor's worker removes itself
and its caches on their next visit:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("srm-")).map((k) => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll()).then((cs) => cs.forEach((c) => c.navigate(c.url))),
));
```

No API keys are needed. The site, search, programme matcher and rule-based assistant all work offline. Optional settings (see `.env.example`):

- `NEXT_PUBLIC_SITE_URL`: the canonical site address, for the sitemap, SEO tags and link previews. **Set it to the real https address in Vercel.** Without it, link previews point at `localhost:3000`.
- `ENQUIRY_WEBHOOK_URL`: where the admission enquiry form sends submissions. Without it, the form says plainly that nothing was sent.
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`: turn on AI search and the assistant's AI answers using any free OpenAI-compatible endpoint (tested with Groq: `https://api.groq.com/openai/v1` and `openai/gpt-oss-20b`). Keep the key in `.env.local` or the host's secret settings, never in git. Free tiers are rate-limited, so the site falls back to keyword search and rule-based answers if the AI is busy or off.

## Project structure

```
app/[locale]/        pages: home, programmes, programme detail, campuses, stories, admissions
app/api/             ask (programme matcher), ai-search, assistant (Ask SRM), enquiry, search index
components/          grail (homepage, intro, mascot), hostels (3D), walk (Walk SRM game), map, nav, footer, programme, assistant, ui
content/             programmes, colleges, campuses, alumni, stories, research, stats, voices, startups, walk (JSON)
content/i18n/        Tamil and Hindi translations of the content
messages/            interface text in en / ta / hi
lib/                 content loading, search, recommender, llm, assistant, Lite Mode, Parent Mode, map maths
public/media/        photos and the intro frames (sources in content/media-credits.json); every file here is in use
public/walk/         Walk SRM: the campus world (built by scripts/build-campus-walk.mjs from OpenStreetMap) and its cover
scripts/             content checks, media status, map builders, translation review, link check, UI audit, A/B end-to-end check
docs/                audits (AUDIT.md, AUDIT-TASK4.md), Task 3 and Task 5 notes, Walk SRM plan, link-preview checks, translation review
```

## Content you can trust

- **Every fact has a source.** Fees, eligibility, entrance exams and dates come from SRM's 2026 admission pages and its 2026–27 brochure. Each programme lists its sources.
- **Unknown means TODO, never a guess.** Anything SRM hasn't published (for example MBBS fees, which appear only in the NEET bulletin) stays a marked `TODO`. It shows in development and is hidden on the live site.
- **Photos are real.** They are SRM's own, from its websites, plus openly licensed photos from Wikimedia Commons, which show their author and licence on the image. Every file's origin is listed in [`content/media-credits.json`](content/media-credits.json).
- **The demo walkthrough** for judges is in [DEMO.md](DEMO.md).

## Credits

**Design and development: Shreyas** — [github.com/shreyascode11](https://github.com/shreyascode11)

The SRM name, logo, emblem and photographs belong to SRM Institute of Science and Technology and are used here only for this design-challenge entry. Photos from Wikimedia Commons are credited on the images under their CC BY / CC BY-SA licences. Map data and the 3D campus footprints © OpenStreetMap contributors; India outline from Natural Earth (public domain). The look takes its structure and motion from the Grail app as a reference; the emblem treatment, kolam patterns, mascot, quests and every feature are original (see [CREDITS.md](CREDITS.md)).
