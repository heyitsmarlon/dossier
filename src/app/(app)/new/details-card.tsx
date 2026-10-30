"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { Details } from "./new-application";

const FIELDS: { field: Exclude<keyof Details, "title" | "deadline">; label: string; placeholder?: string }[] = [
  { field: "company", label: "Firma" },
  { field: "role", label: "Stelle" },
  { field: "location", label: "Ort", placeholder: "Nicht genannt" },
  { field: "mode", label: "Arbeitsmodell", placeholder: "Nicht genannt" },
  { field: "salary", label: "Gehalt", placeholder: "Nicht genannt" },
];

/**
 * "The application" (E7-3, NEW-3): what the AI read from the posting, all
 * editable. What the posting doesn't say stays empty; nothing is filled in.
 */
export function DetailsCard({ details, onChange }: { details: Details; onChange: (details: Details) => void }) {
  const set = (field: keyof Details, value: string) => onChange({ ...details, [field]: value });
  return (
    <Card className="grid grid-cols-1 gap-x-[18px] gap-y-5 sm:grid-cols-2">
      <h2 tabIndex={-1} className="text-[15px] font-medium sm:col-span-2">
        Die Bewerbung
      </h2>
      <Input
        className="sm:col-span-2"
        label={
          <span className="flex justify-between gap-3">
            <span>Titel</span>
            <span className="text-muted">Von der KI vorgeschlagen. Ändere ihn, wenn du magst</span>
          </span>
        }
        inputClassName="text-base font-medium"
        value={details.title}
        onChange={(event) => set("title", event.target.value)}
      />
      {FIELDS.map(({ field, label, placeholder }) => (
        <Input key={field} label={label} placeholder={placeholder} value={details[field]} onChange={(event) => set(field, event.target.value)} />
      ))}
      <Input
        label="Bewerben bis"
        type="date"
        value={details.deadline}
        onChange={(event) => set("deadline", event.target.value)}
        hint={details.deadline ? undefined : "Keine Frist"}
      />
    </Card>
  );
}
