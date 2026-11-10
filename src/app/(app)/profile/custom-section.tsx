"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { CustomSectionFormat } from "@/generated/prisma/enums";
import { useAutosave } from "@/hooks/use-autosave";
import { citationExcerpt } from "@/lib/citation";
import { CUSTOM_SECTION_FORMATS, formatDateRange, type CustomItem, type CustomSection } from "@/lib/profile";

import { createCustomItem, deleteCustomSection, removeCustomItem, reorderCustomItems, restoreCustomItem, restoreCustomSection, saveCustomItem, saveCustomSection } from "./actions";
import { EntryList } from "./entry-list";
import { MonthYearField } from "./month-year-field";
import type { UpdateProfile } from "./skills-section";

const optional = (label: string) => (
  <>
    {label} <span className="font-normal text-muted">(optional)</span>
  </>
);

/** The fields of an open item, the ones its section's format shows, autosaved as you type. */
function CustomItemForm({
  sectionId,
  format,
  entry,
  onChange,
  autoFocus,
}: {
  sectionId: string;
  format: CustomSectionFormat;
  entry: CustomItem;
  onChange: (entry: CustomItem) => void;
  autoFocus: boolean;
}) {
  const track = useTrackSave();
  const { flush } = useAutosave(entry, (value) => track(saveCustomItem({ ...value, sectionId })));
  const set = (change: Partial<CustomItem>) => onChange({ ...entry, ...change });
  const link = (
    <Input
      className="col-span-2"
      label={optional("Link")}
      placeholder="example.org/award"
      hint="Im PDF ist der Link anklickbar."
      value={entry.link}
      onChange={(event) => set({ link: event.target.value })}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-[18px]" onBlur={flush}>
      {format === "ENTRIES" && (
        <>
          <Input className="col-span-2" label="Titel" placeholder="Mentorin" value={entry.title} onChange={(event) => set({ title: event.target.value })} autoFocus={autoFocus} />
          <Input className="col-span-2" label={optional("Wo oder mit wem")} placeholder="Jugendzentrum Köln" value={entry.subtitle} onChange={(event) => set({ subtitle: event.target.value })} />
          <MonthYearField label="Beginn" value={{ month: entry.startMonth, year: entry.startYear }} onChange={({ month, year }) => set({ startMonth: month, startYear: year })} />
          <div className="flex flex-col gap-2.5">
            <MonthYearField label="Ende" value={{ month: entry.endMonth, year: entry.endYear }} onChange={({ month, year }) => set({ endMonth: month, endYear: year })} disabled={entry.current} />
            <Checkbox label="Läuft noch" checked={entry.current} onChange={(event) => set({ current: event.target.checked })} />
          </div>
          <Textarea
            className="col-span-2"
            label={optional("Details")}
            hint="Ein Stichpunkt pro Zeile."
            placeholder="40 Jugendlichen beigebracht, ihre erste Website zu bauen"
            rows={4}
            value={entry.details}
            onChange={(event) => set({ details: event.target.value })}
          />
          {link}
        </>
      )}
      {format === "LINES" && (
        <>
          <Textarea
            className="col-span-2"
            label="Text"
            hint="So lang du willst. **Fett** oder *kursiv* mit Sternchen."
            placeholder="Fotopreis der Stadt Köln, 2023"
            rows={3}
            value={entry.title}
            onChange={(event) => set({ title: event.target.value })}
            autoFocus={autoFocus}
          />
          {link}
        </>
      )}
      {format === "INLINE" && <Input className="col-span-2" label="Eintrag" placeholder="Klettern" value={entry.title} onChange={(event) => set({ title: event.target.value })} autoFocus={autoFocus} />}
      <Checkbox
        className="col-span-2"
        label="Im Lebenslauf zeigen"
        hint="Aus: bleibt im Profil, fehlt aber in jedem Lebenslauf und in dem, was die KI liest."
        checked={entry.onResumes}
        onChange={(event) => set({ onResumes: event.target.checked })}
      />
    </div>
  );
}

/**
 * The page of a section the user made (#298): its name, its format and its
 * items, which go on resumes as written, and deleting it, with Undo in the toast.
 */
