"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { ChatRole, DocumentKind, VersionCause } from "@/generated/prisma/enums";
import { action, ActionError } from "@/lib/action";
import { isAiConfigured } from "@/lib/ai/config";
import { profileUnits } from "@/lib/ai/tasks/tailor-resume";
import { editsSchema, extractedSchema, matchSchema, trimmedSchema, unitsSchema, withSkillAdded } from "@/lib/application-data";
import { loadDocuments, readJson } from "@/lib/application-documents";
import { WRITTEN_EMAIL_UNITS } from "@/lib/application-email";
import { documentLabels } from "@/lib/document-labels";
import { frozenCopySchema, frozenProfile, readFrozenCopy, withSectionFromProfile } from "@/lib/frozen-copy";
import { updateDocuments } from "@/lib/document-units";
import { DOCUMENT_LABELS } from "@/lib/file-name";
import { syncInterviewToCalendar } from "@/lib/google/availability";
import { GoogleError } from "@/lib/google/errors";
import { isFrameUnit, withFrame, WRITTEN_FRAME_UNITS } from "@/lib/letter-frame";
import { saveVersion } from "@/lib/document-versions";
import { refineJob, refineJobKey } from "@/lib/jobs/refine";
import { regenerateUnitJob, unitJobKey } from "@/lib/jobs/regenerate-unit";
import { findUnfinishedJobs, startJob } from "@/lib/jobs/runner";
import { emailJobKey, writeEmailJob } from "@/lib/jobs/write-email";
import { writeDocumentJob, writeDocumentJobKey } from "@/lib/jobs/write-document";
import { scoreResumeJob, scoreResumeJobKey } from "@/lib/jobs/score-resume";
import { scoringProblem } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile-data";
import { findOrCreateSkill } from "@/lib/profile-entries";
import { profileUpdate } from "@/lib/profile-update";
import { sectionLayoutSchema, sectionOfUnit } from "@/lib/resume-sections";
import { loadSettings } from "@/lib/settings-data";
import { THEME_FIELDS } from "@/lib/theme-data";
import { cleanUnitText, isPublicationUnit, isVerbatimUnit, unitName } from "@/lib/unit-text";

const GONE = "Diese Bewerbung gibt es nicht mehr.";
const PART_GONE = "Dieser Teil des Dokuments existiert nicht mehr. Lade die Seite neu, um den aktuellen Stand zu sehen.";

const refresh = (id: string) => revalidatePath(`/applications/${id}`);

/** The Resume tab's layout switch (APP-4): the theme's own layout, or a single column. */
export const setFollowThemeLayout = action(
  z.object({ id: z.string().min(1), follow: z.boolean() }),
  async ({ id, follow }) => {
    const { count } = await prisma.application.updateMany({ where: { id }, data: { followThemeLayout: follow } });
    if (count === 0) throw new ActionError(GONE);
    refresh(id);
    return null;
  },
);

/** The Resume tab's Photo switch (#224): show the profile photo on this resume or not, whatever the profile says. */
export const setShowPhoto = action(z.object({ id: z.string().min(1), show: z.boolean() }), async ({ id, show }) => {
  const { count } = await prisma.application.updateMany({ where: { id }, data: { showPhoto: show } });
  if (count === 0) throw new ActionError(GONE);
  refresh(id);
  return null;
});

/** The Sections menu (#297): this resume's own order and which sections are on it. */
export const setApplicationSections = action(z.object({ id: z.string().min(1), order: sectionLayoutSchema.shape.order, off: sectionLayoutSchema.shape.off, titles: sectionLayoutSchema.shape.titles }), async ({ id, order, off, titles }) => {
  const application = await prisma.application.findUnique({ where: { id }, select: { sections: true } });
  if (!application) throw new ActionError(GONE);
  const withReferences = readJson(sectionLayoutSchema, application.sections)?.withReferences;
  await prisma.application.update({ where: { id }, data: { sections: { order, off, ...(titles ? { titles } : {}), ...(withReferences ? { withReferences } : {}) } } });
  refresh(id);
  return null;
});

/** "Use the base resume's order": a draft follows the base resume again; one that was sent takes its order as it is now, once. */
export const followBaseSections = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  const application = await prisma.application.findUnique({ where: { id }, select: { frozen: true } });
  if (!application) throw new ActionError(GONE);
  const sections = application.frozen === null ? Prisma.DbNull : (await loadSettings()).resumeSections;
  await prisma.application.update({ where: { id }, data: { sections } });
  refresh(id);
  return null;
});

