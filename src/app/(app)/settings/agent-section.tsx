"use client";

import Link from "next/link";
import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toastResult } from "@/components/toast";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import type { SavedAgentSearch } from "@/lib/agent/search";
import { AGENT_MAX_SOURCE_REQUESTS_PER_DAY } from "@/lib/agent/limits";
import type { Country } from "@/lib/job-search/countries";
import type { JobSource, SearchQuery } from "@/lib/job-search/search";
import type { Scorer } from "@/lib/scoring/scorers";

import { saveAgentSettings } from "../agent/actions";
import { RecurringSearches } from "./recurring-searches";
import { SETTINGS_SECTIONS, settingsSectionHref, type SettingsSectionId } from "./sections";
import { SettingsSectionIntro } from "./settings-screen";

export type AgentSettings = {
  enabled: boolean;
  hour: number;
  minScore: number;
  maxScores: number;
  maxDrafts: number;
  autoDraft: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MIN_SCORES = [50, 55, 60, 65, 70, 75, 80, 85, 90];
const SCORE_COUNTS = Array.from({ length: 30 }, (_, index) => index + 1);
const DRAFT_COUNTS = Array.from({ length: 11 }, (_, index) => index);
const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Shared daily schedule and AI limits, with explicit saved-search management.
 */
export function AgentSection({
  initial,
  source,
  scoring,
  countries,
  timeZone,
  onlyWhileOpen = false,
  searches,
  suggestedQuery,
}: {
  initial: AgentSettings;
  /** The source in Settings → Job search; null while job search is off. */
  source: JobSource | null;
  /** What scores the postings (Settings → Scoring), and whether it's set up. */
  scoring: { scorer: Scorer; ready: boolean };
  countries: readonly Country[];
  /** The user's time zone, which the hour is in. */
  timeZone: string;
  /** In the desktop app on this computer, where it only runs while the app is open (#325). */
  onlyWhileOpen?: boolean;
  searches: SavedAgentSearch[];
  suggestedQuery?: SearchQuery;
}) {
  const track = useTrackSave();
  const [settings, setSettings] = useState(initial);

  const change = (next: Partial<AgentSettings>) => {
    const previous = settings;
    setSettings({ ...settings, ...next });
    void track(saveAgentSettings(next)).then((result) => {
      if (!toastResult(result).ok) setSettings(previous);
    });
  };

  return (
    <>
      <SettingsSectionIntro title="Job-Agent">
        Einmal am Tag führt er alle aktiven Suchen aus, bewertet die neuen Anzeigen anhand deines Profils und legt die besten auf der Agent-Seite ab. Er verschickt nie etwas und bewirbt sich nie.
      </SettingsSectionIntro>

      {source === "ARBEITSAGENTUR" ? (
        // It searches on its own, which the BA's terms forbid most clearly (#223).
        <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
          Der Agent durchsucht nicht die Bundesagentur für Arbeit. Wähle dafür JSearch, Adzuna oder FreeHire unter{" "}
          <Link href="/settings?section=jobs" className="font-medium text-warning underline underline-offset-2">
            Einstellungen → Jobsuche
          </Link>
          . Manuelle Suchen unter „Jobs finden“ sind nicht betroffen.
        </p>
      ) : !source ? (
        <SetupNote before="Der Agent durchsucht die Quelle, die du wählst unter " section="jobs" after=". Dort ist noch keine gewählt." />
      ) : scoring.ready ? null : scoring.scorer === "JEV" ? (
        <SetupNote before="Der Agent bewertet Anzeigen mit Jev, dafür braucht es deinen TypeSafe-Schlüssel unter " section="scoring" after="." />
      ) : (
        <SetupNote before="Der Agent bewertet Anzeigen mit dem KI-Anbieter unter " section="ai" after=". Dort ist noch keiner eingerichtet." />
      )}

      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Job-Agent ausführen"
          description={
            settings.enabled
              ? `An. Er läuft einmal am Tag nach ${clock(settings.hour)} deiner Zeit (${timeZone}), und du kannst ihn zwischendurch auf der Agent-Seite starten.${
                  onlyWhileOpen ? " Auf diesem Rechner nur, solange Dossier offen ist: Ist es zu der Zeit geschlossen, startet der Durchlauf, sobald du es am selben Tag öffnest." : ""
                }`
              : "Aus. Es wird nichts gesucht oder bewertet, bis er an ist."
          }
          checked={settings.enabled}
          onCheckedChange={(enabled) => change({ enabled })}
        />
      </Card>

      <RecurringSearches initial={searches} suggestedQuery={suggestedQuery} source={source} countries={countries} />

      <Card padding="none" className="grid gap-x-[18px] gap-y-5 px-7 py-[26px] sm:grid-cols-2">
        <Select label="Läuft nach" hint={`Deine Zeit (${timeZone})`} value={String(settings.hour)} onChange={(event) => change({ hour: Number(event.target.value) })}>
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {clock(hour)}
            </option>
          ))}
        </Select>
        <Select
          label="Mindestpunktzahl"
          hint="Niedriger bewertete Anzeigen kommen nicht in die Liste."
          value={String(settings.minScore)}
          onChange={(event) => change({ minScore: Number(event.target.value) })}
        >
          {[...new Set([...MIN_SCORES, settings.minScore])].sort((a, b) => a - b).map((score) => (
            <option key={score} value={score}>
              {score} von 100
            </option>
          ))}
        </Select>
        <Select label="Bewertete Anzeigen pro Durchlauf" value={String(settings.maxScores)} onChange={(event) => change({ maxScores: Number(event.target.value) })}>
          {SCORE_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </Select>
        <Select
          label="Entwürfe pro Durchlauf, höchstens"
          value={String(settings.maxDrafts)}
          disabled={!settings.autoDraft}
          hint={settings.autoDraft ? undefined : "Schalte zuerst „Entwürfe selbst vorbereiten“ ein"}
          onChange={(event) => change({ maxDrafts: Number(event.target.value) })}
        >
          {DRAFT_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </Select>
        <Toggle
          className="sm:col-span-2"
          label="Entwürfe selbst vorbereiten"
          description={
            settings.autoDraft
              ? `Für die besten neuen Anzeigen jedes Durchlaufs, bis zu ${plural(settings.maxDrafts, "Entwurf", "Entwürfe")}: zugeschnittener Lebenslauf und Anschreiben, zur Prüfung bereit.`
              : "Aus. Du wählst mit „Entwurf vorbereiten“, welche Anzeigen einen Entwurf bekommen."
          }
          checked={settings.autoDraft}
          onCheckedChange={(autoDraft) => change({ autoDraft })}
        />
      </Card>

      <p className="text-meta text-muted">
        Ein gemeinsamer Tagesplan für alle aktiven Suchen, in {timeZone}. Jede Suche fragt nur die erste Ergebnisseite ab, nacheinander. Höchstens {AGENT_MAX_SOURCE_REQUESTS_PER_DAY} Abfragen in 24 Stunden, fehlgeschlagene mitgezählt. Ein Durchlauf wartet, bis er komplett hineinpasst. Über alle Suchen bewertet jeder Durchlauf bis zu {plural(settings.maxScores, "Anzeige", "Anzeigen")}
        {settings.autoDraft ? ` und bereitet bis zu ${plural(settings.maxDrafts, "Entwurf", "Entwürfe")} vor` : ""}. Bewertet wird mit dem Anbieter aus Einstellungen → Bewertung, Entwürfe schreibt dein KI-Anbieter. Beide bekommen dein Profil; die Jobquelle bekommt nur die Suche.
      </p>
    </>
  );
}

/** What the agent still needs, with a link to the section that sets it up. */
function SetupNote({ before, section, after }: { before: string; section: SettingsSectionId; after: string }) {
  return (
    <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
      {before}
      <Link href={settingsSectionHref(section)} className="font-medium text-warning underline underline-offset-2">
        Settings → {SETTINGS_SECTIONS.find((entry) => entry.id === section)?.label}
      </Link>
      {after}
    </p>
  );
}
