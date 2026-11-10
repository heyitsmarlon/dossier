"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast, toastResult } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { checkInbox, disconnectGoogleAccount, saveGoogleClient, saveGoogleSettings } from "@/lib/google/actions";
import { cn } from "@/lib/cn";

import { SettingsSectionIntro } from "./settings-screen";

export type GoogleSettings = {
  gmailRead: boolean;
  gmailScope: "known" | "all";
  gmailInterval: number;
  calendarAvailability: boolean;
  calendarEvents: boolean;
  calendarId: string;
  workDays: number[];
  workStart: string;
  workEnd: string;
  workTimeZone: string | null;
  slotMinutes: number;
  bufferMinutes: number;
};

/** Where each part of the OAuth client comes from; the secret itself never reaches the browser. */
export type GoogleClientView = {
  id: string;
  idState: "set" | "env" | "none" | "unreadable";
  secretState: "set" | "env" | "none" | "unreadable";
};

export type GoogleConnectionView =
  | { status: "not-configured" }
  | { status: "disconnected" }
  | {
      status: "connected";
      email: string;
      canSend: boolean;
      canRead: boolean;
      canUseCalendar: boolean;
      lastSync: string | null;
      syncProblem: string | null;
      signInProblem: string | null;
    };

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const INTERVALS = [5, 10, 15, 30, 60];
const LENGTHS = [15, 30, 45, 60, 90];
const BUFFERS = [0, 10, 15, 30];

/** What came back from Google's consent page, as a message. */
export const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Mit Google verbunden.",
  denied: "Google wurde kein Zugriff gewährt, daher hat sich nichts geändert.",
  expired: "Das hat zu lange gedauert oder wurde nicht hier gestartet. Verbinde dich noch einmal.",
  rejected: "Google hat die Anmeldung abgelehnt. Prüf Client-ID und Secret unten.",
  failed: "Die Verbindung mit Google hat nicht geklappt. Versuch es noch einmal.",
  "not-configured": "Google ist auf diesem Server noch nicht eingerichtet. Siehe die Schritte unten.",
};

/**
 * Settings → Google (E15-1): connect Gmail and Calendar, choose what Dossier
 * reads, and set the working hours that interview times are offered in.
 * Every field saves on its own. Nothing is ever sent without asking.
 */