/**
 * "Add" on the Sections menu (#297): puts a section from the profile on this
 * resume, in the profile's own words. Nothing else ever does: a resume only
 * holds what it was written with and what's added here.
 */
export const addApplicationSection = action(z.object({ id: z.string().min(1), key: z.string().min(1) }), async ({ id, key }) => {
  const [application, profile, settings] = await Promise.all([
    prisma.application.findUnique({ where: { id }, select: { sections: true, language: true, frozen: true } }),
    loadProfile(),
    loadSettings(),
  ]);
  if (!application) throw new ActionError(GONE);

  const fresh = profileUnits(profile, documentLabels(application.language)).filter((unit) => sectionOfUnit(unit.id, profile) === key);
  const added = new Set(fresh.map((unit) => unit.id));
  const copy = readFrozenCopy(application.frozen);
  await updateDocuments(id, async (documents, tx) => {
    const units = documents[DocumentKind.RESUME];
    if (!units) throw new ActionError(PART_GONE);
    // A sent resume is drawn from its copy, so the section has to reach that too (#299). Taking one back on that it still holds changes nothing.
    const holdsIt = copy !== null && units.some((unit) => unit.text.trim() && sectionOfUnit(unit.id, frozenProfile(copy, profile)) === key);
    if (copy && !holdsIt) {
      await tx.application.update({ where: { id }, data: { frozen: withSectionFromProfile(copy, profile, key) as unknown as Prisma.InputJsonValue } });
    }
    for (const unit of fresh) {
      const index = units.findIndex((entry) => entry.id === unit.id);
      if (index < 0) units.push(unit);
      else if (!units[index].text.trim()) units[index] = unit;
    }
  });
  // Back through here, so they're no longer listed as left out. Written after the document itself: updateDocuments checks it wasn't changed meanwhile.
  const row = await prisma.document.findUniqueOrThrow({ where: { applicationId_kind: { applicationId: id, kind: DocumentKind.RESUME } }, select: { id: true, trimmed: true } });
  const trimmed = readJson(trimmedSchema, row.trimmed);
  const rest = trimmed?.filter((cut) => !(cut.kind === "unit" ? added.has(cut.unit.id) : added.has(cut.unitId)));
  if (trimmed && rest && rest.length !== trimmed.length) {
    await prisma.document.update({ where: { id: row.id }, data: { trimmed: rest.length > 0 ? rest : Prisma.DbNull } });
  }

  const own = readJson(sectionLayoutSchema, application.sections);
  const layout = own ?? settings.resumeSections;
  if (layout.off.includes(key) || key === "references") {
    await prisma.application.update({
      where: { id },
      data: {
        sections: {
          ...layout,
          off: layout.off.filter((entry) => entry !== key),
          ...(key === "references" ? { withReferences: true } : {}),
        },
      },
    });
  }
  refresh(id);
  return null;
});

/**
 * "Update from profile" (#301): titles, dates, contact details and links as
 * the profile has them now, with what's new in the sections this resume holds.
 * Returns what to put back for Undo, or null when there was nothing to update.
 */
export const updateFromProfile = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  if (!(await prisma.application.count({ where: { id } }))) throw new ActionError(GONE);
  const { application, liveProfile, resume, includeReferences } = await loadDocuments(id);
  if (!resume) throw new ActionError(PART_GONE);
  const copy = readFrozenCopy(application.frozen);
  const update = profileUpdate({ copy: copy?.profile ?? null, live: liveProfile, units: resume.units, trimmed: resume.trimmed ?? null, language: application.language, includeReferences });
  if (!update.changed) return null;

  await updateDocuments(id, async (documents, tx) => {
    documents[DocumentKind.RESUME] = update.units;
    if (copy && update.copy) await tx.application.update({ where: { id }, data: { frozen: { ...copy, profile: update.copy } as unknown as Prisma.InputJsonValue } });
  });
  refresh(id);
  return { profile: copy?.profile ?? null, units: resume.units };
});

