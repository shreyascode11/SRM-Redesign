import Image from "next/image";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { HeroSearch } from "@/components/hero/HeroSearch";
import { CampusExplorer } from "@/components/map/CampusExplorer";
import { Photo } from "@/components/ui/Photo";
import questsData from "@/content/quests.json";
import { getContent } from "@/lib/content";
import { Link } from "@/lib/i18n";
import { STAT_KOLAM } from "@/lib/kolam";
import { getCities, getMapData, mapAspect } from "@/lib/map";
import { SECTION } from "@/lib/sections";
import { studentLife } from "@/lib/student-life";
import emblem from "@/public/brand/srm-emblem.png";
import { CharacterCard, type Stat } from "./CharacterCard";
import { ChennaiClock } from "./ChennaiClock";
import { IntroGate } from "./IntroGate";
import { GrailMotion } from "./GrailMotion";
import { HeroRing } from "./HeroRing";
import { Kolam } from "./Kolam";
import { Rise } from "./Rise";

type QuestCopy = { title: string; summary: string; proof: string };
const STATS = questsData.stats as Stat[];
const STAT_COLOR: Record<Stat, string> = { build: "var(--stat-build)", think: "var(--stat-think)", connect: "var(--stat-connect)", grow: "var(--stat-grow)" };
const KOLAMS = ["lattice", "rings", "petals", "flower"] as const;

/**
 * "Level Up at SRM" (SRM-GRAIL-REDESIGN.md; the look and motion follow REFERENCE.md): a student's years at SRM as a
 * character that levels up. Seven chapters that alternate black, off-white sheets and lilac; each sticks while the
 * next slides over it. Every quest and number comes from content JSON; the stats on the card are a game, not data.
 */
