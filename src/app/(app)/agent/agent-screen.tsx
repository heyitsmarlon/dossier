"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { linksAttribution, SourceAttribution } from "@/components/source-attribution";
import { toast, toastResult } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useJob } from "@/hooks/use-job";
import type { AgentCandidateView, AgentView } from "@/lib/agent/view";
import { AGENT_MAX_SOURCE_REQUESTS_PER_DAY } from "@/lib/agent/limits";

import { approveAgentDraft, dismissAgentCandidate, prepareAgentDraft, restoreAgentCandidate, runAgentNow } from "./actions";

type ScanResult = { message: string };
type DraftResult = { applicationId: string };

const SETTINGS: Record<NonNullable<AgentView["setupSection"]>, { href: string; label: string }> = {
  agent: { href: "/settings?section=agent", label: "Einstellungen → Job-Agent" },
  ai: { href: "/settings?section=ai", label: "Einstellungen → KI-Anbieter" },
  jobs: { href: "/settings?section=jobs", label: "Einstellungen → Jobsuche" },
  scoring: { href: "/settings?section=scoring", label: "Einstellungen → Bewertung" },
};

/**
 * The Agent screen (E16-6): what the job agent searches, when it runs, the
 * drafts it prepared and the postings it scored, waiting for a look. Nothing
 * here sends anything.
 */
