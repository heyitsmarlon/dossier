"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useTrackSave } from "@/components/save-tracker";
import { useJob } from "@/hooks/use-job";
import { IMPORT_MAX_BYTES, IMPORT_TOO_BIG } from "@/lib/import-limits";
import type { JobView } from "@/lib/jobs/runner";
import { downloadFrom } from "@/lib/save-file";
import { JOB_RETENTION_OPTIONS } from "@/lib/settings";

import { deleteEverything, startZippingPdfs, updateSettings } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

type ZipResult = { file: string; fileName: string; documents: number };
/** Nightly backups (E10-7) as the server sees them. */
export type BackupStatus = {
  on: boolean;
  retentionDays: number;
  /** DOSSIER_DATA_DIR/backups */
  dir: string;
  /** "today at 03:00", or null before the first one. */
  lastRun: string | null;
  /** Why the last one failed, if it did. */
  problem: string | null;
  /** In the desktop app on this computer, which isn't always on at 03:00 (#325). */
  onlyWhileOpen?: boolean;
};

type Summary = { applications: number; roles: number; skills: number; themes: number; notes: number };
type Preview = { file: File; incoming: Summary; current: Summary; exportedAt: string };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** "8 Bewerbungen, 3 Positionen, 12 Fähigkeiten und 1 eigenes Design" */
function describe({ applications, roles, skills, themes }: Summary): string {
  const parts = [count(applications, "Bewerbung", "Bewerbungen"), count(roles, "Position", "Positionen"), count(skills, "Fähigkeit", "Fähigkeiten")];
  if (themes > 0) parts.push(count(themes, "eigenes Design", "eigene Designs"));
  return `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)}`;
}

/** An import request's answer: the JSON, or a plain error. */
async function send(file: File, preview: boolean): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/import${preview ? "?preview=1" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: file,
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 413) return { ok: false, error: typeof body?.error === "string" ? body.error : "Diese Datei ist zu groß für diesen Server." };
    if (!response.ok || !body) return { ok: false, error: typeof body?.error === "string" ? body.error : "Der Import hat nicht geklappt. Versuch es noch einmal." };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: "Du scheinst offline zu sein. Versuch es noch einmal, wenn du verbunden bist." };
  }
}

/**
 * Settings → Your data (E10-4 to E10-8, SET-10, SET-11): take everything
 * out, bring it back, keep backups, or delete it all.
 */
