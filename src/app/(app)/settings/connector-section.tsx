"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { copyText } from "@/lib/copy-text";

import { disconnectClaude, setConnector } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

const LINK = "font-medium text-ink underline underline-offset-2";

/**
 * Settings → Claude connector (#221): Dossier as a connector in Claude, off
 * until it's turned on here. Then it shows the address to add in Claude,
 * and Disconnect Claude signs every Claude out.
 */
export function ConnectorSection({ initial, address }: { initial: { on: boolean }; address: string }) {
  const track = useTrackSave();
  const [on, setOn] = useState(initial.on);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(address);
  const publicHttps = address.startsWith("https://");

  const turn = async (next: boolean) => {
    setOn(next);
    const result = toastResult(await track(setConnector({ on: next })));
    if (!result.ok) setOn(!next);
  };

  const copy = async () => toast((await copyText(address)) ? "Adresse kopiert." : "Kopieren hat nicht geklappt. Markiere die Adresse und kopiere sie selbst.");

  return (
    <>
      <SettingsSectionIntro title="Claude-Connector">
        Nutze Dossier aus Claude heraus: in Chats auf claude.ai, in den Desktop- und Mobil-Apps und in Claudes Kommandozeilen-App. Claude kann Jobs suchen, dein
        Profil und deine Bewerbungen lesen und die Bewerbungen und Bewertungen speichern, die es schreibt, mit deinem eigenen Claude-Tarif. Es verschickt und löscht nie etwas.
      </SettingsSectionIntro>

      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Claude verbinden lassen"
          description={
            on
              ? "An. Claude verbindet sich über die Adresse unten, sobald du dich bei Dossier angemeldet und es erlaubt hast."
              : "Aus. Die Adressen des Connectors sind auf diesem Server nicht offen."
          }
          checked={on}
          onCheckedChange={(checked) => void turn(checked)}
        />
      </Card>

      {on && (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-[7px]">
              <span className="text-label text-muted">Adresse zum Hinzufügen in Claude</span>
              <div className="flex flex-wrap items-center gap-3">
                <code className="min-w-0 flex-1 rounded-control border border-line-input bg-input px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]">
                  {address}
                </code>
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  Kopieren
                </Button>
              </div>
            </div>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-pretty">
              <li>
                Öffne in Claude <strong>Einstellungen → Connectors</strong> und wähle <strong>Benutzerdefinierten Connector hinzufügen</strong>.
              </li>
              <li>
                Nenn ihn <strong>Dossier</strong>, füge die Adresse ein und drück <strong>Hinzufügen</strong>, dann <strong>Verbinden</strong>.
              </li>
              <li>
                Claude öffnet Dossier: Melde dich an, falls gefragt, prüf, was Claude darf, und drück <strong>Erlauben</strong>.
              </li>
            </ol>
            <p className="text-meta text-muted">
              In Claudes Kommandozeilen-App: <code className="font-mono text-label">claude mcp add --transport http dossier {address}</code>, dann{" "}
              <code className="font-mono text-label">/mcp</code> zum Anmelden.
            </p>
            {!publicHttps && (
              <p role="note" className="rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
                {local ? "Das ist eine lokale Adresse. " : "Diese Adresse ist kein HTTPS. "}
                Claude im Web, auf dem Desktop und mobil erreicht Dossier von Anthropics Servern aus und braucht daher eine öffentliche HTTPS-Adresse (setze{" "}
                <code className="font-mono text-label">DOSSIER_PUBLIC_URL</code>, falls Dossier unter einer anderen erreichbar ist). Claudes Kommandozeilen-App auf dem
                Rechner, auf dem Dossier läuft, kann diese nutzen.
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-3 text-sm text-pretty">
            <p>
              Was Claude über den Connector liest, geht mit deinem Claude-Konto an Anthropic, wie alles in einem Chat: dein Profil
              ohne Kontaktdaten, die Anzeigen und Bewerbungen, an denen es arbeitet, und deine Suchen. Private Notizen sowie Absender und
              Unterschrift des Anschreibens bleiben außen vor.{" "}
              <a href="https://github.com/AienTech/dossier/wiki/Connecting-Claude" target="_blank" rel="noopener noreferrer" className={LINK}>
                Claude verbinden
              </a>{" "}
              erklärt die Details (englisch).
            </p>
            <p className="text-muted">
              Ohne eigenes KI-Modell geben „Neue Bewerbung“ und „Bewerten“ in „Jobs finden“ die Arbeit an einen neuen Claude-Chat ab, der sie
              über den Connector hier speichert.
            </p>
            <div>
              <Button
                variant="secondary"
                onClick={() => void track(disconnectClaude({})).then(toastResult)}
              >
                Claude trennen
              </Button>
              <p className="mt-2 text-meta text-muted">Meldet jedes Claude ab. Das passiert auch, wenn du dein Passwort oder DOSSIER_SECRET änderst.</p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
