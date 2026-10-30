import { countryName } from "./countries";
import type { JobSource } from "./search";
import { SOURCE_INFO } from "./sources";

// What can go wrong when searching a job source, in words people can act on
// (E14-1). A source's own error text never reaches the screen or the logs.

export type JobSearchProblem =
  /** The source isn't offered on this server (DOSSIER_JOBS_ARBEITSAGENTUR=off). */
  | "off"
  /** The Bundesagentur für Arbeit's note hasn't been accepted yet (#223). */
  | "not-accepted"
  /** No key saved for a source that needs one. */
  | "no-key"
  /** The source refused the key. */
  | "key"
  /** The plan's searches are used up. */
  | "quota"
  /** The source doesn't list jobs in that country. */
  | "country"
  /** The source can't be reached, or failed on its side. */
  | "unavailable"
  /** The source answered in a shape Dossier doesn't know: its API changed. */
  | "changed";

export class JobSearchError extends Error {
  override name = "JobSearchError";

  constructor(
    readonly problem: JobSearchProblem,
    message: string,
    /** For the server log: the source, the call and the status, never the search. */
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** The error for `problem` with `source`, worded for the screen. */
export function jobSearchError(problem: JobSearchProblem, source: JobSource, { country = "", detail }: { country?: string; detail?: string } = {}) {
  const { name, quotaPeriod } = SOURCE_INFO[source];
  const message = {
    off: `${name} wird auf diesem Server nicht angeboten. Wähle eine andere Quelle unter Einstellungen → Jobsuche.`,
    "not-accepted": `Read the note about ${name} and tick “I understand” before Dossier searches it.`,
    "no-key": `Trag zuerst deine${source === "ADZUNA" ? " App-ID und deinen Schlüssel" : "n Schlüssel"} für ${name} unter Einstellungen → Jobsuche ein.`,
    key: `${name} hat deinen Schlüssel nicht akzeptiert. Prüf ihn unter Einstellungen → Jobsuche.`,
    quota: quotaPeriod
      ? `Du hast deine Suchen bei ${name} für ${quotaPeriod} aufgebraucht. Versuch es dann wieder, oder wechsle in einen größeren Tarif.`
      : `${name} begrenzt gerade die Suchen. Warte eine Minute und versuch es noch einmal.`,
    country: `${name} listet keine Jobs in ${countryName(country)}. Wähle ein anderes Land oder eine andere Quelle unter Einstellungen → Jobsuche.`,
    unavailable: `${name} antwortet gerade nicht. Versuch es in einer Minute noch einmal.`,
    changed:
      source === "ARBEITSAGENTUR"
        ? "Die Jobsuche der Arbeitsagentur hat sich geändert oder antwortet nicht. Versuch eine andere Quelle unter Einstellungen → Jobsuche."
        : `${name} hat so geantwortet, dass Dossier es nicht versteht; der Dienst hat sich vielleicht geändert. Versuch es später noch einmal.`,
  }[problem];
  return new JobSearchError(problem, message, detail ? `${source}: ${detail}` : undefined);
}
