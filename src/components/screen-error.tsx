"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ScreenMessage } from "@/components/screen-message";
import { Button, buttonClassName } from "@/components/ui/button";

/** What Next.js passes to an `error.tsx`. */
export type ErrorPageProps = {
  error: Error & { digest?: string };
  /** Fetches and renders the screen again. */
  retry: () => void;
};

/**
 * A screen that failed to load (E11-4), with Try again and a way elsewhere.
 * The error itself stays on the server; its digest points to the log entry.
 */
export function ScreenError({
  error,
  retry,
  title,
  children,
  elsewhere = { href: "/", label: "Zur Übersicht" },
  standalone,
}: ErrorPageProps & {
  /** Outside the app's shell: see ScreenMessage. */
  standalone?: boolean;
  title: string;
  /** Extra reassurance for this screen, e.g. that a draft is kept. */
  children?: ReactNode;
  elsewhere?: { href: string; label: string };
}) {
  return (
    <ScreenMessage
      title={title}
      standalone={standalone}
      actions={
        <>
          <Button onClick={() => retry()}>Erneut versuchen</Button>
          <Link href={elsewhere.href} className={buttonClassName("secondary")}>
            {elsewhere.label}
          </Link>
        </>
      }
    >
      <p>Auf dem Server ist etwas schiefgegangen. Nichts Gespeichertes ist verloren, und ein neuer Versuch löst es meistens.</p>
      {children}
      {error.digest && (
        <p className="text-meta">
          If it keeps happening, the server log has the details under <code className="font-mono">{error.digest}</code>.
        </p>
      )}
    </ScreenMessage>
  );
}
