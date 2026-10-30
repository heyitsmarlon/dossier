"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import type { ProfilePhoto } from "@/lib/photo";
import { ageOn, isOptionalBasic, type Basics, type BasicsField } from "@/lib/profile";

import { saveBasics } from "./actions";
import { PhotoField } from "./photo-field";
import { useTrackSave } from "@/components/save-tracker";

type FieldSpec = {
  field: Exclude<BasicsField, "summary">;
  label: string;
  wide?: boolean;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
};

// PRO-1, in the prototype's order and layout.
const FIELDS: FieldSpec[] = [
  { field: "name", label: "Vollständiger Name", wide: true, placeholder: "Max Mustermann", autoComplete: "name" },
  { field: "headline", label: "Berufsbezeichnung", wide: true, placeholder: "Senior Webdesigner" },
  { field: "email", label: "E-Mail", type: "email", placeholder: "max.mustermann@example.com", autoComplete: "email" },
  { field: "phone", label: "Telefon", type: "tel", placeholder: "+49 151 23456789", autoComplete: "tel" },
  { field: "dob", label: "Geburtsdatum", type: "date", autoComplete: "bday" },
  { field: "website", label: "Website", placeholder: "maxmustermann.de", autoComplete: "url" },
  { field: "address", label: "Straße und Hausnummer", wide: true, placeholder: "Musterstraße 12", autoComplete: "street-address" },
  { field: "city", label: "Ort", placeholder: "50667 Köln", autoComplete: "address-level2" },
  { field: "country", label: "Land", placeholder: "Deutschland", autoComplete: "country-name" },
  { field: "linkedin", label: "LinkedIn", wide: true, placeholder: "linkedin.com/in/maxmustermann" },
];

// Gentle format hints: they never block saving.
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const looksLikeWebAddress = (value: string) =>
  /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i.test(value.trim());

function formatHint(field: BasicsField, value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (field === "email" && !looksLikeEmail(value)) return "Das sieht noch nicht nach einer E-Mail-Adresse aus.";
  if ((field === "website" || field === "linkedin") && !looksLikeWebAddress(value)) {
    return "Das sieht noch nicht nach einer Webadresse aus, z. B. maxmustermann.de.";
  }
  return undefined;
}

/** A field label that says the field is optional (#216). */
function Optional({ label }: { label: string }) {
  return (
    <>
      {label} <span className="font-normal text-muted">(optional)</span>
    </>
  );
}

/** The Basics section (PRO-1, PRO-2), autosaved as you type (PRO-10), with the photo (#224), saved as it changes. */
export function BasicsSection({
  basics,
  onChange,
  photo,
  onPhotoChange,
}: {
  basics: Basics;
  onChange: (basics: Basics) => void;
  photo: ProfilePhoto | null;
  onPhotoChange: (photo: ProfilePhoto | null) => void;
}) {
  const track = useTrackSave();
  const { flush } = useAutosave(basics, (value) => track(saveBasics(value)));
  // Hints show once you've left a field, not while you're typing in it.
  const [visited, setVisited] = useState<Set<BasicsField>>(new Set());

  const set = (field: BasicsField, value: string) => onChange({ ...basics, [field]: value });
  const leave = (field: BasicsField) => {
    setVisited((fields) => new Set(fields).add(field));
    flush();
  };
  const age = ageOn(basics.dob, new Date());

  return (
    <Card className="grid grid-cols-2 gap-x-[18px] gap-y-5">
      <PhotoField photo={photo} onChange={onPhotoChange} />
      {FIELDS.map(({ field, label, wide, placeholder, type, autoComplete }) => (
        <Input
          key={field}
          className={wide ? "col-span-2" : undefined}
          label={isOptionalBasic(field) ? <Optional label={label} /> : label}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={basics[field]}
          onChange={(event) => set(field, event.target.value)}
          onBlur={() => leave(field)}
          hint={visited.has(field) ? formatHint(field, basics[field]) : undefined}
        />
      ))}
      <Textarea
        className="col-span-2"
        label="Ein paar Zeilen über dich"
        placeholder="Was du machst, worin du gut bist, wonach du suchst."
        rows={4}
        value={basics.summary}
        onChange={(event) => set("summary", event.target.value)}
        onBlur={() => leave("summary")}
      />
      <Checkbox
        className="col-span-2 pt-1"
        label={
          <>
            Mein Alter im Lebenslauf zeigen{" "}
            <span className="text-meta text-muted">
              {age === null
                ? "(zuerst Geburtsdatum eintragen)"
                : `(du bist ${age}; standardmäßig aus, da oft empfohlen wird, es wegzulassen)`}
            </span>
          </>
        }
        checked={basics.showAge}
        onChange={(event) => onChange({ ...basics, showAge: event.target.checked })}
      />
    </Card>
  );
}