export async function GrailHome() {
  const t = await getTranslations("Grail");
  const ex = await getTranslations("Acts.explore");
  const nav = await getTranslations("Nav");
  const locale = await getLocale();
  const hero = await getTranslations("Hero");
  const walk = await getTranslations("Walk");
  const map = getMapData(locale);
  const all = await getMessages();
  const copy = all.Grail.quests as Record<string, QuestCopy>;
  const { campuses, colleges, programmes, site, nirf, naacGrade, placements, researchStats, studentWork } = getContent(locale);
  const life = studentLife.stats;
  const stat = (id: string) => placements.items.find((s) => s.id === id);
  const research = (id: string) => researchStats.find((s) => s.id === id);

  // Proof lines that carry a number take it from content, never from the message files.
  const params: Record<string, Record<string, string>> = {
    patent: { n: research("patents")?.display ?? "" },
    clubs: { n: life.clubs },
    jhalak: { n: life.houses },
    offer: { n: stat("offers")?.display ?? "", season: placements.season },
    khel: { n: life.events },
    cycle: { n: life.acres },
    talk: { n: life.counselling },
  };
  const fill = (s: string, v: Record<string, string> = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const quests = questsData.quests.map((q) => {
    const c = copy[q.id]!;
    return { ...q, stat: q.stat as Stat, title: c.title, summary: c.summary, proof: fill(c.proof, params[q.id]) };
  });
  const byId = (id: string) => quests.find((q) => q.id === id)!;
  const statName = (s: Stat) => t(`stats.${s}.name`);

  const paths = questsData.paths.map((p) => ({
    id: p.id,
    label: t(`hero.paths.${p.id as "building"}`),
    stats: p.stats as Record<Stat, number>,
    quests: p.quests.map((id) => {
      const q = byId(id);
      return { id: q.id, title: q.title, stat: q.stat, href: q.href };
    }),
  }));

  const rank = (id: string) => nirf.ranks.find((r) => r.id === id);
  const university = rank("university");
  const engineering = rank("engineering");
  const camber = studentWork.find((s) => s.slug.startsWith("camber"));
  const swift = studentWork.find((s) => s.slug.startsWith("swift"));
  const proofs = [
    university ? { big: `#${university.rank}`, label: t("proof.nirf", { year: nirf.year, category: university.label }) } : null,
    engineering ? { big: `#${engineering.rank}`, label: t("proof.nirf", { year: nirf.year, category: engineering.label }) } : null,
    { big: naacGrade, label: t("proof.naac") },
    stat("offers") ? { big: stat("offers")!.display, label: t("proof.offers", { season: placements.season }) } : null,
    stat("highest-ctc") ? { big: stat("highest-ctc")!.display, label: t("proof.highest", { season: placements.season }) } : null,
    research("patents") ? { big: research("patents")!.display, label: t("proof.patents") } : null,
    research("publications") ? { big: research("publications")!.display, label: t("proof.publications") } : null,
  ].filter((p): p is { big: string; label: string } => !!p);
  const wins = [camber ? { title: camber.title, href: `/stories/${camber.slug}` } : null, swift ? { title: swift.title, href: `/stories/${swift.slug}` } : null].filter(
    (w): w is { title: string; href: string } => !!w,
  );

  const photos = [
    ...campuses.filter((c) => c.kind === "campus").map((c) => ({ key: c.slug, src: c.photo, caption: c.name, href: `/campuses/${c.slug}` })),
    ...studentLife.events.slice(0, 4).map((e) => ({ key: e.slug, src: e.photo, caption: e.name, href: "/student-life#student-affairs" })),
  ];

  const camberQuest = byId("camber");

  // The hero ring: quest cards and kolam tiles, alternating (decorative copies of the quests below).
  const ringItems = quests.slice(0, 6).flatMap((q, i) => [
    <div key={q.id} className="grail-mini">
      <Kolam variant={STAT_KOLAM[q.stat]} color={STAT_COLOR[q.stat]} className="size-9" />
      <p className="mt-3 text-[11px] font-semibold text-[#555]">{t("board.raises", { stat: statName(q.stat) })}</p>
      <p className="mt-1 text-[17px] leading-tight font-bold">{q.title}</p>
      <p className="mt-2 text-[11px] leading-snug text-[#555]">{q.proof}</p>
    </div>,
    <Kolam key={`k${i}`} variant={KOLAMS[i % 4]!} color={STAT_COLOR[STATS[(i + 1) % 4]!]} className="grail-tile" />,
  ]);

  const statNames = Object.fromEntries(STATS.map((s) => [s, statName(s)])) as Record<Stat, string>;
  const announce = Object.fromEntries(
    paths.map((p) => [p.id, t("hero.announce", { path: p.label, quests: p.quests.map((q) => q.title).join(", ") })]),
  );
  let chapter = 0;
  const corner = (kicker: string) => (
    <div className="flex justify-between gap-4 text-sm font-medium opacity-80">
      <span>{kicker}</span>
      <span className="shrink-0">{t("level", { n: String(++chapter).padStart(2, "0") })}</span>
    </div>
  );

  return (
    <div data-grail className="bg-[var(--bg)] text-[var(--fg)]">
      <GrailMotion />
      <IntroGate label={t("intro.label")} hint={t("intro.hint")} skip={t("intro.skip")} loading={t("intro.loading")} />

      {/* ── 01 Hero: the title over a turning ring of quests around SRM's emblem ── */}
      <section aria-labelledby="grail-title" data-tone="hero" className="grail-stack grail-hero relative overflow-hidden pb-12">
        <div className="site-container relative z-10 pt-6">
          {corner(t("hero.kicker"))}
          <Rise as="h1" id="grail-title" onLoad text={t("hero.title")} className="mt-4 text-center text-[clamp(3.4rem,11vw,8.75rem)]" />
        </div>
        {/* Title, then the ring with SRM's emblem, then the words and buttons: the cards never cover any text. */}
        <HeroRing
          items={ringItems}
          center={<Image src={emblem} alt="" priority sizes="(min-width: 1024px) 260px, 150px" className="size-full" />}
          pause={t("hero.ringPause")}
          play={t("hero.ringPlay")}
        />
        <div className="site-container relative z-10">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <p className="grail-num text-2xl tracking-wide text-[var(--action)]">Learn. Leap. Lead.</p>
            <p className="max-w-xl text-lg text-[var(--fg-muted)]">{t("hero.lead")}</p>
            {/* A/B test "hero-cta" (lib/ab.ts). A: the game-style run button first. B: search first ("What do you want to
                become?"), which opens the programme finder with the words already in it. */}
            <div data-ab="hero-cta" data-ab-variant="a" data-ab-goal="hero-cta" className="flex flex-wrap justify-center gap-3">
              <Link href="/admissions#apply" className="grail-cta">
                {t("hero.start")}
              </Link>
              <Link href="/programmes" className="inline-flex min-h-12 items-center rounded-full border border-[var(--line)] bg-black/40 px-6 font-semibold text-[var(--fg)] no-underline backdrop-blur hover:border-[var(--fg)]">
                {t("hero.find")}
              </Link>
              <Link href="/walk" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--line)] bg-black/40 px-6 font-semibold text-[var(--fg)] no-underline backdrop-blur hover:border-[var(--fg)]">
                <span aria-hidden="true">🎮</span>
                {walk("promo.heroCta")}
              </Link>
            </div>
            <div data-ab="hero-cta" data-ab-variant="b" data-ab-goal="hero-cta" className="flex w-full max-w-xl flex-col items-center gap-3">
              <p aria-hidden="true" className="grail-display text-[clamp(1.6rem,3.4vw,2.4rem)] leading-tight">
                {hero("title")}
              </p>
              <form role="search" action={locale === "en" ? "/programmes" : `/${locale}/programmes`} className="flex w-full items-center gap-2 rounded-full border border-white/25 bg-black/50 p-1.5 pl-5 backdrop-blur focus-within:border-[var(--fg)]">
                <label htmlFor="hero-ask" className="sr-only">
                  {hero("inputLabel")}
                </label>
                <input
                  id="hero-ask"
                  name="q"
                  type="search"
                  autoComplete="off"
                  maxLength={120}
                  placeholder={`${(hero.raw("examples") as string[]).slice(0, 3).join(" · ")}…`}
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)]"
                />
                <button type="submit" className="grail-cta min-h-11 shrink-0 px-5">
                  {hero("submit")}
                </button>
              </form>
              <div className="flex flex-wrap justify-center gap-x-6">
                <Link href="/admissions#apply" className="inline-flex min-h-11 items-center font-semibold text-[var(--fg)] underline underline-offset-4">
                  {t("hero.start")} →
                </Link>
                <Link href="/walk" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[var(--fg)] underline underline-offset-4">
                  <span aria-hidden="true">🎮</span>
                  {walk("promo.heroCta")} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 Learn. Leap. Lead.: SRM's tagline as the site's three acts (black). Each word leads to its part of the site. ── */}
      <section aria-labelledby="grail-slogan" data-tone="dark" className="relative bg-black py-20 lg:py-28">
        <div className="site-container">
          {corner(t("slogan.kicker"))}
          <Rise id="grail-slogan" text={t("slogan.title")} className="mt-4 text-[clamp(3rem,10vw,9rem)]" />
          <p className="mt-4 max-w-xl text-lg text-[var(--fg-muted)]">{t("slogan.intro")}</p>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {(
              [
                { k: "learn", href: "/programmes", kolam: "lattice", color: "var(--stat-think)" },
                { k: "leap", href: "#grail-board", kolam: "rings", color: "var(--stat-build)" },
                { k: "lead", href: "#grail-proof", kolam: "petals", color: "var(--stat-connect)" },
              ] as const
            ).map((a, i) => (
              <li key={a.k} className="flex flex-col gap-4 rounded-[28px] border border-white/15 bg-white/[0.04] p-6">
                <div className="flex items-center gap-4">
                  <Kolam variant={a.kolam} color={a.color} className="size-14 shrink-0" />
                  <span aria-hidden="true" className="grail-num text-6xl text-white/25">{i + 1}</span>
                </div>
                <h3 className="grail-num text-4xl uppercase">{t(`slogan.${a.k}.name`)}</h3>
                <p className="text-[var(--fg-muted)]">{t(`slogan.${a.k}.line`, { n: programmes.length, c: colleges.length })}</p>
                <Link href={a.href} className="mt-auto inline-flex min-h-11 items-center font-semibold text-[var(--fg)] underline underline-offset-4">
                  {t(`slogan.${a.k}.cta`)} →
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 02 Quest accepted, clock's running (lilac). On large screens it pins, and an ink blot spreads out of the
          black until the whole screen is lilac; elsewhere, or with reduced motion, it is simply there. ── */}
      <section aria-labelledby="grail-clock" data-tone="lilac" className="grail-ink relative z-[1]">
        <div className="grail-ink-pin">
          <div className="grail-ink-layer grail-lilac">
            <div className="site-container flex h-full flex-col pt-20 pb-10 lg:pt-24">
              {corner(t("clock.kicker"))}
              <Rise id="grail-clock" text={t("clock.title")} className="mx-auto mt-2 max-w-5xl text-center text-[clamp(2.4rem,5.6vw,5.25rem)]" />
              <div className="relative my-6 flex min-h-[18rem] flex-1 items-center justify-center lg:my-4">
                <ChennaiClock className="grail-clock" />
                <div className="grail-phone">
                  <div aria-hidden="true" className="grail-phone-frame">
                    <span className="grail-phone-notch" />
                    <span className="grail-phone-bar" />
                  </div>
                  <div className="grail-phone-card">
                    <Kolam variant={STAT_KOLAM[camberQuest.stat]} color={STAT_COLOR[camberQuest.stat]} className="size-10" />
                    <p className="mt-2 text-[11px] font-semibold text-[#555]">{t("board.raises", { stat: statName(camberQuest.stat) })}</p>
                    <p className="mt-1 text-[clamp(1rem,1.5vw,1.3rem)] leading-tight font-bold text-[#000]">{camberQuest.title}</p>
                    <p className="mt-2 text-[11px] leading-snug text-[#555]">{camberQuest.summary}</p>
                    <p className="mt-3 border-t border-[#e2e2e2] pt-2 text-[10px] font-semibold text-[#555]">{camberQuest.proof}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 border-t border-[var(--line)] pt-5 md:grid-cols-2 md:gap-16">
                <p className="max-w-xl text-lg leading-snug font-semibold">{t("clock.lead")}</p>
                <div className="flex flex-col items-start gap-3">
                  <p className="max-w-xl">{t("clock.side")}</p>
                  <a href="#grail-path" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                    {t("clock.cta")} →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 Your character (sheet) ── */}
      <section aria-labelledby="grail-path" data-tone="light" className="grail-stack grail-sheet">
        <div className="site-container py-16 lg:py-24">
          {corner(t("hero.pathKicker"))}
          <Rise id="grail-path" text={t("hero.pathTitle")} className="mt-4 text-[clamp(2.8rem,8vw,7rem)]" />
          <div className="mt-10">
            <CharacterCard
              paths={paths}
              crest={<Kolam variant="flower" color="var(--stat-grow)" className="size-full" />}
              strings={{
                legend: t("hero.pickLegend"),
                name: t("hero.cardName"),
                year: t("hero.cardYear"),
                // The card fills in {n} itself as the level changes.
                level: t.raw("hero.levelPill") as string,
                levelUp: t("hero.levelUp"),
                xp: t("hero.xp"),
                empty: t("hero.empty"),
                firstQuests: t("hero.firstQuests"),
                statNames,
                announce,
              }}
            />
          </div>
        </div>
      </section>

      {/* ── 03 The four stats (lilac) ── */}
      <section aria-labelledby="grail-stats" data-tone="lilac" className="grail-stack grail-lilac">
        <div className="site-container py-16 lg:py-24">
          {corner(t("stats.kicker"))}
          <Rise id="grail-stats" text={t("stats.title")} className="mt-4 max-w-5xl text-[clamp(2.8rem,8vw,7rem)]" />
          <p className="mt-4 max-w-xl text-lg">{t("stats.intro")}</p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => {
              const list = quests.filter((q) => q.stat === s);
              return (
                <li key={s} className="grail-stat flex flex-col rounded-[28px] bg-[#F5F5F5] p-5 text-black">
                  <Kolam variant={STAT_KOLAM[s]} color={STAT_COLOR[s]} className="aspect-square w-24" />
                  <h3 className="grail-display mt-5 text-5xl">{statName(s)}</h3>
                  <p className="mt-2 text-[#555]">{t(`stats.${s}.line`)}</p>
                  <details className="group mt-auto pt-5">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-black px-4 font-semibold">
                      {t("stats.open", { n: list.length })}
                      <span aria-hidden="true" className="transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <ul className="mt-3 flex flex-col">
                      {list.map((q) => (
                        <li key={q.id}>
                          <Link href={q.href} className="flex min-h-11 items-center py-1 font-semibold text-black underline-offset-4 hover:underline">
                            {q.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── 04 Quest board (black) ── */}
      <section aria-labelledby="grail-board" data-tone="dark" className="grail-stack bg-black py-20 lg:py-28">
        <div className="site-container">
          {corner(t("board.kicker"))}
          <Rise id="grail-board" text={t("board.title")} className="mt-4 text-[clamp(2.8rem,8vw,7rem)]" />
          <p className="mt-4 max-w-xl text-lg text-[var(--fg-muted)]">{t("board.intro")}</p>
        </div>
        <ul
          aria-label={t("board.label")}
          tabIndex={0}
          className="grail-board mt-10 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-4 pb-8 md:scroll-px-8 md:px-8 lg:scroll-px-12 lg:px-12"
        >
          {quests.map((q, i) => (
            <li key={q.id} className="w-[78vw] max-w-[20rem] shrink-0 snap-start" style={{ "--tilt": `${i % 2 ? 1.6 : -1.6}deg` } as React.CSSProperties}>
              {/* The title is the link and stretches over the card, so a photo's own credit link stays a separate link. */}
              <article className="grail-quest relative flex h-full flex-col overflow-hidden rounded-[24px] bg-[#F5F5F5] text-black focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[var(--focus)]">
                <Photo src={q.photo} alt="" decorative sizes="320px" className="aspect-[16/10] w-full" />
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#555]">
                    <Kolam variant={STAT_KOLAM[q.stat]} color={STAT_COLOR[q.stat]} className="size-6" />
                    {t("board.raises", { stat: statName(q.stat) })}
                  </p>
                  <h3 className="text-2xl leading-tight font-bold">
                    <Link href={q.href} className="text-black no-underline outline-none after:absolute after:inset-0 after:content-['']">
                      {q.title}
                    </Link>
                  </h3>
                  <p className="text-[#555]">{q.summary}</p>
                  <p className="mt-auto pt-3 text-sm">
                    <span className="mr-2 rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-[#F5F5F5]">{t("board.proof")}</span>
                    {q.proof}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 05 Proof (sheet) ── */}
      <section id={SECTION.rankings} aria-labelledby="grail-proof" data-tone="light" className="grail-stack grail-sheet scroll-mt-16">
        <div className="site-container py-16 lg:py-24">
          {corner(t("proof.kicker"))}
          <Rise id="grail-proof" text={t("proof.title")} className="mt-4 text-[clamp(2.8rem,8vw,7rem)]" />
          <p className="mt-4 max-w-xl text-lg text-[var(--fg-muted)]">{t("proof.intro")}</p>
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {proofs.map((p) => (
              <div key={p.label} className="flex flex-col-reverse gap-1 border-t border-black/30 pt-3">
                <dt className="font-medium text-[#555]">{p.label}</dt>
                <dd className="grail-display text-[clamp(2.4rem,5.5vw,4.5rem)]">{p.big}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {wins.map((w) => (
              <li key={w.href}>
                <Link href={w.href} className="inline-flex min-h-12 items-center gap-3 rounded-full bg-black px-5 py-2 font-semibold text-[#F5F5F5] no-underline">
                  <Kolam variant="flower" color="var(--stat-think)" className="size-6 shrink-0" />
                  {w.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm">
            <a href={nirf.source} className="inline-flex min-h-11 items-center font-semibold text-black underline underline-offset-4">
              {t("proof.source", { year: nirf.year })}
            </a>
          </p>
        </div>
      </section>

      {/* ── 06 Campus, in motion (black) ── */}
      <section aria-labelledby="grail-media" data-tone="dark" className="grail-stack bg-black py-20 lg:py-28">
        <div className="site-container">
          {corner(t("media.kicker"))}
          <Rise id="grail-media" text={t("media.title")} className="mt-4 text-[clamp(2.8rem,8vw,7rem)]" />
        </div>
        <ul aria-label={t("media.label")} tabIndex={0} className="grail-strip mt-10 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-6 md:scroll-px-8 md:px-8 lg:scroll-px-12 lg:px-12">
          {photos.map((p, i) => (
            <li key={p.key} className={`group relative shrink-0 snap-start ${i % 3 === 0 ? "w-[70vw] max-w-[26rem]" : "w-[56vw] max-w-[19rem]"}`}>
              <Photo src={p.src} alt="" decorative sizes="(min-width: 768px) 26rem, 70vw" className={`w-full rounded-[22px] ${i % 3 === 0 ? "aspect-[4/5]" : "aspect-square"}`} imgClassName="transition-transform duration-700 group-hover:scale-105" />
              {/* Stretched over the photo; a photo's credit link sits above it and still works. */}
              <Link href={p.href} className="mt-3 block font-semibold text-[var(--fg)] underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']">
                {p.caption}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 07 Where will you study? Our campus map: fly to a campus, see how far it is from home, then walk
          through it in 360° or VR, all in the page. It slides up over the photo strip like the other sheets. ── */}
      <section id={SECTION.explore} aria-labelledby="explore-title" data-tone="dark" className="grail-map relative z-[1] -mt-9 scroll-mt-16 rounded-t-[36px] border-t border-white/15 bg-[#0a0a0a]">
        <div className="site-container py-16 lg:py-24">
          {corner(nav("ourCampuses"))}
          <Rise id="explore-title" text={ex("title")} className="mt-4 text-[clamp(2.8rem,8vw,7rem)]" />
          <p className="mt-4 max-w-2xl text-lg text-[var(--fg-muted)]">{ex("intro")}</p>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {(["f1", "f2", "f3"] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4 font-semibold">
                <Kolam variant={KOLAMS[(i + 2) % 4]!} color={STAT_COLOR[STATS[(i + 2) % 4]!]} className="size-10 shrink-0" />
                {t(`explore.${k}`)}
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <CampusExplorer campuses={map.campuses} clusters={map.clusters} groups={map.groups} states={getCities(locale)} aspect={mapAspect} mapSrc="/map/india.svg" />
          </div>
          <p className="mt-6 text-xs text-[var(--fg-muted)]">{ex("mapCredit")}</p>
          {/* Walk SRM: the campus as a small walkable world (/walk). */}
          <div className="mt-10 grid items-center gap-6 overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-[#1f4fd8]/25 via-[#14101a] to-[#623562]/40 p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:p-10">
            <Link href="/walk" className="block overflow-hidden rounded-2xl border border-white/15 md:order-2" tabIndex={-1} aria-hidden="true">
              <Image src="/walk/cover-gate.jpg" alt={walk("promo.imageAlt")} width={1200} height={630} sizes="(min-width: 768px) 40vw, 100vw" className="h-auto w-full transition-transform duration-500 hover:scale-[1.03]" />
            </Link>
            <div>
              <p className="text-sm font-semibold text-[#ffd166]">{walk("promo.kicker")}</p>
              <h3 className="grail-display mt-2 text-[clamp(2rem,4.5vw,3.5rem)] leading-none">{walk("promo.title")}</h3>
              <p className="mt-3 max-w-xl text-[var(--fg-muted)]">{walk("promo.text")}</p>
              <Link href="/walk" className="grail-cta mt-6 w-fit">
                {walk("promo.cta")} ▸
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 08 Start your run (lilac) ── */}
      <section aria-labelledby="grail-start" data-tone="lilac" className="grail-lilac relative z-[2] -mt-9 rounded-t-[36px]">
        <div className="site-container py-16 lg:py-24">
          {corner(t("start.kicker"))}
          <Rise id="grail-start" text={t("start.title")} className="mt-4 text-[clamp(3.2rem,10vw,9rem)]" />
          <p className="mt-4 max-w-xl text-lg">{t("start.intro")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admissions#apply" className="grail-cta grail-cta-ink">
              {t("start.apply")}
            </Link>
            <Link href="/admissions#enquiry" className="inline-flex min-h-12 items-center rounded-full border border-current px-6 font-semibold text-[var(--fg)] no-underline">
              {t("start.enquire")}
            </Link>
            {site.admissions.phones.slice(0, 1).map((p) => (
              <a key={p.tel} href={`tel:${p.tel}`} className="inline-flex min-h-12 items-center rounded-full border border-current px-6 font-semibold text-[var(--fg)] no-underline">
                {t("start.call")}: {p.display}
              </a>
            ))}
          </div>
          {/* The programme finder: the same search as before, so "what do you want to become?" still works here. */}
          <div className="mt-10 max-w-4xl">
            <h3 className="text-xl font-semibold">{t("start.findTitle")}</h3>
            <HeroSearch
              counts={{ programmes: programmes.length, colleges: colleges.length, campuses: campuses.filter((c) => c.kind === "campus").length }}
              phones={site.admissions.phones.slice(0, 2)}
            />
          </div>
        </div>
      </section>

      {/* The floating dock (desktop): one action, always in reach; it takes the colours of the section under it. */}
      <Link href="/admissions#apply" className="grail-dock" data-on="hero">
        <span aria-hidden="true" className="grail-dock-mark">
          <Kolam variant="flower" color="var(--stat-grow)" className="size-full" />
        </span>
        <span>{t("dock")}</span>
      </Link>
    </div>
  );
}
