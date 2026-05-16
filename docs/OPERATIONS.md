# Opérations — EduPilot

Manuel d'exploitation : déploiement, monitoring, sauvegardes, mise à l'échelle. Destiné à l'équipe SRE / DevOps.

---

## 1. Topologie d'environnements

| Environnement | URL | DB | Cache | Sentry | Branches |
|---------------|-----|----|----|--------|----------|
| Local dev | `http://localhost:3000` | Postgres local Docker | in-memory | désactivé | toute branche |
| Staging | `https://staging.edupilot.app` | Postgres dédié | Upstash Redis (free tier) | env `staging` | `main` (auto-deploy) |
| Production | `https://app.edupilot.bj` | Postgres + replicas | Upstash Redis (pay-as-you-go) | env `production` | tags `v*.*.*` (manual approval) |

---

## 2. Variables d'environnement requises

Voir `.env.example` pour la liste complète. Les **critiques** :

| Variable | Type | Description |
|----------|------|-------------|
| `DATABASE_URL` | URL | Postgres avec SSL en prod (`?sslmode=require`) |
| `NEXTAUTH_URL` | URL | URL publique de l'app |
| `NEXTAUTH_SECRET` | secret | Min 32 caractères — `openssl rand -base64 48` |
| `TOTP_ENCRYPTION_KEY` | secret hex | 64 caractères hex — `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` | URL | Cache + rate-limiter distribués |
| `UPSTASH_REDIS_REST_TOKEN` | secret | Auth Upstash |
| `SENTRY_DSN` | URL | DSN frontend + backend |
| `SENTRY_AUTH_TOKEN` | secret | Pour upload des sourcemaps en CI |
| `RESEND_API_KEY` | secret | Emails transactionnels |
| `GEMINI_API_KEY` | secret | Gemini pour bulletins / action plans |
| `STRIPE_SECRET_KEY` | secret | Paiements internationaux (optionnel) |
| `FLUTTERWAVE_SECRET_KEY` | secret | Mobile money Bénin |
| `FLUTTERWAVE_WEBHOOK_SECRET` | secret | Validation HMAC des webhooks |

> **Règle d'or** : aucun secret en clair dans le repo. Utiliser GitHub Actions Secrets / Vercel Env / un Vault.

---

## 3. Déploiement

### 3.1 Pipeline automatique
1. PR mergée sur `main` → `ci.yml` (lint + tests + e2e + security)
2. `Quality Gate` vert → `ci-cd.yml` se déclenche
3. Image Docker construite, taguée `sha-<sha>` + `latest`, poussée sur GHCR
4. Image scannée par Trivy → SARIF dans GitHub Security
5. Migrations Prisma `migrate deploy` sur staging
6. Déploiement staging
7. Smoke test `/api/health` (5 tentatives × 10s)
8. **Pour la production** : créer un tag `v1.2.3` → déclenche `deploy-production` avec approbation manuelle

### 3.2 Déploiement manuel (urgence)
```bash
# 1. Vérifier la santé de la branche locale
npm run type-check && npm run lint && npm run test

# 2. Construire l'image
docker build -t ghcr.io/<owner>/edupilot:hotfix-$(git rev-parse --short HEAD) .

# 3. Pousser
docker push ghcr.io/<owner>/edupilot:hotfix-...

# 4. Mettre à jour le serveur (exemple compose)
ssh prod "cd /srv/edupilot && \
  IMAGE=ghcr.io/<owner>/edupilot:hotfix-... docker compose pull && \
  docker compose up -d"

# 5. Vérifier
curl https://app.edupilot.bj/api/health
```

### 3.3 Rollback
```bash
# Identifier le dernier tag stable
gh release list --limit 5

# Redéployer le tag précédent
ssh prod "cd /srv/edupilot && \
  IMAGE=ghcr.io/<owner>/edupilot:v1.1.4 docker compose up -d"

# Vérifier
curl https://app.edupilot.bj/api/health
```

**Migration DB rollback** : Prisma n'a pas de `migrate rollback` natif. Pour annuler :
- Si la migration n'a pas encore touché des données : `prisma migrate resolve --rolled-back <name>` puis appliquer un down manuel
- Sinon : restaurer depuis backup (voir §6)

---

## 4. Monitoring

