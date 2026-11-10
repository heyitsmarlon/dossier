import type { Tone } from "@/generated/prisma/enums";
import type { Match, Unit } from "@/lib/application-data";
import { isParagraph } from "@/lib/letter-frame";
import { sameName, type ProfileData } from "@/lib/profile";
import { inEditorOrder, skillNamesIn } from "@/lib/skill-groups";
import { TONES } from "@/lib/tones";
import { isCustomUnit } from "@/lib/unit-text";

// The first message on a new application: what was tailored (E7-6, SET-5).
// Built in code from the documents, the profile and the match, never written
// by the model, so it can't describe a change that didn't happen
// (decided 28 September 2026).

export type TailoringSummary = { intro: string; list: string[]; foot: string };

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/** "A, B and C" */
function listOf(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`;
}

export function tailoringSummary({
  profile,
  company,
  role,
  match,
  resume,
  letter,
  tone,
  note,
  references,
  strict,
  showChanges,
}: {
  profile: ProfileData;
  company: string;
  role: string;
  match: Match;
  resume: Unit[];
  letter: Unit[];
  tone: Tone;
  note: string;
  /** Whether the tailored resume includes references, and why not when it doesn't. */
  references: "included" | "not-asked" | "setting-off";
  strict: boolean;
  /** Settings → "Show what changed" (SET-5). */
  showChanges: boolean;
}): TailoringSummary {
  const where = company.trim() || "diese Stelle";
  const unit = (id: string) => resume.find((entry) => entry.id === id);
  const list: string[] = [];

  const summary = unit("summary")?.text ?? "";
  const forRole = role.trim() ? `für die Stelle als ${role.trim()}` : "für diese Stelle";
  if (summary && !profile.basics.summary.trim()) list.push(`Zusammenfassung ${forRole} geschrieben`);
  else if (summary && !same(summary, profile.basics.summary)) list.push(`Deine Zusammenfassung ${forRole} umgeschrieben`);

  const reworded = profile.experience.filter((entry) => {
    const tailored = unit(`experience:${entry.id}`);
    return tailored && !same(tailored.text, entry.bullets.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"));
  });
  if (reworded.length > 0) {
    list.push(
      reworded.length === profile.experience.length && reworded.length > 1
        ? `Alle ${reworded.length} Positionen so umformuliert, dass vorne steht, was ${where} sucht`
        : `${reworded.length === 1 ? "Position" : "Positionen"} ${listOf(reworded.map((entry) => entry.company || entry.role))} für diese Stelle umformuliert`,
    );
  }

  const projects = profile.projects.filter((entry) => {
    const tailored = unit(`project:${entry.id}`);
    return tailored && !same(tailored.text, entry.bullets.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"));
  });
  if (projects.length > 0) {
    list.push(`${projects.length === 1 ? "Projekt" : "Projekte"} ${listOf(projects.map((entry) => entry.name || "ohne Titel"))} für diese Stelle umformuliert`);
  }

  const certifications = resume.filter((entry) => entry.id.startsWith("certification:")).length;
  if (certifications > 0) list.push(`${certifications === 1 ? "Deine Zertifizierung" : `Deine ${certifications} Zertifizierungen`} wörtlich übernommen`);
  const publications = resume.filter((entry) => entry.id.startsWith("publication:")).length;
  if (publications > 0) list.push(`${publications === 1 ? "Deine Veröffentlichung" : `Deine ${publications} Veröffentlichungen`} wörtlich übernommen`);
  if (resume.some((entry) => isCustomUnit(entry.id))) list.push("Deine eigenen Abschnitte wörtlich übernommen");

  const skills = skillNamesIn(unit("skills")?.text ?? "");
  const profileSkills = inEditorOrder(profile.skills).map((skill) => skill.name);
  const kept = profileSkills.filter((name) => skills.some((skill) => sameName(skill, name)));
  if (skills.length > 1 && !skills.every((skill, index) => kept[index] && sameName(skill, kept[index]))) {
    list.push(`Deine Fähigkeiten danach sortiert, was ${where} sucht`);
  }
  const dropped = profileSkills.filter((name) => !skills.some((skill) => sameName(skill, name)));
  if (skills.length > 0 && dropped.length > 0) {
    list.push(dropped.length <= 3 ? `${listOf(dropped)} weggelassen, darum geht es bei dieser Stelle nicht` : `${dropped.length} Fähigkeiten weggelassen, die hier nicht helfen`);
  }

  if (profile.references.length > 0 && resume.length > 0) {
    list.push(
      references === "included"
        ? "Deine Referenzen aufgenommen, da die Anzeige danach fragt"
        : references === "not-asked"
          ? "Referenzen weggelassen, da die Anzeige nicht danach fragt"
          : "Referenzen weggelassen, wie in den Einstellungen festgelegt",
    );
  }

  if (letter.some(isParagraph)) list.push(`Anschreiben im Ton „${TONES[tone].label}“ geschrieben`);
  const gaps = match.items.filter((item) => item.result === "gap").map((item) => `„${item.requirement}“`);
  if (gaps.length > 0) list.push(`Sei bereit, über ${listOf(gaps)} zu sprechen, da ${gaps.length === 1 ? "es" : "sie"} nicht in deinem Profil ${gaps.length === 1 ? "steht" : "stehen"}`);
  if (note.trim()) list.push(`Deinen Hinweis berücksichtigt: „${note.trim()}“`);

  const flagged = [...resume, ...letter].reduce((count, entry) => count + (entry.unverified?.length ?? 0), 0);
  if (strict && flagged > 0) {
    list.push(`${flagged === 1 ? "Ein Detail" : `${flagged} Details`} zur Prüfung markiert (weder in deinem Profil noch in der Anzeige)`);
  }

  const foot = !strict
    ? "„Nie Erfahrung erfinden“ ist aus, prüf also die Fakten, bevor du etwas verschickst."
    : flagged > 0
      ? "Prüf die markierten Details genau, bevor du etwas verschickst."
      : "Nichts erfunden: Jede Zeile stammt aus deinem Profil.";

  return showChanges
    ? { intro: `Das habe ich für ${where} angepasst:`, list, foot }
    : { intro: `${readyLine(resume.length > 0, letter.length > 0)} für ${where} ${resume.length > 0 === letter.length > 0 ? "sind" : "ist"} fertig.`, list: [], foot };
}

/** "Your tailored resume and cover letter", or only the one written (#367). */
function readyLine(resume: boolean, letter: boolean): string {
  return resume && letter ? "Dein angepasster Lebenslauf und dein Anschreiben" : resume ? "Dein angepasster Lebenslauf" : letter ? "Dein angepasstes Anschreiben" : "Deine Unterlagen";
}

/** The message as stored: intro, a bulleted list, the footnote. */
export function summaryText({ intro, list, foot }: TailoringSummary): string {
  return [intro, list.length > 0 ? list.map((line) => `- ${line}`).join("\n") : null, foot].filter(Boolean).join("\n\n");
}
