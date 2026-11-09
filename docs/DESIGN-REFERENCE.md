# Design reference: grail-app.com

The homepage's structure and motion take their cue from Grail (grail-app.com). These are the notes from studying it;
nothing of Grail's copy, art, fonts or code is used.

## What it looks like

Looked at on 2026-11-05 in Chrome (headless, real rendering) at 1440 × 900 and 390 × 844, scrolled top to bottom,
with computed styles read from the live page. Page: 11,729 px tall on desktop, 8,562 px on a phone. Nothing here is
copied into the build: this is the structure and feel we borrow, in SRM's own words, colours and art.

## Palette (sampled from computed styles, most used first)

| Role | Value | Where |
|---|---|---|
| Ground | `#000000` | Hero, "Chapter 01", totems, stats, footer: most of the page is black |
| Text on black | `#FFFFFF`, body at 72% white; muted `#B8B8B8` | |
| Sheets | `#F5F5F5`, `#EEEEEE`, `#E9E9E9` | Off-white panels with large rounded corners that slide over the black, slightly rotated |
| Accent ground | lilac `#E7AFE7` to `#ECD2F3` | Whole "Chapter 02" and "Chapter 04" sections, with a soft blurred cloud texture |
| Accent ink | aubergine `#623562` | Serif headline on the lilac sections |
| Action | `#ECD2F3` pill with `#1A1018` text; chips `#FFCDFF` | "Join Waitlist" pill; selected totem chip |
| Art | red, yellow, ochre-brown, lilac, sky blue, black | Flat folk-heraldry "guild" tiles: checks, keys, trees, ships |

It is **not** the warm-paper, lime and ember palette the brief guessed. It is black and off-white with one soft accent
colour and loud, flat pattern art.

## Type

- **Display:** "PP Pangaia" (a commercial, high-contrast serif with flared, calligraphic W and V), weight 300, always
  UPPERCASE, very large (145 px for the hero at 1440 wide, 80 to 90 px for section heads), line height about 0.88,
  letter spacing -1%. Lines are often staggered left and right across the width.
- **Text:** "Switzer" (a commercial grotesk), 15 to 16 px, line height about 1.3, regular; 600 for buttons and labels.
- Small labels in sentence case at the top corners of each section: "About Problem" left, "Chapter 01" right.

## Layout and section order

1. **Hero (black):** small logo left, one-line description centred, "Join Waitlist" pill right. Huge serif
   "RECLAIM YOUR LIFE" across the full width, over a 3D carousel of tilted quest cards and pattern tiles (canvas).
2. **Chapter 01, Problem (black):** a four-line staggered serif headline, a short paragraph below.
3. **Chapter 02, Timer (lilac):** "QUEST ACCEPTED. CLOCK'S RUNNING." with a phone mock-up over giant faint countdown digits.
4. **Chapter 03, Journey (off-white sheet, rotated, sliding over the lilac):** "IT STARTS AS ONE [tile] QUEST. IT
   RARELY STAYS THAT WAY." A pattern tile sits inline in the headline. Then a numbered list of five "A chance: …" rows
   with a small photo each.
5. **Chapter 04, Reflection (lilac):** "TELL FUTURE SELF / AND SEEKERS AFTER", with a blurred phone mock-up.
6. **Chapter 05, Totems (dark brown, smoky):** a 3D armoured duck ("THE KNIGHT"); "SIX TOTEMS. ONE'S YOURS." with six
   pill chips to pick one.
7. **Chapter 06, Stats (black):** "EVERY QUEST LANDS SOMEWHERE." with four stat columns (Charisma, Strength, Wisdom,
   Intellect) and a number each.
8. **Chapter 07, Guilds (off-white sheet, rotated):** pattern tiles scattered around "YOUR GUILDS. THEY DEFINE YOUR QUESTS".
9. **Get in early (black):** a giant faint "YOUR EMAIL" input with a hairline under it. Footer: maker, logo, email, Privacy, Terms.

## Components

- **Quest card:** white, rounded about 16 px, a small pattern crest, guild name in small grey type, a bold three-line
  task, one line of explanation, then avatars with timings.
- **Floating dock:** a pill that stays fixed near the bottom of the screen on every section: logo mark plus "Join Waitlist".
  It changes colour to match the section under it.
- **Chips:** fully rounded, 600 weight, one highlighted.
- **Sheets:** big rounded panels (about 28 px corners) that come in rotated a few degrees and settle as you scroll.

## Motion

- Headline letters rise into place one at a time (`rise`, 620 ms each, staggered).
- Sheets slide up over the previous section and straighten as they arrive.
- The hero's card carousel and the totem are 3D (8 `<canvas>` elements on the page).
- Scroll-linked throughout; nothing autoplays with sound.

## Imagery

No stock hero. The art is original flat pattern tiles; the only photos are small, candid, phone-style shots in the
"A chance" list.

## Nav and footer

No menu at all, just the logo (back to top) and the "Join Waitlist" pill. The footer is a single row.

## What we borrow for SRM, and what we change

| Borrow (structure and feel) | Make original to SRM |
|---|---|
| Black ground, off-white sheets that slide over it, one loud accent per section | Colours from kolam, the rice-flour and powder floor drawings of Tamil Nadu: kumkum red, turmeric, leaf green, sky; lime only for the one action |
| Giant uppercase serif display over a clean grotesk | Instrument Serif (free, OFL) over Inter, already self-hosted; Tamil and Hindi fall back to the scripts' own faces |
| Pattern tiles as identity | Generated kolam crests (a dot grid with loops), one per stat, never Grail's heraldry |
| Four stats, quests, "pick yours" chips | Build, Think, Connect, Grow; every quest is a real thing at SRM with a sourced proof |
| Chapter labels in the corners | "Level 01" to "Level 06" |
| Floating action dock | "Start your run" (Apply), desktop only, so it never fights Ask SRM on phones |
| No nav | We keep the site's real header and footer: the brief requires the plain fallback links |
| 3D canvas hero | Not used: an original character card instead, so the hero stays fast on a budget Android phone |
