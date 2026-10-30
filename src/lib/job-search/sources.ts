import type { JobSource, JSearchHost } from "./search";

/** What Settings → Job search may know about a source's key: never the key itself. "env" means it comes from the environment. */
export type JobKeyState = "none" | "set" | "unreadable" | "env";

/** What the Job search section starts from (E14-4). */
export type JobSearchSettingsView = {
  source: JobSource | "OFF";
  jsearch: { host: JSearchHost; keyState: JobKeyState };
  adzuna: { appId: string; keyState: JobKeyState };
  /** Whether this server offers the Bundesagentur für Arbeit, and when its note was accepted (#223). */
  arbeitsagentur: { offered: boolean; acceptedAt: string | null };
  /** The FreeHire it searches: "freehire.me", or a self-hosted one's host (DOSSIER_FREEHIRE_URL). */
  freehire: { host: string };
};

export const JOB_KEY_UNREADABLE = "Dein gespeicherter Schlüssel ist nicht lesbar. Bitte gib ihn neu ein.";

/** Where to get a JSearch key, by where it's from. */
export const JSEARCH_KEY_URLS: Record<JSearchHost, string> = {
  openwebninja: "https://www.openwebninja.com/api/jsearch",
  rapidapi: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
};

/** How Settings → Job search and the Find jobs screen describe each source (E14). */
export type SourceInfo = {
  name: string;
  /** What it covers, in a line. */
  description: string;
  /** Cost and reach at a glance. */
  tag: string;
  /** Where to get a key; null when none is needed. */
  keyUrl: string | null;
  /** When used-up searches come back: "this month", "today"; null when there's no quota. */
  quotaPeriod: string | null;
  /** Shown with its results, as the source's terms ask. */
  attribution: string | null;
  /**
   * Where the attribution links, when the terms ask for a link: the source's
   * site for the posting's country when its link is on one (`local`), else
   * `home`. Null for a plain-text attribution.
   */
  attributionLink: { home: string; local: RegExp } | null;
  /** The countries it lists jobs in (ISO codes); null for every country. */
  countries: readonly string[] | null;
  /** Whether it looks within a distance of the place; without, the place only puts postings there first. */
  radius: boolean;
};

export const SOURCE_INFO: Record<JobSource, SourceInfo> = {
  JSEARCH: {
    name: "JSearch",
    description: "Anzeigen von LinkedIn, Indeed, Glassdoor und Firmenseiten, über Google for Jobs.",
    tag: "Die meisten Länder · kostenloser Schlüssel mit 200 Suchen im Monat",
    keyUrl: "https://www.openwebninja.com/api/jsearch",
    quotaPeriod: "diesen Monat",
    attribution: null,
    attributionLink: null,
    countries: null,
    radius: true,
  },
  ADZUNA: {
    name: "Adzuna",
    description: "Adzunas eigener Jobindex in 19 Ländern. Liefert nur den Anfang jeder Anzeige.",
    tag: "19 Länder · kostenloser Schlüssel, etwa 250 Suchen am Tag",
    keyUrl: "https://developer.adzuna.com/signup",
    quotaPeriod: "heute",
    attribution: "Jobs by Adzuna",
    // Its terms: "Adzuna" on each displayed advert, at least 116 × 23 px, linked to adzuna.co.uk or the local site.
    attributionLink: { home: "https://www.adzuna.co.uk", local: /^www\.adzuna\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/ },
    countries: ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"],
    radius: true,
  },
  ARBEITSAGENTUR: {
    name: "Bundesagentur für Arbeit",
    description: "Die Jobbörse der Bundesagentur für Arbeit, mit vollständigen Anzeigen. Inoffiziell: Nutzung auf eigene Verantwortung.",
    tag: "Nur Deutschland · kostenlos, kein Schlüssel · inoffiziell",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Quelle: Bundesagentur für Arbeit",
    attributionLink: null,
    countries: ["de"],
    radius: true,
  },
  FREEHIRE: {
    name: "FreeHire",
    description: "Vor allem Tech-Anzeigen, direkt von Karriereseiten (Greenhouse, Lever, Workday und mehr), mit vollständigen Anzeigen.",
    tag: "Die meisten Länder · kostenlos, kein Schlüssel · kein Umkreisfilter",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Jobs by FreeHire",
    attributionLink: null,
    countries: null,
    // It has a city filter, but only for the names it knows, and a country with it widens rather than narrows.
    radius: false,
  },
};

/** FreeHire's public catalogue; DOSSIER_FREEHIRE_URL can name a self-hosted one instead. */
export const FREEHIRE_URL = "https://freehire.me";

/** Whether a source lists jobs in a country ("de"). */
export function sourceCovers(source: JobSource, country: string): boolean {
  const countries = SOURCE_INFO[source].countries;
  return countries === null || countries.includes(country);
}

// The Bundesagentur für Arbeit (#223) has no official API: Dossier uses the
// access its own job search uses, without its permission. So it's the
// user's own choice, after this note, and a server can turn it off
// (DOSSIER_JOBS_ARBEITSAGENTUR=off).

/** The BA's terms of use for arbeitsagentur.de. */
export const ARBEITSAGENTUR_TERMS_URL = "https://www.arbeitsagentur.de/datei/nutzungsbedingungen_ba036575.pdf";

/** What "I understand" agrees to, in Settings, in Find jobs and in the server log. */
export const ARBEITSAGENTUR_NOTE =
  "Die Bundesagentur für Arbeit hat keine offizielle API. Dossier durchsucht sie über den Zugang, den ihre eigene Jobsuche nutzt, ohne ihre Erlaubnis, " +
  "und die Nutzungsbedingungen der BA erlauben keinen automatisierten Zugriff. Du wählst diese Quelle auf eigene Verantwortung, und sie kann jederzeit aufhören zu funktionieren.";

/** A BA posting's own page on arbeitsagentur.de, which its results always link to, even when they have a link of their own. */
export function arbeitsagenturPage(posting: { source: JobSource; externalId: string }): string | null {
  return posting.source === "ARBEITSAGENTUR" ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(posting.externalId)}` : null;
}

/** Where a posting's attribution links (www.adzuna.de for one of Adzuna's German postings); null when it's plain text. */
export function attributionHref(source: JobSource, postingUrl: string): string | null {
  const link = SOURCE_INFO[source].attributionLink;
  if (!link) return null;
  const host = URL.canParse(postingUrl) ? new URL(postingUrl) : null;
  return host?.protocol === "https:" && link.local.test(host.hostname) ? host.origin : link.home;
}
