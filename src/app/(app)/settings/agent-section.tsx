"use client";

import Link from "next/link";
import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toastResult } from "@/components/toast";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/hooks/use-autosave";
import type { Country } from "@/lib/job-search/countries";
import { searchHref, type JobSource, type SearchQuery } from "@/lib/job-search/search";

import { saveAgentSettings } from "../agent/actions";
import { RemoteOnlyField, SearchFields, type SearchFieldErrors } from "../jobs/search-fields";
import { SettingsSectionIntro } from "./settings-screen";

export type AgentSettings = {
  enabled: boolean;
  query: SearchQuery;
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
 * Settings → Job agent (E16-7): whether it runs, the one search it runs,
 * when, and how much a run may do. Each change saves at once; the search
 * once typing pauses.
 */
export function AgentSection({
  initial,
  source,
  aiReady,
  countries,
  timeZone,
}: {
  initial: AgentSettings;
  /** The source in Settings → Job search; null while job search is off. */
  source: JobSource | null;
  aiReady: boolean;
  countries: readonly Country[];
  /** The user's time zone, which the hour is in. */
  timeZone: string;
}) {
  const track = useTrackSave();
  const [settings, setSettings] = useState(initial);
  const [errors, setErrors] = useState<SearchFieldErrors>({});

  const change = (next: Partial<AgentSettings>) => {
    const previous = settings;
    setSettings({ ...settings, ...next });
    void track(saveAgentSettings(next)).then((result) => {
      if (!toastResult(result).ok) setSettings(previous);
    });
  };
  const { flush } = useAutosave(settings.query, (query) => track(saveAgentSettings({ query })));
  const setQuery = (patch: Partial<SearchQuery>) => {
    setErrors({});
    setSettings((current) => ({ ...current, query: { ...current.query, ...patch } }));
  };

  const turnOn = (on: boolean) => {
    if (on) {
      const problems = {
        keywords: settings.query.keywords.trim() ? undefined : "Gib ein, wonach der Agent suchen soll.",
        country: settings.query.country ? undefined : "Wähle ein Land.",
      };
      setErrors(problems);
      if (problems.keywords || problems.country) return;
      // With it, so a search started from Find jobs is saved too.
      return change({ enabled: true, query: settings.query });
    }
    change({ enabled: false });
  };

  return (
    <>
      <SettingsSectionIntro title="Job-Agent">
        Einmal am Tag führt er eine Suche aus, bewertet die neuen Anzeigen anhand deines Profils und legt die besten auf der Agent-Seite ab. Er verschickt nie etwas und bewirbt sich nie.
      </SettingsSectionIntro>

      {source === "ARBEITSAGENTUR" ? (
        // It searches on its own, which the BA's terms forbid most clearly (#223).
        <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
          Der Agent durchsucht nicht die Bundesagentur für Arbeit. Wähle dafür JSearch, Adzuna oder FreeHire unter{" "}
          <Link href="/settings?section=jobs" className="font-medium text-warning underline underline-offset-2">
            Einstellungen → Jobsuche
          </Link>
          .
        </p>
      ) : (!source || !aiReady) && (
        <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
          {!source ? "Der Agent durchsucht die Quelle, die du wählst unter " : "Der Agent bewertet Anzeigen mit dem KI-Anbieter unter "}
          <Link href={!source ? "/settings?section=jobs" : "/settings?section=ai"} className="font-medium text-warning underline underline-offset-2">
            {!source ? "Einstellungen → Jobsuche" : "Einstellungen → KI-Anbieter"}
          </Link>
          {!source ? ". Dort ist noch keine gewählt." : ". Dort ist noch keiner eingerichtet."}
        </p>
      )}

      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Job-Agent ausführen"
          description={
            settings.enabled
              ? `An. Er läuft einmal am Tag nach ${clock(settings.hour)} deiner Zeit (${timeZone}), und du kannst ihn zwischendurch auf der Agent-Seite starten.`
              : "Aus. Es wird nichts gesucht oder bewertet, bis er an ist."
          }
          checked={settings.enabled}
          onCheckedChange={turnOn}
        />
      </Card>

      <Card padding="none" className="flex flex-col gap-4 px-7 py-[26px]">
        <div className="flex flex-col gap-1">
          <h3 className="text-field font-medium">Wonach er sucht</h3>
          <p className="text-meta text-muted">
            Dieselbe Suche wie unter{" "}
            <Link href={searchHref(settings.query)} className="font-medium text-ink underline underline-offset-2">
              Jobs finden
            </Link>
            , über die Quelle aus Einstellungen → Jobsuche. Anzeigen, die du dort gemerkt, verworfen oder auf die du dich beworben hast, werden ausgelassen.
          </p>
        </div>
        <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2" onBlur={flush}>
          <SearchFields value={settings.query} onChange={setQuery} source={source} countries={countries} errors={errors} />
          <div className="sm:col-span-2">
            <RemoteOnlyField value={settings.query} onChange={setQuery} source={source} />
          </div>
        </div>
      </Card>

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
        Eine Suche am Tag, höchstens drei in 24 Stunden. Jeder Durchlauf bewertet bis zu {plural(settings.maxScores, "Anzeige", "Anzeigen")}
        {settings.autoDraft ? ` und bereitet bis zu ${plural(settings.maxDrafts, "Entwurf", "Entwürfe")} vor` : ""}. Bewertungen und Entwürfe gehen mit deinem Profil an deinen KI-Anbieter, wie bei einer neuen Bewerbung; die Jobquelle bekommt nur die Suche.
      </p>
    </>
  );
}