/** Undo after "Update from profile". */
export const undoUpdateFromProfile = action(
  z.object({ id: z.string().min(1), profile: frozenCopySchema.shape.profile.nullable(), units: unitsSchema }),
  async ({ id, profile, units }) => {
    const application = await prisma.application.findUnique({ where: { id }, select: { frozen: true } });
    if (!application) throw new ActionError(GONE);
    const copy = readFrozenCopy(application.frozen);
    await updateDocuments(id, async (documents, tx) => {
      documents[DocumentKind.RESUME] = units;
      if (copy && profile) await tx.application.update({ where: { id }, data: { frozen: { ...copy, profile } as unknown as Prisma.InputJsonValue } });
    });
    refresh(id);
    return null;
  },
);

/**
 * The Theme menu on the Resume and Cover letter tabs (#226, public issue 10):
 * gives the application's resume and cover letter another theme, together.
 * Only their look changes, so nothing is written again.
 */
export const setApplicationTheme = action(z.object({ id: z.string().min(1), themeId: z.string().min(1) }), async ({ id, themeId }) => {
  if (!(await prisma.theme.count({ where: { id: themeId } }))) {
    throw new ActionError("Dieses Design gibt es nicht mehr. Lade die Seite neu, um deine Designs zu sehen.");
  }
  const application = await prisma.application.findUnique({ where: { id }, select: { frozen: true } });
  if (!application) throw new ActionError(GONE);
  await prisma.document.updateMany({
    where: { applicationId: id, kind: { in: [DocumentKind.RESUME, DocumentKind.COVER_LETTER] } },
    data: { themeId },
  });
  // A sent resume is drawn in the theme it was sent with, until it's given another here (#299).
  const copy = readFrozenCopy(application.frozen);
  if (copy) {
    const theme = await prisma.theme.findUniqueOrThrow({ where: { id: themeId }, select: THEME_FIELDS });
    await prisma.application.update({ where: { id }, data: { frozen: { ...copy, themes: { RESUME: theme, COVER_LETTER: theme } } as unknown as Prisma.InputJsonValue } });
  }
  refresh(id);
  return null;
});

/**
 * The next interview's date and time (E9-9), or null to remove it. It shows
 * on the dashboard's "Worth a look" while the application is in Interview,
 * and while Dossier keeps interviews in Google Calendar, the event is added,
 * moved or deleted to match.
 */
export const setInterviewDate = action(
  z.object({ id: z.string().min(1), at: z.iso.datetime().nullable() }),
  async ({ id, at }, { toast }) => {
    const { count } = await prisma.application.updateMany({ where: { id }, data: { nextInterviewAt: at ? new Date(at) : null } });
    if (count === 0) throw new ActionError(GONE);
    refresh(id);
    try {
      const { inCalendar } = await syncInterviewToCalendar(id);
      if (inCalendar) toast(at ? "Gesprächstermin gespeichert, auch in deinem Kalender." : "Gesprächstermin entfernt, auch aus deinem Kalender.");
      else toast(at ? "Gesprächstermin gespeichert. Er erscheint auf deiner Übersicht." : "Gesprächstermin entfernt.");
    } catch (error) {
      if (!(error instanceof GoogleError)) throw error;
      toast(`${at ? "Gesprächstermin gespeichert" : "Gesprächstermin entfernt"}, aber dein Kalender wurde nicht geändert: ${error.message}`);
    }
    return null;
  },
);

/**
 * Saves a unit edited by hand (APP-6). `expected` is the text the editor
 * started from: if the unit changed since (an AI rewrite that finished
 * meanwhile), nothing is saved, so neither version is lost unseen. The
 * text is the user's own, so the fact guard's hints go.
 */
export const saveUnit = action(
  z.object({
    id: z.string().min(1),
    document: z.enum(DocumentKind),
    unitId: z.string().min(1),
    text: z.string().max(10_000),
    expected: z.string(),
  }),
  async ({ id, document, unitId, text, expected }) => {
    const clean = cleanUnitText(unitId, text);
    // The email's recipient may be left empty, for the mail app to fill in.
    if (!clean && !(document === DocumentKind.EMAIL && unitId === "to")) {
      throw new ActionError("Schreib zuerst etwas, oder brich ab, um es so zu lassen.");
    }

    await updateDocuments(id, async (documents) => {
      const units = documents[document];
      const unit = units?.find((entry) => entry.id === unitId);
      // A letter written before E8-11 shows its frame without storing it: the first edit stores that part.
      if (!unit && units && document === DocumentKind.COVER_LETTER && isFrameUnit(unitId)) {
        documents[document] = withFrame(units, { [unitId]: clean });
        return;
      }
      if (!unit) throw new ActionError(PART_GONE);
      if (unit.text !== expected) {
        throw new ActionError("Dieser Teil hat sich beim Bearbeiten geändert. Kopier deinen Text, brich ab und bearbeite die neue Fassung.");
      }
      unit.text = clean;
      delete unit.unverified;
    });
    refresh(id);
    return { text: clean };
  },
);

