"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toastResult } from "@/components/toast";
import type { AiErrorKind } from "@/lib/ai/errors";
import { AI_CHOICES, AI_PRIORITIES, aiChoice, type AiChoice, type AiChoiceId, type AiPriority } from "@/lib/setup/ai-choices";

import { saveAiProvider } from "../../(app)/settings/actions";
import { connectAi, findLocalAi } from "./actions";
import { ChoiceCards } from "./choice-cards";
import { InstructionList } from "./instruction-list";

/** What the step starts from: the AI in effect, if it works. */
export type AiStepView = { usable: boolean; name: string; model: string; choice: AiChoiceId | null; fromEnv: boolean };

type Status =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "connected"; model: string; seconds: number }
  | { state: "failed"; kind: AiErrorKind; message: string }
  | { state: "found"; baseUrl: string; models: string[]; model: string | null }
  | { state: "missing" };

/** What to try next after a failed check, in plain words. */
function hint(kind: AiErrorKind, choice: AiChoice): string | null {
  switch (kind) {
    case "auth":
      return `Prüf, ob du den ganzen Schlüssel kopiert hast, ohne etwas davor oder danach. Klappt es immer noch nicht, erstelle einen neuen Schlüssel und füge ihn ein.${choice.id === "anthropic" ? " Claudes Schlüssel braucht einen Workspace: Der Standard-Workspace reicht." : ""}`;
    case "rate-limited":
      return "Das heißt meist, dass auf dem Konto noch kein Guthaben ist. Lade etwas auf, warte eine Minute und prüf noch einmal.";
    case "unreachable":
      return `Dossier konnte ${choice.name} nicht erreichen. Prüf, ob dieser Server online ist, und versuch es noch einmal.`;
    case "model":
      return "Dein Konto hat darauf eventuell noch keinen Zugriff. Neue Konten warten manchmal ein bisschen: Versuch es später noch einmal oder wähle einen anderen Anbieter.";
    default:
      return null;
  }
}

/**
 * The guide's AI step (E21-2): what matters most, then one or two choices
 * for it, then that choice's steps, its key and a check that says in plain
 * words what went wrong. Local ones are found on this computer instead.
 */
