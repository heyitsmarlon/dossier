"use client";

import { useState, type FormEvent } from "react";

import { toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CustomSectionFormat } from "@/generated/prisma/enums";
import { CUSTOM_SECTION_FORMATS, type CustomSection } from "@/lib/profile";

import { createCustomSection } from "./actions";

/** Common sections, each with the format it usually takes; picking one fills in both. */
const SUGGESTIONS: readonly { title: string; format: CustomSectionFormat }[] = [
  { title: "Auszeichnungen", format: "LINES" },
  { title: "Kurse", format: "LINES" },
  { title: "Vorträge", format: "LINES" },
  { title: "Führung", format: "ENTRIES" },
  { title: "Mitgliedschaften", format: "LINES" },
  { title: "Interessen", format: "INLINE" },
];

/** "Add a section" (#298, #338): a name and a format, then on to its page for its items. */
export function AddSectionForm({ onAdded, onCancel }: { onAdded: (section: CustomSection) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<CustomSectionFormat>("LINES");
  const [saving, setSaving] = useState(false);
  const hint = CUSTOM_SECTION_FORMATS.find((entry) => entry.value === format)!.hint;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = toastResult(await createCustomSection({ title, format }));
    if (result.ok) onAdded({ id: result.data, title: title.trim(), format, items: [] });
    else setSaving(false);
  };

  return (
    <Card>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <Input label="Name des Abschnitts" placeholder="Auszeichnungen" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required maxLength={100} />
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <ToggleChip
              key={suggestion.title}
              selected={title === suggestion.title}
              onClick={() => {
                setTitle(suggestion.title);
                setFormat(suggestion.format);
              }}
            >
              {suggestion.title}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span id="new-section-format" className="text-label font-medium">
            So erscheint es im Lebenslauf
          </span>
          <SegmentedControl aria-labelledby="new-section-format" options={CUSTOM_SECTION_FORMATS.map(({ value, label }) => ({ value, label }))} value={format} onValueChange={setFormat} />
          <p className="text-label text-muted">{hint} Du kannst später wechseln.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || !title.trim()}>
            Abschnitt hinzufügen
          </Button>
          <Button variant="text" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Card>
  );
}
