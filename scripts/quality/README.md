# Scripts de non-régression qualité

Issus des mesures de l'audit du 2026-09-11 (`docs/AUDIT.md`). Ils ciblent **uniquement** un serveur local
branché sur une **base jetable** remplie par le seed de démonstration. Ils ne doivent jamais viser une base réelle :
`lib.mjs` refuse toute URL sans `QUALITY_DISPOSABLE_DB=1`, ainsi que le port 5432.

| Script | Mesure | Défauts couverts |
|---|---|---|
| `smoke.mjs [ROLE…\|ALL]` | tous les GET non paramétrés : statut, temps, taille ; seuils `QUALITY_MAX_KB` / `QUALITY_MAX_MS` | C3, M5 |
| `latency.mjs [ROLE] [N]` | p50/p95 séquentiels, RSS serveur (`QUALITY_SERVER_PID`) | C3, M4 |
| `load.mjs [chemins]` | autocannon 10 connexions × 15 s | perf |
| `security.mjs [checks]` | XFF, force brute, IDOR, isolation, health, cron, JSON invalide — PASS/FAIL | H1–H5, M3 |
| `redis-outage.mjs` | latence `/api/auth/csrf` avec Redis injoignable | H6 |
| `db-counts.mjs` | nombre de lignes des tables principales | seed, restauration |
| `lighthouse.sh <dir> [pages]` | scores Lighthouse mobile/desktop, poids des pages | C3, perf front, a11y |
| `pg-seq-scans.mjs reset\|report` | tables lues séquentiellement entre `reset` et `report` (ex. autour du smoke) : candidates à un `EXPLAIN ANALYZE`, preuve pour ou contre un index | M5, index (Lot 3) |

## Préparer l'environnement de mesure

```bash
# 1. Base jetable (PostgreSQL ≠ port 5432), migrations puis seed volumineux
export QUALITY_DATABASE_URL="postgresql://user:pass@localhost:5433/edupilot_audit?schema=public"
export QUALITY_DISPOSABLE_DB=1
DATABASE_URL="$QUALITY_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$QUALITY_DATABASE_URL" npm run db:seed          # ~8 min, 125 000 notes

# 2. Rôle applicatif soumis à la RLS (audit M2) : le serveur de production
#    refuse de démarrer avec un rôle superutilisateur ou BYPASSRLS.
ADMIN_DATABASE_URL="$QUALITY_DATABASE_URL" APP_DB_PASSWORD=audit-app-role-password \
  node scripts/db/setup-app-role.mjs
export QUALITY_APP_DATABASE_URL="postgresql://edupilot_app:audit-app-role-password@localhost:5433/edupilot_audit?schema=public"

# 3. Build et serveur de production sur le port 3100
npm run build
DATABASE_URL="$QUALITY_APP_DATABASE_URL" AUTH_TRUST_HOST=true NEXTAUTH_URL=http://localhost:3100 \
  UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= SKIP_ENV_VALIDATION=true \
  PORT=3100 npm run start -- -p 3100
```

`QUALITY_DATABASE_URL` (propriétaire) sert au seed et aux lectures directes des scripts (`db-counts.mjs`,
`pg-seq-scans.mjs`, vérifications de `security.mjs`) ; le serveur utilise `QUALITY_APP_DATABASE_URL`.

`npm run start` charge `scripts/server/client-ip-preload.cjs` (adresse client fiable, audit H3). Sans lui,
toutes les requêtes partagent l'IP `unknown` et `security.mjs xff` ne mesure plus le vrai comportement.

Base jetable sans PostgreSQL installé : `node scripts/quality/disposable-pg.mjs edupilot_audit` (port 5433,
données dans `.quality-tmp/pg`, reste au premier plan).

- `security.mjs` : serveur **sans** `RATE_LIMIT_RELAXED` (limites de production).
- `smoke.mjs`, `latency.mjs`, `load.mjs` : ajouter `RATE_LIMIT_RELAXED=true` pour ne pas mesurer le rate-limit.
- Les tests E2E (`npm run test:e2e`) réécrivent les mots de passe de certains comptes de démonstration :
  définir `QUALITY_PASSWORD` en conséquence si besoin.
