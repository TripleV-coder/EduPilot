# Suivi de remédiation — EduPilot

> **Source de vérité initiale** : `docs/AUDIT.md` (2026-09-11, note 5,8/10).
> **Branche** : `fix/production-readiness`, créée depuis `main` @ `4953cdd`.
> **Règle** : relire ce fichier au début de chaque session, avant toute action. Aucun statut « Corrigé » sans preuve d'exécution.

## Protocole

- Un commit par correctif, Conventional Commits, identifiant d'audit entre crochets (`fix(security): … [H5]`).
- Test qui échoue d'abord, correctif ensuite, test vert. C1, C3, H5 et M3 sont testés contre un **vrai PostgreSQL**.
- Bases **jetables** uniquement : PostgreSQL embarqué, port **5433**, bases `edupilot_audit` (seed) et `edupilot_fresh` (vide). Jamais `localhost:5432`.
- Mesures : `scripts/quality/*` (voir `scripts/quality/README.md`), build de production, `next start -p 3100`.
- Fin de lot : batterie complète (`tsc`, `lint`, `vitest`, `build`, intégration réelle, E2E concernés), puis arrêt en attente du feu vert.

---

## Lot 0 — Préparation (sans correctif)

### Actions réalisées

| Action | Résultat | Commit |
|---|---|---|
| Arbre de travail | Non propre → décision du propriétaire : travaux pré-audit commités sur `release/1.2-consolidation`, `main` avancé en fast-forward | `4953cdd` |
| Branche `fix/production-readiness` depuis `main` | Créée | — |
| Rapport d'audit versionné | `docs/AUDIT.md` | `076666c` |
| Base jetable seedée | `edupilot_audit` : 3 écoles, 2 685 utilisateurs, 987 élèves, 130 284 notes, 3 696 évaluations, 8 167 présences, 3 400 paiements, 587 dossiers médicaux — seed en 766 s (sous contention du build) | — |
| Scripts de mesure versionnés | `scripts/quality/` (smoke, latency, load, security, redis-outage, db-counts, lighthouse) — tous exécutés avec succès | `88215e5` |

Le seed étant aléatoire, les volumes diffèrent légèrement de l'audit (947 élèves / 125 004 notes). Les mesures « avant » ci-dessous sont celles **rejouées au Lot 0** sur cette base.

### Mesures de référence rejouées (Lot 0)

Conditions : i7-1355U, 15 Go, Node 22.22.3, build de production (47 s), `next start -p 3100`, Upstash désactivé (fallback mémoire) sauf H6, `SKIP_ENV_VALIDATION=true`, `AUTH_TRUST_HOST=true`.

