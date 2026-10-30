#!/usr/bin/env bash
# Richtet Dossier (deutsch) einmalig lokal ein: legt .env mit zufälligen
# Geheimnissen an, baut das Image und speichert den Hash deines Passworts.
# Danach: docker compose -f compose.local.yml up -d
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f compose.local.yml)

if ! docker info >/dev/null 2>&1; then
  echo "Docker läuft nicht. Starte Docker Desktop und versuch es noch einmal." >&2
  exit 1
fi

if [ -f .env ] && grep -q '^DOSSIER_PASSWORD=' .env; then
  echo ".env gibt es schon. Starten mit: ${COMPOSE[*]} up -d"
  exit 0
fi

# Compose verlangt diese Werte schon beim Bauen; das Passwort kommt gleich.
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export DOSSIER_SECRET="$(openssl rand -base64 32)"
export DOSSIER_PASSWORD="placeholder"

echo "Baue das Image (beim ersten Mal einige Minuten) …"
"${COMPOSE[@]}" build app

read -rsp "Passwort für Dossier: " pw1; echo
read -rsp "Noch einmal: " pw2; echo
if [ -z "$pw1" ] || [ "$pw1" != "$pw2" ]; then
  echo "Die Passwörter sind leer oder stimmen nicht überein." >&2
  exit 1
fi
hash=$(printf '%s\n' "$pw1" | "${COMPOSE[@]}" run --rm --no-deps -T app hash-password 2>/dev/null)
unset pw1 pw2
if [[ "$hash" != argon2id:* ]]; then
  echo "Der Passwort-Hash konnte nicht erzeugt werden." >&2
  exit 1
fi

{
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
  echo "DOSSIER_SECRET=$DOSSIER_SECRET"
  echo "DOSSIER_PASSWORD=$hash"
  echo "TZ=Europe/Berlin"
} > .env
chmod 600 .env

echo "Fertig. Starten mit:  ${COMPOSE[*]} up -d"
echo "Dann im Browser:      http://localhost:3000"
