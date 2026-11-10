"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DocumentPreview } from "@/components/documents/document-preview";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { ResumeDocument } from "@/components/documents/resume-document";
import { PageHeader } from "@/components/page-header";
import { toast, toastResult } from "@/components/toast";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import type { PaperSize } from "@/generated/prisma/enums";
import type { ProfileData } from "@/lib/profile";
import { saveFile } from "@/lib/save-file";
import type { SectionLayout } from "@/lib/resume-sections";
import { parseThemeFile, themeFile, themeFileName } from "@/lib/theme-file";
import { FIT_LEVELS, hasSidebar, PAPER_SIZES, type ThemeData } from "@/lib/themes";

import { deleteTheme, duplicateTheme, importTheme, saveResumeSections, saveTheme, setBaseTheme, setFitBaseResume } from "./actions";
import { SectionsPanel } from "./sections-panel";
import { draftFrom, ThemeBuilder, type ThemeDraft } from "./theme-builder";
import { ThemePicker } from "./theme-picker";

export type ResumeWorkspaceProps = {
  profile: ProfileData;
  themes: ThemeData[];
  /** How many applications' documents use each theme, by id (E5-7). */
  usage: Record<string, number>;
  baseThemeId: string;
  paper: PaperSize;
  includeReferences: boolean;
  /** Settings → "Base resume language", for its headings and dates; null for English. */
  language: string | null;
  /** The sections' order and which are off (#297). */
  sections: SectionLayout;
  /** "Fit to one page" (public issue 69). */
  fitToPage: boolean;
  /** `/resume?panel=sections` opens the Sections tab. */
  initialPanel?: Panel;
};

export type Panel = "themes" | "customize" | "sections";

/**
 * The Base resume screen: the preview on the left and the theme panel on the
 * right, which moves below the preview on narrow windows. Picking a theme
 * shows it right away and saves it in the background; while you customise
 * one, the preview shows the draft.
 */