export function CustomSectionEditor({
  section,
  update,
  onDeleted,
  onRestored,
}: {
  section: CustomSection;
  update: UpdateProfile;
  onDeleted: (section: CustomSection) => void;
  onRestored: (section: CustomSection) => void;
}) {
  const track = useTrackSave();
  const [title, setTitle] = useState(section.title);
  const [quick, setQuick] = useState("");
  const { flush } = useAutosave({ id: section.id, title, format: section.format }, (value) => track(saveCustomSection(value)));
  const setSection = (change: (current: CustomSection) => CustomSection) =>
    update((current) => ({ ...current, customSections: current.customSections.map((entry) => (entry.id === section.id ? change(entry) : entry)) }));
  const setItems = (change: (items: CustomItem[]) => CustomItem[]) => setSection((current) => ({ ...current, items: change(current.items) }));
  const format = CUSTOM_SECTION_FORMATS.find((entry) => entry.value === section.format)!;

  const remove = async () => {
    flush();
    if (!toastResult(await track(deleteCustomSection({ id: section.id }))).ok) return;
    onDeleted(section);
    toast(`Deleted “${section.title}”.`, {
      action: {
        label: "Rückgängig",
        onClick: async () => {
          if (!toastResult(await restoreCustomSection(section)).ok) return;
          onRestored(section);
          toast(`Put back “${section.title}”.`);
        },
      },
    });
  };

  /** Inline items are a word or two each: type one and press Enter, as with skills. */
  const addQuick = async () => {
    const name = quick.trim();
    if (!name) return;
    setQuick("");
    const result = await track(createCustomItem({ sectionId: section.id, title: name }));
    if (!result.ok) return toast(result.error);
    setItems((current) => [...current, result.data]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[18px]" onBlur={flush}>
        <Input
          label="Name des Abschnitts"
          hint="Lebensläufe übernehmen ihn genau so."
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim()) setSection((current) => ({ ...current, title: event.target.value }));
          }}
        />
        <div className="flex flex-col gap-2">
          <span id={`format-${section.id}`} className="text-label font-medium">
            So erscheint es im Lebenslauf
          </span>
          <SegmentedControl
            aria-labelledby={`format-${section.id}`}
            options={CUSTOM_SECTION_FORMATS.map(({ value, label }) => ({ value, label }))}
            value={section.format}
            onValueChange={(value) => setSection((current) => ({ ...current, format: value }))}
          />
          <p className="text-label text-muted">{format.hint} Switching keeps everything you&apos;ve written here.</p>
        </div>
      </div>
      {section.format === "INLINE" && (
        <Input
          label="Eintrag hinzufügen"
          hint="Eingeben und Enter drücken."
          placeholder="Klettern"
          value={quick}
          onChange={(event) => setQuick(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void addQuick();
          }}
        />
      )}
      <EntryList
        items={section.items}
        setItems={setItems}
        addLabel="Eintrag hinzufügen"
        ordering={{ mode: "manual", save: (ids) => reorderCustomItems({ sectionId: section.id, ids }) }}
        summary={(entry) => ({
          title: citationExcerpt(entry.title) || (entry.details.trim() ? section.title : "Neuer Eintrag"),
          subtitle: section.format === "ENTRIES" ? entry.subtitle.trim() : section.format === "LINES" ? entry.link.trim() : "In einer Zeile",
          meta: entry.onResumes ? (section.format === "ENTRIES" && formatDateRange(entry)) || undefined : "Nicht im Lebenslauf",
        })}
        create={() => createCustomItem({ sectionId: section.id })}
        remove={(entry) => removeCustomItem({ id: entry.id })}
        restore={(entry) => restoreCustomItem({ ...entry, sectionId: section.id })}
        renderForm={(entry, { onChange, autoFocus }) => (
          <CustomItemForm sectionId={section.id} format={section.format} entry={entry} onChange={onChange} autoFocus={autoFocus} />
        )}
      />
      <Button variant="danger-text" size="sm" className="self-start" onClick={() => void remove()}>
        Diesen Abschnitt löschen
      </Button>
    </div>
  );
}

