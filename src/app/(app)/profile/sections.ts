import type { CustomSection } from "@/lib/profile";
import { customKey, DEFAULT_SECTION_LAYOUT, profileRows } from "@/lib/resume-sections";

/**
 * The profile's sections, in the order they start in. Each one that goes on a
 * resume is one heading there, in the resume's usual order; Basics and the
 * Facts aren't headings. Optional ones don't count towards Profile strength (#216).
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
    id: "summary",
    optional: false,
    label: "Zusammenfassung",
    title: "Zusammenfassung",
    hint: "Was du machst, worin du gut bist und wonach du suchst. Jede Bewerbung bekommt ihre eigene Fassung.",
  },
  {
    id: "experience",
    optional: false,
    label: "Berufserfahrung",
    title: "Berufserfahrung",
    hint: "Füge die Positionen hinzu, auf die du stolz bist. Grobe Stichpunkte reichen völlig: Jede Bewerbung bekommt ihre eigene, polierte Fassung.",
  },
  {
    id: "volunteering",
    optional: true,
    label: "Ehrenamt",
    title: "Ehrenamt",
    hint: "Unbezahlte Arbeit für eine Sache oder Gemeinschaft. Lebensläufe zeigen es getrennt von deinen Jobs, und es zählt nicht zu deinen Berufsjahren.",
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
    hint: "Abschlüsse und Kurse: alles, was deine Geschichte erzählt. Zertifikate haben einen eigenen Abschnitt.",
  },
  {
    id: "certifications",
    optional: true,
    label: "Zertifikate",
    title: "Zertifikate",
    hint: "Zertifikate und Lizenzen, mit Aussteller und Prüfmöglichkeit. Sie kommen wörtlich in den Lebenslauf, in der Reihenfolge, die du hier festlegst.",
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
    id: "skills",
    optional: false,
    label: "Fähigkeiten",
    title: "Fähigkeiten",
    hint: "Eine eingeben und Enter drücken. Ordne sie dann unter Berufserfahrung deinen Positionen zu, damit die KI weiß, wo du sie eingesetzt hast.",
  },
  {
    id: "languages",
    optional: true,
    label: "Sprachen",
    title: "Sprachen",
    hint: "Die Sprachen, die du sprichst, und wie gut.",
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
/** A section the user made (#298). */
export type CustomSectionId = `custom:${string}`;
export type ProfileSectionId = SectionId | CustomSectionId;
/** What the Profile page can show: a section, or the form that adds one (#338). */
export type ProfilePage = ProfileSectionId | "new";

export type NavSection = { id: ProfileSectionId; optional: boolean; label: string; title: string; hint: string };

/** The sections in the nav's order, which is also the order new resumes start with. */
export function navSections(customSections: readonly CustomSection[], order: readonly string[] = DEFAULT_SECTION_LAYOUT.order): NavSection[] {
  const custom = customSections.map(
    (section): NavSection => ({
      id: `custom:${section.id}`,
      optional: true,
      label: section.title.trim() || "Abschnitt ohne Titel",
      title: section.title.trim() || "Abschnitt ohne Titel",
      hint: "Ein eigener Abschnitt. Er kommt so in den Lebenslauf, wie du ihn schreibst.",
    }),
  );
  const all: readonly NavSection[] = [...SECTIONS, ...custom];
  return profileRows(order, customSections.map((section) => customKey(section.id))).flatMap((key) => all.find((section) => section.id === key) ?? []);
}

/** The section in `?section=`, or Basics when it's missing or unknown. */
export function sectionFromParam(value: string | string[] | undefined, customSections: readonly CustomSection[] = []): ProfilePage {
  if (value === "new") return "new";
  return navSections(customSections).find((section) => section.id === value)?.id ?? "basics";
}

export const sectionHref = (id: ProfilePage) => `/profile?section=${id}`;
