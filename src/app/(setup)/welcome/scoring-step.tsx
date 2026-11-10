"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TYPESAFE_KEY_URL, type Scorer, type ScoringView } from "@/lib/scoring/scorers";
import { WIKI } from "@/lib/setup/instructions";

import { saveScorer, saveTypesafeKey, testJev } from "../../(app)/settings/actions";
import { ChoiceCards } from "./choice-cards";
import { InstructionList } from "./instruction-list";

type Status = { state: "idle" } | { state: "checking" } | { state: "connected" } | { state: "failed"; message: string };

const OPTIONS: readonly { value: Scorer; name: string; description: string; tag: string }[] = [
  {
    value: "AI",
    name: "Deine KI",
    description: "Die KI, die du gewählt hast, bewertet jede Anzeige und begründet in eigenen Worten, warum sie passt. Nichts weiter einzurichten.",
    tag: "Empfohlen",
  },
  {
    value: "JEV",
    name: "Jev von TypeSafe",
    description: "Ein Modell für schnelle Ja-oder-Nein-Urteile. Dossier baut die Bewertung aus seinen Antworten, und die Begründungen zitieren Zeilen aus der Anzeige.",
    tag: "Braucht einen TypeSafe-Schlüssel · Early Access",
  },
];

/**
 * The guide's scoring step (E21-4): Score in Find jobs and the job agent use
 * your AI unless you choose Jev, which comes with its key steps and a check.
 */
export function ScoringStep({ initial }: { initial: ScoringView }) {
  const router = useRouter();
  const [scorer, setScorer] = useState<Scorer>(initial.scorer);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const choose = async (next: Scorer) => {
    setScorer(next);
    setStatus({ state: "idle" });
    if (toastResult(await saveScorer({ scorer: next })).ok) router.refresh();
  };

  const check = async () => {
    setStatus({ state: "checking" });
    if (key.trim() && !toastResult(await saveTypesafeKey({ change: { action: "set", value: key } })).ok) return setStatus({ state: "idle" });
    const result = toastResult(await testJev({}));
    if (!result.ok) return setStatus({ state: "idle" });
    if (!result.data.connected) return setStatus({ state: "failed", message: result.data.message });
    setKey("");
    setStatus({ state: "connected" });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <ChoiceCards label="Anzeigen bewerten mit" options={OPTIONS} value={scorer} onChange={(next) => void choose(next)} />
      {scorer === "JEV" && (
        <Card className="flex flex-col gap-6">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="font-medium">Was es kostet</dt>
            <dd className="text-pretty text-muted">Du zahlst TypeSafe für jede Anzeige, die es liest. Es ist im Early Access, ein neues Konto muss eventuell auf einen Schlüssel warten.</dd>
            <dt className="font-medium">Deine Daten</dt>
            <dd className="text-pretty text-muted">
              Jede Anzeige, die du bewerten lässt, geht mit deinem Profil an TypeSafe, ohne Namen, Kontaktdaten und Referenzen. TypeSafe trainiert nicht damit. Jev
              versteht Englisch am besten.
            </dd>
          </dl>
          <InstructionList
            label="Jev einrichten"
            steps={[
              { text: "Registriere dich bei TypeSafe, öffne in der Konsole die Schlüssel und erstelle einen.", link: { href: TYPESAFE_KEY_URL, label: "TypeSafe-Konsole" } },
              { text: "Kopier den Schlüssel und füge ihn unten ein." },
            ]}
          />
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (status.state !== "checking") void check();
            }}
          >
            <Input
              label="TypeSafe-Schlüssel"
              type="password"
              autoComplete="off"
              placeholder={initial.keyState === "set" ? "Gespeichert · neuen einfügen, um ihn zu ersetzen" : "Hier einfügen"}
              hint="Wird verschlüsselt auf deinem Server gespeichert und nie wieder angezeigt."
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <Button type="submit" className="self-start" aria-disabled={status.state === "checking" || undefined}>
              {status.state === "checking" ? "Prüfe…" : "Prüfen"}
            </Button>
          </form>
          <div role="status" className="text-sm empty:hidden">
            {status.state === "connected" && <p className="text-success">Es klappt: Jev hat geantwortet.</p>}
            {status.state === "failed" && <p className="rounded-card bg-warning-surface px-4 py-3 font-medium text-warning">{status.message}</p>}
          </div>
          <a href={`${WIKI}/Choosing-an-AI-provider#scoring-with-jev`} target="_blank" rel="noopener noreferrer" className="self-start text-meta text-muted underline underline-offset-2 hover:text-ink">
            Mehr Hilfe im Wiki (englisch) <span className="sr-only">(öffnet in neuem Tab)</span>
          </a>
        </Card>
      )}
    </div>
  );
}
