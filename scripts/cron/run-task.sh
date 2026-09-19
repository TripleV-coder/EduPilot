#!/usr/bin/env bash
#
# Déclenche une tâche planifiée d'EduPilot sur l'installation locale (Lot 7).
#
#   scripts/cron/run-task.sh automation      # maintenance quotidienne + relances
#   scripts/cron/run-task.sh retention       # purge selon les durées de conservation
#   scripts/cron/run-task.sh retention --dry # aperçu seul, n'efface rien
#
# L'appel passe par l'API, avec le secret : exactement le même chemin qu'en
# production (bail exclusif, contexte système, journal). Rien n'est exécuté
# dans un second processus qui contournerait ces garanties.
#
# Variables :
#   CRON_SECRET     (obligatoire) le même que celui du serveur
#   APP_URL         défaut http://127.0.0.1:3000
#   CRON_TIMEOUT    défaut 30 (secondes) — la maintenance répond 202 puis
#                   travaille en tâche de fond, l'attente reste donc courte
set -euo pipefail

TASK="${1:-}"
DRY="${2:-}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
TIMEOUT="${CRON_TIMEOUT:-30}"

die() { echo "[ERREUR] $*" >&2; exit 1; }
log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

[ -n "${CRON_SECRET:-}" ] || die "CRON_SECRET n'est pas définie."
command -v curl >/dev/null 2>&1 || die "curl est requis."

case "$TASK" in
  automation) PATH_SUFFIX="/api/system/automation"; METHOD="POST" ;;
  retention)
    PATH_SUFFIX="/api/system/retention"
    # --dry : GET, c'est-à-dire l'aperçu calculé par le même code que la purge.
    if [ "$DRY" = "--dry" ] || [ "$DRY" = "--apercu" ]; then METHOD="GET"; else METHOD="POST"; fi
    ;;
  *) die "Tâche inconnue : « ${TASK} ». Attendu : automation | retention [--dry]" ;;
esac

log "Déclenchement de « $TASK » sur $APP_URL$PATH_SUFFIX"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

STATUS="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' -m "$TIMEOUT" \
  -X "$METHOD" "$APP_URL$PATH_SUFFIX" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Content-Type: application/json' || echo 000)"

BODY="$(head -c 2000 "$BODY_FILE")"

case "$STATUS" in
  200|202)
    log "OK ($STATUS) : $BODY"
    ;;
  409)
    # Bail déjà détenu : une exécution est en cours. Ce n'est pas une erreur.
    log "Déjà en cours ($STATUS) — rien à faire : $BODY"
    ;;
  000)
    die "Serveur injoignable sur $APP_URL (délai ${TIMEOUT}s)."
    ;;
  *)
    die "Échec ($STATUS) : $BODY"
    ;;
esac
