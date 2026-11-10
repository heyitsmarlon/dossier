import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { verifySession } from "@/lib/auth/session";

import { Consent } from "./consent";
import { checkAuthorizeRequest } from "./request";

export const metadata: Metadata = { title: "App verbinden" };

/**
 * Claude, or another MCP app (#281), asks to use Dossier through the connector (#221, src/app/api/mcp).
 * Signed-out visitors sign in first: the proxy sends them to /login and back.
 */
export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  await verifySession();
  const params = await searchParams;
  const checked = await checkAuthorizeRequest(params);
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-8 py-12">
      <div className="flex w-full max-w-[460px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <h1 className="font-serif text-[26px] font-medium tracking-[-0.01em]">
            {"error" in checked ? "Eine App" : checked.clientName} mit Dossier verbinden
          </h1>
        </div>
        {"error" in checked ? (
          <p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-sm text-error">
            {checked.error}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 text-sm leading-[1.6] text-pretty">
              <p>
                <strong>{checked.clientName}</strong> möchte dein Dossier nutzen. Wenn du es erlaubst, kann es:
              </p>
              <ul className="list-disc pl-5 text-muted">
                <li>mit deiner Jobquelle nach Jobs suchen und Anzeigen anhand deines Profils bewerten</li>
                <li>dein Profil und deine Bewerbungen samt Lebensläufen und Anschreiben lesen, aber nicht deine Kontaktdaten oder Notizen</li>
                <li>Bewerbungen, die es für dich schreibt, als Entwürfe speichern und ihren Status ändern</li>
              </ul>
              <p className="text-muted">
                Es kann nie eine Bewerbung oder E-Mail verschicken oder etwas löschen. Erlaube es nur, wenn du Dossier gerade selbst zu{" "}
                {checked.clientName} hinzugefügt hast: Es schickt dich zurück zu <strong className="text-ink">{new URL(checked.redirectUri).host}</strong>.
                Unter Einstellungen → MCP-Connector kannst du jede App jederzeit trennen.
              </p>
            </div>
            <Consent
              request={{
                client_id: checked.clientId,
                redirect_uri: checked.redirectUri,
                code_challenge: checked.codeChallenge,
                code_challenge_method: one(params.code_challenge_method),
                state: checked.state,
                resource: checked.resource,
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
