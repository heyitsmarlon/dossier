/** User-facing messages shared by Server Actions, route handlers and the pages calling them. */
export const messages = {
  signedOut: "Du wurdest abgemeldet. Melde dich erneut an, um weiterzumachen.",
  invalidInput: "Einige Angaben sind ungültig. Prüf die markierten Felder.",
  unexpected: "Auf dem Server ist etwas schiefgegangen. Bitte versuch es noch einmal.",
  crossOrigin: "Diese Anfrage kam nicht von Dossiers eigenen Seiten und wurde daher blockiert.",
  offline: "Dossier ist nicht erreichbar. Prüf deine Verbindung und versuch es noch einmal.",
} as const;
