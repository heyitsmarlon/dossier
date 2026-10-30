"use client";

import { ScreenError, type ErrorPageProps } from "@/components/screen-error";
import { fontVariables } from "@/fonts";

import "./globals.css";

/** When even the root layout fails (E11-4): it replaces the whole document, so it brings its own. */
export default function GlobalError(props: ErrorPageProps) {
  return (
    <html lang="de" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <title>Dossier konnte nicht geladen werden</title>
        <main className="flex min-h-screen justify-center">
          <ScreenError {...props} standalone title="Dossier konnte nicht geladen werden" />
        </main>
      </body>
    </html>
  );
}
