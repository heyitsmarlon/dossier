"use client";

import { AlertDialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toastWithUndo } from "@/components/change-status";
import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { emailAddresses } from "@/lib/application-email";
import { sendWithGmail } from "@/lib/google/actions";

/** Whether Gmail can send, for the Email tab: the account it sends from, or why not. */
export type GmailSender = { from: string } | { from: null; reason: "not-configured" | "not-connected" | "no-permission" };

/**
 * "Send with Gmail" (E15-2): sends the email from the connected account with
 * the PDFs attached, after a confirmation that says exactly what goes where.
 */
export function SendWithGmail({
  applicationId,
  sender,
  to,
  subject,
  attachments,
  sentBefore,
}: {
  applicationId: string;
  sender: GmailSender;
  to: string;
  subject: string;
  attachments: string[];
  /** It went out through Gmail already. */
  sentBefore: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, startSending] = useTransition();

  if (sender.from === null) {
    if (sender.reason === "not-configured") return null;
    return (
      <a href={sender.reason === "no-permission" ? "/api/google/connect?scopes=send" : "/settings?section=google"} className={buttonClassName("secondary", "md")}>
        {sender.reason === "no-permission" ? "Senden mit Gmail erlauben" : "Gmail zum Senden verbinden"}
      </a>
    );
  }

  const ready = emailAddresses(to).length > 0 && subject.trim().length > 0;
  const send = () =>
    startSending(async () => {
      setOpen(false);
      const result = await sendWithGmail({ id: applicationId });
      if (!result.ok) return toast(result.error);
      toastWithUndo(result.toast, result.data.eventId);
      router.refresh();
    });

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <Button
        aria-disabled={sending || !ready || undefined}
        onClick={() => {
          if (sending) return;
          if (!ready) return toast(emailAddresses(to).length === 0 ? "Trag zuerst einen Empfänger ein: Die Anzeige nennt keine Adresse." : "Trag zuerst einen Betreff ein.");
          setOpen(true);
        }}
      >
        {sending ? "Wird gesendet…" : sentBefore ? "Erneut mit Gmail senden" : "Mit Gmail senden"}
      </Button>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-dialog border border-line-popover bg-card p-6 shadow-menu">
          <AlertDialog.Title className="font-serif text-[22px] leading-tight">Diese Bewerbung senden?</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="flex flex-col gap-3 text-sm text-muted">
              <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5">
                <dt>Von</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{sender.from}</dd>
                <dt>To</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{to}</dd>
                <dt>Betreff</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{subject}</dd>
                <dt>Anhänge</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{attachments.length > 0 ? attachments.join(", ") : "Keine"}</dd>
              </dl>
              <p>
                {sentBefore ? "Sie ist schon einmal rausgegangen; das sendet sie erneut. " : "Sie wandert nach „Gesendet“, und "}
                ich behalte den Verlauf auf Antworten im Blick. Das lässt sich nicht zurückholen.
              </p>
            </div>
          </AlertDialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonClassName("secondary", "sm")}>Abbrechen</AlertDialog.Cancel>
            <AlertDialog.Action className={buttonClassName("primary", "sm", "hover:text-on-primary")} onClick={send}>
              Jetzt senden
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
