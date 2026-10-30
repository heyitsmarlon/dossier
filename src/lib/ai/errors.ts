// What can go wrong when talking to an AI provider, in words people can act
// on (E6-1). Provider messages never reach the UI or the logs as they are:
// some of them echo parts of the request, such as a masked API key.

export type AiErrorKind =
  | "unreachable"
  | "auth"
  | "model"
  | "rate-limited"
  | "busy"
  | "timeout"
  | "too-long"
  | "cancelled"
  | "config"
  | "invalid-output"
  | "cut-off"
  | "provider";

const MESSAGES: Record<Exclude<AiErrorKind, "model" | "config">, string> = {
  unreachable: "Der Server war nicht erreichbar. Prüf die Adresse und ob er läuft.",
  auth: "Der Server hat den API-Schlüssel nicht akzeptiert. Prüf ihn unter Einstellungen → KI-Anbieter.",
  "rate-limited": "Der KI-Anbieter begrenzt gerade die Anfragen. Warte eine Minute und versuch es noch einmal.",
  busy: "Der KI-Anbieter ist gerade überlastet. Versuch es gleich noch einmal.",
  timeout: "Das Modell hat zu lange gebraucht. Versuch es noch einmal oder wähle ein schnelleres Modell.",
  "too-long": "Das ist mehr Text, als das Modell auf einmal verarbeiten kann. Versuch eine kürzere Anzeige oder ein Modell mit größerem Kontext.",
  cancelled: "Cancelled.",
  "invalid-output": "Die Antwort des Modells kam nicht im erwarteten Format. Versuch es noch einmal.",
  "cut-off": "Die Antwort des Modells wurde abgeschnitten. Versuch es noch einmal oder wähle ein anderes Modell unter Einstellungen → KI-Anbieter.",
  provider: "Beim KI-Anbieter ist ein Problem aufgetreten. Versuch es gleich noch einmal.",
};

/** An AI failure with a message for people; `retryable` says whether Retry can help. */
export class AiError extends Error {
  override name = "AiError";

  constructor(
    readonly kind: AiErrorKind,
    message: string,
    /** For the server log: status and error type, never the provider's message. */
    readonly detail?: string,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.kind !== "config" && this.kind !== "cancelled";
  }

  static of(kind: Exclude<AiErrorKind, "model" | "config">, detail?: string): AiError {
    return new AiError(kind, MESSAGES[kind], detail);
  }

  static unknownModel(model: string, detail?: string): AiError {
    return new AiError("model", `Der Server hat das Modell „${model}“ nicht. Wähle ein anderes unter Einstellungen → KI-Anbieter.`, detail);
  }

  static config(message: string): AiError {
    return new AiError("config", message);
  }
}

const CONNECTION_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);

/** Whether a message from a provider says the input didn't fit the model's context. */
const TOO_LONG = /context|too long|too many tokens|maximum.*tokens|token limit|exceeds/i;

/** The Node.js network error behind a failed fetch, if any. */
function networkCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && CONNECTION_CODES.has(code)) return code;
    current = current.cause;
  }
  return undefined;
}

type HttpLike = { status?: unknown; status_code?: unknown; name?: unknown; message?: unknown };

/**
 * Turns whatever a provider SDK or fetch threw into an AiError. `cancelled`
 * and `timedOut` tell a cancellation by the caller apart from our timeout.
 */
export function toAiError(
  error: unknown,
  { model, cancelled, timedOut }: { model: string; cancelled?: boolean; timedOut?: boolean },
): AiError {
  if (error instanceof AiError) return error;
  // The SDKs wrap what their fetch throws, e.g. a refused redirect (keyGuardedFetch).
  if (error instanceof Error && error.cause instanceof AiError) return error.cause;
  if (cancelled) return AiError.of("cancelled");
  if (timedOut) return AiError.of("timeout");

  const e = (error ?? {}) as HttpLike;
  const name = typeof e.name === "string" ? e.name : "Error";
  const message = typeof e.message === "string" ? e.message : "";
  const status = typeof e.status === "number" ? e.status : typeof e.status_code === "number" ? e.status_code : undefined;
  const detail = [name, status].filter(Boolean).join(" ");

  if (name === "TimeoutError" || name === "APIConnectionTimeoutError") return AiError.of("timeout", detail);
  if (name === "AbortError" || name === "APIUserAbortError") return AiError.of("cancelled", detail);
  const code = networkCode(error);
  if (code || name === "APIConnectionError") return AiError.of("unreachable", code ?? detail);

  switch (status) {
    case 401:
    case 403:
      return AiError.of("auth", detail);
    case 404:
      return AiError.unknownModel(model, detail);
    case 413:
      return AiError.of("too-long", detail);
    case 429:
      return AiError.of("rate-limited", detail);
    case 503:
    case 529:
      return AiError.of("busy", detail);
    case 400:
    case 422:
      return TOO_LONG.test(message) ? AiError.of("too-long", detail) : AiError.of("provider", detail);
  }
  // Ollama answers an unknown model with a plain error, whatever its status.
  if (/model .*not found|pull the model/i.test(message)) return AiError.unknownModel(model, detail);
  return AiError.of("provider", detail);
}
