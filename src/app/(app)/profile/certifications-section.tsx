"use client";

import { useTrackSave } from "@/components/save-tracker";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import { formatMonthYear, type CertificationItem, type ProfileData } from "@/lib/profile";

import { createCertification, removeCertification, reorderCertifications, restoreCertification, saveCertification } from "./actions";
import { EntryList } from "./entry-list";
import { MonthYearField } from "./month-year-field";
import type { UpdateProfile } from "./skills-section";

const optional = (label: string) => (
  <>
    {label} <span className="font-normal text-muted">(optional)</span>
  </>
);

/** The fields of an open certification, autosaved as you type. */
function CertificationForm({
  entry,
  onChange,
  autoFocus,
}: {
  entry: CertificationItem;
  onChange: (entry: CertificationItem) => void;
  autoFocus: boolean;
}) {
  const track = useTrackSave();
  const { flush } = useAutosave(entry, (value) => track(saveCertification(value)));
  const set = (change: Partial<CertificationItem>) => onChange({ ...entry, ...change });

  return (
    <div className="grid grid-cols-2 gap-[18px]" onBlur={flush}>
      <Input
        className="col-span-2"
        label="Zertifikat"
        placeholder="Zertifizierte Barrierefreiheits-Expertin"
        value={entry.name}
        onChange={(event) => set({ name: event.target.value })}
        autoFocus={autoFocus}
      />
      <Input
        className="col-span-2"
        label="Ausgestellt von"
        placeholder="IHK Köln"
        value={entry.issuer}
        onChange={(event) => set({ issuer: event.target.value })}
      />
      <MonthYearField label="Erworben" value={{ month: entry.month, year: entry.year }} onChange={({ month, year }) => set({ month, year })} />
      <MonthYearField
        label="Gültig bis"
        value={{ month: entry.expiryMonth, year: entry.expiryYear }}
        onChange={({ month, year }) => set({ expiryMonth: month, expiryYear: year })}
      />
      <p className="col-span-2 -mt-2.5 text-label text-muted">Lass „Gültig bis“ leer, wenn es nicht abläuft. Lebensläufe nennen die Gültigkeit.</p>
      <Input
        label={optional("Zertifikats-ID")}
        placeholder="IDI-20481"
        value={entry.credentialId}
        onChange={(event) => set({ credentialId: event.target.value })}
      />
      <Input
        label={optional("Link")}
        placeholder="verify.example.org/IDI-20481"
        hint="Wo ein Arbeitgeber es prüfen kann. Im PDF ist der Link anklickbar."
        value={entry.link}
        onChange={(event) => set({ link: event.target.value })}
      />
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
 * Certifications (#293): their own section next to Education, in the user's
 * order. Resumes show them as written; the AI never rewrites them.
 */
export function CertificationsSection({ profile, update }: { profile: ProfileData; update: UpdateProfile }) {
  return (
    <EntryList
      items={profile.certifications}
      setItems={(change) => update((current) => ({ ...current, certifications: change(current.certifications) }))}
      addLabel="Zertifikat hinzufügen"
      ordering={{ mode: "manual", save: (ids) => reorderCertifications({ ids }) }}
      summary={(entry) => ({
        title: entry.name.trim() || "Neues Zertifikat",
        subtitle: entry.issuer.trim(),
        meta: entry.onResumes ? formatMonthYear(entry.year, entry.month) || undefined : "Nicht im Lebenslauf",
      })}
      create={() => createCertification({})}
      remove={(entry) => removeCertification({ id: entry.id })}
      restore={(entry) => restoreCertification(entry)}
      renderForm={(entry, { onChange, autoFocus }) => (
        <CertificationForm entry={entry} onChange={onChange} autoFocus={autoFocus} />
      )}
    />
  );
}