const unitInput = { id: z.string().min(1), document: z.enum(DocumentKind), unitId: z.string().min(1) };

/**
 * "Regenerate" (E8-4): rewrites one unit in the background and returns the
 * job's id. Asking again while it's being rewritten follows the same job.
 */
export const startRegenerating = action(
  z.object({
    ...unitInput,
    /** For a letter part an older letter only shows (E8-11): the text on screen, stored before it's rewritten. */
    shown: z.string().trim().min(1).max(2000).optional(),
  }),
  async ({ id, document, unitId, shown }) => {
    const frame = document === DocumentKind.COVER_LETTER && isFrameUnit(unitId);
    // The sender, date and signature come from the profile and the day, not the AI (E8-11).
    if ((frame && !WRITTEN_FRAME_UNITS.has(unitId)) || (document === DocumentKind.EMAIL && !WRITTEN_EMAIL_UNITS.has(unitId))) {
      throw new ActionError("Dieser Teil stammt nicht von der KI. Bearbeite ihn stattdessen.");
    }
    // A certification or publication is the user's own (#293, #218).
    if (document === DocumentKind.RESUME && isVerbatimUnit(unitId)) {
      throw new ActionError(`${isPublicationUnit(unitId) ? "Eine Veröffentlichung" : "Ein Zertifikat"} bleibt, wie du es geschrieben hast. Bearbeite es stattdessen.`);
    }
    if (frame && shown) {
      await updateDocuments(id, async (documents) => {
        const units = documents[document];
        if (units && !units.some((entry) => entry.id === unitId)) documents[document] = withFrame(units, { [unitId]: shown });
      });
    }
    const row = await prisma.document.findUnique({ where: { applicationId_kind: { applicationId: id, kind: document } } });
    const unit = row && unitsSchema.parse(row.units).find((entry) => entry.id === unitId);
    if (!unit) throw new ActionError(PART_GONE);

    for (const job of await findUnfinishedJobs(unitJobKey(id))) {
      const input = regenerateUnitJob.input.safeParse(job.input);
      if (input.success && input.data.document === document && input.data.unitId === unitId) return job.id;
    }
    return startJob(regenerateUnitJob, { applicationId: id, document, unitId, from: unit.text }, { key: unitJobKey(id), applicationId: id });
  },
);

/**
 * Undo on the "Rewrote the summary." toast (E8-4): puts the previous
 * version back, unless the unit has changed again since.
 */
export const restoreUnit = action(
  z.object({
    ...unitInput,
    text: z.string().max(10_000),
    unverified: z.array(z.string()).optional(),
    /** The text it has now, which Undo replaces. */
    expected: z.string(),
  }),
  async ({ id, document, unitId, text, unverified, expected }) => {
    await updateDocuments(id, async (documents) => {
      const unit = documents[document]?.find((entry) => entry.id === unitId);
      if (!unit) throw new ActionError(PART_GONE);
      if (unit.text !== expected) throw new ActionError("Es wurde seitdem wieder geändert, daher lässt sich das nicht rückgängig machen.");
      unit.text = text;
      if (unverified?.length) unit.unverified = unverified;
      else delete unit.unverified;
    }, { version: { cause: VersionCause.UNDONE } });
    refresh(id);
    return null;
  },
);

/** The answer on the Job posting tab, where there's nothing to change. */
const POSTING_REPLY = "I can change the resume, the cover letter or the email. Switch to one of them, or hover a section and pick “Ask AI”.";

/**
 * Sends a message from the Refine with AI panel (E8-5): saves it and starts
 * the reply in the background, returning the job's id. On the Job posting
 * tab without a picked unit, the reply comes at once and needs no AI.
 */