export function ResumeWorkspace({
  profile,
  themes: initialThemes,
  usage,
  baseThemeId,
  paper,
  includeReferences,
  language,
  sections: initialSections,
  fitToPage: initialFit,
  initialPanel = "themes",
}: ResumeWorkspaceProps) {
  const [themes, setThemes] = useState(initialThemes);
  const [fitToPage, setFitToPage] = useState(initialFit);
  // How far the resume is squeezed to fit one page (public issue 69): the
  // preview measures itself, and goes a step tighter while it runs over.
  const [fit, setFit] = useState(0);
  const [pages, setPages] = useState(1);
  const [baseId, setBaseId] = useState(baseThemeId);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [sections, setSections] = useState(initialSections);
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ThemeData | null>(null);
  // The last base theme the server confirmed, to go back to if a save fails,
  // and the last one picked, so an older failure doesn't undo a newer pick.
  const savedId = useRef(baseThemeId);
  const pickedId = useRef(baseThemeId);
  // The same for the sections' order.
  const savedSections = useRef(initialSections);
  const latestSections = useRef(initialSections);

  const base = themes.find((entry) => entry.id === baseId) ?? themes[0];
  const theme: ThemeData = draft ? { ...draft, id: draft.id ?? "draft", builtIn: false } : base;
  // The squeeze starts over from the theme as it is whenever what's on the page changes.
  const shown = [draft, base, profile, paper, includeReferences, language, sections, fitToPage] as const;
  const [squeezed, setSqueezed] = useState(shown);
  if (shown.some((input, index) => input !== squeezed[index])) {
    setSqueezed(shown);
    setFit(0);
  }
  const onPages = (counted: number) => {
    setPages(counted);
    if (fitToPage && counted > 1 && fit < FIT_LEVELS) setFit(fit + 1);
  };
  const toggleFit = async (next: boolean) => {
    setFitToPage(next);
    if (!toastResult(await setFitBaseResume({ fit: next })).ok) setFitToPage(!next);
  };
  const empty =
    !profile.basics.name.trim() &&
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0;

  // E11-3: opening or leaving the builder replaces the panel's controls, so
  // focus follows: to the theme's name, or back to the theme in use.
  const panelArea = useRef<HTMLElement>(null);
  const movedPanel = useRef(false);
  useEffect(() => {
    if (!movedPanel.current) return;
    movedPanel.current = false;
    // A frame later: the tab's content mounts after this render.
    const frame = requestAnimationFrame(() =>
      panelArea.current?.querySelector<HTMLElement>(panel === "customize" ? "input" : "[data-in-use]")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [panel]);

  /** Switches panels; `moveFocus` when the control used goes away with the old panel. */
  const openPanel = (next: Panel, moveFocus = false) => {
    movedPanel.current = moveFocus;
    // Customize starts from the theme in use; leaving it discards the draft.
    setDraft(next === "customize" ? (draft ?? draftFrom(base)) : null);
    setPanel(next);
  };

  const selectTheme = async (id: string) => {
    if (id === baseId) return;
    setBaseId(id);
    pickedId.current = id;
    const result = toastResult(await setBaseTheme({ id }));
    if (result.ok) savedId.current = id;
    else if (pickedId.current === id) setBaseId(savedId.current);
  };

  const changeSections = async (next: SectionLayout) => {
    setSections(next);
    latestSections.current = next;
    const result = toastResult(await saveResumeSections(next));
    if (result.ok) savedSections.current = next;
    else if (latestSections.current === next) setSections(savedSections.current);
  };

  /** A new custom theme, now the base theme: from a copy or an imported file. */
  const addTheme = (added: ThemeData) => {
    setThemes((current) => [...current, added]);
    setBaseId(added.id);
    savedId.current = pickedId.current = added.id;
  };

  // E5-7: what can be done with the theme in use.
  const duplicate = async () => {
    const result = toastResult(await duplicateTheme({ id: base.id }));
    if (result.ok) addTheme(result.data);
  };

  const exportFile = () =>
    saveFile(new Blob([JSON.stringify(themeFile(base), null, 2)], { type: "application/json" }), themeFileName(base));

  const importFile = async (file: File) => {
    if (file.size > 100_000) return toast("Diese Datei ist zu groß für ein Dossier-Design.");
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return toast("Diese Datei ist kein Dossier-Design.");
    }
    // Checked here for a quick answer, and again on the server.
    const read = parseThemeFile(json);
    if (!read.ok) return toast(read.error);
    const result = toastResult(await importTheme({ file: json }));
    if (result.ok) addTheme(result.data);
  };

  const remove = async (theme: ThemeData) => {
    const result = toastResult(await deleteTheme({ id: theme.id }));
    if (!result.ok) return;
    setThemes((current) => current.filter((entry) => entry.id !== theme.id));
    setBaseId(result.data.baseThemeId);
    savedId.current = pickedId.current = result.data.baseThemeId;
    // Its Delete button is gone with it: focus goes to the theme in use now.
    requestAnimationFrame(() => panelArea.current?.querySelector<HTMLElement>("[data-in-use]")?.focus());
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    const result = toastResult(await saveTheme(draft));
    setSaving(false);
    if (!result.ok) return;
    const saved = result.data;
    setThemes((current) =>
      current.some((entry) => entry.id === saved.id)
        ? current.map((entry) => (entry.id === saved.id ? saved : entry))
        : [...current, saved],
    );
    setBaseId(saved.id);
    savedId.current = pickedId.current = saved.id;
    openPanel("themes", true);
  };

  return (
    <>
      <PageHeader
        title="Basis-Lebenslauf"
        description="Direkt aus deinem Profil erstellt. Jede neue Bewerbung startet mit diesem und wird dann auf die Stelle zugeschnitten."
        actions={
          <>
            <Link href="/profile" className={buttonClassName("secondary")}>
              Profil bearbeiten
            </Link>
            <DownloadPdfButton href="/api/pdf?doc=base">PDF herunterladen</DownloadPdfButton>
          </>
        }
      />
      <div className="@container flex flex-1 flex-wrap border-t border-line">
        <DocumentPreview
          label={theme.name}
          meta={(pages) => `${PAPER_SIZES[paper].label} · ${pages} ${pages === 1 ? "Seite" : "Seiten"}${fit > 0 ? " · eingepasst" : ""}`}
          onPages={onPages}
          notice={() =>
            empty ? (
              // E11-4: an empty page needs a way forward.
              <p role="note" className="rounded-card bg-card px-4 py-2.5 text-meta text-muted">
                Dein Lebenslauf füllt sich aus deinem Profil. Trag deinen Namen und ein, zwei Positionen ein, dann nimmt er hier Gestalt an.{" "}
                <Link href="/profile" className="text-ink underline underline-offset-2">
                  Zu deinem Profil
                </Link>
              </p>
            ) : null
          }
        >
          <ResumeDocument theme={theme} profile={profile} paper={paper} includeReferences={includeReferences} language={language} sections={sections} fit={fitToPage ? fit : 0} />
        </DocumentPreview>
        <aside
          ref={panelArea}
          aria-label="Design und Abschnitte"
          className="flex flex-[1_0_300px] flex-col gap-6 border-t border-line bg-paper px-7 pt-7 pb-12 @min-[780px]:border-t-0 @min-[780px]:border-l"
        >
          <Toggle
            label="Auf eine Seite einpassen"
            description={
              !fitToPage
                ? "Aus. Der Lebenslauf nimmt so viele Seiten, wie er braucht."
                : fit === 0
                  ? "An. Er passt so, wie er ist."
                  : pages > 1
                    ? "An, aber er ist selbst eng gesetzt länger als eine Seite. Kürze ihn oder lass unter „Abschnitte“ einen Abschnitt weg."
                    : `An. Engere Abstände${fit >= 3 ? " und kleinere Schrift" : fit >= 2 ? " und Zeilen" : ""}, damit er passt; das PDF ebenso.`
            }
            checked={fitToPage}
            onCheckedChange={(next) => void toggleFit(next)}
          />
          <Tabs value={panel} onValueChange={(value) => openPanel(value as Panel)} className="flex flex-col gap-6">
            <TabsList variant="segmented">
              <TabsTrigger value="themes">Designs</TabsTrigger>
              <TabsTrigger value="customize">Anpassen</TabsTrigger>
              <TabsTrigger value="sections">Abschnitte</TabsTrigger>
            </TabsList>
            <TabsContent value="themes">
              <ThemePicker
                themes={themes}
                activeId={theme.id}
                userName={profile.basics.name.trim() || "Dein Name"}
                onSelect={selectTheme}
                onCustomize={() => openPanel("customize", true)}
                actions={{
                  duplicate: () => void duplicate(),
                  exportFile,
                  remove: () => setDeleting(base),
                  importFile: (file) => void importFile(file),
                }}
              />
            </TabsContent>
            <TabsContent value="customize">
              {draft && (
                <ThemeBuilder
                  draft={draft}
                  onChange={setDraft}
                  onSave={saveDraft}
                  onCancel={() => openPanel("themes", true)}
                  saving={saving}
                />
              )}
            </TabsContent>
            <TabsContent value="sections">
              <SectionsPanel
                profile={profile}
                includeReferences={includeReferences}
                sections={sections}
                sidebar={hasSidebar(theme.layout)}
                onChange={(next) => void changeSections(next)}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`„${deleting?.name ?? ""}“ löschen?`}
        description={deleteDescription(deleting ? (usage[deleting.id] ?? 0) : 0)}
        confirmLabel="Design löschen"
        onConfirm={() => deleting && void remove(deleting)}
      />
    </>
  );
}

/** What deleting the theme in use means (decided 29 September 2026: allowed while applications use it). */
function deleteDescription(applications: number): string {
  const used =
    applications === 0
      ? "Keine Bewerbung nutzt es."
      : `${applications === 1 ? "Eine Bewerbung nutzt" : `${applications} Bewerbungen nutzen`} es; ihre Unterlagen verwenden dann stattdessen dein Basis-Design.`;
  return `${used} Editorial wird dein Basis-Design. Das lässt sich nicht rückgängig machen, aber du kannst das Design vorher exportieren.`;
}

