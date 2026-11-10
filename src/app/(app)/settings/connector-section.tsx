"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { copyText } from "@/lib/copy-text";

import { addConnectorRedirect, disconnectApps, removeConnectorRedirect, setConnector } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

const LINK = "font-medium text-ink underline underline-offset-2";

/**
 * Settings → MCP connector (#221, #281): Dossier as a connector for Claude
 * and other MCP apps, off until it's turned on here. Then it shows the
 * address to add in an app, Claude's steps, the other apps allowed to sign
 * in, and Disconnect all apps, which signs every one of them out.
 */
export function ConnectorSection({
  initial,
  address,
  inDesktopApp = false,
}: {
  initial: { on: boolean; redirects: string[] };
  address: string;
  /** On this computer, in the desktop app: an app's approval page opens in the browser, which the app signs in (#365). */
  inDesktopApp?: boolean;
}) {
  const track = useTrackSave();
  const [on, setOn] = useState(initial.on);
  const [redirects, setRedirects] = useState(initial.redirects);
  const [draft, setDraft] = useState("");
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(address);
  const publicHttps = address.startsWith("https://");

  const turn = async (next: boolean) => {
    setOn(next);
    const result = toastResult(await track(setConnector({ on: next })));
    if (!result.ok) setOn(!next);
  };

  const copy = async () => toast((await copyText(address)) ? "Adresse kopiert." : "Kopieren hat nicht geklappt. Markiere die Adresse und kopiere sie selbst.");

  const addRedirect = async () => {
    const uri = draft.trim();
    if (!uri) return;
    const result = toastResult(await track(addConnectorRedirect({ uri })));
    if (!result.ok) return;
    setRedirects(result.data.redirects);
    setDraft("");
  };

  const removeRedirect = async (uri: string) => {
    const result = toastResult(await track(removeConnectorRedirect({ uri })));
    if (result.ok) setRedirects(result.data.redirects);
  };

  return (
    <>
      <SettingsSectionIntro title="MCP-Connector">
        Nutze Dossier aus KI-Apps, die MCP sprechen: Claude in Chats auf claude.ai, in den Desktop- und Mobil-Apps und in seiner Kommandozeilen-App, oder andere Apps wie
        n8n. Sie können Jobs suchen, dein Profil und deine Bewerbungen lesen und die Bewerbungen und Bewertungen speichern, die sie schreiben. Sie verschicken und löschen nie etwas.
      </SettingsSectionIntro>

      {inDesktopApp && (
        <p className="text-meta text-muted">
          Auf diesem Rechner fragt eine App im Browser nach deiner Erlaubnis. Wähle dann in diesem Fenster Hilfe → Im Browser anmelden, und der
          Browser macht weiter.
        </p>
      )}

      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Apps verbinden lassen"
          description={
            on
              ? "An. Apps verbinden sich über die Adresse unten, sobald du dich bei Dossier angemeldet und sie erlaubt hast."
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
              <span className="text-label text-muted">Adresse zum Hinzufügen in einer App</span>
              <div className="flex flex-wrap items-center gap-3">
                <code className="min-w-0 flex-1 rounded-control border border-line-input bg-input px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]">
                  {address}
                </code>
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  Kopieren
                </Button>
              </div>
            </div>
            <h3 className="text-control font-medium">In Claude</h3>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-pretty">
              <li>
                Öffne <strong>Einstellungen → Connectors</strong> und wähle <strong>Benutzerdefinierten Connector hinzufügen</strong>.
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
                Claude im Web, auf dem Desktop und mobil sowie Cloud-Apps wie n8n Cloud erreichen Dossier von ihren eigenen Servern und brauchen daher eine öffentliche HTTPS-Adresse
                (setze <code className="font-mono text-label">DOSSIER_PUBLIC_URL</code>, falls Dossier unter einer anderen erreichbar ist). Claudes Kommandozeilen-App
                auf dem Rechner, auf dem Dossier läuft, kann diese nutzen.
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-control font-medium">Andere Apps</h3>
              <p className="text-sm text-pretty text-muted">
                Nachdem du eine App erlaubt hast, schickt Dossier dich an die Adresse der App zurück. Die von Claude sind bekannt; für jede andere App trag ihre Adresse hier
                genau so ein, wie die App sie anzeigt (bei n8n heißt sie OAuth Redirect URL). Wer eine hinzugefügte App nutzt, kann darüber dein Dossier lesen und ändern.
              </p>
            </div>
            {redirects.length > 0 && (
              <ul aria-label="Callback-Adressen der Apps" className="flex flex-col gap-2">
                {redirects.map((uri) => (
                  <li key={uri} className="flex flex-wrap items-center gap-3">
                    <code className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere]">{uri}</code>
                    <Button variant="text" size="sm" onClick={() => void removeRedirect(uri)}>
                      Entfernen <span className="sr-only">{uri}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Callback-Adresse"
                className="min-w-0 flex-1"
                inputClassName="font-mono text-[13.5px]"
                placeholder="https://your-app.example/oauth/callback"
                spellCheck={false}
                autoComplete="off"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addRedirect();
                  }
                }}
              />
              <Button variant="secondary" onClick={() => void addRedirect()}>
                Hinzufügen
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 text-sm text-pretty">
            <p>
              Was eine App über den Connector liest, geht an den Betreiber der App. Bei Claude ist das Anthropic, mit deinem Claude-Konto, wie alles in einem Chat:
              dein Profil ohne Kontaktdaten, die Anzeigen und Bewerbungen, an denen es arbeitet, und deine Suchen. Private Notizen sowie Absender und
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
              <Button variant="secondary" onClick={() => void track(disconnectApps({})).then(toastResult)}>
                Alle Apps trennen
              </Button>
              <p className="mt-2 text-meta text-muted">Meldet Claude und jede andere App ab. Das passiert auch, wenn du dein Passwort oder DOSSIER_SECRET änderst.</p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
