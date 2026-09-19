#!/usr/bin/env bash
#
# Restauration d'une sauvegarde chiffrée EduPilot (Lot 7).
#
#   scripts/backup/postgres-restore.sh <fichier.sql.gz.enc> --confirm <nom_de_la_base>
#
# La restauration ÉCRASE la base visée par DATABASE_URL. Elle exige donc de
# retaper le nom de cette base. À la fin, elle recompte les lignes table par
# table et les compare au manifeste écrit lors de la sauvegarde : si un
# écart apparaît, le script sort en erreur.
#
# Variables : DATABASE_URL, BACKUP_PASSPHRASE_FILE (mêmes que la sauvegarde).
set -euo pipefail

die() { echo "[ERREUR] $*" >&2; exit 1; }
log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

ARCHIVE="${1:-}"
CONFIRM=""
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm) CONFIRM="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

[ -n "$ARCHIVE" ] || die "Usage : $0 <fichier.sql.gz.enc> --confirm <nom_de_la_base>"
[ -r "$ARCHIVE" ] || die "Fichier illisible : $ARCHIVE"
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL n'est pas définie."
[ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || die "BACKUP_PASSPHRASE_FILE n'est pas définie."
[ -r "${BACKUP_PASSPHRASE_FILE}" ] || die "Phrase secrète illisible : ${BACKUP_PASSPHRASE_FILE}"

for tool in psql openssl gzip sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || die "Outil manquant : $tool"
done

eval "$(node -e '
const u = new URL(process.env.DATABASE_URL);
const q = (v) => `'"'"'${String(v).replace(/'"'"'/g, `'"'"'\\'"'"''"'"'`)}'"'"'`;
console.log(`DB_USER=${q(decodeURIComponent(u.username))}`);
console.log(`DB_PASS=${q(decodeURIComponent(u.password))}`);
console.log(`DB_HOST=${q(u.hostname)}`);
console.log(`DB_PORT=${q(u.port || "5432")}`);
console.log(`DB_NAME=${q(u.pathname.replace(/^\//, ""))}`);
')"

[ "$CONFIRM" = "$DB_NAME" ] || die "Restauration REFUSÉE. Ajoutez « --confirm $DB_NAME » : cette opération écrase la base « $DB_NAME » sur $DB_HOST:$DB_PORT."

# Intégrité avant toute écriture.
if [ -r "${ARCHIVE}.sha256" ]; then
  EXPECTED="$(cut -d' ' -f1 < "${ARCHIVE}.sha256")"
  ACTUAL="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
  [ "$EXPECTED" = "$ACTUAL" ] || die "Empreinte SHA256 incorrecte : le fichier est altéré ou incomplet. Rien n'a été restauré."
  log "Empreinte vérifiée."
else
  log "[AVERTISSEMENT] Pas de fichier .sha256 : intégrité non vérifiable."
fi

export PGPASSWORD="$DB_PASS"
trap 'unset PGPASSWORD' EXIT
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

log "Restauration dans « $DB_NAME » ($DB_HOST:$DB_PORT) — le contenu actuel est remplacé."
"${PSQL[@]}" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null

set -o pipefail
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:${BACKUP_PASSPHRASE_FILE}" -in "$ARCHIVE" \
  | gzip -dc \
  | "${PSQL[@]}" -q \
  || die "Échec de la restauration : la base est dans un état intermédiaire, relancez la commande."

log "Données restaurées. Vérification…"

COUNTS_SQL="SELECT coalesce(json_object_agg(table_name, rows), '{}'::json)::text FROM (
  SELECT c.relname AS table_name,
         (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', c.relname), false, true, '')))[1]::text::bigint AS rows
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
) t;"
AFTER="$("${PSQL[@]}" -At -c "$COUNTS_SQL")"

META="${ARCHIVE%.sql.gz.enc}.meta.json"
if [ ! -r "$META" ]; then
  log "[AVERTISSEMENT] Manifeste absent ($META) : comparaison impossible, lignes restaurées affichées seules."
  node -e 'const c=JSON.parse(process.argv[1]); for (const [t,n] of Object.entries(c).sort()) console.log(`  ${t.padEnd(36)} ${String(n).padStart(9)}`);' "$AFTER"
  exit 0
fi

node -e '
const [metaFile, afterJson] = process.argv.slice(1);
const before = JSON.parse(require("fs").readFileSync(metaFile, "utf8")).rowCounts ?? {};
const after = JSON.parse(afterJson);
const tables = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
const diffs = [];
for (const t of tables) {
  const b = Number(before[t] ?? 0), a = Number(after[t] ?? 0);
  if (b !== a) diffs.push({ table: t, avant: b, apres: a });
}
console.log(`  ${tables.length} table(s) comparée(s), ${Object.values(after).reduce((n, v) => n + Number(v), 0)} ligne(s) restaurée(s).`);
if (diffs.length === 0) {
  console.log("  Aucun écart : la restauration est conforme au manifeste.");
  process.exit(0);
}
console.error(`  ${diffs.length} ÉCART(S) :`);
for (const d of diffs) console.error(`    ${d.table.padEnd(36)} avant ${String(d.avant).padStart(9)} · après ${String(d.apres).padStart(9)}`);
process.exit(1);
' "$META" "$AFTER" || die "Restauration INCOMPLÈTE : le nombre de lignes ne correspond pas au manifeste."

log "Restauration terminée et vérifiée."