export function GoogleSection({
  connection,
  client,
  initial,
  browserTimeZone,
  redirectUri,
  inDesktopApp = false,
}: {
  connection: GoogleConnectionView;
  client: GoogleClientView;
  initial: GoogleSettings;
  browserTimeZone: string | null;
  /** The address to register in Google Cloud. */
  redirectUri: string;
  /** On this computer, in the desktop app: Google's sign-in opens in the browser, signed in by the app (#327). */
  inDesktopApp?: boolean;
}) {
  const track = useTrackSave();
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [timeZone, setTimeZone] = useState(initial.workTimeZone ?? "");
  const [calendarId, setCalendarId] = useState(initial.calendarId);
  const [confirming, setConfirming] = useState(false);
  const [checking, startChecking] = useTransition();

  const change = (next: Partial<GoogleSettings>) => {
    const previous = settings;
    setSettings({ ...settings, ...next });
    void track(saveGoogleSettings(next as Parameters<typeof saveGoogleSettings>[0])).then((result) => {
      if (!toastResult(result).ok) setSettings(previous);
    });
  };

  const toggleDay = (day: number) =>
    change({ workDays: settings.workDays.includes(day) ? settings.workDays.filter((entry) => entry !== day) : [...settings.workDays, day].sort((a, b) => a - b) });

  const disconnect = async () => {
    if (toastResult(await disconnectGoogleAccount({})).ok) router.refresh();
  };

  const checkNow = () =>
    startChecking(async () => {
      toastResult(await checkInbox({}));
      router.refresh();
    });

  if (connection.status === "not-configured") return <SetupSteps redirectUri={redirectUri} client={client} />;

  return (
    <>
      <SettingsSectionIntro title="Google">
        Verschicke Bewerbungen aus deinem Gmail, sieh Antworten von Arbeitgebern direkt bei jeder Bewerbung und biete Gesprächstermine aus deinem
        Kalender an. Dossier fragt immer, bevor es etwas verschickt.
      </SettingsSectionIntro>

      <Card className="flex flex-col gap-4">
        {connection.status === "connected" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="flex items-center gap-2 text-control">
                <span aria-hidden className="size-2 flex-none rounded-full bg-success" />
                Verbunden als <span className="font-medium">{connection.email}</span>
              </p>
              <Button variant="danger-outline" size="sm" onClick={() => setConfirming(true)}>
                Trennen
              </Button>
            </div>
            {connection.signInProblem && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-4 py-3">
                <p role="alert" className="text-control text-error">
                  {connection.signInProblem} Until then, Dossier doesn&apos;t check your mail or calendar.
                </p>
                <a href="/api/google/connect" className={buttonClassName("secondary", "sm")}>
                  Neu verbinden
                </a>
              </div>
            )}
            <ul className="flex flex-col gap-1.5 text-meta text-muted">
              <Permission granted={connection.canSend} group="send" label="E-Mails von deiner Adresse senden" />
              <Permission granted={connection.canRead} group="read" label="Deine Mails lesen, um Antworten auf deine Bewerbungen zu finden" />
              <Permission granted={connection.canUseCalendar} group="calendar" label="Sehen, wann du frei bist, und Gespräche in deinen Kalender eintragen" />
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              Du meldest dich auf Googles eigener Seite an und wählst, was Dossier darf. Tokens werden verschlüsselt auf deinem Server gespeichert und
              verlassen ihn nie, außer zur Kommunikation mit Google.
            </p>
            <a href="/api/google/connect" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
              Google-Konto verbinden
            </a>
            {inDesktopApp && (
              <p className="flex flex-wrap items-center gap-x-2 text-meta text-muted">
                Die Google-Anmeldung öffnet sich in deinem Browser. Sobald dort „Verbunden“ steht, komm hierher zurück.
                <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => router.refresh()}>
                  Erneut prüfen
                </button>
              </p>
            )}
          </div>
        )}
      </Card>

      {connection.status === "connected" && (
        <>
          <Card padding="none" className="flex flex-col px-7 pt-1.5 pb-5">
            <Toggle
              className="py-4"
              label="Antworten lesen"
              description="Gmail nach Antworten von Arbeitgebern durchsuchen, sie Bewerbungen zuordnen und von der KI lesen lassen."
              checked={settings.gmailRead}
              disabled={!connection.canRead}
              onCheckedChange={(gmailRead) => change({ gmailRead })}
            />
            {settings.gmailRead && connection.canRead && (
              <div className="flex flex-col gap-4 border-t border-line pt-4">
                <div className="flex flex-col gap-[7px]">
                  <span id="gmail-scope" className="text-label text-muted">
                    Welche Mails
                  </span>
                  <SegmentedControl<"known" | "all">
                    aria-labelledby="gmail-scope"
                    size="sm"
                    options={[
                      { value: "known", label: "Von mir begonnene Verläufe und Firmen-Domains" },
                      { value: "all", label: "Jede neue E-Mail" },
                    ]}
                    value={settings.gmailScope}
                    onValueChange={(gmailScope) => change({ gmailScope })}
                  />
                  <p className="text-meta text-muted">
                    {settings.gmailScope === "known"
                      ? "Nur Mails, die zu einer Bewerbung passen, werden behalten und an die KI geschickt."
                      : "Mails ohne passende Bewerbung warten unter „Bitte ansehen“. Mit gehosteter KI werden sie zum Lesen an den Anbieter geschickt."}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <Select
                    label="Prüfen alle"
                    className="w-40"
                    value={settings.gmailInterval}
                    onChange={(event) => change({ gmailInterval: Number(event.target.value) })}
                  >
                    {INTERVALS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} Minuten
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" onClick={checkNow} disabled={checking}>
                    {checking ? "Prüfe…" : "Jetzt prüfen"}
                  </Button>
                  <p role="status" className={cn("flex items-center gap-2 pb-2 text-control", connection.syncProblem ? "text-error" : "text-muted")}>
                    {connection.syncProblem ?? (connection.lastSync ? `Zuletzt geprüft ${connection.lastSync}` : "Noch nicht geprüft")}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card padding="none" className="flex flex-col px-7 pt-1.5 pb-6">
            <Toggle
              className="py-4"
              label="Termine aus meinem Kalender anbieten"
              description="Bittet ein Arbeitgeber um ein Treffen, bietet die entworfene Antwort Zeiten an, zu denen du frei bist."
              checked={settings.calendarAvailability}
              disabled={!connection.canUseCalendar}
              onCheckedChange={(calendarAvailability) => change({ calendarAvailability })}
            />
            <Toggle
              className="border-t border-line py-4"
              label="Gespräche in meinen Kalender eintragen"
              description="Steht ein Termin fest, wird er mit Link zur Bewerbung eingetragen und synchron gehalten: Eine Änderung hier oder in Google gilt auf beiden Seiten."
              checked={settings.calendarEvents}
              disabled={!connection.canUseCalendar}
              onCheckedChange={(calendarEvents) => change({ calendarEvents })}
            />
            <div className="grid gap-x-[18px] gap-y-5 border-t border-line pt-5 sm:grid-cols-2">
              <div className="flex flex-col gap-[7px] sm:col-span-2">
                <span id="work-days" className="text-label text-muted">
                  Arbeitstage
                </span>
                <div role="group" aria-labelledby="work-days" className="flex flex-wrap gap-1.5">
                  {DAYS.map((label, index) => {
                    const on = settings.workDays.includes(index + 1);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(index + 1)}
                        className={cn(
                          "min-w-12 rounded-control border px-2.5 py-1.5 text-control",
                          on ? "border-primary bg-selected font-medium text-ink" : "border-line-field bg-input text-muted hover:border-line-strong",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Input label="Von" type="time" value={settings.workStart} onChange={(event) => event.target.value && change({ workStart: event.target.value })} />
              <Input label="Bis" type="time" value={settings.workEnd} onChange={(event) => event.target.value && change({ workEnd: event.target.value })} />
              <Select label="Gesprächsdauer" value={settings.slotMinutes} onChange={(event) => change({ slotMinutes: Number(event.target.value) })}>
                {LENGTHS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} Minuten
                  </option>
                ))}
              </Select>
              <Select label="Puffer um Termine" value={settings.bufferMinutes} onChange={(event) => change({ bufferMinutes: Number(event.target.value) })}>
                {BUFFERS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? "Kein Puffer" : `${minutes} Minuten`}
                  </option>
                ))}
              </Select>
              <Input
                label="Zeitzone"
                placeholder={browserTimeZone ?? "Europe/Berlin"}
                hint={browserTimeZone ? `Leer nutzt die deines Browsers: ${browserTimeZone}` : "Leer nutzt die deines Browsers"}
                value={timeZone}
                spellCheck={false}
                onChange={(event) => setTimeZone(event.target.value)}
                onBlur={() => timeZone.trim() !== (settings.workTimeZone ?? "") && change({ workTimeZone: timeZone.trim() || null })}
              />
              <Input
                label="Kalender"
                hint="primary ist dein Hauptkalender; oder die ID eines Kalenders aus den Einstellungen von Google Kalender"
                value={calendarId}
                spellCheck={false}
                onChange={(event) => setCalendarId(event.target.value)}
                onBlur={() => calendarId.trim() && calendarId.trim() !== settings.calendarId && change({ calendarId: calendarId.trim() })}
              />
            </div>
          </Card>
        </>
      )}

      <ClientCard initial={client} connected={connection.status === "connected"} />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Google trennen?"
        description="Der Zugriff von Dossier wird bei Google widerrufen. Mails, die schon in Dossier sind, bleiben; bis du dich neu verbindest, kommt nichts Neues dazu."
        confirmLabel="Trennen"
        onConfirm={() => void disconnect()}
      />
    </>
  );
}

