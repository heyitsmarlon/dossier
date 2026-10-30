/**
 * The profile's sections, in order: skills come before experience so they can
 * be attached to roles. Optional ones don't count towards Profile strength (#216).
 */
export const SECTIONS = [
  {
    id: "basics",
    optional: false,
    label: "Basisdaten",
    title: "Basisdaten",
    hint: "Wie Arbeitgeber dich erreichen. Nur was du zeigen willst, landet im Lebenslauf.",
  },
  {
    id: "skills",
    optional: false,
    label: "Fähigkeiten & Sprachen",
    title: "Fähigkeiten & Sprachen",
    hint: "Eine eingeben und Enter drücken. Danach ordnest du sie unter Berufserfahrung jeder Position zu, damit die KI weiß, wo du sie eingesetzt hast.",
  },
  {
    id: "experience",
    optional: false,
    label: "Berufserfahrung",
    title: "Berufserfahrung",
    hint: "Füge die Positionen hinzu, auf die du stolz bist. Grobe Stichpunkte reichen völlig: Jede Bewerbung bekommt ihre eigene, polierte Fassung.",
  },
  {
    id: "projects",
    optional: true,
    label: "Projekte",
    title: "Projekte",
    hint: "Nebenprojekte, Open Source, Studienarbeiten oder eine Abschlussarbeit: Dinge, die du gebaut hast und die zeigen, was du kannst, gerade wenn deine Positionen das noch nicht sagen.",
  },
  {
    id: "education",
    optional: false,
    label: "Ausbildung",
    title: "Ausbildung",
    hint: "Abschlüsse, Kurse, Zertifikate: alles, was deine Geschichte erzählt.",
  },
  {
    id: "publications",
    optional: true,
    label: "Veröffentlichungen",
    title: "Veröffentlichungen",
    hint: "Aufsätze, Artikel, Bücher oder Kapitel, in deinem Zitierstil. Sie kommen wörtlich in den Lebenslauf, in der Reihenfolge, die du hier festlegst.",
  },
  {
    id: "references",
    optional: true,
    label: "Referenzen",
    title: "Referenzen",
    hint: "Menschen, die für dich bürgen. Sie bleiben privat, außer du nimmst sie auf.",
  },
  {
    id: "facts",
    optional: true,
    label: "Fakten über mich",
    title: "Fakten über mich",
    hint: "Was die KI über dich wissen sollte, das der Rest deines Profils nicht sagt. Sie liest das beim Schreiben von Lebensläufen und Anschreiben und kopiert es nie als Liste in einen Lebenslauf.",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** The section in `?section=`, or Basics when it's missing or unknown. */
export function sectionFromParam(value: string | string[] | undefined): SectionId {
  return SECTIONS.find((section) => section.id === value)?.id ?? "basics";
}

export const sectionHref = (id: SectionId) => `/profile?section=${id}`;
