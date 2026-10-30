"use client";

import { Dialog } from "radix-ui";
import { useRef, useState } from "react";

import { toast } from "@/components/toast";
import { buttonClassName } from "@/components/ui/button";

import { chooseUsagePing } from "./actions";

/** PRIVACY.md's section on the usage ping, for the rest of what the question says. */
export const USAGE_PING_PRIVACY_URL = "https://github.com/AienTech/dossier/blob/main/PRIVACY.md#usage-ping";

const LINK = "font-medium text-ink underline underline-offset-2";

/**
 * Asks once after sign-in whether to send the usage ping (#172). Consent has
 * to be a free choice: both answers look the same, neither has focus at
 * first, and closing the dialog (Escape, or a click outside) is a no. Its
 * wording is USAGE_PING_TEXT_VERSION: change that with it.
 */
export function UsagePingDialog({ host }: { host: string }) {
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const content = useRef<HTMLDivElement>(null);

  const answer = async (send: boolean) => {
    if (saving) return;
    setSaving(true);
    const result = await chooseUsagePing({ send });
    setSaving(false);
    if (!result.ok) return toast(result.error);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && void answer(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          ref={content}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            // The dialog itself takes focus, so neither answer looks preselected.
            event.preventDefault();
            content.current?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-32px)] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-dialog border border-line-popover bg-card p-6 shadow-menu focus:outline-none"
        >
          <Dialog.Title className="font-serif text-[22px] leading-tight">Täglichen Nutzungs-Ping senden?</Dialog.Title>
          <Dialog.Description asChild>
            <div className="flex flex-col gap-2.5 text-sm text-muted">
              <p>
                Einmal an jedem Tag, an dem du Dossier nutzt, würde dein Server an <span className="text-ink">{host}</span> eine zufällige Installations-ID und
                die Versionsnummer senden, damit das Projekt weiß, wie viele Installationen wie oft genutzt werden.
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>Sonst nichts: kein Profil, keine Unterlagen, Bewerbungen, Einstellungen oder Serveradresse. Der Empfänger speichert die Absenderadresse des Pings nicht.</li>
                <li>Er geht an den Betreuer des Dossier-Projekts, auf dessen eigenen Server in Deutschland. Kein anderer Dienst ist unterwegs beteiligt.</li>
                <li>Was gespeichert wird, wird nach einem Jahr gelöscht.</li>
              </ul>
              <p>
                Nichts wird gesendet, außer du wählst „Nutzungs-Ping senden“. Du kannst das unter Einstellungen → Über ändern oder mit DOSSIER_TELEMETRY auf dem
                Server. Um Gespeichertes löschen zu lassen, schick die Installations-ID an{" "}
                <a href="mailto:dossier.app@pm.me" className={LINK}>
                  dossier.app@pm.me
                </a>
                .{" "}
                <a href={USAGE_PING_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
                  Mehr unter Datenschutz <span className="sr-only">(öffnet in neuem Tab)</span>
                </a>
              </p>
            </div>
          </Dialog.Description>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" className={buttonClassName("secondary", "sm")} disabled={saving} onClick={() => void answer(false)}>
              Nicht senden
            </button>
            <button type="button" className={buttonClassName("secondary", "sm")} disabled={saving} onClick={() => void answer(true)}>
              Nutzungs-Ping senden
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