/** A permission and, while it's missing, the link to allow it. */
function Permission({ granted, group, label }: { granted: boolean; group: string; label: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span aria-hidden className={cn("size-1.5 flex-none rounded-full", granted ? "bg-success" : "bg-faint")} />
      <span className={cn(granted && "text-ink")}>{label}</span>
      {!granted && (
        <a href={`/api/google/connect?scopes=${group}`} className="underline underline-offset-3">
          Erlauben
        </a>
      )}
      <span className="sr-only">{granted ? "(erlaubt)" : "(nicht erlaubt)"}</span>
    </li>
  );
}

/** Before the server has a Google client: how to make one. */
function SetupSteps({ redirectUri, client }: { redirectUri: string; client: GoogleClientView }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      toast("Weiterleitungs-URI kopiert.");
    } catch {
      toast("Kopieren hat nicht geklappt. Markiere sie und kopiere sie selbst.");
    }
  };
  return (
    <>
      <SettingsSectionIntro title="Google">
        Verbinde Gmail und Google Kalender, um Bewerbungen zu senden, Antworten zu lesen und Gesprächstermine anzubieten. Gib diesem Server zuerst einen
        Google-OAuth-Client.
      </SettingsSectionIntro>
      <Card className="flex flex-col gap-4 text-sm">
        <ol className="flex list-decimal flex-col gap-2.5 pl-5">
          <li>
            Leg in der <span className="font-medium">Google Cloud Console</span> ein Projekt an und aktiviere die{" "}
            <span className="font-medium">Gmail API</span> und die <span className="font-medium">Google Calendar API</span>.
          </li>
          <li>
            Richte den <span className="font-medium">OAuth-Zustimmungsbildschirm</span> als „Extern“ ein, trag dich als Testnutzer ein und{" "}
            <span className="font-medium">veröffentliche</span> ihn (In Produktion). Unveröffentlicht beendet Google den Zugriff nach 7 Tagen.
          </li>
          <li>
            Erstelle eine <span className="font-medium">OAuth-Client-ID</span> vom Typ Webanwendung mit dieser autorisierten Weiterleitungs-URI:
            <span className="mt-1.5 flex items-center gap-2">
              <code className="rounded-control border border-line-field bg-input px-2 py-1 font-mono text-label [overflow-wrap:anywhere]">
                {redirectUri}
              </code>
              <Button variant="text" size="sm" onClick={() => void copy()}>
                Kopieren
              </Button>
            </span>
          </li>
          <li>Füge ID und Secret des Clients unten ein.</li>
        </ol>
      </Card>
      <ClientCard initial={client} connected={false} />
    </>
  );
}

