#!/usr/bin/env bash
#
# Sauvegarde PostgreSQL chiffrée d'EduPilot (Lot 7).
#
#   scripts/backup/postgres-backup.sh
#
# Produit trois fichiers par sauvegarde, dans BACKUP_DIR :
#   edupilot_<horodatage>.sql.gz.enc        dump chiffré (AES-256)
#   edupilot_<horodatage>.sql.gz.enc.sha256 empreinte du fichier chiffré
#   edupilot_<horodatage>.meta.json         base, taille, empreinte et
#                                           NOMBRE DE LIGNES PAR TABLE
#
# Le fichier .meta.json est ce qui permet à la restauration de prouver qu'elle
# a tout remis : elle recompte et compare table par table.
#
# Variables :
#   DATABASE_URL              (obligatoire) base à sauvegarder
#   BACKUP_PASSPHRASE_FILE    (obligatoire) fichier contenant la phrase secrète
#                             de chiffrement, en mode 600. Sans lui, le script
#                             REFUSE de s'exécuter : une sauvegarde en clair
#                             d'une base scolaire n'a pas à exister.
#   BACKUP_DIR                défaut /var/backups/edupilot/postgres
#   BACKUP_RETENTION_DAYS     défaut 30
#   BACKUP_KEEP_MIN           défaut 7 — jamais moins de N sauvegardes, quel
#                             que soit leur âge (une machine arrêtée un mois
#                             ne doit pas se réveiller sans aucune sauvegarde)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/edupilot/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
KEEP_MIN="${BACKUP_KEEP_MIN:-7}"
DATE="$(date +%Y%m%d_%H%M%S)"

die() { echo "[ERREUR] $*" >&2; exit 1; }
log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL n'est pas définie."
[ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || die "BACKUP_PASSPHRASE_FILE n'est pas définie : la sauvegarde doit être chiffrée."
[ -r "${BACKUP_PASSPHRASE_FILE}" ] || die "Phrase secrète illisible : ${BACKUP_PASSPHRASE_FILE}"
[ -s "${BACKUP_PASSPHRASE_FILE}" ] || die "Phrase secrète vide : ${BACKUP_PASSPHRASE_FILE}"

for tool in pg_dump psql openssl gzip sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || die "Outil manquant : $tool (paquet postgresql-client pour pg_dump et psql)."
done

# L'URL est découpée par Node : le découpage en sed cassait sur un mot de passe
# contenant @ ou : et sur les paramètres ?schema=.
eval "$(node -e '
const u = new URL(process.env.DATABASE_URL);
const q = (v) => `'"'"'${String(v).replace(/'"'"'/g, `'"'"'\\'"'"''"'"'`)}'"'"'`;
console.log(`DB_USER=${q(decodeURIComponent(u.username))}`);
console.log(`DB_PASS=${q(decodeURIComponent(u.password))}`);
console.log(`DB_HOST=${q(u.hostname)}`);
console.log(`DB_PORT=${q(u.port || "5432")}`);
console.log(`DB_NAME=${q(u.pathname.replace(/^\//, ""))}`);
')"

mkdir -p "$BACKUP_DIR"
BASE="$BACKUP_DIR/edupilot_${DATE}"
ARCHIVE="${BASE}.sql.gz.enc"
META="${BASE}.meta.json"

log "Sauvegarde de « $DB_NAME » ($DB_HOST:$DB_PORT) vers $ARCHIVE"
export PGPASSWORD="$DB_PASS"
trap 'unset PGPASSWORD' EXIT

# Nombre de lignes par table, EXACT (pas l'estimation du planificateur) :
# c'est la référence que la restauration devra retrouver.
COUNTS_SQL="SELECT coalesce(json_object_agg(table_name, rows), '{}'::json)::text FROM (
  SELECT c.relname AS table_name,
         (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', c.relname), false, true, '')))[1]::text::bigint AS rows
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
) t;"
COUNTS="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -At -c "$COUNTS_SQL")"

# pg_dump | gzip | openssl : le dump en clair ne touche jamais le disque.
set -o pipefail
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=plain --no-owner --no-privileges \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:${BACKUP_PASSPHRASE_FILE}" -out "$ARCHIVE" \
  || die "Échec de la sauvegarde (pg_dump, gzip ou openssl)."

# Relecture immédiate : une sauvegarde qu'on ne sait pas déchiffrer n'en est
# pas une. Le dump est déchiffré et décompressé vers /dev/null.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:${BACKUP_PASSPHRASE_FILE}" -in "$ARCHIVE" \
  | gzip -dc > /dev/null \
  || die "Le fichier produit n'est pas relisible : sauvegarde considérée en échec."

CHECKSUM="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
echo "$CHECKSUM" > "${ARCHIVE}.sha256"
SIZE_BYTES="$(stat -c%s "$ARCHIVE")"
SIZE_HUMAN="$(du -h "$ARCHIVE" | cut -f1)"

node -e '
const [file, db, date, checksum, bytes, counts] = process.argv.slice(1);
require("fs").writeFileSync(file, JSON.stringify({
  database: db, createdAt: date, checksumSha256: checksum,
  sizeBytes: Number(bytes), rowCounts: JSON.parse(counts),
}, null, 2));
' "$META" "$DB_NAME" "$(date -Iseconds)" "$CHECKSUM" "$SIZE_BYTES" "$COUNTS"

# Ces deux lignes sont lues par /api/system/backup : ne pas en changer la forme.
log "Taille de la sauvegarde: $SIZE_HUMAN"
log "Checksum SHA256: $CHECKSUM"

# Rotation : on supprime au-delà de RETENTION_DAYS, mais jamais les KEEP_MIN
# plus récentes.
mapfile -t ALL < <(find "$BACKUP_DIR" -maxdepth 1 -name 'edupilot_*.sql.gz.enc' -type f -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
DELETED=0
for ((i = KEEP_MIN; i < ${#ALL[@]}; i++)); do
  f="${ALL[$i]}"
  if [ -n "$(find "$f" -mtime "+${RETENTION_DAYS}" 2>/dev/null)" ]; then
    rm -f "$f" "${f}.sha256" "${f%.sql.gz.enc}.meta.json"
    DELETED=$((DELETED + 1))
  fi
done
log "Rotation : $DELETED sauvegarde(s) supprimée(s) (au-delà de ${RETENTION_DAYS} jours, minimum ${KEEP_MIN} conservées)."
log "Sauvegardes présentes : ${#ALL[@]}."

if [ -n "${BACKUP_WEBHOOK_URL:-}" ] && command -v curl >/dev/null 2>&1; then
  curl -fsS -X POST "$BACKUP_WEBHOOK_URL" -H 'Content-Type: application/json' \
    -d "{\"text\":\"Sauvegarde EduPilot réussie ($SIZE_HUMAN)\"}" >/dev/null || true
fi

log "Sauvegarde terminée."
