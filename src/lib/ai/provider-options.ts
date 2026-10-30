import { AiProvider } from "@/generated/prisma/enums";

/** The provider cards in Settings → AI provider (SET-1), as in the prototype's `PROVIDERS`. */
export const PROVIDER_OPTIONS: readonly {
  value: AiProvider;
  name: string;
  /** Who receives the data, for the privacy notes; null when it's whoever runs the server. */
  vendor: string | null;
  description: string;
  tag: string;
  /** Runs on the user's own hardware: no notes about data leaving, and one AI job at a time. */
  local: boolean;
  /** Filled in when the card is picked; empty means "type your server's address". */
  defaultUrl: string;
  urlPlaceholder: string;
  /** Shown under the address. */
  urlHint?: string;
  defaultModel: string;
  /** The key field, if the card has one; `hint` says when it's needed. */
  apiKey: { label: string; hint?: string } | null;
}[] = [
  {
    value: AiProvider.LOCAL,
    name: "Lokales Modell",
    vendor: null,
    description: "Läuft auf deiner eigenen Hardware über Ollama oder llama.cpp.",
    tag: "Privat · kostenlos · langsamer",
    local: true,
    defaultUrl: "http://localhost:11434",
    urlPlaceholder: "http://localhost:11434",
    urlHint:
      "Dossier in Docker? Dort ist localhost Dossiers eigener Container: Nutze http://host.docker.internal:11434 für Ollama auf diesem Rechner oder http://ollama:11434 für den Compose-Dienst.",
    defaultModel: "",
    apiKey: null,
  },
  {
    value: AiProvider.LMSTUDIO,
    name: "LM Studio",
    vendor: null,
    description: "Modelle, die du in LM Studio betreibst, auf diesem Rechner oder in deinem Netz.",
    tag: "Privat · kostenlos · deine Hardware",
    local: true,
    // Dossier runs in Docker, where localhost is its own container.
    defaultUrl: "http://host.docker.internal:1234",
    urlPlaceholder: "http://host.docker.internal:1234",
    urlHint:
      "Das ist LM Studio auf dem Rechner, auf dem Dossiers Docker läuft; ohne Docker nutze http://localhost:1234. Keine Verbindung? Starte den Server im Developer-Tab von LM Studio und schalte dort „Serve on Local Network“ ein.",
    defaultModel: "",
    apiKey: { label: "API-Token", hint: "Nur nötig, wenn du in den Servereinstellungen von LM Studio Authentifizierung eingeschaltet hast." },
  },
  {
    value: AiProvider.OPENAI,
    name: "OpenAI-kompatibel",
    vendor: null,
    description: "Jeder Server, der die OpenAI-API spricht, gehostet oder in deinem Netz.",
    tag: "Eigener Endpunkt",
    local: false,
    defaultUrl: "",
    urlPlaceholder: "https://api.openai.com/v1",
    defaultModel: "",
    apiKey: { label: "API-Schlüssel" },
  },
  {
    value: AiProvider.ANTHROPIC,
    name: "Anthropic",
    vendor: "Anthropic",
    description: "Claude-Modelle über deinen eigenen API-Schlüssel.",
    tag: "Gehostet · Abrechnung nach Nutzung",
    local: false,
    defaultUrl: "https://api.anthropic.com",
    urlPlaceholder: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-5",
    apiKey: { label: "API-Schlüssel" },
  },
  {
    value: AiProvider.MISTRAL,
    name: "Mistral",
    vendor: "Mistral",
    description: "Mistral-Modelle über deinen eigenen API-Schlüssel.",
    tag: "Gehostet · kostenloser Einstieg",
    local: false,
    defaultUrl: "https://api.mistral.ai/v1",
    urlPlaceholder: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-latest",
    apiKey: { label: "API-Schlüssel" },
  },
];

export function providerOption(provider: AiProvider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)!;
}

/** What people see when a saved key can't be decrypted, e.g. after DOSSIER_SECRET changed. */
export const API_KEY_UNREADABLE = "Dein gespeicherter API-Schlüssel ist nicht lesbar. Bitte gib ihn neu ein.";

/** What Settings may know about the API key: never the key itself. */
export type KeyState = "none" | "set" | "unreadable" | "env";

/** What the AI provider section starts from. */
export type AiSettingsView = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  keyState: KeyState;
};