| Défaut | Commande de preuve | Mesure avant |
|---|---|---|
| **C1** | clone neuf + `prisma migrate deploy` sur `edupilot_fresh` | `prisma/migrations/` ne contient que `migration_lock.toml` → « No migration found » ; 1 table en base ; `user.count()` → **P2021 « table public.users does not exist »** |
| **C2 / M7** | `npm audit --omit=dev --json` | **4** (1 critique `next` 16.0.0–16.3.2 ; élevées `nodemailer` ≤ 9.1.0, `sharp` < 0.35.4, `browserslist` ≤ 4.28.6). Tous environnements : 15 (1 C, 8 H, 5 M, 1 L). Versions correctives publiées : `next` **16.3.4**, `eslint-config-next` 16.3.4, `nodemailer` **9.1.1** (sans majeure), `sharp` 0.35.4 |
| **C3** | `latency.mjs SCHOOL_ADMIN 30` | `/api/evaluations` **p50 13 920 ms / p95 14 937 ms, 99 547 Ko** ; `/api/grades/statistics` **timeout 20 s** (2/2) ; `/api/analytics/dashboard` p50 929 / **p95 1 026 ms** |
| **C3** | `smoke.mjs SCHOOL_ADMIN TEACHER PARENT` (seuils 1 Mo / 1 s) | **35 violations**. Admin : timeouts `evaluations`, `grades/statistics` ; > 1 s : `analytics/dashboard` 1 328, `analytics/school/overview` 1 504, `analytics/students` 1 656, `events` 8 297, `performances` 2 037, `schedules` 1 011 ms ; > 1 Mo : `schedules` 8 883, `analytics/students` 5 121, `fees` 2 812, `health/vaccinations` 2 644, `health/medical-records` 1 548 Ko. p95 (200) : admin 1 011, enseignant 1 022, parent 74 ms |
| **C3** | `lighthouse.sh` (SCHOOL_ADMIN) | `/dashboard/grades` desktop : **100 206 Ko**, 84 requêtes, TBT 1 408 ms, perf 0,68 |
| **M4 / C3** | RSS du serveur (`/proc/<pid>/status`) | **216–246 Mo au repos → 5 710 Mo** après `latency.mjs` → **8 746 Mo** après le smoke → **5 214 Mo** après un seul chargement Lighthouse de la page Notes (serveur neuf). L'OOM killer a tué le PostgreSQL de test |
| **H1** | `security.mjs health` | `GET /api/health` anonyme → **401** « Non authentifié » |
| **H2** | `security.mjs cron` (CRON_SECRET défini) | `automation` et `retention`, secret invalide **et valide** → **401 « Non authentifié »** (middleware) |
| **H3** | `security.mjs xff` | 130 requêtes, XFF tournant → **130×200, 0×429** |
| **H4** | `security.mjs bruteforce` | 12 échecs, même IP → **12×302, 0×429** |
| **H5** | `security.mjs idor` | Catégorie d'une autre école : GET **200**, PATCH **200 persisté**, DELETE **200 (désactivée)** |
| **H6** | `redis-outage.mjs` (Upstash `http://127.0.0.1:1`) | `/api/auth/csrf` 10×200, **p50 4 319 ms / p95 4 360 ms** |
| **M3** | `security.mjs json` | `POST /api/classes` `{}` → **500** ; JSON cassé → **500** |
| TENANT (contrôle) | `security.mjs tenant` | `?schoolId` d'une autre école → 403 (déjà correct) |
| Perf de référence | `load.mjs /api/classes` (5 s) ; `lighthouse.sh dashboard` | 110 req/s, p99 252 ms, 0 erreur ; dashboard mobile perf 0,59, TBT 981 ms, LCP 4 793 ms, a11y 1,00 |

### Reprise de session (2026-09-11, session 2) — état de l'environnement