export function DataSection({
  hasApiKey,
  exportName,
  backups,
  jobRetentionHours,
}: {
  hasApiKey: boolean;
  exportName: string;
  backups: BackupStatus;
  /** How long finished background jobs are kept. */
  jobRetentionHours: number;
}) {
  const [includeKey, setIncludeKey] = useState(false);
  const router = useRouter();
  const track = useTrackSave();
  const [nightly, setNightly] = useState(backups.on);
  const [retention, setRetention] = useState(jobRetentionHours);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const [zipJob, setZipJob] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // E10-5: follow the zip; when it's ready, offer it.
  const zip = useJob<ZipResult>(zipJob, 0, (job: JobView<ZipResult>) => {
    if (job.status === "FAILED") toast(job.error ?? "Das ZIP konnte nicht erstellt werden. Versuch es noch einmal.");
    if (job.status === "DONE" && job.result) {
      toast(`${job.result.fileName} ist fertig.`, {
        action: { label: "Herunterladen", onClick: () => downloadFrom(`/api/downloads/${job.id}`) },
      });
    }
  });
  const zipping = starting || (zip !== null && zip.status !== "DONE" && zip.status !== "FAILED");

  // E10-6: read the file, say what it replaces, and only then import.
  const chooseFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) return toast(IMPORT_TOO_BIG);
    setImporting(true);
    const result = await send(file, true);
    setImporting(false);
    if (!result.ok) return toast(result.error);
    setPreview({ file, ...(result.data as Omit<Preview, "file">) });
  };

  const runImport = async (file: File) => {
    setImporting(true);
    toast("Sichere deine Daten, dann wird importiert…");
    const result = await send(file, false);
    setImporting(false);
    if (!result.ok) return toast(result.error);
    toast(`Importiert. Deine bisherigen Daten sind gesichert als ${String(result.data.backup)}.`);
    router.refresh();
  };

  const switchBackups = (on: boolean) => {
    setNightly(on);
    void track(updateSettings({ nightlyBackup: on })).then((result) => {
      if (!result.ok) {
        setNightly(!on);
        toast(result.error);
      }
    });
  };

  const changeRetention = (hours: number) => {
    const before = retention;
    setRetention(hours);
    void track(updateSettings({ jobRetentionHours: hours })).then((result) => {
      if (!result.ok) {
        setRetention(before);
        toast(result.error);
      }
    });
  };

  const zipAll = async () => {
    setStarting(true);
    const result = await startZippingPdfs({});
    setStarting(false);
    if (!result.ok) return toast(result.error);
    setZipJob(result.data.jobId);
    toast(`Packe ${result.data.documents} Dokumente als ZIP. Das dauert einen Moment.`);
  };

  return (
    <>
      <SettingsSectionIntro title="Deine Daten">
        Alles, was du eingibst, liegt in einer Datenbank auf deinem Server, und nichts wird verkauft: Es gibt niemanden, an den. Was ihn verlässt, geht an
        den KI-Anbieter und die Jobquelle deiner Wahl, an Google, wenn du Gmail verbindest, und an den täglichen Nutzungs-Ping und die Update-Prüfung (siehe Über).
      </SettingsSectionIntro>
      <Card padding="none" className="flex flex-col px-7 pt-1.5 pb-2.5">
        <DataRow
          title="Alles exportieren"
          description="Profil, Bewerbungen, Unterlagen und Designs in einer JSON-Datei. Praktisch für Backups oder einen Serverumzug."
          action={
            <DownloadPdfButton
              variant="secondary"
              size="sm"
              href={`/api/export${includeKey ? "?apiKey=1" : ""}`}
              held={false}
              progress={`Bereite ${exportName} vor…`}
            >
              Exportieren
            </DownloadPdfButton>
          }
        >
          {hasApiKey && (
            <Checkbox
              className="pt-1"
              label="Meine API-Schlüssel einschließen"
              checked={includeKey}
              onChange={(event) => setIncludeKey(event.target.checked)}
              hint={
                includeKey
                  ? "Deine API-Schlüssel (KI-Anbieter und Jobsuche) landen im Klartext in der Datei, jeder mit der Datei kann sie nutzen. Bewahr sie sicher auf."
                  : "Standardmäßig ausgelassen: Ein anderer Server könnte die verschlüsselte Kopie ohnehin nicht lesen."
              }
            />
          )}
        </DataRow>
        <DataRow
          title="Alle PDFs herunterladen"
          description="Jeder zugeschnittene Lebenslauf und jedes Anschreiben, als ZIP nach Firma sortiert."
          action={
            <Button variant="secondary" size="sm" aria-disabled={zipping || undefined} onClick={() => !zipping && void zipAll()}>
              {zipping ? "Packe…" : "Herunterladen"}
            </Button>
          }
        >
          {zipping && zip?.step && (
            <p role="status" className="text-meta text-muted">
              {zip.step}…
            </p>
          )}
          {zip?.status === "DONE" && zip.result && (
            <p>
              <a href={`/api/downloads/${zip.id}`} download className={buttonClassName("text", "sm", "underline underline-offset-2")}>
                {zip.result.fileName} herunterladen
              </a>
            </p>
          )}
        </DataRow>
        <DataRow
          title="Importieren"
          description="Aus einer Exportdatei wiederherstellen. Deine aktuellen Daten werden vorher gesichert."
          action={
            <>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
              <Button variant="secondary" size="sm" aria-disabled={importing || undefined} onClick={() => !importing && fileInput.current?.click()}>
                {importing ? "Importiere…" : "Datei wählen"}
              </Button>
            </>
          }
        />
        <DataRow
          title="Aufgabendaten aufbewahren für"
          description="Was die KI für eine Aufgabe bekommen und geschrieben hat: eine Anzeige, den Text deines Lebenslaufs, Entwürfe, aus denen keine Bewerbung wurde. Es wird für Neuladen und Rückgängig aufbewahrt, dann gelöscht. Bewerbungen behalten ihre eigenen Unterlagen, bis du sie löschst."
          action={
            <Select
              aria-label="Aufgabendaten aufbewahren für"
              value={retention}
              onChange={(event) => changeRetention(Number(event.target.value))}
            >
              {JOB_RETENTION_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  {option.label}
                </option>
              ))}
            </Select>
          }
        />
        <div className="flex flex-col gap-2 border-t border-line py-4">
          <Toggle
            label="Nächtliche Backups"
            description={
              nightly
                ? `${backups.retentionDays} Tage aufbewahrt in ${backups.dir}. ${
                    backups.lastRun ? `Das letzte lief ${backups.lastRun}.` : "Das erste läuft heute Nacht um 03:00."
                  }${backups.onlyWhileOpen ? " Auf diesem Rechner laufen sie nur, solange Dossier offen ist: Eine verpasste Nacht wird kurz nach dem Öffnen nachgeholt." : ""}`
                : "Aus. Du hast nur, was du selbst exportierst."
            }
            checked={nightly}
            onCheckedChange={switchBackups}
          />
          {nightly && backups.problem && (
            <p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-meta text-error">
              Das letzte Backup ist fehlgeschlagen: {backups.problem}
            </p>
          )}
        </div>
      </Card>
      <DangerZone />
      {preview && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPreview(null)}
          title="Alles durch diesen Export ersetzen?"
          description={
            <>
              Die Datei, exportiert am {new Date(preview.exportedAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}, enthält{" "}
              {describe(preview.incoming)}. Sie ersetzt dein Profil, deine Einstellungen und {describe(preview.current)}. Deine aktuellen Daten werden
              vorher gesichert.
            </>
          }
          confirmLabel="Importieren und ersetzen"
          onConfirm={() => void runImport(preview.file)}
        />
      )}
    </>
  );
}

