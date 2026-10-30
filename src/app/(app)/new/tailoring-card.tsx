"use client";

import { useId } from "react";

import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { Tone } from "@/generated/prisma/enums";
import { TONES } from "@/lib/tones";

const TONE_OPTIONS = Object.values(Tone).map((tone) => ({ value: tone, label: TONES[tone].label }));

/** "Tailoring" (E7-5, NEW-6): the cover letter's tone, and a note for the AI. */
export function TailoringCard({
  tone,
  note,
  onTone,
  onNote,
}: {
  tone: Tone;
  note: string;
  onTone: (tone: Tone) => void;
  onNote: (note: string) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Card className="flex flex-col gap-5 py-6">
      <h2 className="text-[15px] font-medium">Zuschnitt</h2>
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