export const sendMessage = action(
  z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1, "Schreib zuerst, was sich ändern soll.").max(2000),
    /** The document on screen; null on the Job posting and Notes tabs, and on the Email tab before there's an email. */
    viewing: z.enum(DocumentKind).nullable(),
    /** The unit picked with "Ask AI". */
    target: z.object({ document: z.enum(DocumentKind), unitId: z.string().min(1) }).nullable(),
  }),
  async ({ id, text, viewing, target }) => {
    if (!(await prisma.application.count({ where: { id } }))) throw new ActionError(GONE);

    if (!viewing && !target) {
      const now = Date.now();
      await prisma.chatMessage.createMany({
        data: [
          { applicationId: id, role: ChatRole.USER, text, createdAt: new Date(now) },
          { applicationId: id, role: ChatRole.AI, text: POSTING_REPLY, createdAt: new Date(now + 1) },
        ],
      });
      refresh(id);
      return { jobId: null };
    }

    if (!(await isAiConfigured())) throw new ActionError("Dafür brauchst du einen KI-Anbieter. Wähle einen unter Einstellungen → KI-Anbieter.");
    if ((await findUnfinishedJobs(refineJobKey(id))).length > 0) {
      throw new ActionError("Ich arbeite noch an deiner letzten Nachricht. Schick diese, wenn ich fertig bin.");
    }
    let targetLabel: string | null = null;
    if (target) {
      const row = await prisma.document.findUnique({ where: { applicationId_kind: { applicationId: id, kind: target.document } } });
      const unit = row && unitsSchema.parse(row.units).find((entry) => entry.id === target.unitId);
      if (!unit) throw new ActionError(PART_GONE);
      targetLabel = unit.label;
    }

    const message = await prisma.chatMessage.create({
      data: { applicationId: id, role: ChatRole.USER, text, targetUnit: targetLabel },
      select: { id: true },
    });
    const jobId = await startJob(refineJob, { applicationId: id, messageId: message.id, request: text, target, viewing }, { key: refineJobKey(id), applicationId: id });
    refresh(id);
    return { jobId };
  },
);