/** One row of the data card: what it does on the left, its control on the right. */
export function DataRow({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: ReactNode;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
          <h3 className="text-field">{title}</h3>
          <p className="text-meta text-muted">{description}</p>
        </div>
        <div className="flex-none">{action}</div>
      </div>
      {children}
    </div>
  );
}

const CONFIRMATION = "DELETE";

/** "Delete everything" (E10-8, SET-11): typed confirmation, then gone for good. */
function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const ready = typed === CONFIRMATION;

  const deleteAll = async () => {
    if (!ready) return toast("Tippe zur Bestätigung DELETE in Großbuchstaben.");
    setDeleting(true);
    // On success the action takes you to the empty dashboard.
    const result = await deleteEverything({ confirm: CONFIRMATION });
    setDeleting(false);
    if (result && !result.ok) toast(result.error);
  };

  return (
    <section
      aria-labelledby="danger-heading"
      className="flex flex-col gap-3.5 rounded-panel border border-danger-line bg-danger-surface px-7 py-[22px]"
    >
      <div className="flex flex-col gap-1">
        <h3 id="danger-heading" className="text-[15px] font-medium text-error-strong">
          Alles löschen
        </h3>
        <p className="text-control text-muted">
          Entfernt dein Profil, alle Bewerbungen und Unterlagen, deine Einstellungen und die Backups von diesem Server. Das lässt sich nicht
          rückgängig machen, exportiere also vorher, falls du es zurückhaben willst.
        </p>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Zur Bestätigung DELETE tippen"
            placeholder="Zur Bestätigung DELETE tippen"
            // Opened on request, so the box takes focus.
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void deleteAll();
              else if (event.key === "Escape") setConfirming(false);
            }}
            className="min-w-0 flex-[1_1_200px] rounded-control border border-line-input bg-input px-3 py-2.5 font-mono text-[13.5px] focus-visible:border-error-strong focus-visible:outline-offset-0"
          />
          <Button
            variant="danger"
            size="sm"
            aria-disabled={!ready || deleting || undefined}
            onClick={() => !deleting && void deleteAll()}
            className={ready ? undefined : "bg-danger-disabled hover:bg-danger-disabled"}
          >
            {deleting ? "Lösche…" : "Endgültig löschen"}
          </Button>
          <Button
            variant="text"
            size="sm"
            className="px-3!"
            onClick={() => {
              setConfirming(false);
              setTyped("");
            }}
          >
            Abbrechen
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="danger-outline" size="sm" onClick={() => setConfirming(true)}>
            Alles löschen…
          </Button>
        </div>
      )}
    </section>
  );
}