const SECRET_PLACEHOLDER: Record<GoogleClientView["secretState"], string> = {
  set: "Gespeichert · neues Secret eingeben, um es zu ersetzen",
  env: "Nutzt DOSSIER_GOOGLE_CLIENT_SECRET · eingeben, um hier eines zu speichern",
  none: "Verschlüsselt auf deinem Server gespeichert",
  unreadable: "Verschlüsselt auf deinem Server gespeichert",
};

/**
 * The OAuth client: its ID, and a write-only secret, each saved when you
 * leave its field. Saved here, they override the DOSSIER_GOOGLE_CLIENT_*
 * variables. A different client ID disconnects the account.
 */
export function ClientCard({ initial, connected }: { initial: GoogleClientView; connected: boolean }) {
  const track = useTrackSave();
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [id, setId] = useState(initial.id);
  const [secret, setSecret] = useState("");

  const save = async (change: Parameters<typeof saveGoogleClient>[0]) => {
    const result = toastResult(await track(saveGoogleClient(change)));
    if (!result.ok) return false;
    setView(result.data);
    setId(result.data.id);
    router.refresh();
    return true;
  };

  const saveId = () => {
    if (id.trim() === view.id) return;
    void save({ id });
  };
  const saveSecret = async () => {
    if (!secret.trim()) return;
    if (await save({ secret: { action: "set", value: secret } })) setSecret("");
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-control font-medium">OAuth-Client</h3>
        <p className="text-meta text-muted">
          {connected ? "Eine neue Client-ID trennt dein Google-Konto; verbinde es danach neu." : "Wird auf diesem Server gespeichert, kein Neustart nötig."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-[18px] gap-y-5 sm:grid-cols-2">
        <Input
          label="Client-ID"
          value={id}
          placeholder={view.idState === "env" ? "Nutzt DOSSIER_GOOGLE_CLIENT_ID" : "…apps.googleusercontent.com"}
          hint={view.idState === "env" ? "Aus DOSSIER_GOOGLE_CLIENT_ID · eingeben, um hier eine zu speichern" : undefined}
          spellCheck={false}
          autoComplete="off"
          inputClassName="font-mono text-[13.5px]"
          onChange={(event) => setId(event.target.value)}
          onBlur={saveId}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveId();
            }
          }}
        />
        <div className="flex flex-col gap-2.5">
          <Input
            label="Client-Secret"
            type="password"
            autoComplete="off"
            value={secret}
            placeholder={SECRET_PLACEHOLDER[view.secretState]}
            error={view.secretState === "unreadable" ? "Das gespeicherte Secret ist nicht lesbar, vermutlich weil sich DOSSIER_SECRET geändert hat. Gib es neu ein." : undefined}
            onChange={(event) => setSecret(event.target.value)}
            onBlur={() => void saveSecret()}
            onKeyDown={(event) => {
              if (event.key === "Enter" && secret.trim()) {
                event.preventDefault();
                void saveSecret();
              }
            }}
          />
          {(view.secretState === "set" || view.secretState === "unreadable") && (
            <Button variant="text" size="sm" className="self-start" onClick={() => void save({ secret: { action: "clear" } })}>
              Gespeichertes Secret entfernen
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
