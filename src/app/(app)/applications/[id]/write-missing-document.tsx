"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { useJob } from "@/hooks/use-job";
import type { WritableKind } from "@/lib/jobs/write-document";

import { startWritingDocument } from "./actions";

const NAMES: Record<WritableKind, string> = { RESUME: "zugeschnittenen Lebenslauf", COVER_LETTER: "Anschreiben" };

/**
 * In place of a document the application was created without (#367): it
 * says so, and writes it on request, in the background. A reloaded page
 * picks up a document still being written.
 */
export function WriteMissingDocument({
  applicationId,
  kind,
  aiReady,
  writing,
}: {
  applicationId: string;
  kind: WritableKind;
  aiReady: boolean;
  /** The job writing it, e.g. since before a reload. */
  writing: string | null;
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState(writing);
  const [starting, startTransition] = useTransition();
  const job = useJob(jobId, 0, (update) => {
    if (update.status === "DONE") router.refresh();
    if (update.status === "FAILED") {
      toast(update.error ?? "Das Schreiben hat nicht geklappt. Versuch es noch einmal.");
      setJobId(null);
    }
  });
  const busy = starting || (jobId !== null && job?.status !== "FAILED");

  const write = () =>
    startTransition(async () => {
      const result = await startWritingDocument({ id: applicationId, kind });
      if (!result.ok) return toast(result.error);
      setJobId(result.data);
    });

  return (
    <div className="flex flex-1 justify-center overflow-auto bg-canvas px-10 pt-16 pb-16">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <p className="text-muted">
          {busy
            ? `${job?.step ?? `Schreibe ${NAMES[kind]}`}…`
            : `Diese Bewerbung wurde ohne ${NAMES[kind]} angelegt.${aiReady ? "" : " Zum Schreiben brauchst du einen KI-Anbieter (Einstellungen → KI-Anbieter)."}`}
        </p>
        {aiReady && (
          <Button variant="secondary" disabled={busy} onClick={write}>
            {busy ? "Schreibe…" : `${kind === "RESUME" ? "Lebenslauf" : "Anschreiben"} schreiben`}
          </Button>
        )}
      </div>
    </div>
  );
}
