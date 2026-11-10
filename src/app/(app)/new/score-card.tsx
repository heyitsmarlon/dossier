"use client";

import { FitDetails } from "@/components/fit-details";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PostingFit } from "@/lib/fit";

/**
 * "Score it" in the new application's review (public issue 66): how well the
 * posting fits overall, as Score does in Find jobs, so the decision to go on
 * can be made before anything is written.
 */
export function ScoreCard({ fit, scoring, step, onScore }: { fit: PostingFit | null; scoring: boolean; step: string | null; onScore: () => void }) {
  return (
    <Card padding="none" className="flex flex-col gap-3 px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-field font-medium">Wie gut es passt</h3>
          <p className="text-meta text-muted">Eine Bewertung von 0 bis 100 mit Begründung, wie in „Jobs finden“, vom Bewerter aus Einstellungen → Bewertung.</p>
        </div>
        <Button variant="secondary" size="sm" aria-disabled={scoring || undefined} onClick={() => !scoring && onScore()}>
          {scoring ? "Bewerte…" : fit ? "Neu bewerten" : "Bewerten"}
        </Button>
      </div>
      {scoring && (
        <p role="status" className="text-meta text-muted">
          {step ?? "Startet…"}
        </p>
      )}
      {fit && !scoring && <FitDetails fit={fit} />}
    </Card>
  );
}
