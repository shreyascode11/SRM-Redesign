export type NavLink = { label: string; href: string };

export type NavGroup = { title: string; links: NavLink[] };

export type NavSection = {
  id: "study" | "research" | "student-work" | "campuses" | "about";
  label: string;
  intro: string;
  groups: NavGroup[];
  feature?: { eyebrow: string; title: string; href: string };
};

export type NavData = {
  sections: NavSection[];
  apply: NavLink;
  /** The 3D campus game (/walk). */
  play: NavLink;
  enquiry: NavLink;
  call: { label: string; display: string; tel: string };
  compare: NavLink;
  labels: { primary: string; home: string; menu: string; close: string; language: string; external: string; apply: string };
};
