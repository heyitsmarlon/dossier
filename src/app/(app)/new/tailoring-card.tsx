"use client";

import { useId } from "react";

import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { Tone } from "@/generated/prisma/enums";
import { DOCUMENTS_TO_WRITE, type DocumentsToWrite } from "@/lib/settings";
import { TONES } from "@/lib/tones";

const TONE_OPTIONS = Object.values(Tone).map((tone) => ({ value: tone, label: TONES[tone].label }));
const WRITE_LABELS: Record<DocumentsToWrite, string> = { both: "Resume and letter", resume: "Resume", letter: "Cover letter" };
const WRITE_OPTIONS = DOCUMENTS_TO_WRITE.map((value) => ({ value, label: WRITE_LABELS[value] }));

/** "Tailoring" (E7-5, NEW-6): what to write (#367), the cover letter's tone, and a note for the AI. */
export function TailoringCard({
  write,
  tone,
  note,
  onWrite,
  onTone,
  onNote,
}: {
  write: DocumentsToWrite;
  tone: Tone;
  note: string;
  onWrite: (write: DocumentsToWrite) => void;
  onTone: (tone: Tone) => void;
  onNote: (note: string) => void;
}) {
  const writeId = useId();
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Card className="flex flex-col gap-5 py-6">
      <h2 className="text-[15px] font-medium">Zuschnitt</h2>
      <div className="flex flex-col gap-[9px]">
        <span id={writeId} className="text-label text-muted">
          Write
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SegmentedControl aria-labelledby={writeId} options={WRITE_OPTIONS} value={write} onValueChange={onWrite} />
          {write !== "both" && <span className="text-meta text-muted">The other can be written later, from the application.</span>}
        </div>
      </div>
      {write !== "resume" && (
      <div className="flex flex-col gap-[9px]">
        <span id={labelId} className="text-label text-muted">
          Ton des Anschreibens
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SegmentedControl
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
            options={TONE_OPTIONS}
            value={tone}
            onValueChange={onTone}
          />
          <span id={descriptionId} className="text-meta text-muted">
            {TONES[tone].description}
          </span>
        </div>
      </div>
      )}
      <Textarea
        label="Gibt es etwas, das ich wissen sollte?"
        hint="Wird als Fakt für die KI bei der Bewerbung gespeichert. Später im Tab „Stellenanzeige“ änderbar."
        rows={3}
        placeholder="z. B. Ich ziehe im Januar nach Hamburg. Oder: Stell meine Forschungsarbeit in den Vordergrund."
        value={note}
        onChange={(event) => onNote(event.target.value)}
      />
    </Card>
  );
}
