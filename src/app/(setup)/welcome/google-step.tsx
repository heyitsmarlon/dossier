"use client";

import { useState } from "react";

import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setupHref } from "@/lib/setup-guide";
import { GOOGLE_HELP, GOOGLE_STEPS } from "@/lib/setup/google";

import { CALLBACK_MESSAGES, ClientCard, type GoogleClientView, type GoogleConnectionView } from "../../(app)/settings/google-section";
import { InstructionList } from "./instruction-list";

const CONNECT = `/api/google/connect?return=${encodeURIComponent(setupHref("google"))}`;

/**
 * The guide's Gmail and Calendar step (E21-5): what it does, an address
 * Google won't take spotted first, Google Cloud's steps with the redirect
 * address to copy, the client saved right there, and Connect, which comes
 * back here.
 */
export function GoogleStep({
  connection,
  client,
  redirectUri,
  addressProblem,
  outcome,
}: {
  connection: GoogleConnectionView;
  client: GoogleClientView;
  redirectUri: string;
  addressProblem: "http" | "ip" | null;
  /** What came back from Google's consent page, if anything. */
  outcome: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
    } catch {
      toast("Kopieren hat nicht geklappt. Markiere die Adresse und kopiere sie selbst.");
    }
  };
  const message = outcome ? CALLBACK_MESSAGES[outcome] : null;

  if (connection.status === "connected") {
    return (
      <Card className="flex flex-col gap-2">
        <p className="text-sm">
          Verbunden als <strong className="font-medium">{connection.email}</strong>. Unter Einstellungen → Google legst du fest, was Dossier liest, und deine Arbeitszeiten.
        </p>
        <p className="text-meta text-muted">Änderst du dein Google-Passwort, wird Dossier getrennt: Verbinde es dann unter Einstellungen → Google neu.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <p role="status" className="rounded-card bg-warning-surface px-4 py-3 text-sm font-medium text-warning">
          {message}
        </p>
      )}
      {addressProblem ? (
        <Card className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Google akzeptiert die Adresse dieses Servers noch nicht.</p>
          <p className="text-pretty text-muted">
            {addressProblem === "ip"
              ? "Google braucht einen Namen wie jobs.example.com statt Zahlen wie 192.168.1.20."
              : "Google braucht eine Adresse, die mit https:// beginnt, außer bei localhost."}{" "}
            Dossier ist unter <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{new URL(redirectUri).origin}</span> erreichbar. Gib ihm einen Domainnamen mit https (die
            Installationsanleitungen im Wiki zeigen, wie), oder überspring diesen Schritt vorerst.
          </p>
          <a href={GOOGLE_HELP} target="_blank" rel="noopener noreferrer" className="self-start font-medium text-ink underline underline-offset-2">
            Mehr Hilfe im Wiki (englisch) <span className="sr-only">(öffnet in neuem Tab)</span>
          </a>
        </Card>
      ) : (
        <Card className="flex flex-col gap-6">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="font-medium">Was es kostet</dt>
            <dd className="text-pretty text-muted">Nichts. Google Cloud fragt eventuell nach Zahlungsdaten für andere Dienste; Gmail und Kalender brauchen das nicht.</dd>
            <dt className="font-medium">Deine Daten</dt>
            <dd className="text-pretty text-muted">
              Deine Mails und dein Kalender bleiben bei Google. Dossier liest die Antworten auf deine Bewerbungen, und die gewählte KI liest sie, um deine Antworten zu entwerfen. Nichts
              wird verschickt, ohne dass du auf Senden drückst.
            </dd>
          </dl>
          <InstructionList steps={GOOGLE_STEPS} label="Google einrichten" />
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Die Adresse für Schritt 6</span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-control border border-line-field bg-input px-3 py-2 font-mono text-label [overflow-wrap:anywhere]">{redirectUri}</code>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
            </div>
            <p className="text-label text-muted">Meldet Google redirect_uri_mismatch, warte ein paar Minuten und versuch es noch einmal: Eine neue Adresse braucht manchmal so lange.</p>
          </div>
          <ClientCard initial={client} connected={false} />
          <div className="flex flex-wrap items-center gap-3">
            {connection.status === "not-configured" ? (
              <Button aria-disabled title="Speichere zuerst Client-ID und Secret">
                Google verbinden
              </Button>
            ) : (
              <a href={CONNECT} className={buttonClassName("primary", "md", "hover:text-on-primary")}>
                Google verbinden
              </a>
            )}
            <a href={GOOGLE_HELP} target="_blank" rel="noopener noreferrer" className="text-meta text-muted underline underline-offset-2 hover:text-ink">
              Mehr Hilfe im Wiki (englisch) <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