export function AgentScreen({ view }: { view: AgentView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [runJobId, setRunJobId] = useState(view.runJobId);
  const [showBelow, setShowBelow] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<AgentCandidateView | null>(null);

  const run = useJob<ScanResult>(runJobId, 0, (job) => {
    if (job.status !== "DONE" && job.status !== "FAILED") return;
    setRunJobId(null);
    toast(job.status === "DONE" ? (job.result?.message ?? "Der Durchlauf ist fertig.") : (job.error ?? "Der Durchlauf wurde nicht abgeschlossen."));
    router.refresh();
  });
  const running = Boolean(runJobId) && (!run || run.status === "QUEUED" || run.status === "RUNNING");

  const runNow = () =>
    startTransition(async () => {
      const result = toastResult(await runAgentNow({}));
      if (result.ok) setRunJobId(result.data.jobId);
    });

  const hide = (id: string, gone: boolean) =>
    setHidden((current) => {
      const next = new Set(current);
      if (gone) next.add(id);
      else next.delete(id);
      return next;
    });

  const dismiss = (candidate: AgentCandidateView) =>
    startTransition(async () => {
      hide(candidate.id, true);
      const result = await dismissAgentCandidate({ candidateId: candidate.id });
      if (!result.ok) {
        hide(candidate.id, false);
        return toast(result.error);
      }
      const undo = result.data.undo;
      if (!undo) return toast("Verworfen, samt Entwurf. Die Anzeige kommt nicht wieder.");
      toast("Verworfen. Die Anzeige kommt nicht wieder.", {
        action: {
          label: "Rückgängig",
          onClick: () =>
            void restoreAgentCandidate({ ...undo, reasons: stringList(undo.reasons), redFlags: stringList(undo.redFlags) }).then((restored) => {
              if (!toastResult(restored).ok) return;
              hide(candidate.id, false);
              router.refresh();
            }),
        },
      });
      router.refresh();
    });

  const drafts = view.drafts.filter((candidate) => !hidden.has(candidate.id));
  const scored = view.scored.filter((candidate) => !hidden.has(candidate.id));
  const below = view.belowMinimum.filter((candidate) => !hidden.has(candidate.id));
  const empty = drafts.length === 0 && scored.length === 0;

  return (
    <>
      <PageHeader
        title="Job-Agent"
        description="Einmal am Tag sucht er nach neuen Stellenanzeigen, bewertet sie anhand deines Profils und legt dir die besten hier ab. Entwürfe warten auf deine Prüfung, und nichts wird je verschickt."
        actions={
          <Button aria-disabled={running || pending || undefined} onClick={() => !running && !pending && runNow()}>
            {running ? "Läuft…" : "Alle jetzt starten"}
          </Button>
        }
      />
      <div className="flex flex-col gap-8 px-4 pb-20 sm:px-10">
        <Notices view={view} />

        <Card padding="none" className="px-7 py-2">
          <dl>
            <Fact label="Agent">{view.enabled ? "An" : "Aus"}</Fact>
            <Fact label="Aktive Suchen">{view.searches.filter((search) => search.enabled).length} von {view.searches.length}</Fact>
            <Fact label="Letzter Durchlauf">
              {view.lastRun ? (
                <>
                  {view.lastRun.at}
                  {view.lastRun.message && <span className="block text-muted">{view.lastRun.message}</span>}
                </>
              ) : (
                "Noch nicht"
              )}
            </Fact>
            <Fact label="Nächster Durchlauf">{view.nextRun ?? "Aus"}</Fact>
            <Fact label="Verfügbare Quellenabfragen">{Math.max(0, AGENT_MAX_SOURCE_REQUESTS_PER_DAY - view.sourceRequestsUsed)} von {AGENT_MAX_SOURCE_REQUESTS_PER_DAY} in den letzten 24 Stunden</Fact>
            <Fact label="Nächster kompletter Durchlauf möglich">{view.nextEligibility} ({view.timeZone})</Fact>
          </dl>
          {running && (
            <p role="status" className="border-t border-line py-3.5 text-sm text-muted">
              {run?.step ?? "Durchlauf startet…"}
            </p>
          )}
        </Card>

        <Card padding="none" className="flex flex-col gap-4 px-7 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-section">Wiederkehrende Suchen</h2>
            <Link href="/settings?section=agent" className="text-meta text-muted underline underline-offset-2">Suchen und Zeitplan verwalten</Link>
          </div>
          {view.searches.length === 0 ? <p className="text-meta text-muted">Noch keine gespeicherten Suchen.</p> : <ol className="flex flex-col gap-3">
            {view.searches.map((search) => {
              const last = view.searchHistory.find((result) => result.searchId === search.id);
              return <li key={search.id} className="border-t border-line pt-3 text-sm">
                <p className="break-words font-medium">{search.name} · {search.enabled ? "Aktiv" : "Pausiert"}</p>
                <p className="text-meta text-muted break-words">{search.query.keywords}{search.query.place ? ` · ${search.query.place}` : ""} · {search.query.country.toUpperCase() || "Kein Land gewählt"}</p>
                <p className="text-meta text-muted">{last ? `${last.error ? "Letzte Abfrage fehlgeschlagen" : "Letzte Abfrage abgeschlossen"}: ${last.at} · ${last.found} gefunden · ${last.fresh} neu für den Agenten` : "Noch nicht gelaufen."}</p>
                {last && <p className="text-xs text-muted">{last.batchMessage ? `Ergebnis des Durchlaufs: ${last.batchMessage}` : "Durchlauf läuft noch; die Zahlen sind eventuell unvollständig."}</p>}
                {last?.searchName !== undefined && last.searchName !== search.name && <p className="text-xs text-muted">Gelaufen als „{last.searchName}“</p>}
                {last?.error && <p className="text-meta text-error">{last.error}</p>}
              </li>;
            })}
          </ol>}
          {view.searchResults.length > 0 && <div className="border-t border-line pt-3">
            <h3 className="text-field font-medium">Ergebnisse des letzten Durchlaufs</h3>
            <ul className="mt-2 flex flex-col gap-2 text-meta text-muted">{view.searchResults.map((result) => <li key={result.searchId} className="break-words">
              {result.searchName}{!view.searches.some((search) => search.id === result.searchId) ? " (gelöschte Suche)" : ""}: {result.found} gefunden · {result.fresh} neu für den Agenten{result.error ? ` · Abfrage fehlgeschlagen: ${result.error}` : " · Abfrage abgeschlossen"}
            </li>)}</ul>
          </div>}
          <p className="text-meta text-muted">Die Trefferzahlen können sich zwischen Suchen überschneiden, zähl sie also nicht zusammen. „Neu für den Agenten“ wird pro Suche gezählt, bevor doppelte Anzeigen entfernt und bewertet werden. Anzeigen behalten den Namen der Suche, mit der sie gefunden wurden, auch nach Umbenennen oder Löschen.</p>
          <p className="text-meta text-muted">Eine Abfrage (erste Ergebnisseite) pro aktiver Suche, nacheinander. Insgesamt sind {AGENT_MAX_SOURCE_REQUESTS_PER_DAY} Abfragen in 24 Stunden erlaubt, fehlgeschlagene mitgezählt. „Alle starten“ wartet, bis der ganze Durchlauf hineinpasst; manuelle Durchläufe warten außerdem mindestens eine Stunde nach dem letzten. Jeder Durchlauf teilt sich höchstens {view.maxScores} KI-Bewertungen{view.autoDraft ? ` und ${view.maxDrafts} automatische Entwürfe` : "; automatische Entwürfe sind aus"} über alle Suchen.</p>
        </Card>

        <Section title="Entwürfe zur Prüfung" count={drafts.length}>
          {drafts.length === 0 ? (
            <Empty>
              {view.autoDraft
                ? "Noch keine Entwürfe. Nach einem Durchlauf bekommen die besten neuen Anzeigen hier einen Entwurf."
                : "Noch keine Entwürfe. Bereite einen aus einer bewerteten Anzeige vor, oder lass den Agenten das tun (Einstellungen → Job-Agent)."}
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {drafts.map((candidate) => (
                <li key={candidate.id}>
                  <CandidateCard candidate={candidate}>
                    <Link href={`/applications/${candidate.applicationId}`} className={buttonClassName("primary", "sm", "hover:text-on-primary")}>
                      Entwurf prüfen
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        startTransition(async () => {
                          if (toastResult(await approveAgentDraft({ candidateId: candidate.id })).ok) router.refresh();
                        })
                      }
                    >
                      Übernehmen
                    </Button>
                    <OpenPosting url={candidate.url} />
                    <Button variant="danger-text" size="sm" className="ml-auto" onClick={() => setConfirming(candidate)}>
                      Verwerfen
                    </Button>
                  </CandidateCard>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Bewertete Anzeigen" count={scored.length}>
          {scored.length === 0 ? (
            <Empty>{empty ? "Noch nichts da. Ein Durchlauf legt die passendsten Anzeigen hier ab." : "Keine Anzeigen, die auf einen Entwurf warten."}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {scored.map((candidate) => (
                <li key={candidate.id}>
                  <ScoredCard candidate={candidate} onDismiss={() => dismiss(candidate)} />
                </li>
              ))}
            </ul>
          )}
          {below.length > 0 && (
            <div className="flex flex-col gap-3">
              <button type="button" aria-expanded={showBelow} onClick={() => setShowBelow(!showBelow)} className="w-fit text-meta text-muted underline underline-offset-2 hover:text-ink">
                {below.length} unter deiner Mindestpunktzahl von {view.minScore} · {showBelow ? "Ausblenden" : "Anzeigen"}
              </button>
              {showBelow && (
                <ul className="flex flex-col gap-3">
                  {below.map((candidate) => (
                    <li key={candidate.id}>
                      <ScoredCard candidate={candidate} onDismiss={() => dismiss(candidate)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Diesen Entwurf verwerfen?"
        description="Lebenslauf, Anschreiben und Chat werden gelöscht, und die Anzeige kommt nicht wieder."
        confirmLabel="Entwurf verwerfen"
        onConfirm={() => {
          if (confirming) dismiss(confirming);
          setConfirming(null);
        }}
      />
    </>
  );
}

const stringList = (value: unknown): string[] | null => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : null);

/** Why the agent isn't running, and where to fix it. */
function Notices({ view }: { view: AgentView }) {
  const note = (children: ReactNode) => (
    <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
      {children}
    </p>
  );
  if (!view.enabled) {
    return note(
      <>
        Der Job-Agent ist aus.{" "}
        <Link href={SETTINGS.agent.href} className="font-medium text-warning underline underline-offset-2">
          Einschalten unter Einstellungen → Job-Agent
        </Link>
        {view.drafts.length + view.scored.length > 0 && ". Was er vorher gefunden hat, ist noch da."}
      </>,
    );
  }
  if (view.setupProblem && view.setupSection) {
    return note(
      <>
        {view.setupProblem.replace(/ \(Einstellungen → [^)]+\)\.$/, ".")}{" "}
        <Link href={SETTINGS[view.setupSection].href} className="font-medium text-warning underline underline-offset-2">
          Zu {SETTINGS[view.setupSection].label}
        </Link>
      </>,
    );
  }
  if (view.limitReached) return note(`Der ganze Durchlauf braucht mehr Abfragen, als gerade verfügbar sind. Wieder möglich ab ${view.nextEligibility} (${view.timeZone}).`);
  return null;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line py-3.5 text-sm first:border-t-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="sm:text-right">{children}</dd>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const id = `agent-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-serif text-section">
          {title}
        </h2>
        <p className="text-meta text-muted">{count} offen</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-line-card bg-card px-5 py-4 text-sm text-muted">{children}</p>;
}

function OpenPosting({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClassName("secondary", "sm")}>
      Anzeige öffnen <span className="sr-only">(öffnet in neuem Tab)</span>
    </a>
  );
}

/** A posting the agent found: what it is, its score and why. The actions go below. */
function CandidateCard({ candidate, children }: { candidate: AgentCandidateView; children: ReactNode }) {
  return (
    <Card padding="none" className="flex flex-col gap-3.5 px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-serif text-[20px] leading-tight text-pretty">{candidate.title}</h3>
          {candidate.company && <p className="text-sm text-ink">{candidate.company}</p>}
          {candidate.facts && <p className="text-meta text-muted">{candidate.facts}</p>}
          {candidate.origin && <p className="text-xs text-muted">{candidate.origin}</p>}
          {candidate.searches.length > 0 && <p className="text-xs text-muted break-words">Gefunden von: {candidate.searches.map((search) => `${search.searchName}${search.searchId === null ? " (gelöschte Suche)" : ""}`).join(" · ")}</p>}
          {/* As the source's terms ask (E14-2); the origin names the others. */}
          {linksAttribution(candidate.source) && <SourceAttribution source={candidate.source} url={candidate.url} className="mt-1.5 self-start" />}
        </div>
        <ScoreBadge score={candidate.score} />
      </div>
      {candidate.reasons.length > 0 && (
        <ul aria-label="Warum es passt" className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {candidate.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}
      {candidate.redFlags.length > 0 && (
        <div className="rounded-card bg-warning-surface px-3.5 py-2.5 text-meta text-warning">
          <p className="font-medium">Gut zu wissen</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
            {candidate.redFlags.map((flag, index) => (
              <li key={index}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
      {candidate.error && (
        <p role="alert" className="text-meta text-error">
          {candidate.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-3.5">{children}</div>
    </Card>
  );
}

/** A scored posting: Prepare draft (following the job while it writes), Open posting, Dismiss. */
function ScoredCard({ candidate, onDismiss }: { candidate: AgentCandidateView; onDismiss: () => void }) {
  const router = useRouter();
  const [jobId, setJobId] = useState(candidate.draftJobId);
  const [starting, startTransition] = useTransition();
  const job = useJob<DraftResult>(jobId, 0, (update) => {
    if (update.status === "DONE") {
      setJobId(null);
      toast("Der Entwurf ist bereit zur Prüfung.");
      router.refresh();
    } else if (update.status === "FAILED") {
      setJobId(null);
      toast(update.error ?? "Der Entwurf konnte nicht vorbereitet werden.");
      router.refresh();
    }
  });
  const preparing = starting || Boolean(jobId);

  const prepare = () =>
    startTransition(async () => {
      const result = toastResult(await prepareAgentDraft({ candidateId: candidate.id }));
      if (!result.ok) return;
      if (result.data.applicationId) router.refresh();
      else setJobId(result.data.jobId);
    });

  return (
    <CandidateCard candidate={candidate}>
      <Button size="sm" aria-disabled={preparing || undefined} onClick={() => !preparing && prepare()}>
        {preparing ? "Entwurf wird vorbereitet…" : "Entwurf vorbereiten"}
      </Button>
      <OpenPosting url={candidate.url} />
      {preparing && job?.step && (
        <span role="status" className="text-meta text-muted">
          {job.step}
        </span>
      )}
      <Button variant="danger-text" size="sm" className="ml-auto" onClick={onDismiss}>
        Verwerfen
      </Button>
    </CandidateCard>
  );
}
