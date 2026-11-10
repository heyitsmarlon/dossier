import { WIKI, type Instruction } from "./instructions";

// The setup guide's job search step (E21-3): what kind of jobs, then the
// source for it, with how to get its free key. The Bundesagentur für Arbeit
// isn't here: it's unofficial, and chosen in Settings with its note.

export type JobKind = "tech" | "any" | "none";

export const JOB_KINDS: readonly { value: JobKind; name: string; description: string }[] = [
  { value: "tech", name: "Vor allem Tech", description: "Software, Design, Daten und andere Rollen bei Tech-Firmen. Kein Schlüssel nötig." },
  { value: "any", name: "Jede Art von Job", description: "Alle Branchen, von den großen Jobbörsen. Braucht einen kostenlosen Schlüssel, das dauert ein paar Minuten." },
  { value: "none", name: "Vorerst keine", description: "Du fügst Anzeigen ein, die du selbst findest. „Jobs finden“ bleibt aus, bis du in den Einstellungen eine Quelle wählst." },
];

export type JobChoice = {
  source: "FREEHIRE" | "ADZUNA" | "JSEARCH";
  kind: Exclude<JobKind, "none">;
  name: string;
  about: string;
  cost: string;
  steps: readonly Instruction[];
};

export const JOB_CHOICES: readonly JobChoice[] = [
  {
    source: "FREEHIRE",
    kind: "tech",
    name: "FreeHire",
    about: "Anzeigen direkt von den Karriereseiten der Firmen, vor allem Tech, in den meisten Ländern, mit vollem Text.",
    cost: "Kostenlos für private Nutzung, ohne Schlüssel.",
    steps: [{ text: "Drück unten **FreeHire verwenden**. Das war’s." }],
  },
  {
    source: "ADZUNA",
    kind: "any",
    name: "Adzuna",
    about: "Adzunas eigener Jobindex in 19 Ländern. Er liefert den Anfang jeder Anzeige, den Rest liest Dossier von der Seite der Anzeige.",
    cost: "Ein kostenloser Schlüssel, ohne Kreditkarte. Dein Konto zeigt, wie viele Suchen er erlaubt.",
    steps: [
      {
        text: "Registriere dich als Adzuna-Developer. Das Formular fragt nach Organisation und Website: Wähle **Personal job search** als Verwendungszweck und gib eine eigene Seite an, etwa dein LinkedIn-Profil.",
        link: { href: "https://developer.adzuna.com/signup", label: "Adzuna-Registrierung" },
      },
      { text: "Dein Konto zeigt eine Application ID und einen Key. Kopier beide unten hinein." },
    ],
  },
  {
    source: "JSEARCH",
    kind: "any",
    name: "JSearch",
    about: "Anzeigen von LinkedIn, Indeed, Glassdoor und Firmenseiten, über Google for Jobs, in den meisten Ländern.",
    cost: "Ein kostenloser Tarif mit wenigen Suchen pro Monat, ohne Kreditkarte. Die Seite zeigt, wie viele.",
    steps: [
      { text: "Registriere dich im Developer-Portal von OpenWeb Ninja und wähle den kostenlosen JSearch-Tarif.", link: { href: "https://app.openwebninja.com", label: "OpenWeb Ninja" } },
      { text: "Kopier deinen API-Schlüssel und füge ihn unten ein." },
    ],
  },
];

export const JOB_SOURCES_HELP = `${WIKI}/Choosing-a-job-source`;