### 4.1 Stack
| Couche | Outil | Cible |
|--------|-------|-------|
| Errors frontend + backend | Sentry | Taux d'erreur, traces, releases |
| Performance | Vercel Analytics / Web Vitals | LCP, INP, CLS |
| Logs structurés | Pino → stdout → fournisseur (Vercel Logs / Datadog) | Recherche full-text |
| Uptime | Better Uptime / UptimeRobot | `/api/health` toutes 60s |
| Métriques DB | Postgres `pg_stat_*` + dashboard fournisseur | Connections, slow queries |

### 4.2 Health check endpoint
`GET /api/health` (source : `src/lib/health/`)
- 200 OK : DB reachable, cache reachable, app vivante
- 503 : Au moins une dépendance KO (le détail est dans la réponse JSON)
- Latence cible : < 100 ms

### 4.3 SLOs
| Indicateur | Objectif | Mesure |
|------------|----------|--------|
| Disponibilité (`/api/health`) | 99.5 % mensuel | Better Uptime |
| Latence p95 API | < 500 ms | Sentry traces |
| Error rate (5xx) | < 0.5 % | Sentry |
| Build → déploiement | < 15 min | GitHub Actions |

### 4.4 Alertes
| Condition | Canal | Sévérité |
|-----------|-------|----------|
| `/api/health` KO 3 fois consécutives | Email + SMS oncall | P0 |
| Error rate > 2 % sur 5 min | Slack #alerts | P1 |
| Sentry : nouveau issue Critical | Slack #alerts | P1 |
| Latence p95 > 1.5 s sur 10 min | Slack #alerts | P2 |
| Pool DB > 80 % connexions | Slack #alerts | P2 |
| Disk DB > 80 % | Email | P2 |

---

## 5. Mise à l'échelle

### 5.1 Capacité actuelle (estimation V1)
- **Frontend** : 1 instance Vercel suffisante jusqu'à ~5 000 utilisateurs concurrents
- **DB** : Postgres 16, t3.medium (2 vCPU, 4 Go RAM) jusqu'à ~50 écoles / 10 000 élèves
- **Cache** : Upstash free tier (10 000 commandes/jour) suffisant en dev/staging

### 5.2 Goulots connus
| Endpoint | Symptôme | Mitigation |
|----------|----------|------------|
| `/api/analytics/dashboard` | Latence > 2s avec >1000 élèves | Pré-calcul via cron `analytics-sync.ts` |
| `/api/grades/report-cards` (PDF) | CPU élevé | File de jobs en V2 |
| `/api/import/*` | Timeout sur > 500 lignes CSV | Découpage par batch, déjà implémenté à 100 lignes/batch |

### 5.3 Scaling horizontal
- Frontend : Vercel auto-scale ; pour self-hosted, ajouter PM2 cluster mode ou K8s replicas
- DB : ajouter une replica read-only et router les requêtes lecture via `prisma.$replica`
- Cache : Upstash s'auto-scale

---

## 6. Sauvegardes et restauration

### 6.1 Politique
| Type | Fréquence | Rétention |
|------|-----------|-----------|
| Snapshot Postgres complet | Quotidien à 03h00 UTC | 30 jours |
| WAL streaming | Continu | 7 jours (PITR) |
| Backup hebdomadaire chiffré | Lundi 04h00 UTC | 12 semaines |
| Backup mensuel cold storage | 1er du mois | 5 ans |

### 6.2 Test de restauration
**Obligatoire** : 1 fois par trimestre, restaurer un snapshot dans un environnement isolé, vérifier que `prisma migrate status` est clean et que `/api/health` répond. Documenté dans le runbook trimestriel.

### 6.3 Procédure de restauration en urgence
```bash
# 1. Identifier le snapshot
aws rds describe-db-snapshots --db-instance-identifier edupilot-prod

# 2. Restaurer vers une nouvelle instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier edupilot-restore-$(date +%Y%m%d) \
  --db-snapshot-identifier <snapshot-id>

# 3. Mettre à jour DATABASE_URL → nouvelle instance
# 4. Vérifier l'intégrité
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Grade\";"

# 5. Bascule DNS / load balancer si nécessaire
# 6. Tag de l'incident
```

---

## 7. Migrations de base

### 7.1 Workflow
1. Modifier `prisma/schema.prisma`
2. `npx prisma migrate dev --name <nom-descriptif>` (génère le fichier SQL)
3. Tester en local : `npm run db:push && npm run db:seed`
4. PR avec le diff schema + migration SQL
5. CI exécute la migration sur DB éphémère pour valider
6. Merge → `migrate deploy` joué sur staging automatiquement
7. Promotion en prod après validation manuelle

