/** Homepage section anchors. Nav, footer and the act components all use these, so links never drift. */
export const SECTION = {
  main: "main",
  learn: "learn",
  rankings: "rankings",
  leap: "leap",
  studentWork: "student-work",
  startups: "startups",
  research: "research",
  lead: "lead",
  alumni: "alumni",
  placements: "placements",
  explore: "explore",
  thisWeek: "this-week",
} as const;

export const missionAnchor = (slug: string) => `research-${slug}`;

/**
 * Where each of those things lives now. The homepage is chapters, so the deep content has its own pages:
 * rankings stay on the homepage, research missions and numbers on /research, stories and alumni on /stories.
 * Nav, footer and pages link through these, and the link check in scripts/check-links.mjs keeps them honest.
 */
export const HREF = {
  rankings: `/#${SECTION.rankings}`,
  research: `/research#${SECTION.research}`,
  researchNumbers: "/research#research-numbers",
  mission: (slug: string) => `/research#${missionAnchor(slug)}`,
  stories: "/stories",
  studentWork: `/stories#${SECTION.studentWork}`,
  alumni: `/stories#${SECTION.alumni}`,
  thisWeek: `/stories#${SECTION.thisWeek}`,
} as const;
