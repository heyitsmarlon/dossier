import type { Metadata } from "next";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { verifySession } from "@/lib/auth/session";
import { isAiConfigured, isAiUsable, loadAiConfig, loadAiSettingsView } from "@/lib/ai/config";
import { jobSearchView, loadJobSearchConfig } from "@/lib/job-search/config";
import { SOURCE_INFO } from "@/lib/job-search/sources";
import { loadProfileName } from "@/lib/profile-data";
import { SCORER_INFO } from "@/lib/scoring/scorers";
import { jobRetentionLabel } from "@/lib/settings";
import { loadScoringConfig, scoringView } from "@/lib/scoring/config";
import { providerOption } from "@/lib/ai/provider-options";
import { env } from "@/lib/env";
import { redirectUri } from "@/lib/google/oauth";
import { loadSettings } from "@/lib/settings-data";
import { googleClientView, googleView, requestOrigin } from "@/lib/settings-views";
import { aiChoice, choiceOf } from "@/lib/setup/ai-choices";
import { googleAddressProblem } from "@/lib/setup/google";
import { setupHref, setupStepFromParam } from "@/lib/setup-guide";

import { ProfileImport } from "../../(app)/profile/import/profile-import";
import { AiStep } from "./ai-step";
import { GoogleStep } from "./google-step";
import { JobsStep } from "./jobs-step";
import { ScoringStep } from "./scoring-step";
import { SetupFrame } from "./setup-frame";

export const metadata: Metadata = { title: "Dossier einrichten" };

