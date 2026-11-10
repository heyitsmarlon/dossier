"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ScoreBadge } from "@/components/score-badge";
import { toast } from "@/components/toast";
import { useJob } from "@/hooks/use-job";
import { fitBand } from "@/lib/fit";
import type { ResumeFit } from "@/lib/resume-fit";

import { startScoringResume } from "./actions";

/**
 * Score / Score again on the Resume tab (#370): how well the tailored
 * resume, as it is now, fits the posting, by the scorer in Settings →
 * Scoring. Only on request; the reasons show on hover and to screen readers.
 */
export function ResumeScore({ applicationId, fit, scoring }: { applicationId: string; fit: ResumeFit | null; scoring: string | null }) {
  const router = useRouter();
  const [jobId, setJobId] = useState(scoring);
  const [starting, startTransition] = useTransition();
  const job = useJob(jobId, 0, (update) => {
    if (update.status === "DONE") {
      setJobId(null);
      router.refresh();
    }
    if (update.status === "FAILED") {
      toast(update.error ?? "Die Bewertung hat nicht geklappt. Versuch es noch einmal.");
      setJobId(null);
    }
  });
  const busy = starting || (jobId !== null && job?.status !== "DONE" && job?.status !== "FAILED");
  const reasons = fit ? [...fit.reasons, ...fit.redFlags.map((flag) => `Achtung: ${flag}`)] : [];

  const score = () =>
    startTransition(async () => {
      const result = await startScoringResume({ id: applicationId });
      if (!result.ok) return toast(result.error);
      setJobId(result.data);
    });

  return (
    <span className="flex items-center gap-2">
      {fit && (
        <span className="flex items-center gap-1.5" title={reasons.join("\n")}>
          <ScoreBadge score={fit.score} size="sm" />
          <span className="text-meta text-muted">{fitBand(fit.score)}</span>
          <span className="sr-only">{reasons.join(" ")}</span>
        </span>
      )}
      <button type="button" className="text-meta text-muted underline underline-offset-2 hover:text-ink disabled:no-underline" disabled={busy} onClick={score}>
        {busy ? "Bewerte…" : fit ? "Neu bewerten" : "Bewerten"}
      </button>
    </span>
  );
}