### 7.2 Règles
- **Jamais** de migration qui supprime une colonne en prod sans plan en 2 étapes :
  1. Release N : déprécier la colonne (ne plus l'écrire, lecture tolérante)
  2. Release N+1 : drop la colonne
- **Jamais** de migration > 1 minute sur une table > 10 M lignes sans `CREATE INDEX CONCURRENTLY` / `pg_repack`
- **Toujours** tester `prisma migrate diff` avant un déploiement majeur

---

## 8. Cache (Upstash Redis)

### 8.1 Stratégies
| Donnée | TTL | Pattern d'invalidation |
|--------|-----|------------------------|
| Listes (`/api/students`, `/api/classes`) | 60 s (SHORT) | Après mutation : `invalidateByPath("/api/students")` |
| Dashboards | 120 s (MEDIUM) | Cron `analytics-sync` toutes les 5 min |
| Données de référence (matières, niveaux) | 300 s (LONG) | Manuel via admin panel |
| Sessions NextAuth | 30 j | Auto via NextAuth |
| Rate-limit counters | window-based | Auto via Upstash |

### 8.2 Commandes utiles
```bash
# Voir le hit ratio
curl -X POST "$UPSTASH_REDIS_REST_URL" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -d '["info","stats"]'

# Vider tout le cache API (à utiliser avec précaution)
curl -X POST "$UPSTASH_REDIS_REST_URL/eval" \
  -d 'redis.call("DEL", unpack(redis.call("KEYS", "api:*")))'
```

---

## 9. Secrets et rotation

| Secret | Rotation | Procédure |
|--------|----------|-----------|
| `NEXTAUTH_SECRET` | 90 jours | Génération, rolling update (sessions invalidées) |
| `TOTP_ENCRYPTION_KEY` | **Jamais** sauf compromission | Désactiver MFA tous comptes, re-générer, ré-enrôler |
| Tokens Stripe / Flutterwave | 90 jours | Rotation via dashboard fournisseur, MAJ env, redéploiement |
| `DATABASE_URL` (mot de passe) | 90 jours | Créer nouvel utilisateur, MAJ env, redéployer, supprimer ancien |
| `RESEND_API_KEY` | 180 jours | Idem |
| Tokens GHCR (déploiement) | Auto (GitHub Actions OIDC) | RAS |

Stockage : Vault (V2) ou GitHub Actions Secrets (V1). **Pas** d'AWS Secrets Manager pour le moment (coût).

---

## 10. Coûts d'infrastructure (estimation mensuelle V1)

| Service | Plan | Coût |
|---------|------|------|
| Vercel (hosting) | Pro | ~20 USD |
| Postgres managé (Neon / Supabase) | Pro 2 vCPU | ~25 USD |
| Upstash Redis | Pay-as-you-go | ~5 USD |
| Sentry | Team | ~26 USD |
| Resend (email) | 50K/mois | 20 USD |
| Domaine + SSL | annuel | ~15 USD |
| **Total V1** | | **~110 USD/mois** |

À ~500 écoles actives, ces coûts triplent environ. Voir [ADR-0009](./adr/0009-cost-scaling.md) pour le plan de scaling.

---

## 11. Calendrier de maintenance

| Tâche | Fréquence | Responsable |
|-------|-----------|-------------|
| Revue des dépendances Dependabot | Hebdo | Tech Lead |
| Audit sécurité automatisé (Trivy/CodeQL) | À chaque PR | CI |
| Test restauration backup | Trimestriel | SRE |
| Revue audit logs (anomalies) | Mensuel | Sécurité |
| Revue SLO / KPI | Mensuel | Product + Tech Lead |
| Test plan de continuité | Annuel | Direction |
| Pen test externe | Annuel | Société externe |

---

## 12. Contacts oncall

| Rôle | Personne | Contact | Plage |
|------|----------|---------|-------|
| Tech Lead | Triple-V | `bosco29962355977@gmail.com` | Sem 1-2 du mois |
| Backend secondaire | À définir | — | Sem 3-4 du mois |
| DBA | À définir | — | Astreinte 24/7 sur P0 DB |
| Sécurité | Triple-V | `security@edupilot.bj` (à créer) | P0 sécurité 24/7 |

Escalade : P0 → SMS + appel. P1 → email + Slack DM. P2+ → Slack #alerts.
