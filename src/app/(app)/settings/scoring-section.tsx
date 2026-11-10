"use client";

import Link from "next/link";
import { RadioGroup } from "radix-ui";
import { useState } from "react";

import { KeyField } from "@/components/key-field";
import { useTrackSave } from "@/components/save-tracker";
import { toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SCORER_INFO, SCORERS, TYPESAFE_KEY_URL, type Scorer, type ScoringView } from "@/lib/scoring/scorers";
import { cn } from "@/lib/cn";

import { saveScorer, saveTypesafeKey, testJev } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

type Connection =
  | { status: "untested" }
  | { status: "testing" }
  | { status: "connected"; model: string; seconds: number }
  | { status: "failed"; message: string };

/**
 * Settings → Scoring (#274): whether Score in Find jobs and the job agent
 * use the AI model or Jev, and Jev's key. Each change saves on its own; the
 * key is saved when you leave its field and never shown again.
 */
export function ScoringSection({ initial }: { initial: ScoringView }) {
  const track = useTrackSave();
  const [view, setView] = useState(initial);
  const [connection, setConnection] = useState<Connection>({ status: "untested" });

  const apply = (result: Awaited<ReturnType<typeof saveScorer>>) => {
    if (result.ok) setView(result.data);
    return result.ok;
  };

  const choose = async (scorer: Scorer) => {
    setView((current) => ({ ...current, scorer }));
    setConnection({ status: "untested" });
    apply(toastResult(await track(saveScorer({ scorer }))));
  };

  const saveKey = async (change: { action: "set"; value: string } | { action: "clear" }) => {
    setConnection({ status: "untested" });
    return apply(toastResult(await track(saveTypesafeKey({ change }))));
  };

  const test = async () => {
    if (connection.status === "testing") return;
    setConnection({ status: "testing" });
    const result = await testJev({});
    if (!result.ok) setConnection({ status: "failed", message: result.error });
    else if (result.data.connected) setConnection({ status: "connected", model: result.data.model, seconds: result.data.seconds });
    else setConnection({ status: "failed", message: result.data.message });
  };

  return (
    <>
      <SettingsSectionIntro title="Bewertung">
        Womit „Bewerten“ in „Jobs finden“ und der Job-Agent beurteilen, wie gut eine Anzeige zu deinem Profil passt. Entwürfe schreibt immer dein KI-Modell.
      </SettingsSectionIntro>

      <RadioGroup.Root
        aria-label="Anzeigen bewerten mit"
        value={view.scorer}
        onValueChange={(value) => void choose(value as Scorer)}
        className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3"
      >
        {SCORERS.map((scorer) => (
          <RadioGroup.Item
            key={scorer}
            value={scorer}
            aria-label={SCORER_INFO[scorer].name}
            aria-describedby={`scorer-${scorer}`}
            className="group flex flex-col gap-1.5 rounded-card border border-line-card bg-card p-[18px] text-left hover:border-line-strong data-[state=checked]:border-primary data-[state=checked]:shadow-[0_0_0_1px_var(--color-primary)]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-medium">{SCORER_INFO[scorer].name}</span>
              <span
                aria-hidden
                className="grid size-4 place-items-center rounded-full border-[1.5px] border-line-strong group-data-[state=checked]:border-primary"
              >
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </span>
            </span>
            <span id={`scorer-${scorer}`} className="flex flex-col gap-1.5">
              <span className="text-meta text-muted">{SCORER_INFO[scorer].description}</span>
              <span className="text-xs text-muted">{SCORER_INFO[scorer].tag}</span>
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>

      {view.scorer === "JEV" && (
        <>
          <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
            Jede Anzeige, die du bewerten lässt, geht mit deinem Profil an TypeSafe, ohne Namen und Kontaktdaten. Jev versteht Englisch am besten: Anzeigen in anderen Sprachen
            werden weniger genau bewertet.
          </p>

          <Card className="flex flex-col gap-5">
            <KeyField
              label="TypeSafe-Schlüssel"
              keyState={view.keyState}
              envName="DOSSIER_TYPESAFE_KEY"
              getKey={{ href: TYPESAFE_KEY_URL, text: "der TypeSafe-Konsole" }}
              onSave={saveKey}
            />
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <Button variant="secondary" onClick={() => void test()} disabled={connection.status === "testing"}>
                {connection.status === "testing" ? "Teste…" : "Verbindung testen"}
              </Button>
              <ConnectionStatus connection={connection} />
            </div>
          </Card>

          <p className="text-sm text-muted">
            Die Bewertungen von Jev und deinem KI-Modell haben nicht dieselbe Skala. Legt der Job-Agent zu viele oder zu wenige Anzeigen ab, ändere seine Mindestpunktzahl unter{" "}
            <Link href="/settings?section=agent" className="underline underline-offset-2 hover:text-ink">
              Einstellungen → Job-Agent
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}

function ConnectionStatus({ connection }: { connection: Connection }) {
  const [dot, text, message] =
    connection.status === "connected"
      ? ["bg-success", "text-success", `Verbunden · ${connection.model} hat in ${connection.seconds.toLocaleString("de-DE")} s geantwortet`]
      : connection.status === "failed"
        ? ["bg-error", "text-error", connection.message]
        : connection.status === "testing"
          ? ["bg-status-offer", "text-muted", "Stelle Jev eine kurze Frage…"]
          : ["bg-faint", "text-muted", "Seit deiner letzten Änderung nicht getestet · ein Test kostet ein paar Dutzend Tokens"];
  return (
    <p role="status" className={cn("flex items-center gap-2 text-control", text)}>
      <span aria-hidden className={cn("size-2 flex-none rounded-full", dot)} />
      {message}
    </p>
  );
}