/** "A, B and C" */
const listOf = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`);

/**
 * "Undo" under a reply in the chat (E8-6, APP-8): puts back what the reply
 * changed, units and tone, all or nothing. A unit edited again since is
 * never overwritten; the answer says which.
 */
export const undoMessage = action(z.object({ id: z.string().min(1), messageId: z.string().min(1) }), async ({ id, messageId }) => {
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, applicationId: id, role: ChatRole.AI } });
  const edits = message && editsSchema.safeParse(message.edits);
  if (!message || !edits?.success || edits.data.length === 0) throw new ActionError("In dieser Nachricht gibt es nichts rückgängig zu machen.");
  if (message.undone) throw new ActionError("Das ist schon rückgängig gemacht.");

  await updateDocuments(id, async (documents, tx) => {
    const changed = edits.data.flatMap((edit) => {
      const unit = documents[edit.document]?.find((entry) => entry.id === edit.unitId);
      return unit?.text === edit.text ? [] : [`„${unitName(unit ?? { id: edit.unitId, label: "" })}“`];
    });
    if (changed.length > 0) {
      throw new ActionError(
        `Du hast ${listOf(changed)} seitdem geändert, Rückgängig würde das überschreiben. Bearbeite ${changed.length === 1 ? "es" : "sie"} stattdessen von Hand.`,
      );
    }
    for (const edit of edits.data) {
      const unit = documents[edit.document]!.find((entry) => entry.id === edit.unitId)!;
      unit.text = edit.previousText;
      if (edit.previousUnverified?.length) unit.unverified = edit.previousUnverified;
      else delete unit.unverified;
    }
    if (message.previousTone) await tx.application.update({ where: { id }, data: { tone: message.previousTone } });
    // Only once, even when two clicks race.
    const { count } = await tx.chatMessage.updateMany({ where: { id: messageId, undone: false }, data: { undone: true } });
    if (count === 0) throw new ActionError("Das ist schon rückgängig gemacht.");
  }, { version: { cause: VersionCause.UNDONE } });
  refresh(id);
  return { edited: edits.data.map(({ document, unitId }) => ({ document, unitId })) };
});

/**
 * "+ Add to profile" on the Job posting tab (E8-7, NEW-5): adds a missing
 * skill to the profile, and the requirement becomes partly covered.
 */
export const addMatchSkill = action(z.object({ id: z.string().min(1), index: z.number().int().min(0) }), async ({ id, index }) => {
  const application = await prisma.application.findUnique({ where: { id }, select: { match: true, extracted: true } });
  if (!application) throw new ActionError(GONE);
  const match = matchSchema.safeParse(application.match);
  const extracted = extractedSchema.safeParse(application.extracted);
  const item = match.success ? match.data.items[index] : undefined;
  const requirement = extracted.success ? extracted.data.requirements[index] : undefined;
  if (!match.success || !item || item.result !== "gap" || requirement?.kind !== "skill" || !requirement.skill) {
    throw new ActionError("Diese Anforderung kann nicht zu deinem Profil hinzugefügt werden. Lade die Seite neu, um den aktuellen Stand zu sehen.");
  }

  const { skill } = await findOrCreateSkill(requirement.skill.trim());
  const items = match.data.items.map((entry, position) => (position === index ? withSkillAdded(entry, skill.name) : entry));
  await prisma.application.update({ where: { id }, data: { match: { items } } });
  refresh(id);
  return { name: skill.name };
});

// Private notes (E8-9, APP-14). They stay on this server and never go into
// a prompt: no AI task reads the Note table.

const noteBody = z.string().trim().min(1, "Schreib zuerst etwas.").max(5000);

export const addNote = action(z.object({ id: z.string().min(1), body: noteBody }), async ({ id, body }) => {
  if (!(await prisma.application.count({ where: { id } }))) throw new ActionError(GONE);
  await prisma.note.create({ data: { applicationId: id, body } });
  refresh(id);
  return null;
});

const NOTE_GONE = "Diese Notiz gibt es nicht mehr.";

export const updateNote = action(
  z.object({ id: z.string().min(1), noteId: z.string().min(1), body: noteBody }),
  async ({ id, noteId, body }) => {
    const { count } = await prisma.note.updateMany({ where: { id: noteId, applicationId: id }, data: { body } });
    if (count === 0) throw new ActionError(NOTE_GONE);
    refresh(id);
    return null;
  },
);

/** Deletes a note at once; it comes back with its date through `restoreNote` (Undo on the toast). */
export const deleteNote = action(z.object({ id: z.string().min(1), noteId: z.string().min(1) }), async ({ id, noteId }) => {
  const note = await prisma.note.findFirst({ where: { id: noteId, applicationId: id } });
  if (!note) throw new ActionError(NOTE_GONE);
  await prisma.note.delete({ where: { id: note.id } });
  refresh(id);
  return { body: note.body, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() };
});

export const restoreNote = action(
  z.object({ id: z.string().min(1), body: noteBody, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }),
  async ({ id, body, createdAt, updatedAt }) => {
    if (!(await prisma.application.count({ where: { id } }))) throw new ActionError(GONE);
    await prisma.note.create({ data: { applicationId: id, body, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) } });
    refresh(id);
    return null;
  },
);

/**
 * "Leave out" (#217): takes a part off the tailored resume. It's listed with
 * what the page limit left out, so "Put back" brings it back to its place.
 * Returns where it is in that list, for Undo.
 */
export const leaveOutUnit = action(z.object({ id: z.string().min(1), unitId: z.string().min(1) }), async ({ id, unitId }) => {
  const cut = await updateDocuments(id, async (documents) => {
    const units = documents[DocumentKind.RESUME];
    const index = units ? units.findIndex((unit) => unit.id === unitId) : -1;
    if (!units || index < 0) throw new ActionError(PART_GONE);
    const [unit] = units.splice(index, 1);
    return { kind: "unit" as const, unit, index, byHand: true as const };
  });
  // Written after the document itself: updateDocuments checks it wasn't changed meanwhile.
  const row = await prisma.document.findUniqueOrThrow({
    where: { applicationId_kind: { applicationId: id, kind: DocumentKind.RESUME } },
    select: { id: true, trimmed: true },
  });
  const earlier = trimmedSchema.safeParse(row.trimmed);
  const trimmed = [...(earlier.success ? earlier.data : []), cut];
  await prisma.document.update({ where: { id: row.id }, data: { trimmed } });
  refresh(id);
  return { index: trimmed.length - 1 };
});

/**
 * "Put back" (E10-10, #217): restores a part or bullets left out, by hand or
 * to fit the page limit. Putting back twice changes nothing more.
 */
export const putBackTrimmed = action(z.object({ id: z.string().min(1), index: z.number().int().min(0) }), async ({ id, index }) => {
  const row = await prisma.document.findUnique({ where: { applicationId_kind: { applicationId: id, kind: DocumentKind.RESUME } } });
  const trimmed = row ? trimmedSchema.safeParse(row.trimmed) : null;
  const item = trimmed?.success ? trimmed.data[index] : undefined;
  if (!row || !trimmed?.success || !item) throw new ActionError("Das ist schon wieder drin. Lade die Seite neu, um den aktuellen Lebenslauf zu sehen.");

  await updateDocuments(id, async (documents) => {
    const units = documents[DocumentKind.RESUME];
    if (!units) throw new ActionError(PART_GONE);
    if (item.kind === "unit") {
      if (!units.some((unit) => unit.id === item.unit.id)) units.splice(Math.min(item.index, units.length), 0, item.unit);
      return;
    }
    const unit = units.find((entry) => entry.id === item.unitId);
    if (!unit) throw new ActionError(PART_GONE);
    const lines = unit.text.split("\n");
    unit.text = [...lines, ...item.lines.filter((line) => !lines.includes(line))].filter(Boolean).join("\n");
  });
  const rest = trimmed.data.filter((_, position) => position !== index);
  await prisma.document.update({ where: { id: row.id }, data: { trimmed: rest.length > 0 ? rest : Prisma.DbNull } });
  refresh(id);
  return null;
});

// ─── Versions (E8-10, APP-13) ────────────────────────────────────────────────

const VERSION_GONE = "Diese Fassung gibt es nicht mehr. Öffne den Verlauf erneut, um den Stand zu sehen.";

/** A document's versions, newest first, without their units. */
export const listVersions = action(z.object({ id: z.string().min(1), document: z.enum(DocumentKind) }), async ({ id, document }) => {
  const versions = await prisma.documentVersion.findMany({
    where: { document: { applicationId: id, kind: document } },
    orderBy: { createdAt: "desc" },
    select: { id: true, cause: true, detail: true, createdAt: true },
  });
  return versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() }));
});

/** One version's units, to look at before restoring it. */
export const loadVersion = action(z.object({ id: z.string().min(1), versionId: z.string().min(1) }), async ({ id, versionId }) => {
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, document: { applicationId: id } },
    select: { units: true, document: { select: { kind: true } } },
  });
  if (!version) throw new ActionError(VERSION_GONE);
  return { document: version.document.kind, units: unitsSchema.parse(version.units) };
});

/**
 * Brings back an earlier version. The document as it is now is saved as a
 * version first (unless it's already the newest), so nothing is lost, and
 * the restored state becomes a version of its own.
 */
export const restoreVersion = action(z.object({ id: z.string().min(1), versionId: z.string().min(1) }), async ({ id, versionId }, { toast }) => {
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, document: { applicationId: id } },
    select: { units: true, createdAt: true, document: { select: { id: true, kind: true } } },
  });
  if (!version) throw new ActionError(VERSION_GONE);
  const { kind } = version.document;
  const units = unitsSchema.parse(version.units);

  const stillLeftOut = await updateDocuments(
    id,
    async (documents, tx) => {
      const current = documents[kind];
      if (!current) throw new ActionError(PART_GONE);
      if (JSON.stringify(current) === JSON.stringify(units)) throw new ActionError("Das ist die Fassung, die du gerade hast.");
      const newest = await tx.documentVersion.findFirst({ where: { documentId: version.document.id }, orderBy: { createdAt: "desc" }, select: { units: true } });
      if (!newest || JSON.stringify(unitsSchema.parse(newest.units)) !== JSON.stringify(current)) {
        await saveVersion(tx, version.document.id, current, { cause: VersionCause.BEFORE_RESTORE });
      }
      documents[kind] = units;
      // Parts left out that the restored version has again are no longer left out.
      if (kind !== DocumentKind.RESUME) return null;
      const row = await tx.document.findUniqueOrThrow({ where: { id: version.document.id }, select: { trimmed: true } });
      const trimmed = trimmedSchema.safeParse(row.trimmed);
      if (!trimmed.success) return null;
      return trimmed.data.filter((cut) =>
        cut.kind === "unit"
          ? !units.some((unit) => unit.id === cut.unit.id)
          : !cut.lines.every((line) => units.find((unit) => unit.id === cut.unitId)?.text.includes(line)),
      );
    },
    { version: { cause: VersionCause.RESTORED, detail: version.createdAt.toISOString() } },
  );
  // Written after the document itself: updateDocuments checks it wasn't changed meanwhile.
  if (stillLeftOut) {
    await prisma.document.update({
      where: { id: version.document.id },
      data: { trimmed: stillLeftOut.length > 0 ? stillLeftOut : Prisma.DbNull },
    });
  }
  toast(`${DOCUMENT_LABELS[kind]} auf den damaligen Stand zurückgesetzt. Deine bisherige Fassung ist ebenfalls im Verlauf.`);
  refresh(id);
  return null;
});

// ─── A document it was created without (#367) ──────────────────────────────

/**
 * "Write the cover letter" (or resume) on an application created without
 * it: writes it in the background and returns the job's id. Asking again
 * while it's being written follows the same job.
 */
export const startWritingDocument = action(
  z.object({ id: z.string().min(1), kind: z.enum([DocumentKind.RESUME, DocumentKind.COVER_LETTER]) }),
  async ({ id, kind }) => {
    const application = await prisma.application.findUnique({ where: { id }, select: { documents: { select: { kind: true } } } });
    if (!application) throw new ActionError(GONE);
    if (application.documents.some((document) => document.kind === kind)) throw new ActionError("Das wurde schon geschrieben. Lade die Seite neu, um es zu sehen.");
    if (!(await isAiConfigured())) throw new ActionError("Dafür brauchst du einen KI-Anbieter. Wähle einen unter Einstellungen → KI-Anbieter.");
    const key = writeDocumentJobKey(id, kind);
    const [running] = await findUnfinishedJobs(key);
    return running?.id ?? startJob(writeDocumentJob, { applicationId: id, kind }, { key, applicationId: id });
  },
);

// ─── The resume's score (#370) ───────────────────────────────────────────────

/** "Score" and "Score again" on the Resume tab: scores the tailored resume in the background and returns the job's id. */
export const startScoringResume = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  const resume = await prisma.document.findUnique({ where: { applicationId_kind: { applicationId: id, kind: DocumentKind.RESUME } }, select: { id: true } });
  if (!resume) throw new ActionError((await prisma.application.count({ where: { id } })) ? "Schreib zuerst den zugeschnittenen Lebenslauf." : GONE);
  const problem = await scoringProblem();
  if (problem) throw new ActionError(problem);
  const key = scoreResumeJobKey(id);
  const [running] = await findUnfinishedJobs(key);
  return running?.id ?? startJob(scoreResumeJob, { applicationId: id }, { key, applicationId: id });
});

// ─── The email (Email tab) ───────────────────────────────────────────────────

/**
 * "Write the email" and "Rewrite": writes the application's email in the
 * background and returns the job's id. Asking again while it's being
 * written follows the same job.
 */
export const startWritingEmail = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  if (!(await prisma.application.count({ where: { id } }))) throw new ActionError(GONE);
  if (!(await isAiConfigured())) throw new ActionError("Dafür brauchst du einen KI-Anbieter. Wähle einen unter Einstellungen → KI-Anbieter.");
  const [running] = await findUnfinishedJobs(emailJobKey(id));
  return running?.id ?? startJob(writeEmailJob, { applicationId: id }, { key: emailJobKey(id), applicationId: id });
});

/**
 * Undo on the "Rewrote the email." toast: puts back the email the rewrite
 * replaced, unless it has changed again since.
 */
export const undoEmailRewrite = action(z.object({ id: z.string().min(1), jobId: z.string().min(1) }), async ({ id, jobId }) => {
  const job = await prisma.job.findFirst({ where: { id: jobId, key: emailJobKey(id), status: "DONE" }, select: { result: true } });
  const result = writeEmailJob.result.safeParse(job?.result);
  const previous = result.success ? result.data.previous : null;
  if (!result.success || !previous) throw new ActionError("Es gibt nichts rückgängig zu machen.");

  const same = (a: unknown, b: unknown) => JSON.stringify(unitsSchema.parse(a)) === JSON.stringify(unitsSchema.parse(b));
  await updateDocuments(id, async (documents) => {
    const current = documents[DocumentKind.EMAIL];
    if (!current) throw new ActionError(PART_GONE);
    if (!same(current, result.data.units)) {
      throw new ActionError("Die E-Mail hat sich seitdem geändert, daher lässt sich das nicht rückgängig machen. Frühere Fassungen sind in ihrem Verlauf.");
    }
    documents[DocumentKind.EMAIL] = previous;
  }, { version: { cause: VersionCause.UNDONE } });
  refresh(id);
  return null;
});
