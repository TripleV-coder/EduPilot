#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Baseline Prisma Migrate pour une base créée par `prisma db push`.
#
# Contexte (audit C1) : avant la version 1.3.0, les migrations n'étaient pas
# versionnées ; les bases existantes ont été créées par `prisma db push` et ne
# possèdent pas de table `_prisma_migrations`. `prisma migrate deploy` refuse
# alors de s'exécuter (P3005) ou tenterait de tout recréer.
#
# Ce script, à lancer PAR L'EXPLOITANT et APRÈS UNE SAUVEGARDE :
#   1. vérifie que la base n'est pas déjà gérée par Prisma Migrate ;
#   2. vérifie que son schéma est IDENTIQUE à prisma/schema.prisma (sinon arrêt) ;
#   3. demande une confirmation explicite ;
#   4. rejoue les instructions que `db push` ne crée pas (toutes idempotentes) :
#      politiques RLS, rattachement enseignants ↔ établissements ;
#   5. marque chaque migration versionnée comme appliquée ;
#   6. vérifie avec `prisma migrate status` que la base est à jour.
#
# Aucune donnée métier n'est modifiée ou supprimée. Voir docs/MIGRATIONS.md.
# Usage : DATABASE_URL=postgresql://… scripts/db/baseline-migrations.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../.."

: "${DATABASE_URL:?DATABASE_URL doit pointer vers la base à baseliner}"
export DATABASE_URL

masked_url=$(printf '%s' "$DATABASE_URL" | sed -E 's#(://[^:/@]+):[^@]*@#\1:****@#')
echo "Base cible : $masked_url"

# 1. La base est-elle déjà gérée par Prisma Migrate ?
applied_count=$(node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const [{ exists }] = await prisma.$queryRawUnsafe(
    "SELECT to_regclass(\x27public._prisma_migrations\x27) IS NOT NULL AS exists"
  );
  if (!exists) { console.log(0); return; }
  const [{ count }] = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL"
  );
  console.log(count);
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
')

if [[ "$applied_count" != "0" ]]; then
  echo "La base est déjà gérée par Prisma Migrate ($applied_count migration(s) appliquée(s))."
  echo "Rien à baseliner : utilisez « npx prisma migrate deploy »."
  exit 0
fi

# 2. Le schéma de la base doit être identique à celui de cette version.
set +e
drift=$(npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script --exit-code 2>&1)
drift_status=$?
set -e

if [[ $drift_status -eq 2 ]]; then
  echo "ARRÊT : le schéma de la base diffère de prisma/schema.prisma."
  echo "Différences (ce qu'il faudrait appliquer à la base) :"
  echo "$drift"
  echo
  echo "Mettez d'abord la base au niveau du schéma de CETTE version (voir docs/MIGRATIONS.md),"
  echo "puis relancez ce script. Aucune modification n'a été faite."
  exit 1
elif [[ $drift_status -ne 0 ]]; then
  echo "ARRÊT : impossible de comparer la base au schéma."
  echo "$drift"
  exit 1
fi
echo "Schéma identique à prisma/schema.prisma."

mapfile -t migrations < <(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
echo "${#migrations[@]} migration(s) seront marquées comme appliquées."

# 3. Confirmation explicite.
read -r -p "Sauvegarde faite ? Tapez BASELINE pour continuer : " answer
if [[ "$answer" != "BASELINE" ]]; then
  echo "Annulé. Aucune modification n'a été faite."
  exit 1
fi

# 4. Instructions non reproduites par `db push` (idempotentes).
echo "Politiques RLS (student_profiles, grades, payments)…"
npx prisma db execute --url "$DATABASE_URL" \
  --file prisma/migrations/20260804083000_enable_rls_on_tenant_critical_tables/migration.sql

echo "Rattachement enseignants ↔ établissements…"
npx prisma db execute --url "$DATABASE_URL" --stdin <<'SQL'
INSERT INTO "teacher_school_assignments" (
    "id", "teacherId", "userId", "schoolId", "status", "isPrimary", "createdAt", "updatedAt"
)
SELECT
    CONCAT('tsa_', md5(tp."id" || ':' || tp."schoolId")),
    tp."id", tp."userId", tp."schoolId",
    'ACTIVE'::"TeacherAssignmentStatus", true,
    COALESCE(tp."createdAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "teacher_profiles" tp
WHERE tp."schoolId" IS NOT NULL
ON CONFLICT ("teacherId", "schoolId") DO NOTHING;
SQL

# 5. Marquage des migrations.
for migration in "${migrations[@]}"; do
  npx prisma migrate resolve --applied "$migration" >/dev/null
  echo "  appliquée : $migration"
done

# 6. Vérification.
npx prisma migrate status
echo "Baseline terminée. Les prochaines mises à jour passent par « npx prisma migrate deploy »."
