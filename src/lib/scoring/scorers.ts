// What can score postings (#274): the AI model in Settings → AI provider,
// or TypeSafe's Jev. Shared by the server and Settings → Scoring.

export const SCORERS = ["AI", "JEV"] as const;
export type Scorer = (typeof SCORERS)[number];

/** Like the job sources' keys: saved here, from DOSSIER_TYPESAFE_KEY, missing, or saved under another DOSSIER_SECRET. */
export type ScoringKeyState = "none" | "set" | "unreadable" | "env";

/** What Settings → Scoring shows: the choice and the key's state, never the key. */
export type ScoringView = { scorer: Scorer; keyState: ScoringKeyState };

export const SCORER_INFO: Record<Scorer, { name: string; description: string; tag: string }> = {
  AI: {
    name: "Dein KI-Modell",
    description: "Der KI-Anbieter aus Einstellungen → KI-Anbieter bewertet jede Anzeige und begründet in eigenen Worten, warum sie passt.",
    tag: "Nutzt deinen KI-Anbieter",
  },
  JEV: {
    name: "Jev von TypeSafe",
    description: "Ein Modell für schnelle Urteile. Es beantwortet Fragen zur Anzeige, und Dossier baut Bewertung und Begründung aus Zeilen der Anzeige.",
    tag: "Braucht einen TypeSafe-Schlüssel",
  },
};

export const TYPESAFE_KEY_URL = "https://console.typesafe.ai/keys";

export const SCORING_KEY_MISSING = "Gib zuerst deinen TypeSafe-Schlüssel ein (Einstellungen → Bewertung).";
export const SCORING_KEY_UNREADABLE = "Dein gespeicherter TypeSafe-Schlüssel ist nicht lesbar. Gib ihn neu ein (Einstellungen → Bewertung).";
