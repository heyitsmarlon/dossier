"use client";

import { useEffect, useState } from "react";

import type { AutosaveStatus } from "@/hooks/use-autosave";
import { cn } from "@/lib/cn";

/** "Saved just now", "Saved 2 min ago", or "Saved at 14:05" after an hour. */
export function savedLabel(savedAt: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - savedAt.getTime()) / 60_000);
  if (minutes < 1) return "Gerade gespeichert";
  if (minutes < 60) return `Vor ${minutes} Min. gespeichert`;
  return `Gespeichert um ${savedAt.toLocaleTimeString("de-DE", { hour: "numeric", minute: "2-digit" })}`;
}

/** The current time, updated every `interval` ms. */
function useNow(interval: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

/**
 * The header's autosave status, from `useAutosave`. Screen readers hear when
 * changes are saved or fail to save, but not every "Saving…" or clock tick.
 */
export function SavedIndicator({
  status,
  savedAt,
  className,
}: {
  status: AutosaveStatus;
  savedAt: Date | null;
  className?: string;
}) {
  const now = useNow(30_000);
  const visible =
    status === "saving"
      ? "Speichert…"
      : status === "error"
        ? "Speichern fehlgeschlagen"
        : savedAt
          ? savedLabel(savedAt, now > savedAt ? now : savedAt)
          : "Alle Änderungen gespeichert";
  const announced =
    status === "saved"
      ? "Alle Änderungen gespeichert."
      : status === "error"
        ? "Deine Änderungen konnten nicht gespeichert werden."
        : "";

  return (
    <span className={cn("text-meta", status === "error" ? "text-error" : "text-muted", className)}>
      <span aria-hidden="true">{visible}</span>
      <span role="status" className="sr-only">
        {announced}
      </span>
    </span>
  );
}
