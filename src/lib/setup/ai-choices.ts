import { AiProvider } from "@/generated/prisma/enums";

import { WIKI, type Instruction } from "./instructions";

// The setup guide's AI step (E21-2): what people care about first, then one
// or two providers for it, each with what it costs, where the data goes and
// the steps to a key. Free hosted tiers aren't offered: Google's may train on
// what's sent and have people read it, Mistral's says it may train, and
// OpenRouter's free models can go to providers that do. Resumes don't belong
// there (decided 5 November 2026). The only free choice is your own computer.

export type AiPriority = "private" | "writing" | "cost" | "other";

export const AI_PRIORITIES: readonly { value: AiPriority; name: string; description: string }[] = [
  {
    value: "private",
    name: "Kostenlos und privat",
    description: "KI, die auf deinem eigenen Rechner läuft: Nichts verlässt ihn, und es kostet nichts. Braucht einen aktuellen Rechner, und Schreiben dauert Minuten statt Sekunden.",
  },
  { value: "writing", name: "Beste Texte", description: "Die bekanntesten KI-Firmen. Du kaufst etwas Guthaben und zahlst, was du nutzt." },
  { value: "cost", name: "Günstigste", description: "Kleinere Modelle von Google und Mistral, die weniger kosten. Du kaufst etwas Guthaben und zahlst, was du nutzt." },
  { value: "other", name: "Etwas anderes", description: "OpenRouter, das mit einem Schlüssel die Modelle vieler Firmen erreicht, oder ein KI-Server, den du schon hast." },
];

export type AiChoiceId = "lmstudio" | "ollama" | "openai" | "anthropic" | "gemini" | "mistral" | "openrouter";

export type AiChoice = {
  id: AiChoiceId;
  priority: AiPriority;
  name: string;
  /** Who's behind it, or what it is, in a few words. */
  about: string;
  provider: AiProvider;
  /** A hosted one's address; a local one is looked for on this computer instead (LOCAL_ADDRESSES). */
  baseUrl: string;
  /** Models in the order Dossier would pick them; the first one the account has is used. Empty for a local one, whose models are the user's. */
  models: readonly string[];
  cost: string;
  data: string;
  /** For a local one: what the computer needs. */
  needs?: string;
  steps: readonly Instruction[];
  /** The key to paste, if any. */
  key: { label: string; startsWith?: string } | null;
  help: string;
};

const OPENROUTER_KEYS = "https://openrouter.ai/keys";

