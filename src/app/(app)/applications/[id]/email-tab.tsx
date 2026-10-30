"use client";

import type { CSSProperties, ReactNode } from "react";

import type { UnitRenderer } from "@/components/documents/document-page";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import type { Unit } from "@/lib/application-data";
import { emailParts, mailtoHref } from "@/lib/application-email";
import { cn } from "@/lib/cn";
import { copyText } from "@/lib/copy-text";

import { SendWithGmail, type GmailSender } from "./send-with-gmail";
import { aboutWords } from "./tabs";

/** The PDFs to attach, by their file names; null when the application doesn't have one. */
export type Attachments = { resume: string | null; letter: string | null };

/**
 * The Email tab: the email to send the application with, to whoever the
 * posting says to send it to. Each part copies on its own for a mail app's
 * fields, or the whole email opens in the mail app, and the resume and cover
 * letter it mentions download right below it. Its parts are edited,
 * regenerated and refined like the documents' (`renderUnit`). Before it's
 * written, the tab offers to write it.
 */
export function EmailTab({
  applicationId,
  units,
  renderUnit,
  history,
  hint,
  notice,
  writing,
  onWrite,
  attachments,
  gmail,
}: {
  applicationId: string;
  /** The email's units; null until it's written. */
  units: Unit[] | null;
  renderUnit: UnitRenderer;
  /** The History button. */
  history: ReactNode;
  /** How to change it, while the current version is shown. */
  hint?: string;
  /** Above the email, e.g. the banner over an earlier version. */
  notice?: ReactNode;
  /** It's being written or rewritten. */
  writing: boolean;
  /** "Write the email" and "Rewrite". */
  onWrite: () => void;
  attachments: Attachments;
  /** Sending with Gmail (E15-2): who it sends from, and whether it went out that way before. */
  gmail?: { sender: GmailSender; sentBefore: boolean };
}) {
  if (!units) {
    return (
      <div className="flex flex-1 flex-col items-center overflow-auto bg-canvas px-10 pt-11 pb-16">
        <div className="flex w-full max-w-[560px] flex-col items-start gap-3 rounded-panel border border-line-card bg-card px-7 py-7">
          <h2 className="font-serif text-section">Eine E-Mail zum Mitschicken</h2>
          <p className="text-sm text-muted">
            Ich schreibe eine kurze E-Mail zu Lebenslauf und Anschreiben, an die Adresse, die die Anzeige für Bewerbungen nennt.
            Kopier sie in deine Mail-App oder öffne sie dort, und häng die PDFs an.
          </p>
          <Button className="mt-1" aria-disabled={writing || undefined} onClick={() => !writing && onWrite()}>
            {writing ? "E-Mail wird geschrieben…" : "E-Mail schreiben"}
          </Button>
        </div>
      </div>
    );
  }

  const { to, subject, body } = emailParts(units);
  const copy = async (text: string, what: string) =>
    toast((await copyText(text)) ? `${what} kopiert.` : "Kopieren hat nicht geklappt. Markiere den Text und kopiere ihn selbst.");

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-auto bg-canvas px-10 pt-11 pb-16">
      <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-x-3 gap-y-1 text-meta text-muted">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Email · {aboutWords([body])}</span>
          {history}
        </span>
        {hint && <span>{hint}</span>}
      </div>
      {notice && <div className="w-full max-w-[680px]">{notice}</div>}

      <article
        aria-label="E-Mail"
        aria-busy={writing || undefined}
        // The parts' highlight and toolbar are measured in page units, which are pixels here.
        style={{ "--u": "1px" } as CSSProperties}
        className={cn("w-full max-w-[680px] rounded-panel border border-line-card bg-card motion-safe:transition-opacity", writing && "opacity-50")}
      >
        <Field label="An" onCopy={to ? () => void copy(to, "Empfänger") : undefined}>
          {renderUnit({
            id: "to",
            children: to || <span className="text-muted">Die Anzeige nennt keine Adresse. Zum Ergänzen bearbeiten.</span>,
          })}
        </Field>
        <Field label="Betreff" onCopy={subject ? () => void copy(subject, "Betreff") : undefined}>
          {renderUnit({ id: "subject", children: subject })}
        </Field>
        <div className="px-7 pt-6 pb-7">
          {renderUnit({ id: "body", className: "text-field leading-[1.6] break-words whitespace-pre-wrap", children: body })}
        </div>

        {(attachments.resume || attachments.letter) && (
          <div className="flex flex-col gap-2.5 border-t border-line px-7 pt-4 pb-5">
            <h3 className="text-meta text-muted">Anhängen</h3>
            <ul className="flex flex-col gap-2">
              {attachments.resume && (
                <Attachment name={attachments.resume} href={`/api/pdf?doc=resume&application=${applicationId}`} what="Zugeschnittener Lebenslauf" />
              )}
              {attachments.letter && (
                <Attachment name={attachments.letter} href={`/api/pdf?doc=letter&application=${applicationId}`} what="Anschreiben" />
              )}
            </ul>
          </div>
        )}
      </article>

      <div className="flex w-full max-w-[680px] flex-wrap items-center gap-3">
        {gmail && (
          <SendWithGmail
            applicationId={applicationId}
            sender={gmail.sender}
            to={to}
            subject={subject}
            attachments={[attachments.resume, attachments.letter].filter((name): name is string => name !== null)}
            sentBefore={gmail.sentBefore}
          />
        )}
        <Button variant={gmail?.sender.from ? "secondary" : "primary"} onClick={() => void copy(body, "Nachricht")}>
          Nachricht kopieren
        </Button>
        {/* Mail apps can't take attachments from a link: the PDFs are attached by hand. */}
        <a href={mailtoHref({ to, subject, body })} className={buttonClassName("secondary", "md")}>
          In Mail-App öffnen
        </a>
        <Button variant="text" className="ml-auto" aria-disabled={writing || undefined} onClick={() => !writing && onWrite()}>
          {writing ? "Wird neu geschrieben…" : "Neu schreiben"}
        </Button>
      </div>
    </div>
  );
}

/** A header line of the email, "An" or "Betreff", with its Copy button. */
function Field({ label, onCopy, children }: { label: string; onCopy?: () => void; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-line px-7 py-3.5">
      <span className="w-14 shrink-0 text-meta text-muted">{label}</span>
      <div className="min-w-0 flex-1 text-field break-words">{children}</div>
      {onCopy && (
        <Button variant="text" size="sm" className="py-0!" aria-label={`${label === "An" ? "Empfänger" : label} kopieren`} onClick={onCopy}>
          Kopieren
        </Button>
      )}
    </div>
  );
}

/** A PDF to attach, with its download. */
function Attachment({ name, href, what }: { name: string; href: string; what: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control border border-line-card bg-input py-2 pr-2 pl-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="rounded-[5px] bg-danger-surface px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-danger">
          PDF
        </span>
        <span className="truncate text-control">{name}</span>
      </span>
      <DownloadPdfButton variant="secondary" size="sm" href={href} progress={`${what} wird als PDF erstellt…`}>
        Herunterladen <span className="sr-only">{name}</span>
      </DownloadPdfButton>
    </li>
  );
}
