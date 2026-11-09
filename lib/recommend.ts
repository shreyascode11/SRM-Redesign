/**
 * "Programmes like this", free and instant: content-based recommendations from the programme tags (no AI service,
 * no tracking, no server). Pure module, so it runs on the server (programme pages) and in the browser (the finder's
 * "Suggested for you", built from what you pinned and viewed, kept only on your device).
 */
type Rec = { slug: string; college: string; level: string; tags: string[] };

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const inter = b.filter((t) => A.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
};

/** The programmes most like `seeds`, best first, each with the tags that made it a match. */
export function recommend<T extends Rec>(all: T[], seeds: T[], limit = 3): { item: T; because: string[] }[] {
  const seedSlugs = new Set(seeds.map((s) => s.slug));
  const seedTags = [...new Set(seeds.flatMap((s) => s.tags))];
  return all
    .filter((p) => !seedSlugs.has(p.slug))
    .map((p) => {
      const because = p.tags.filter((t) => seedTags.includes(t));
      const score =
        2 * jaccard(p.tags, seedTags) + (seeds.some((s) => s.college === p.college) ? 0.35 : 0) + (seeds.some((s) => s.level === p.level) ? 0.1 : 0);
      return { item: p, because: because.slice(0, 3), score };
    })
    .filter((r) => r.because.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, because }) => ({ item, because }));
}
