"use client";

import Link from "next/link";
import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { UPGRADE_GUIDE_URL, type Release } from "@/lib/releases";

import { chooseUsagePing } from "../actions";
import { USAGE_PING_PRIVACY_URL } from "../usage-ping-dialog";
import { checkUpdates, updateSettings } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

export type AboutFacts = { label: string; value: string }[];

/** The update check as the server sees it. */
export type UpdatesView = {
  /** "Check for updates daily". */
  daily: boolean;
  /** A newer release than this one, if a check has found one. */
  available: Release | null;
};

/** The usage ping as the server sees it (#172). */
export type UsagePingView = {
  host: string;
  /** Whether it's wanted; null until someone answers. */
  choice: "on" | "off" | null;
  /** Who decided: DOSSIER_TELEMETRY, or an answer in the app. */
  source: "env" | "app" | null;
  /** The install ID it sends, once the first ping has made one. */
  id: string | null;
  /** Development servers never send it. */
  production: boolean;
};

type Check = { status: "idle" } | { status: "checking" } | { status: "latest" } | ({ status: "newer" } & Release) | { status: "unknown" };

const LINK = "font-medium text-ink underline underline-offset-2";

/**
 * Settings → About (E10-9, SET-12): facts about this install, and the update
 * check: daily while it's on, and whenever asked.
 */
export function AboutSection({ facts, usagePing, updates }: { facts: AboutFacts; usagePing: UsagePingView; updates: UpdatesView }) {
  const [check, setCheck] = useState<Check>(updates.available ? { status: "newer", ...updates.available } : { status: "idle" });
  const [daily, setDaily] = useState(updates.daily);
  const [pinging, setPinging] = useState(usagePing.choice === "on");
  const [answered, setAnswered] = useState(usagePing.choice !== null);
  const track = useTrackSave();

  // Withdrawing is as easy as agreeing (GDPR Art. 7(3)); a no forgets the install ID.
  const switchPing = (on: boolean) => {
    const before = { pinging, answered };
    setPinging(on);
    setAnswered(true);
    void track(chooseUsagePing({ send: on })).then((result) => {
      if (!result.ok) {
        setPinging(before.pinging);
        setAnswered(before.answered);
        toast(result.error);
      }
    });
  };
  const fromEnv = usagePing.source === "env";
  const pingDescription = !usagePing.production
    ? "Entwicklungsserver senden ihn nie."
    : fromEnv
      ? `Über DOSSIER_TELEMETRY=${usagePing.choice} auf dem Server festgelegt, das gilt, solange es gesetzt ist. Dort ändern.`
      : pinging
        ? `An. Einmal an jedem Tag, an dem Dossier genutzt wird, sendet der Server an ${usagePing.host} ${usagePing.id ? `die ID dieser Installation (${usagePing.id})` : "die ID dieser Installation, die beim ersten Ping erzeugt wird,"} und die Versionsnummer. Sonst nichts.`
        : answered
          ? "Aus. Es wird nichts gesendet, und die ID dieser Installation ist vergessen."
          : "Noch nicht beantwortet, daher wird nichts gesendet.";

  const run = async () => {
    setCheck({ status: "checking" });
    const result = await checkUpdates({});
    setCheck(result.ok ? result.data : { status: "unknown" });
  };

  const switchDaily = (on: boolean) => {
    setDaily(on);
    void track(updateSettings({ updateCheck: on })).then((result) => {
      if (!result.ok) {
        setDaily(!on);
        toast(result.error);
      }
    });
  };

  return (
    <>
      <SettingsSectionIntro title="Über diese Installation">Frei und quelloffen. Keine Konten, keine Abos.</SettingsSectionIntro>
      <Card padding="none" className="px-7 py-2">
        <dl>
          {facts.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 border-t border-line py-3.5 text-sm first:border-t-0">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-mono text-[13px] [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card padding="none" className="flex flex-wrap items-center justify-between gap-3 px-7 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Einrichtungshilfe</span>
          <span className="text-meta text-muted">Führt Schritt für Schritt durch KI, Jobsuche, Bewertung, Gmail und Kalender sowie dein Profil.</span>
        </div>
        <Link href="/welcome?step=start" className={buttonClassName("secondary", "sm")}>
          Einrichtungshilfe öffnen
        </Link>
      </Card>
      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Täglichen Nutzungs-Ping senden"
          description={pingDescription}
          checked={usagePing.production && (fromEnv ? usagePing.choice === "on" : pinging)}
          disabled={!usagePing.production || fromEnv}
          onCheckedChange={switchPing}
        />
      </Card>
      <Card padding="none" className="px-7 py-4">
        <Toggle
          label="Täglich nach Updates suchen"
          description={
            daily
              ? "Einmal an jedem Tag, an dem Dossier genutzt wird, fragt der Server GitHub nach der neuesten Version, und die Seitenleiste zeigt an, wenn eine neuere da ist."
              : "Aus. Dossier prüft nur, wenn du auf „Nach Updates suchen“ drückst."
          }
          checked={daily}
          onCheckedChange={switchDaily}
        />
      </Card>
      <div className="flex flex-wrap items-center gap-3.5">
        <Button variant="secondary" aria-disabled={check.status === "checking" || undefined} onClick={() => check.status !== "checking" && void run()}>
          {check.status === "checking" ? "Prüfe…" : "Nach Updates suchen"}
        </Button>
        <p role="status" className="text-control text-muted">
          {check.status === "latest" && "Du nutzt die neueste Version."}
          {check.status === "unknown" && "Konnte gerade nicht nach Updates suchen."}
          {check.status === "newer" && (
            <>
              Version {check.version} ist verfügbar.{" "}
              <a href={check.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                Was ist neu{" "}
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
              {" · "}
              <a href={UPGRADE_GUIDE_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
                So aktualisierst du{" "}
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            </>
          )}
        </p>
      </div>
      <p className="text-meta text-muted">Die Prüfung fragt GitHub nach der neuesten Version und sendet nichts über dich oder diese Installation, weder täglich noch auf Knopfdruck.</p>
      <p className="text-meta text-muted">
        Der Nutzungs-Ping geht erst raus, wenn du zustimmst. Er teilt dem Betreuer des Dossier-Projekts auf dessen eigenem Server mit, wie viele Installationen wie oft genutzt werden. Die ID ist zufällig und sagt nichts über dich, und Gespeichertes wird nach einem Jahr gelöscht. Wenn die bereits gespeicherten Einträge dieser Installation früher entfernt werden sollen, notiere ihre ID, schalte den Ping aus und schick die ID an{" "}
        <a href="mailto:dossier.app@pm.me" className={LINK}>
          dossier.app@pm.me
        </a>
        ; du bekommst eine Bestätigung, sobald sie gelöscht sind.{" "}
        <a href={USAGE_PING_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
          Mehr unter Datenschutz <span className="sr-only">(öffnet in neuem Tab)</span>
        </a>
      </p>
    </>
  );
}
