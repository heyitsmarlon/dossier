"use client";

import { ScreenError, type ErrorPageProps } from "@/components/screen-error";

export default function NewApplicationError(props: ErrorPageProps) {
  return (
    <ScreenError {...props} title="Neue Bewerbung konnte nicht geladen werden">
      <p>Eine eingefügte Anzeige bleibt in diesem Tab erhalten und ist wieder da, sobald es funktioniert.</p>
    </ScreenError>
  );
}
