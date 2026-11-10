"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Saved here, from an environment variable, missing, or saved under another DOSSIER_SECRET. */
export type KeyState = "none" | "set" | "unreadable" | "env";

export const KEY_UNREADABLE = "Dein gespeicherter Schlüssel ist nicht lesbar. Bitte gib ihn neu ein.";

/**
 * A write-only key (Settings → Job search, Scoring): saved when you leave
 * the field or press Enter, then only "Saved" shows.
 */
export function KeyField({
  label,
  keyState,
  envName,
  getKey,
  onSave,
}: {
  label: string;
  keyState: KeyState;
  envName: string;
  getKey: { href: string; text: string };
  onSave: (change: { action: "set"; value: string } | { action: "clear" }) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const save = async () => {
    if (!value.trim()) return;
    if (await onSave({ action: "set", value })) setValue("");
  };
  return (
    <div className="flex flex-col gap-2.5">
      <Input
        label={label}
        type="password"
        autoComplete="off"
        value={value}
        placeholder={
          keyState === "set" ? "Gespeichert · neuen Schlüssel eingeben, um ihn zu ersetzen" : keyState === "env" ? `Nutzt ${envName} · gib einen ein, um ihn hier zu speichern` : "Wird verschlüsselt auf deinem Server gespeichert"
        }
        error={keyState === "unreadable" ? KEY_UNREADABLE : undefined}
        hint={
          keyState === "none" ? (
            <>
              Hol dir einen bei{" "}
              <a href={getKey.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                {getKey.text}
              </a>
              .
            </>
          ) : undefined
        }
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) {
            event.preventDefault();
            void save();
          }
        }}
      />
      {(keyState === "set" || keyState === "unreadable") && (
        <Button variant="text" size="sm" className="self-start" onClick={() => void onSave({ action: "clear" })}>
          Gespeicherten Schlüssel entfernen
        </Button>
      )}
    </div>
  );
}