export function AiStep({ current }: { current: AiStepView }) {
  const router = useRouter();
  const [changing, setChanging] = useState(!current.usable);
  const [priority, setPriority] = useState<AiPriority | null>(current.choice ? aiChoice(current.choice).priority : null);
  const [choiceId, setChoiceId] = useState<AiChoiceId | null>(current.choice);
  const choices = AI_CHOICES.filter((choice) => choice.priority === priority);

  if (!changing) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-sm">
          Dossier schreibt schon mit <strong className="font-medium">{current.name}</strong>
          {current.model && (
            <>
              , Modell <span className="font-mono text-[13px]">{current.model}</span>
            </>
          )}
          .{current.fromEnv && " Das ist auf dem Server festgelegt, in DOSSIER_AI_PROVIDER."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
          Anderen wählen
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lead font-medium">Was ist dir am wichtigsten?</h2>
        <ChoiceCards
          label="Was ist dir am wichtigsten?"
          options={AI_PRIORITIES}
          value={priority}
          onChange={(next) => {
            setPriority(next);
            setChoiceId(AI_CHOICES.find((choice) => choice.priority === next)?.id ?? null);
          }}
        />
      </section>

      {priority && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lead font-medium">Wähle eine</h2>
          <ChoiceCards
            label="KI wählen"
            options={choices.map((choice) => ({ value: choice.id, name: choice.name, description: choice.about }))}
            value={choiceId}
            onChange={setChoiceId}
          />
          {priority === "other" && (
            <p className="text-sm text-muted">
              Du hast einen eigenen KI-Server oder die Adresse eines anderen Anbieters? Trag sie ein unter{" "}
              <Link href="/settings?section=ai" className="font-medium text-ink underline underline-offset-2">
                Einstellungen → KI-Anbieter
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {choiceId && <ChoicePanel key={choiceId} choice={aiChoice(choiceId)} onConnected={() => router.refresh()} />}
    </div>
  );
}

function ChoicePanel({ choice, onConnected }: { choice: AiChoice; onConnected: () => void }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const local = choice.key === null;

  const check = async () => {
    setStatus({ state: "checking" });
    if (local) {
      const result = toastResult(await findLocalAi({ choice: choice.id as "lmstudio" | "ollama" }));
      if (!result.ok) return setStatus({ state: "idle" });
      setStatus(result.data.found ? { state: "found", ...result.data } : { state: "missing" });
      if (result.data.found && result.data.model) onConnected();
      return;
    }
    const result = toastResult(await connectAi({ choice: choice.id, key: key.trim() || undefined }));
    if (!result.ok) return setStatus({ state: "idle" });
    if (result.data.connected) {
      setKey("");
      setStatus({ state: "connected", model: result.data.model, seconds: result.data.seconds });
      onConnected();
    } else {
      setStatus({ state: "failed", kind: result.data.kind, message: result.data.message });
    }
  };

  const chooseModel = async (model: string) => {
    if (status.state !== "found") return;
    setStatus({ ...status, model });
    if (toastResult(await saveAiProvider({ provider: choice.provider, baseUrl: status.baseUrl, model })).ok) onConnected();
  };

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-section">{choice.name}</h2>
        <p className="text-sm text-muted">{choice.about}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
        <dt className="font-medium">Was es kostet</dt>
        <dd className="text-pretty text-muted">{choice.cost}</dd>
        {choice.needs && (
          <>
            <dt className="font-medium">Dein Rechner</dt>
            <dd className="text-pretty text-muted">{choice.needs}</dd>
          </>
        )}
        <dt className="font-medium">Deine Daten</dt>
        <dd className="text-pretty text-muted">{choice.data}</dd>
      </dl>
      <InstructionList steps={choice.steps} label={`${choice.name} einrichten`} />

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (status.state !== "checking") void check();
        }}
      >
        {choice.key && (
          <Input
            label={choice.key.label}
            type="password"
            autoComplete="off"
            placeholder={choice.key.startsWith ? `Beginnt mit ${choice.key.startsWith}` : "Hier einfügen"}
            hint="Wird verschlüsselt auf deinem Server gespeichert und nie wieder angezeigt."
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        )}
        <Button type="submit" className="self-start" aria-disabled={status.state === "checking" || undefined}>
          {status.state === "checking" ? (local ? "Suche…" : "Prüfe…") : local ? `${choice.name} finden` : "Prüfen"}
        </Button>
      </form>

      <div role="status" className="text-sm empty:hidden">
        {status.state === "connected" && (
          <p className="text-success">
            Es klappt: {choice.name} hat in {status.seconds} Sekunden geantwortet, mit <span className="font-mono text-[13px]">{status.model}</span>.
          </p>
        )}
        {status.state === "failed" && (
          <div className="flex flex-col gap-1.5 rounded-card bg-warning-surface px-4 py-3 text-warning">
            <p className="font-medium">{status.message}</p>
            {hint(status.kind, choice) && <p>{hint(status.kind, choice)}</p>}
          </div>
        )}
        {status.state === "missing" && (
          <div className="flex flex-col gap-1.5 rounded-card bg-warning-surface px-4 py-3 text-warning">
            <p className="font-medium">Dossier konnte {choice.name} nicht finden.</p>
            <p>
              Prüf, ob es läuft{choice.id === "lmstudio" ? ", mit eingeschaltetem Server im Developer-Tab" : ""}, und versuch es noch einmal. Läuft Dossier auf einem
              Server statt auf diesem Rechner, kann es {choice.name} hier nicht erreichen: Wähle eine andere Option oder schau im Wiki, wie ein Modell auf dem Server läuft.
            </p>
          </div>
        )}
        {status.state === "found" &&
          (status.models.length === 0 ? (
            <p className="rounded-card bg-warning-surface px-4 py-3 text-warning">
              {choice.name} gefunden, aber es hat noch keine Modelle. Lade eins herunter und drück dann erneut „Finden“.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-success">{choice.name} gefunden. Dossier schreibt mit dem Modell unten.</p>
              <Select label="Modell" value={status.model ?? ""} onChange={(event) => void chooseModel(event.target.value)} className="max-w-[420px]">
                {status.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </div>
          ))}
      </div>

      <a href={choice.help} target="_blank" rel="noopener noreferrer" className="self-start text-meta text-muted underline underline-offset-2 hover:text-ink">
        Mehr Hilfe im Wiki (englisch) <span className="sr-only">(öffnet in neuem Tab)</span>
      </a>
    </Card>
  );
}
