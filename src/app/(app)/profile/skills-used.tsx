"use client";

import { useId, useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast } from "@/components/toast";
import { ToggleChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action";
import { sameName, type SkillItem } from "@/lib/profile";

import type { UpdateProfile } from "./skills-section";

/** A role or project, as far as its skill links go. */
type Linked = { id: string; skillIds: string[] };

/**
 * "Skills you used here" (PRO-6): every profile skill as a toggle chip, and
 * an input that adds a new skill to the profile and attaches it in one step.
 * Roles and projects (PRO-13) both have one.
 */
export function SkillsUsed({
  entry,
  noun,
  skills,
  update,
  setLinks,
  attach,
  attachNew,
}: {
  entry: Linked;
  /** "role" or "project", for the input's label. */
  noun: string;
  skills: SkillItem[];
  update: UpdateProfile;
  /** Changes the entry's links in the profile's state. */
  setLinks: (change: (skillIds: string[]) => string[]) => void;
  /** Saves one link, or removes it. */
  attach: (skillId: string, attached: boolean) => Promise<ActionResult<null>>;
  /** Adds a skill by name, if it's new, and attaches it. */
  attachNew: (name: string) => Promise<ActionResult<{ skill: SkillItem; added: boolean }>>;
}) {
  const track = useTrackSave();
  const labelId = useId();
  const [draft, setDraft] = useState("");
  const attached = skills.filter((skill) => entry.skillIds.includes(skill.id)).length;

  async function toggle(skillId: string) {
    const on = !entry.skillIds.includes(skillId);
    const before = entry.skillIds;
    setLinks(() => (on ? [...before, skillId] : before.filter((linked) => linked !== skillId)));
    const result = await track(attach(skillId, on));
    if (!result.ok) {
      setLinks(() => before);
      toast(result.error);
    }
  }

  async function addNew() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    const existing = skills.find((skill) => sameName(skill.name, name));
    if (existing) {
      if (!entry.skillIds.includes(existing.id)) await toggle(existing.id);
      return;
    }
    const result = await track(attachNew(name));
    if (!result.ok) {
      setDraft(name);
      return toast(result.error);
    }
    const { skill } = result.data;
    update((current) => ({
      ...current,
      skills: current.skills.some((item) => item.id === skill.id) ? current.skills : [...current.skills, skill],
    }));
    setLinks((skillIds) => (skillIds.includes(skill.id) ? skillIds : [...skillIds, skill.id]));
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2.5 pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-label text-muted">
          Fähigkeiten, die du hier genutzt hast
        </span>
        <span className="text-xs text-muted">
          {skills.length > 0
            ? `${attached} von ${skills.length} zugeordnet`
            : "Füge Fähigkeiten unter „Fähigkeiten & Sprachen“ hinzu, oder gib unten eine ein"}
        </span>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <ToggleChip
              key={skill.id}
              check
              selected={entry.skillIds.includes(skill.id)}
              onClick={() => void toggle(skill.id)}
            >
              {skill.name}
            </ToggleChip>
          ))}
        </div>
      )}
      <Input
        aria-label={`Neue Fähigkeit zu diesem Eintrag (${noun}) hinzufügen`}
        placeholder="Neue Fähigkeit? Eingeben und Enter drücken, dann kommt sie auch in dein Profil"
        inputClassName="py-[9px] text-control"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void addNew();
        }}
      />
      <p className="text-label text-muted">
        Die KI nutzt diese Zuordnungen, um beim Zuschneiden eines Lebenslaufs zu zeigen, wo du eine Fähigkeit tatsächlich eingesetzt hast.
      </p>
    </div>
  );
}
