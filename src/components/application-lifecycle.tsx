"use client";

import type { RefObject } from "react";

import { deleteApplication, setArchived } from "@/lib/application-actions";

import { toast, toastResult } from "./toast";
import { ConfirmDialog } from "./ui/confirm-dialog";

/**
 * Archives an application or brings it back (E9-5), with Undo on the
 * toast. Returns whether it worked.
 */
export async function archiveApplication(id: string, archived: boolean): Promise<boolean> {
  const result = await setArchived({ id, archived });
  if (!result.ok) {
    toast(result.error);
    return false;
  }
  if (archived) {
    toast("Archiviert. Sie ist vom Board verschwunden und zählt weiter auf deiner Übersicht.", {
      action: { label: "Rückgängig", onClick: () => void setArchived({ id, archived: false }).then(toastResult) },
    });
  } else {
    toast("Wieder auf deinem Board.");
  }
  return true;
}

/** "Delete…": asks first, since the application, its documents, chat and notes can't come back. */
export function DeleteApplicationDialog({
  id,
  open,
  onOpenChange,
  onDeleted,
  returnFocusTo,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  /** The menu button it was opened from. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Diese Bewerbung löschen?"
      description="Zugeschnittener Lebenslauf und Anschreiben, der Chat, deine Notizen, der Verlauf und die Mails aus Gmail werden mitgelöscht. Das lässt sich nicht rückgängig machen. Archiviere sie stattdessen, um sie aus dem Weg zu räumen."
      confirmLabel="Bewerbung löschen"
      returnFocusTo={returnFocusTo}
      onConfirm={async () => {
        const result = await deleteApplication({ id });
        if (!result.ok) return toast(result.error);
        toast("Bewerbung gelöscht.");
        onDeleted?.();
      }}
    />
  );
}
