/** The settings sections, in order (PRD §6.8). */
export const SETTINGS_SECTIONS = [
  { id: "ai", label: "KI-Anbieter" },
  { id: "jobs", label: "Jobsuche" },
  { id: "agent", label: "Job-Agent" },
  { id: "documents", label: "Unterlagen" },
  { id: "google", label: "Google" },
  { id: "claude", label: "Claude-Connector" },
  { id: "data", label: "Deine Daten" },
  { id: "about", label: "Über" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The section in `?section=`, or AI provider when it's missing or unknown. */
export function settingsSectionFromParam(value: string | string[] | undefined): SettingsSectionId {
  return SETTINGS_SECTIONS.find((section) => section.id === value)?.id ?? "ai";
}

export const settingsSectionHref = (id: SettingsSectionId) => `/settings?section=${id}`;