export const AI_CHOICES: readonly AiChoice[] = [
  {
    id: "lmstudio",
    priority: "private",
    name: "LM Studio",
    about: "Eine App, die KI-Modelle auf deinem Rechner ausführt, ganz ohne Befehle tippen.",
    provider: AiProvider.LMSTUDIO,
    baseUrl: "",
    models: [],
    cost: "Kostenlos.",
    data: "Nichts verlässt deinen Rechner.",
    needs: "16 GB Arbeitsspeicher oder mehr ist am besten; unter Windows hilft eine Grafikkarte mit 4 GB eigenem Speicher sehr. Apple-Rechner brauchen einen Chip der M-Serie.",
    steps: [
      { text: "Lade LM Studio herunter und installiere es.", link: { href: "https://lmstudio.ai/download", label: "Download-Seite von LM Studio" } },
      { text: "Öffne den Tab **Discover**, such nach **Qwen** und lade ein 7B-Modell herunter. Das sind ein paar Gigabyte." },
      { text: "Öffne den Tab **Developer** und schalte oben den Server ein. Lass LM Studio offen." },
      { text: "Läuft Dossier auf einem anderen Rechner bei dir zu Hause, schalte in den Server-Einstellungen **Serve on Local Network** ein." },
      { text: "Drück unten **LM Studio finden**." },
    ],
    key: null,
    help: `${WIKI}/Choosing-an-AI-provider#lm-studio`,
  },
  {
    id: "ollama",
    priority: "private",
    name: "Ollama",
    about: "Führt KI-Modelle auf deinem Rechner aus. Ein Modell holst du mit einem getippten Befehl.",
    provider: AiProvider.LOCAL,
    baseUrl: "",
    models: [],
    cost: "Kostenlos.",
    data: "Nichts verlässt deinen Rechner, solange du ein Modell nutzt, das darauf läuft. Modelle, deren Name auf „cloud“ endet, laufen stattdessen auf Ollamas Servern.",
    needs: "Ein aktueller Rechner: Modelle sind mehrere Gigabyte groß und ohne starke Grafikkarte langsam. Auf dem Mac macOS Sonoma oder neuer.",
    steps: [
      { text: "Lade Ollama herunter und installiere es.", link: { href: "https://ollama.com/download", label: "Download-Seite von Ollama" } },
      { text: "Öffne ein Terminal (unter Windows **PowerShell**), tipp **ollama pull qwen2.5:7b** und drück Enter. Das lädt etwa 5 GB herunter." },
      { text: "Lass Ollama laufen und drück dann unten **Ollama finden**." },
    ],
    key: null,
    help: `${WIKI}/Choosing-an-AI-provider#local-model-with-ollama`,
  },
  {
    id: "openai",
    priority: "writing",
    name: "OpenAI",
    about: "Die Firma hinter ChatGPT.",
    provider: AiProvider.OPENAI,
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-6.1-terra", "gpt-6-luna"],
    cost: "Du kaufst zuerst Guthaben, mindestens 5 $, und jeder Lebenslauf oder jedes Anschreiben verbraucht ein bisschen davon. Ein ChatGPT-Plus-Abo deckt das nicht ab.",
    data: "Dein Profil ohne Kontaktdaten und die Anzeigen, die du hinzufügst, gehen an OpenAI. OpenAI trainiert damit nicht, außer du gibst sie ausdrücklich frei.",
    steps: [
      { text: "Registriere dich oder melde dich auf OpenAIs Developer-Plattform an.", link: { href: "https://platform.openai.com/", label: "OpenAI-Plattform" } },
      { text: "Füge unter **Billing** eine Karte hinzu und kauf mindestens 5 $ Guthaben. Automatisches Aufladen ist an, bis du es ausschaltest." },
      {
        text: "Öffne **API keys** und drück **Create new secret key**. Für den ersten Schlüssel schickt OpenAI einen Code per SMS oder WhatsApp an dein Handy.",
        link: { href: "https://platform.openai.com/api-keys", label: "OpenAI-API-Schlüssel" },
      },
      { text: "Kopier den Schlüssel sofort: Er wird nur einmal angezeigt. Füge ihn unten ein." },
    ],
    key: { label: "OpenAI-API-Schlüssel", startsWith: "sk-" },
    help: `${WIKI}/Choosing-an-AI-provider#openai`,
  },
  {
    id: "anthropic",
    priority: "writing",
    name: "Claude",
    about: "Die KI von Anthropic.",
    provider: AiProvider.ANTHROPIC,
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-5-5", "claude-haiku-5-5"],
    cost: "Du kaufst zuerst Guthaben, und jeder Lebenslauf oder jedes Anschreiben verbraucht ein bisschen davon. Ein Claude-Pro-Abo deckt das nicht ab.",
    data: "Dein Profil ohne Kontaktdaten und die Anzeigen, die du hinzufügst, gehen an Anthropic. Standardmäßig trainiert Anthropic nicht damit.",
    steps: [
      { text: "Registriere dich oder melde dich auf Claudes Developer-Plattform an.", link: { href: "https://platform.claude.com/", label: "Claude-Plattform" } },
      { text: "Öffne **Billing**, drück **Buy credits** und wähle einen Betrag.", link: { href: "https://platform.claude.com/settings/billing", label: "Billing" } },
      {
        text: "Öffne **API keys** und drück **Create key**. Wähle einen Workspace (der Standard reicht) und stell den Ablauf auf **Never**: Das lässt sich später nicht ändern.",
        link: { href: "https://platform.claude.com/settings/keys", label: "Claude-API-Schlüssel" },
      },
      { text: "Kopier den Schlüssel, er beginnt mit sk-ant-. Er wird nur einmal angezeigt. Füge ihn unten ein." },
    ],
    key: { label: "Claude-API-Schlüssel", startsWith: "sk-ant-" },
    help: `${WIKI}/Choosing-an-AI-provider#anthropic`,
  },
  {
    id: "gemini",
    priority: "cost",
    name: "Gemini",
    about: "Googles KI, über Google AI Studio.",
    provider: AiProvider.OPENAI,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
    cost: "Du richtest zuerst die Abrechnung ein und kaufst Guthaben, mindestens 5 $. Ein Google-AI-Abo deckt das nicht ab.",
    data: "Dein Profil ohne Kontaktdaten und die Anzeigen, die du hinzufügst, gehen an Google. Mit eingerichteter Abrechnung nutzt Google sie nicht zur Verbesserung seiner Produkte. Ohne darf Google das, und Menschen lesen eventuell mit: Deshalb kommt die Abrechnung zuerst.",
    steps: [
      { text: "Melde dich mit deinem Google-Konto bei Google AI Studio an und akzeptiere die Bedingungen.", link: { href: "https://aistudio.google.com/", label: "Google AI Studio" } },
      {
        text: "Drück auf der Seite **API keys** auf **Set up billing**, verknüpfe ein Abrechnungskonto und kauf mindestens 5 $ Guthaben. Mach das, bevor du den Schlüssel nutzt.",
        link: { href: "https://aistudio.google.com/api-keys", label: "AI-Studio-API-Schlüssel" },
      },
      { text: "Drück auf derselben Seite **Create API key**, kopier ihn und füge ihn unten ein." },
    ],
    key: { label: "Gemini-API-Schlüssel" },
    help: `${WIKI}/Choosing-an-AI-provider#gemini`,
  },
  {
    id: "mistral",
    priority: "cost",
    name: "Mistral",
    about: "Eine französische KI-Firma.",
    provider: AiProvider.MISTRAL,
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-small-2603", "mistral-small-latest"],
    cost: "Du schaltest zuerst Pay-as-you-go ein und lädst Guthaben auf. Mistrals Pro-Abo enthält jeden Monat etwas API-Guthaben.",
    data: "Dein Profil ohne Kontaktdaten und die Anzeigen, die du hinzufügst, gehen an Mistral. Mistral darf sie zur Verbesserung seiner Modelle nutzen, bis du das ausschaltest – das ist einer der Schritte.",
    steps: [
      { text: "Registriere dich oder melde dich in Mistrals Konsole an.", link: { href: "https://console.mistral.ai/", label: "Mistral-Konsole" } },
      { text: "Füge unter **Billing** eine Zahlungsmethode hinzu, schalte Pay-as-you-go ein und drück **Add credits**." },
      { text: "Öffne im **Admin Panel** den Punkt **Privacy** und schalte **Anonymous improvement data** aus." },
      {
        text: "Öffne **API keys** und erstelle einen Schlüssel. Kopier ihn sofort: Er wird nur einmal angezeigt. Füge ihn unten ein.",
        link: { href: "https://console.mistral.ai/api-keys", label: "Mistral-API-Schlüssel" },
      },
    ],
    key: { label: "Mistral-API-Schlüssel" },
    help: `${WIKI}/Choosing-an-AI-provider#mistral`,
  },
  {
    id: "openrouter",
    priority: "other",
    name: "OpenRouter",
    about: "Ein Schlüssel für die Modelle vieler Firmen. Dossier startet mit einem OpenAI-Modell.",
    provider: AiProvider.OPENAI,
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-6.1-terra", "google/gemini-3.8-flash"],
    cost: "Du kaufst zuerst Guthaben, mindestens 5 $, plus OpenRouters Gebühr von etwa 5,5 %.",
    data: "Dein Profil ohne Kontaktdaten und die Anzeigen, die du hinzufügst, gehen an OpenRouter und weiter an die Firma des Modells. Dossier bittet OpenRouter, Firmen auszulassen, die mit den Daten trainieren.",
    steps: [
      { text: "Registriere dich oder melde dich bei OpenRouter an.", link: { href: "https://openrouter.ai/", label: "OpenRouter" } },
      { text: "Kauf mindestens 5 $ Guthaben.", link: { href: "https://openrouter.ai/settings/credits", label: "OpenRouter-Guthaben" } },
      { text: "Erlaube in den Datenschutz-Einstellungen keine Anbieter, die mit deinen Daten trainieren – für bezahlte und kostenlose Modelle.", link: { href: "https://openrouter.ai/settings/privacy", label: "OpenRouter-Datenschutz" } },
      { text: "Erstelle einen Schlüssel und gib ihm einen Namen. Kopier ihn sofort und füge ihn unten ein.", link: { href: OPENROUTER_KEYS, label: "OpenRouter-Schlüssel" } },
    ],
    key: { label: "OpenRouter-Schlüssel", startsWith: "sk-or-" },
    help: `${WIKI}/Choosing-an-AI-provider#openai-compatible-servers`,
  },
];