/** The setup guide (E21); the step is in `?step=`, else where it was left. */
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  // The layout checks too; this is the check next to the data (E11-5).
  await verifySession();
  const [{ step: param, google, job }, settings] = await Promise.all([searchParams, loadSettings()]);
  const step = setupStepFromParam(param, settings.setupGuide);

  if (step === "start") {
    return (
      <SetupFrame
        step="start"
        title="Willkommen bei Dossier"
        complete
        lead={
          <>
            <p>
              Ein paar Schritte machen es startklar: eine KI, die Lebensläufe und Anschreiben schreibt, wo nach Jobs gesucht wird, wie sie bewertet werden, dein Gmail und
              Kalender und dein Profil.
            </p>
            <p className="mt-3">
              Jeder Schritt sagt dir, wohin du gehst, was du anklickst und was du hierher zurückkopierst. Du kannst jeden überspringen und später in den Einstellungen nachholen.
            </p>
          </>
        }
      >
        <div>
          <Link href={setupHref("ai")} className={buttonClassName("primary", "md", "hover:text-on-primary")}>
            Los geht’s →
          </Link>
        </div>
      </SetupFrame>
    );
  }

  if (step === "done") {
    const [usable, view, jobs, scoring, connection, name] = await Promise.all([
      isAiUsable(),
      loadAiSettingsView(),
      loadJobSearchConfig(),
      loadScoringConfig(),
      googleView(),
      loadProfileName(),
    ]);
    const choice = choiceOf(view.provider, view.baseUrl);
    const rows = [
      { label: "KI", value: usable ? (choice ? aiChoice(choice).name : providerOption(view.provider).name) : null, href: "/settings?section=ai" },
      { label: "Jobsuche", value: jobs.source ? SOURCE_INFO[jobs.source].name : null, href: "/settings?section=jobs" },
      { label: "Bewertung", value: SCORER_INFO[scoring.scorer].name, href: "/settings?section=scoring" },
      { label: "Gmail und Kalender", value: connection.status === "connected" ? connection.email : null, href: "/settings?section=google" },
      { label: "Profil", value: name.trim() || null, href: "/profile" },
    ];
    return (
      <SetupFrame step="done" title="Alles bereit" complete lead="Was du übersprungen hast, wartet in den Einstellungen, ebenso diese Einrichtungshilfe, unter „Über“.">
        <dl className="flex max-w-[560px] flex-col rounded-card border border-line-card bg-card px-6 py-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 border-t border-line py-3 text-sm first:border-t-0">
              <dt className="font-medium">{row.label}</dt>
              <dd className="flex items-center gap-3 text-right">
                <span className={row.value ? "" : "text-muted"}>{row.value ?? "Nicht eingerichtet"}</span>
                <Link href={row.href} className="text-meta text-muted underline underline-offset-2 hover:text-ink">
                  Ändern <span className="sr-only">{row.label}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          {name.trim() ? (
            <Link href="/new?fresh=1" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
              Erste Bewerbung starten
            </Link>
          ) : (
            <Link href="/profile" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
              Profil ausfüllen
            </Link>
          )}
          <Link href="/" className={buttonClassName("secondary")}>
            Zur Übersicht
          </Link>
        </div>
      </SetupFrame>
    );
  }

  if (step === "ai") {
    const [usable, view] = await Promise.all([isAiUsable(), loadAiSettingsView()]);
    const choice = choiceOf(view.provider, view.baseUrl);
    return (
      <SetupFrame
        step="ai"
        title="KI wählen"
        complete={usable}
        lead="Sie liest Stellenanzeigen und schreibt deine Lebensläufe und Anschreiben. Wähle, was dir am wichtigsten ist, und die Einrichtungshilfe zeigt dir, wohin du gehst, was du anklickst und was du hierher zurückkopierst."
      >
        <AiStep
          current={{
            usable,
            name: choice ? aiChoice(choice).name : providerOption(view.provider).name,
            model: view.model,
            choice,
            fromEnv: !settings.provider && Boolean(env.DOSSIER_AI_PROVIDER),
          }}
        />
      </SetupFrame>
    );
  }

  if (step === "jobs") {
    const view = jobSearchView(await loadJobSearchConfig());
    return (
      <SetupFrame
        step="jobs"
        title="Wo nach Jobs gesucht wird"
        complete={settings.jobSource !== null || view.source !== "OFF"}
        lead="„Jobs finden“ und der Job-Agent durchsuchen eine Quelle nach passenden Anzeigen. Du kannst auch jede Anzeige einfügen, die du selbst findest."
      >
        <JobsStep initial={view} />
      </SetupFrame>
    );
  }

  if (step === "scoring") {
    const view = scoringView(await loadScoringConfig());
    return (
      <SetupFrame
        step="scoring"
        title="Wie Anzeigen bewertet werden"
        complete={view.scorer === "AI" || view.keyState === "set" || view.keyState === "env"}
        lead="„Bewerten“ in „Jobs finden“ und der Job-Agent sagen, wie gut eine Anzeige zu deinem Profil passt, damit du die guten zuerst siehst. Lebensläufe und Anschreiben schreibt immer deine KI."
      >
        <ScoringStep initial={view} />
      </SetupFrame>
    );
  }

  if (step === "google") {
    const [connection, client, origin] = await Promise.all([googleView(), googleClientView(), requestOrigin()]);
    const uri = redirectUri(origin);
    return (
      <SetupFrame
        step="google"
        title="Gmail und Kalender"
        complete={connection.status === "connected"}
        lead="Optional, und der längste Schritt. Mit verbundenem Google-Konto verschickt Dossier Bewerbungen aus deinem Gmail, ordnet Antworten von Arbeitgebern zu, entwirft deine Antworten und bietet freie Termine an. Das braucht einmalig ein paar Seiten in der Google Cloud."
      >
        <GoogleStep
          connection={connection}
          client={client}
          redirectUri={uri}
          addressProblem={googleAddressProblem(uri)}
          outcome={typeof google === "string" ? google : null}
        />
      </SetupFrame>
    );
  }

  const [aiReady, ai, name] = await Promise.all([isAiConfigured(), loadAiConfig(), loadProfileName()]);
  return (
    <SetupFrame
      step="profile"
      title="Dein Profil"
      complete={Boolean(name.trim())}
      lead={
        name.trim()
          ? "Dein Profil hat schon deinen Namen. Ein importierter Lebenslauf ergänzt oder ersetzt es: Du entscheidest, wenn du gesehen hast, was gefunden wurde."
          : "Alles, was Dossier schreibt, entsteht aus deinem Profil: deinen Positionen, Fähigkeiten und deiner Ausbildung. Starte mit einem Lebenslauf, den du schon hast, oder überspring diesen Schritt und füll es selbst aus."
      }
    >
      <ProfileImport aiReady={aiReady} provider={ai.provider} initialJobId={typeof job === "string" ? job : null} keptFor={jobRetentionLabel(settings.jobRetentionHours)} inGuide />
    </SetupFrame>
  );
}