- Arbre propre, branche `fix/production-readiness` @ `f012e13`. Lot 0 déjà exécuté : rien n'a été rejoué.
- **La base jetable seedée n'existe plus** : aucun répertoire `PG_VERSION` sous `$HOME` ni `/tmp`, `embedded-postgres` absent de `node_modules`, aucun PostgreSQL système, rien en écoute sur 5432/5433. Elle devra être recréée (~13 min de seed) avant les mesures du Lot 1.
- **Docker** : binaire présent, démon **inactif** (`systemctl is-active docker` → `inactive`).
- **Migrations** : `prisma/migrations/` contient **33** migrations SQL + `migration_lock.toml` (les « 34 » de l'audit comptent le fichier de verrou). Seul `migration_lock.toml` est suivi ; les `.sql` sont ignorés par `.gitignore:16` (`*.sql`) [VÉRIFIÉ `git check-ignore -v`].

### Nouveaux défauts découverts au Lot 0

| ID | Sévérité | Constat | Preuve | Traitement |
|---|---|---|---|---|
| **N1** | **Critique** | Épuisement mémoire par tout utilisateur authentifié : les réponses non paginées (`/api/evaluations` ~100 Mo) continuent d'être construites même quand le client abandonne. Quelques appels suffisent à porter le serveur à 5–9 Go (DoS, OOM des processus voisins) | RSS 246 → 8 746 Mo ; OOM kill de PostgreSQL | Rattaché à **C3/M4**, Lot 3 (critère RSS < 500 Mo) |
| **N2** | Élevée | `/api/system/retention` utilise `createApiHandler` avec `requireAuth` par défaut : même une fois le middleware corrigé, le cron recevrait 401 avant la vérification du `CRON_SECRET` ; comparaison du secret par `===` (non constante en temps) | `src/app/api/system/retention/route.ts:22-40` [LU] ; 401 avec secret valide [VÉRIFIÉ] | Rattaché à **H2**, Lot 2 |
| **N3** | Élevée | Le DELETE inter-établissement de H5 est une désactivation logique (`isActive: false`) qui réussit | `security.mjs` : DELETE 200, `isActive=false` | Rattaché à **H5**, Lot 1 |

---

## Registre des défauts

Statuts : **Confirmé** (rejoué au Lot 0) · **Constat audit** (non rejoué, preuve dans `docs/AUDIT.md`) · **En cours** · **Corrigé** (avec preuve) · **Accepté** (décision du propriétaire) · **Reporté**.

| ID | Sév. | Intitulé | Lot | Statut | Commit | Test de preuve | Avant | Après |
|---|---|---|---|---|---|---|---|---|
| C1 | Critique | Migrations Prisma non versionnées + dérive `offeredLevels` | 1 | Confirmé | — | clone neuf → `migrate deploy` → démarrage sans seed ; CI `migrate diff --exit-code` | P2021 table users absente | — |
| C2 | Critique | Next.js 16.3.1 (RCE Image Optimization AVIF) | 1 | Confirmé | — | `npm audit --omit=dev --audit-level=high` = 0 | 1 critique | — |
| C3 | Critique | Endpoints non paginés (évaluations, statistiques, schedules, fees, health, scholarships, analytics) + N1 | 3 | Confirmé | — | smoke seuils 1 Mo/1 s, latency, Lighthouse, RSS | 35 violations ; 100 Mo ; 8,7 Go | — |
| H1 | Élevée | `/api/health` non public → healthcheck Docker en échec | 2 | Confirmé | — | `security.mjs health` + test préfixes publics | 401 | — |
| H2 | Élevée | Crons bloqués (middleware + N2) | 2 | Confirmé | — | `security.mjs cron` avec/sans secret | 401 ×4 | — |
| H3 | Élevée | Rate-limit contournable via XFF | 1 | Confirmé | — | `security.mjs xff` | 0×429 | — |
| H4 | Élevée | Pas de limite IP sur `/api/auth/callback/credentials` | 1 | Confirmé | — | `security.mjs bruteforce` | 0×429 | — |
| H5 | Élevée | IDOR `subjects/categories/[id]` (+ N3) | 1 | Confirmé | — | intégration PG inter-école + `security.mjs idor` | 200/200/200 | — |
| H6 | Élevée | Redis injoignable : +4,3 s par requête | 2 | Confirmé | — | `redis-outage.mjs` | p95 4 360 ms | — |
| M1 | Moyenne | `mustChangePassword` jamais imposé | 4 | Constat audit | — | E2E premier login forcé | — | — |
| M2 | Moyenne | RLS inerte | 4 | Constat audit | — | selon option retenue (a/b) | — | — |
| M3 | Moyenne | JSON invalide / ZodError → 500 | 2 | Confirmé | — | intégration PG + `security.mjs json` | 500 ×2 | — |
| M4 | Moyenne | Croissance mémoire (aggravée : N1) | 3 | Confirmé | — | RSS après série < 500 Mo | 8 746 Mo | — |
| M5 | Moyenne | 163/231 `findMany` sans `take` | 3 | Constat audit | — | revue + plafond helper | 163 | — |
| M6 | Moyenne | `.env.example` incohérent (18 variables, Upstash, `AUTH_TRUST_HOST`) | 2 | Constat audit | — | test de cohérence env ↔ `lib/env.ts` | 18 non documentées | — |
| M7 | Moyenne | Dépendances vulnérables (nodemailer, sharp) | 1 | Confirmé | — | `npm audit` | 4 prod | — |
| M8 | Moyenne | 3 E2E en échec | 5 | Constat audit | — | `npm run test:e2e` | 78/81 | — |
| M9 | Moyenne | Documentation d'API obsolète | 8 | Constat audit | — | OpenAPI généré | 33/452 | — |
| M10 | Moyenne | Panne DB indiscernable d'identifiants invalides | 2 | Constat audit | — | test API + UI | — | — |
| L1 | Faible | CSP `style-src 'unsafe-inline'` | 7 | Constat audit | — | en-tête | — | — |
| L2 | Faible | `X-XSS-Protection` obsolète | 7 | Constat audit | — | en-tête | — | — |
| L3 | Faible | Code mort / modules dupliqués | 8 | Constat audit | — | grep imports | 4 rate-limit | — |
| L4 | Faible | `SIGNATURE_SALT` avec repli codé | 2 | Constat audit | — | validation env prod | — | — |
| L5 | Faible | `/api/system/backup` expose chemin + stdout | 7 | Constat audit | — | test de réponse | — | — |
| L6 | Faible | Fichiers géants | 8 (inventaire) | Constat audit | — | — | — | — |
| L7 | Faible | Données de cache servies pendant panne DB sans indicateur | 2 | Constat audit | — | — | — | — |
| L8 | Faible | `/api/setup` expose `setupNeeded` | 5 | Constat audit (probablement accepté : nécessaire au démarrage à vide) | — | — | — | — |
| L9 | Faible | Artefacts hors périmètre à la racine | 8 (liste à valider) | Constat audit | — | — | — | — |
| N1 | Critique | Épuisement mémoire (voir ci-dessus) | 3 | Confirmé | — | RSS | 8 746 Mo | — |
| N2 | Élevée | Retention : `requireAuth` par défaut + comparaison non constante | 2 | Confirmé | — | `security.mjs cron` | 401 | — |
| N3 | Élevée | Désactivation inter-école via DELETE | 1 | Confirmé | — | `security.mjs idor` | 200 | — |

---

## Plan

| Lot | Contenu | Décisions à obtenir avant exécution |
|---|---|---|
| 1 | C1 (gitignore ciblé, 34 migrations + `offeredLevels`, contrôle CI, procédure de baseline) · C2/M7 (`next`/`eslint-config-next` 16.3.4, `nodemailer` 9.1.1, `sharp`, `npm audit fix` sans `--force`) · H3 (`getClientIp()` unique, proxy de confiance déclaré par variable, défaut sûr) · H4 · H5/N3 | Nom et sémantique de la variable de proxy de confiance (proposition : `TRUSTED_PROXY_HOPS`, défaut `0` = XFF ignoré) |
| 2 | H1, H2/N2, H6 (timeout ≤ 200 ms + coupe-circuit), M3 (400 JSON/Zod + limite de corps), M10, M6/L4, télémétrie Sentry au build, arrêts brutaux (transactions, idempotence, brouillon client) | — |
| 3 | C3/N1/M4 (évaluations sans notes + pagination, agrégations SQL, pagination des listes), M5, N+1, index via `EXPLAIN ANALYZE` | **Format de pagination** (proposition ci-dessous) |
| 4 | Balayage des 70 routes `[id]`, M1, 2FA obligatoire par rôle, M2 | 2FA obligatoire ; **RLS option a/b** |
| 5 | Démarrage à vide depuis l'UI, états vides, import robuste, intégration PG en CI, M8, comptes E2E dédiés | — |
| 6 | Modules activables, consentement (dont représentant légal), droits RGPD, fin de conservation, traçabilité, logs sans PII | **Configuration par défaut des modules**, durées de conservation |
| 7 | Image Docker (**Docker indisponible sur cette machine** → procédure de vérification exacte), SIGTERM, sauvegarde chiffrée/restauration, crons locaux, paiements simulés, état du système, en-têtes L1/L2/L5, `docs/EXPLOITATION.md` | — |
| 8 | Front (imports dynamiques, axe, états d'erreur), consolidation rate-limit/env, `INVENTAIRE_UI.md`, OpenAPI, README/TECH_DEBT/CHANGELOG 1.3.0 | **Module cible rate-limit/env** ; liste L9 à supprimer |
| 9 | Rejeu complet de toutes les mesures, tous rôles, démarrage à vide sur clone neuf, `docs/REMEDIATION.md` | — |

### Décisions du propriétaire (2026-09-11, session 2)

| Sujet | Décision |
|---|---|
| Plan global | **Non validé en l'état — ajustements demandés** (à préciser) |
| H3 — IP de confiance | `TRUSTED_PROXY_HOPS`, défaut `0` = `X-Forwarded-For` ignoré ; `N` = on retient l'adresse ajoutée par le N-ième proxy de confiance en partant de la fin |
| Tests d'intégration PG en local | `embedded-postgres` en devDependency (base éphémère, port ≠ 5432) ; service `postgres:16` en CI |
| Pagination (Lot 3) | **Curseur (keyset)** — format détaillé ci-dessous, à confirmer |

### Proposition : pagination par curseur (Lot 3) — remplace la proposition « offset » ci-après

Contraintes relevées : identifiants `cuid()` sur les 120 modèles (pas d'ordre temporel garanti) → le curseur porte sur le couple (clé de tri, `id`). Quatre fichiers front affichent « Page X / Y » avec précédent/suivant (sans saut direct) : `dashboard/students/page.tsx`, `dashboard/parents/page.tsx`, `dashboard/resources/page.tsx`, `components/layout/data-table.tsx`. Design gelé → l'affichage doit rester identique.

```
GET /api/<liste>?limit=20&cursor=<opaque>        (défaut 20, plafond 100)
{ "data": [ ... ],
  "pagination": { "limit": 20, "nextCursor": "eyJr…" | null, "hasNextPage": true, "total": 120 } }
```

- Curseur opaque `base64url({ k: <valeur de tri>, id })`, tri toujours stable `[{ <champ>: dir }, { id: dir }]`, condition keyset `(champ, id) < (k, id)` ; curseur invalide → **400**.
- `total` calculé par `count()` sur le même filtre (indexé), omis avec `?total=0` pour les appels qui n'en ont pas besoin.
- Helpers serveur uniques dans `lib/api/pagination.ts` (`getCursorParams`, `keysetWhere`, `createCursorResponse`) ; hook client `useCursorPagination` qui tient une pile de curseurs → expose `page`, `totalPages = ceil(total/limit)`, `next()`, `prev()` : **les 4 écrans gardent « Page X / Y » et leurs boutons, sans changement visuel**.
- Les 13 routes au format `page/limit` actuel migrent vers ce format, consommateurs front mis à jour dans le même commit. Rétrocompatibilité transitoire (règle 8) : `?page=` reste accepté (offset, déprécié) jusqu'au Lot 8, puis retiré.
- Index composites `(schoolId, <champ de tri>, id)` ajoutés **uniquement** si `EXPLAIN ANALYZE` le justifie.

### Proposition initiale (offset) — non retenue

Format dominant existant, produit par `getPaginationParams` + `createPaginatedResponse` (`src/lib/api/api-helpers.ts:168-220`), utilisé par 13 routes (2 seulement utilisent `pageSize`, 0 curseur) :

```json
{ "data": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 120, "totalPages": 6, "hasNextPage": true, "hasPreviousPage": false } }
```

Paramètres `?page=&limit=` (défaut 20, plafond 100). Proposition : l'adopter partout, avec migration rétrocompatible des consommateurs front dans le même commit que chaque route.

### Outillage des tests d'intégration (à valider)

Aucun test ne tourne aujourd'hui contre une vraie base. Proposition : suite `tests/integration-db/` pilotée par `TEST_DATABASE_URL` (refus du port 5432 et d'une base non marquée jetable), exécutée en CI via un service `postgres:16`, et localement contre n'importe quel PostgreSQL jetable. Pour le local, deux options : (a) aucune dépendance ajoutée, le développeur fournit la base ; (b) ajout de `embedded-postgres` en devDependency pour démarrer une base éphémère automatiquement.

---

## Journal des batteries de vérification

| Lot | tsc | lint | vitest | build | intégration réelle | E2E | Notes |
|---|---|---|---|---|---|---|---|
| 0 | ✅ 0 erreur (11 s, cache incrémental) | ✅ 0 erreur (60 s) | ✅ 2 703/2 703, 240 fichiers (36 s) | ✅ 47 s | n/a (suite inexistante) | non rejoués (aucun code applicatif modifié) | Base : `88215e5` |
