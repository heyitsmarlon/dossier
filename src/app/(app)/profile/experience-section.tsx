"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import { formatDateRange, UI_DATE_OPTIONS, type EntryOrder, type ExperienceItem, type ProfileData } from "@/lib/profile";

import {
  attachNewSkill,
  createExperience,
  removeExperience,
  reorderEntries,
  restoreExperience,
  saveExperience,
  setExperienceSkill,
  sortEntriesByDate,
} from "./actions";
import { EntryList } from "./entry-list";
import { MonthYearField } from "./month-year-field";
import { useTrackSave } from "@/components/save-tracker";
import type { UpdateProfile } from "./skills-section";
import { SkillsUsed } from "./skills-used";

/** The fields of an open role, autosaved as you type. */
function ExperienceForm({
  entry,
  onChange,
  autoFocus,
}: {
  entry: ExperienceItem;
  onChange: (entry: ExperienceItem) => void;
  autoFocus: boolean;
}) {
  const track = useTrackSave();
  // Autosave the text and dates only; skill links save on their own when toggled.
  const { id, role, company, location, descriptor, bullets, startYear, startMonth, endYear, endMonth, current } = entry;
  const fields = useMemo(
    () => ({ id, role, company, location, descriptor, bullets, startYear, startMonth, endYear, endMonth, current }),
    [id, role, company, location, descriptor, bullets, startYear, startMonth, endYear, endMonth, current],
  );
  const { flush } = useAutosave(fields, (value) => track(saveExperience(value)));
  const set = (change: Partial<ExperienceItem>) => onChange({ ...entry, ...change });

  return (
    <div className="grid grid-cols-2 gap-[18px]" onBlur={flush}>
      <Input
        className="col-span-2"
        label="Position"
        placeholder="Webdesigner"
        value={entry.role}
        onChange={(event) => set({ role: event.target.value })}
        autoFocus={autoFocus}
      />
      <Input
        label="Firma"
        placeholder="Muster GmbH"
        value={entry.company}
        onChange={(event) => set({ company: event.target.value })}
      />
      <Input
        label="Ort"
        placeholder="Köln"
        value={entry.location}
        onChange={(event) => set({ location: event.target.value })}
      />
      <Input
        className="col-span-2"
        label="Über die Firma oder Stelle"
        placeholder="Agentur mit 40 Leuten, Schwerpunkt E-Commerce"
        hint="Optional. Eine Zeile, kursiv unter der Position im Lebenslauf."
        maxLength={300}
        value={entry.descriptor}
        onChange={(event) => set({ descriptor: event.target.value })}
      />
      <MonthYearField
        label="Beginn"
        value={{ month: entry.startMonth, year: entry.startYear }}
        onChange={({ month, year }) => set({ startMonth: month, startYear: year })}
      />
      <div className="flex flex-col gap-2.5">
        <MonthYearField
          label="Ende"
          value={{ month: entry.endMonth, year: entry.endYear }}
          onChange={({ month, year }) => set({ endMonth: month, endYear: year })}
          disabled={entry.current}
        />
        <Checkbox
          label="Ich arbeite noch hier"
          checked={entry.current}
          onChange={(event) => set({ current: event.target.checked })}
        />
      </div>
      <Textarea
        className="col-span-2"
        label="Was du gemacht hast"
        placeholder="Ein Punkt pro Zeile. Stichworte reichen."
        rows={4}
        value={entry.bullets}
        onChange={(event) => set({ bullets: event.target.value })}
      />
    </div>
  );
}

const roleTitle = (entry: ExperienceItem) => entry.role.trim() || "Neue Position";

/** Work experience (PRO-5): one card open at a time, autosaved, with Undo on Remove. */
export function ExperienceSection({ profile, update, order }: { profile: ProfileData; update: UpdateProfile; order: EntryOrder }) {
  const skillNames = (entry: ExperienceItem) =>
    profile.skills.filter((skill) => entry.skillIds.includes(skill.id)).map((skill) => skill.name);

  return (
    <EntryList
      items={profile.experience}
      setItems={(change) => update((current) => ({ ...current, experience: change(current.experience) }))}
      addLabel="Position hinzufügen"
      ordering={{
        mode: order,
        save: (ids) => reorderEntries({ section: "experience", ids }),
        sortByDate: () => sortEntriesByDate({ section: "experience" }),
      }}
      summary={(entry) => ({
        title: roleTitle(entry),
        subtitle: [entry.company, entry.location].filter((part) => part.trim()).join(" · "),
        meta: formatDateRange(entry, UI_DATE_OPTIONS),
        footnote: skillNames(entry).join(" · ") || undefined,
      })}
      create={() => createExperience({})}
      remove={(entry) => removeExperience({ id: entry.id })}
      restore={(entry) => restoreExperience(entry)}
      renderForm={(entry, { onChange, autoFocus }) => (
        <>
          <ExperienceForm entry={entry} onChange={onChange} autoFocus={autoFocus} />
          <SkillsUsed
            entry={entry}
            noun="Position"
            skills={profile.skills}
            update={update}
            setLinks={(change) =>
              update((current) => ({
                ...current,
                experience: current.experience.map((item) => (item.id === entry.id ? { ...item, skillIds: change(item.skillIds) } : item)),
              }))
            }
            attach={(skillId, attached) => setExperienceSkill({ experienceId: entry.id, skillId, attached })}
            attachNew={(name) => attachNewSkill({ experienceId: entry.id, name })}
          />
        </>
      )}
    />
  );
}
