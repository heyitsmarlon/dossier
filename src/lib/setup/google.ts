import { WIKI, type Instruction } from "./instructions";

// The setup guide's Gmail and Calendar step (E21-5): Google Cloud's steps,
// as Google's docs gave them on 5 November 2026 (Google Auth Platform's
// Branding, Audience and Clients pages).

export const GOOGLE_STEPS: readonly Instruction[] = [
  {
    text: "Melde dich mit deinem Google-Konto bei Google Cloud an und erstelle ein Projekt. Nenn es **Dossier** und drück **Create** (Erstellen).",
    link: { href: "https://console.cloud.google.com/projectcreate", label: "Google Cloud" },
  },
  {
    text: "Schalte die Gmail API ein: Prüf, ob oben auf der Seite dein neues Projekt ausgewählt ist, und drück dann **Enable** (Aktivieren).",
    link: { href: "https://console.cloud.google.com/apis/enableflow;apiid=gmail.googleapis.com", label: "Gmail API" },
  },
  {
    text: "Schalte die Google Calendar API genauso ein.",
    link: { href: "https://console.cloud.google.com/apis/enableflow;apiid=calendar-json.googleapis.com", label: "Google Calendar API" },
  },
  {
    text: "Richte den Anmeldebildschirm ein: Drück **Get started** (Jetzt starten), gib **Dossier** als App-Namen und deine E-Mail ein, wähle **External** (Extern), gib deine E-Mail noch einmal ein, stimm der Richtlinie zu und drück **Create** (Erstellen).",
    link: { href: "https://console.developers.google.com/auth/branding", label: "Branding" },
  },
  {
    text: "Öffne **Audience** (Zielgruppe), drück **Publish app** (App veröffentlichen) und bestätige. Bis dahin beendet Google die Verbindung alle 7 Tage.",
    link: { href: "https://console.developers.google.com/auth/audience", label: "Audience" },
  },
  {
    text: "Öffne **Clients** und drück **Create client** (Client erstellen). Wähle **Web application** (Webanwendung) und nenn ihn Dossier. Drück unter **Authorized redirect URIs** (Autorisierte Weiterleitungs-URIs) auf **Add URI** (URI hinzufügen) und füge die Adresse unten ein. Lass **Use this client for an AI-powered agent** frei und drück **Create** (Erstellen).",
    link: { href: "https://console.developers.google.com/auth/clients", label: "Clients" },
  },
  { text: "Kopier die **Client ID** und das **Client secret** in die Felder unten. Google zeigt das Secret nur einmal, kopier es also, bevor du das Fenster schließt." },
  {
    text: "Drück **Google verbinden**. Google warnt, dass die App nicht verifiziert ist: Es ist deine eigene, also drück **Advanced** (Erweitert), dann **Go to Dossier (unsafe)** (Weiter zu Dossier (unsicher)) und erlaube, worum es bittet.",
  },
];

export const GOOGLE_HELP = `${WIKI}/Connecting-Gmail-and-Calendar`;

/**
 * Why Google won't take this redirect address, if it won't: it wants https,
 * except on localhost, and a name rather than an IP address.
 */
export function googleAddressProblem(redirectUri: string): "http" | "ip" | null {
  const { protocol, hostname } = new URL(redirectUri);
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[")) return "ip";
  return protocol === "https:" ? null : "http";
}
