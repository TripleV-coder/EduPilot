# Inventaire du projet — EduPilot

Audit du 2026-10-14, commit de départ `75b2377` (branche `feat/refonte-coloree-et-securite`, identique à `main`).
Légende des preuves : **[E]** constaté par exécution, **[S]** par inspection du dépôt, **[D]** déclaré dans la documentation seulement.

## 1. Nature de l'application

Application web de gestion scolaire pour les établissements du Bénin (primaire, collège, lycée) : élèves,
notes et moyennes (règles officielles béninoises, formules configurables), bulletins, conseils de classe,
présences, finances (FCFA, Mobile Money, FedaPay), messagerie, analyses et prédictions de risque, espace
parents/élèves, multi-établissements (réseaux). **[S]**

## 2. Stack observée

| Élément | Version | Preuve |
|---|---|---|
| Node.js (machine d'audit) | 22.22.3 | [E] `node -v` |
| Node.js visé (Docker, CI, `.nvmrc`) | 24 | [S] `Dockerfile`, `.github/workflows/*.yml`, `.nvmrc` |
| npm | 10.9.8 | [E] |
| TypeScript | ^5.7, mode strict | [S] `package.json`, `tsconfig.json` |
| Next.js (App Router, sortie `standalone`) | 16.3.5 → **16.3.8** après correction | [E] `npm ls next` |
| React | ^19.2.4 | [S] |
| Prisma / PostgreSQL | 6.19.x / PostgreSQL 16 | [E] `prisma validate`, base jetable embedded-postgres 16.14 |
| Authentification | next-auth 5.0.0-beta.30 (Credentials, 2FA TOTP) | [S] |
| Validation | zod ^4.3.6 | [S] |
| Cache / limites partagées | Redis TCP (`ioredis`) ou Upstash REST, repli mémoire | [S] `src/lib/rate-limit.ts`, `src/lib/redis/*` |
| Tests | Vitest 4.1.11, Testing Library + jsdom, fast-check 3.23.2, Playwright ^1.52 | [E] |
| Observabilité | Sentry (`@sentry/nextjs`), logger JSON, `/api/metrics` Prometheus | [S] |
| Paiement | FedaPay SDK, MTN MoMo (webhook signé), Flutterwave/Paystack (webhook signé) | [S] |
| IA | client LLM externe pseudonymisé (`src/lib/ai/external-client.ts`, `pii.ts`) + modèles statistiques internes | [S] |

## 3. Taille et composants

| Mesure | Valeur | Preuve |
|---|---|---|
| Fichiers suivis par Git | 1 741 | [E] `git ls-files` |
| Fichiers TS/TSX dans `src/` | 964 (180 167 lignes) | [E] `evidence/40-static-metrics.log` |
| Pages (`page.tsx`) | 181 | [E] |
| Routes API (`route.ts`) | 313, dont 310 via `createApiHandler` | [E] |
| Modèles / énumérations Prisma | 129 / 70 | [E] |
| Migrations | 50 | [E] |
| Fichiers de tests unitaires / intégration / E2E | 372 / 54 / 31 specs | [E] |

Points d'entrée : `src/proxy.ts` (middleware : authentification, débit, maintenance, CSP par nonce),
`instrumentation.ts` (démarrage de la file de tâches), `src/app/api/**` (API), `src/app/(dashboard)/**` (interface),
`scripts/server/cluster.cjs` (lanceur multi-processus en production), `scripts/server/docker-entrypoint.sh`
(migrations puis serveur). **[S]**

## 4. Données et sécurité structurelles

- PostgreSQL avec **RLS forcée** sur 16 tables sensibles (politiques `app_school_ids()` / `app_rls_bypass()`),
  contexte par requête via AsyncLocalStorage, rôle applicatif `edupilot_app` sans BYPASSRLS. **[S]** migrations
  `20260913…`, `20260914…` ; **[E]** le serveur d'audit tournait sous ce rôle.
- Contrôle d'accès central : `createApiHandler` (rôles, permissions, établissement actif, débit, maintenance). **[S]**
- File de tâches durable en base (`background_jobs`, `FOR UPDATE SKIP LOCKED`). **[S]**

## 5. Commandes disponibles (package.json)

`type-check`, `lint` (ESLint sur `src`), `test` (Vitest), `test:coverage`, `test:integration` (PostgreSQL
éphémère embarqué), `test:coverage:all`, `test:e2e` (Playwright), `build`, `db:*`, `docs:openapi`, `cron:*`. **[S]**
Scripts de mesure : `scripts/quality/*.mjs` (smoke, latency, load, security, db-counts…), utilisables
seulement sur une base marquée jetable. **[S]**

## 6. CI/CD et déploiement

Workflows : `ci.yml` (matrice Node 22/24), `ci-cd.yml`, `pr-validation.yml`, `lighthouse-ci.yml`. Docker
multi-étapes Node 24 Alpine non-root, `docker-compose.yml` (app, postgres, redis, volumes), PM2 (`ecosystem.config.js`). **[S]**
Les workflows n'ont **pas** été exécutés pendant l'audit. **(non vérifié)**

## 7. Environnements utilisés pour l'audit

| Environnement | Usage |
|---|---|
| Machine locale (i7-1355U, 12 threads, 15 Go, Linux 7.0) | baseline, tests, build |
| PostgreSQL éphémère embarqué (suite d'intégration) | 54 fichiers d'intégration |
| Base jetable `edupilot_audit` (port 5433, `.quality-tmp/pg`) : 3 écoles, 2 706 comptes, 131 208 notes | serveur de production local (port 3100), sécurité dynamique, charge, scénarios de formules, navigateur |
| PostgreSQL local de développement (port 5432) | **lecture seule** : `migrate status`, `migrate diff` ; base temporaire `audit_shadow_20261014` créée puis supprimée |

## 8. Composants non examinés ou partiellement

- Pipelines CI distants (non exécutés), déploiement Docker réel (image non construite).
- Fournisseurs externes (FedaPay, MoMo, SMTP, SMS, LLM) : aucune clé, aucun appel réel.
- Suite E2E Playwright : navigateurs Playwright absents (téléchargement non autorisé à ce stade).
- Sauvegarde/restauration : `pg_dump` absent de l'hôte.

## 9. Risques initiaux identifiés à la découverte

1. Dépendances signalées vulnérables (`npm audit`) dont une critique sur `next`.
2. Moteur de formules modifiables par les utilisateurs (risque d'exécution de code, d'exactitude).
3. Application multi-établissements : risque d'accès inter-tenant.
4. Base de développement locale en retard de migrations (27).
