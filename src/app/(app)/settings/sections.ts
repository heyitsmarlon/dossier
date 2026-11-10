/** The settings sections, in order (PRD §6.8). */
export const SETTINGS_SECTIONS = [
  { id: "ai", label: "KI-Anbieter" },
  { id: "jobs", label: "Jobsuche" },
  { id: "scoring", label: "Bewertung" },
  { id: "agent", label: "Job-Agent" },
  { id: "documents", label: "Unterlagen" },
  { id: "google", label: "Google" },
  { id: "connector", label: "MCP-Connector" },
  { id: "data", label: "Deine Daten" },
  { id: "about", label: "Über" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The section in `?section=`, or AI provider when it's missing or unknown; "claude" is the MCP connector's old name (#281). */
export function settingsSectionFromParam(value: string | string[] | undefined): SettingsSectionId {
  if (value === "claude") return "connector";
  return SETTINGS_SECTIONS.find((section) => section.id === value)?.id ?? "ai";
}

export const settingsSectionHref = (id: SettingsSectionId) => `/settings?section=${id}`;