export function aiChoice(id: AiChoiceId): AiChoice {
  return AI_CHOICES.find((choice) => choice.id === id)!;
}

/** Where a model on this computer usually answers: without Docker, from Docker on the same computer, and Compose's Ollama service. */
export const LOCAL_ADDRESSES: Record<"lmstudio" | "ollama", readonly string[]> = {
  lmstudio: ["http://localhost:1234", "http://host.docker.internal:1234"],
  ollama: ["http://localhost:11434", "http://host.docker.internal:11434", "http://ollama:11434"],
};

/** The model to use: the first of `wanted` the server lists (Gemini lists them as models/…), else the first wanted, if the list said nothing. */
export function pickModel(wanted: readonly string[], served: readonly string[]): string | null {
  const found = wanted.find((model) => served.some((id) => id === model || id === `models/${model}`));
  if (found) return found;
  return served.length === 0 ? (wanted[0] ?? null) : null;
}

/** Which of the guide's choices a saved provider and address are, if any. */
export function choiceOf(provider: AiProvider, baseUrl: string): AiChoiceId | null {
  if (provider === AiProvider.LMSTUDIO) return "lmstudio";
  if (provider === AiProvider.LOCAL) return "ollama";
  const host = URL.canParse(baseUrl) ? new URL(baseUrl).hostname : "";
  return AI_CHOICES.find((choice) => choice.provider === provider && choice.baseUrl && new URL(choice.baseUrl).hostname === host)?.id ?? null;
}
