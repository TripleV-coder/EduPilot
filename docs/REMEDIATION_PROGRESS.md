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

## Lot 1 — Intégrité et sécurité critiques (terminé ; feu vert reçu le 2026-09-12)

### Commits

| Commit | Objet |
|---|---|
| `a5d258e` | test(infra) : suite d'intégration sur vrai PostgreSQL (`npm run test:integration`, embedded-postgres, garde-fou port 5432 / suffixe `_test`/`_it`) |
| `f4c709e` | fix(db) **[C1]** : 34 migrations versionnées (dont `offeredLevels`), job CI `integration-tests` avec `migrate diff --exit-code`, E2E sur `migrate deploy`, `scripts/db/baseline-migrations.sh` + `docs/MIGRATIONS.md` |
| `eaa9645` | test(quality) : `scripts/quality/disposable-pg.mjs` (PostgreSQL jetable persistant, port 5433) |
| `3192078` | fix(security) **[H3]** : `getClientIp()` unique + préchargement `client-ip-preload.cjs`, `TRUSTED_PROXY_HOPS` (défaut 0), refus de démarrer en prod sans préchargement |
| `e2b1751` | fix(security) **[H4]** : limite des **échecs** de connexion par IP (10 / 15 min), 429 lisible par next-auth/react, message d'écran juste |
| `0fd0302` | fix(deps) **[C2][M7]** : next 16.3.5, eslint-config-next 16.3.5, nodemailer 9.1.1, sharp 0.35.4, `npm audit fix` |
| `563ccb6` | fix(security) **[H5][N3]** : isolation de `subjects/categories/[id]` (404 hors école, catégories communes réservées au super-admin) |

### Écart assumé avec la consigne (H4)

La consigne demandait `authLimiter` sur `/api/auth/callback/credentials`. Ce limiteur compte **aussi les succès** : 5 connexions par 15 min et par IP. Une école derrière une seule IP publique, ou des téléphones derrière le NAT de l'opérateur (CGNAT), seraient bloqués dès la 6e connexion légitime. Le correctif limite donc les **échecs** : 10 par 15 min et par IP. La tentative est comptée avant la vérification (pas de dépassement par rafale), puis rendue si elle réussit. Le critère est tenu (12 échecs → 2×429) et 30 connexions réussies depuis une même IP ne sont jamais refusées. À valider par le propriétaire.

### Mode d'exploitation introduit (H3)

Le serveur doit être lancé avec `node --require ./scripts/server/client-ip-preload.cjs …`. `npm run start` et l'image Docker le font. En production, `validateEnv` refuse de démarrer sans ce préchargement (`EDUPILOT_PEER_TOKEN`). Derrière un reverse proxy, définir `TRUSTED_PROXY_HOPS=1` et n'exposer le port de l'application qu'au proxy. Documenté dans `.env.example`, et à reprendre dans `docs/EXPLOITATION.md` au Lot 7. `next dev` n'utilise pas le préchargement : en développement, toutes les requêtes partagent l'IP `unknown`, avec les limites de développement.

### Tests existants modifiés (règle 4)

- `tests/lib/auth-rate-limiter.test.ts` : exigeait le premier élément de XFF puis `X-Real-IP`, c'est-à-dire le comportement vulnérable H3. Le test vérifie désormais que ces en-têtes sont ignorés et que l'adresse signée par le préchargement est lue.
- `tests/api/test-helpers.ts` : fabriquait un XFF différent à chaque requête pour isoler le rate-limit, soit le contournement H3 lui-même. Chaque requête reste un client distinct, via une chaîne signée par un jeton de test. Sans cela, `root-schools` recevait un 429 à sa 6e écriture.
- `vitest.config.ts` : exclut `tests/integration-db/**`, suite distincte dont le setup n'est pas compatible avec le mock global de `@prisma/client`. Aucun test existant n'a été retiré ni ignoré.

### Constats de la batterie

- Le build d'un clone neuf **sans `.env`** échoue : `src/lib/config/env-validation.ts` lève une erreur dès l'import et ignore `SKIP_ENV_VALIDATION`, contrairement à `lib/env.ts`. Il réussit avec un `.env` minimal d'exploitant (secrets générés). → N5, rattaché à M6 et L3.
- Premier essai de clone avec `node_modules` en lien symbolique : Turbopack le refuse (lien sortant de la racine). C'est un artefact du montage de test, pas un défaut du dépôt. Le clone a été refait avec `npm ci`.
- `next start` sur `output: standalone` affiche un avertissement : lancement par `node .next/standalone/server.js` à traiter au Lot 7.

---

## Lot 2 — Robustesse (feu vert du 2026-09-12 : « Allons-y, finalise ce qui est demandé »)

Interprétation consignée : enchaîner les lots sans arrêt intermédiaire, sauf pour les décisions réservées au propriétaire (règle 11). L'écart H4 du Lot 1 n'a pas été contesté et reste en place.

### Commits

| Commit | Objet |
|---|---|
| `c749ec8` | fix(ops) **[H1][H2][N2]** : routes publiques par chemin **exact** (`/api/health`, `/api/system/automation`, `/api/system/retention`), `/api/health/*` reste protégé ; `verifyCronSecret` à comparaison en temps constant ; `retention` sans session obligatoire, SUPER_ADMIN avec second facteur validé |
| `1fe4a19` | fix(resilience) **[H6]** : `RedisCircuit` (délai 200 ms, circuit ouvert 30 s, un journal par épisode) sur les 4 clients Upstash |
| `6cd4595` | fix(api) **[M3]** : 413 au-delà de `maxBodyBytes` (1 Mo par défaut, upload 5 Mo + 256 Ko), 400 `INVALID_JSON` avant le handler, 400 `VALIDATION_ERROR` détaillé |
| `fc28606` | fix(auth) **[M10]** : panne de base → `code=service_unavailable`, 2FA erronée → `invalid_2fa`, messages justes à l'écran, pannes non comptées par la limite H4 |
| `828a6f8` | fix(build) **[N5]** : pas de validation d'environnement pendant `next build` |
| `2851521` | fix(config) **[M6][L4]** : `.env.example` = exactement les 65 variables lues, validation de production réaliste (SMTP), `SIGNATURE_SALT` obligatoire |
| `cdbd443` | chore(build) : télémétrie du plugin Sentry désactivée au build |
| `8a34de6` | fix(payments) **[N7]** : la référence de rapprochement n'est plus écrasée par l'identifiant du fournisseur |
| `4df6b0e` | fix(payments) : référence FedaPay écrite avant la création de la transaction (arrêt brutal) |

### Arrêts brutaux — vérification

| Parcours | Constat | Preuve | Verdict |
|---|---|---|---|
| Saisie de notes (`grades/batch`) | Validation complète **avant** `prisma.$transaction([...upserts])` (atomique). Après la transaction : recalcul des analyses dérivées et invalidation des caches | lecture `src/app/api/grades/batch/route.ts:96-133` | Pas de note partielle. Arrêt après la transaction : analyses dérivées en retard jusqu'à la saisie suivante (voir risques) |
| Saisie en cours côté client | Brouillon auto-sauvegardé en `localStorage` (`useAutoSave`), supprimé seulement après un succès (`dashboard/grades/entry/page.tsx:287,320-343`) ; renvoi idempotent (`upsert`) | `tests/hooks/use-autosave.test.tsx` | Récupérable |
| Imports CSV (5 routes) | Une transaction **par ligne** : aucune ligne incohérente, mais un arrêt en cours d'import laisse un import partiel | lecture `api/import/students/route.ts:94-213` | Rattaché au **Lot 5** (« aucun import partiel silencieux », doublons) |
| Paiement Mobile Money (`payments/initiate`) | Paiement `PENDING` + référence commités **avant** l'appel au fournisseur ; plus d'écrasement de la référence (N7) | `tests/integration-db/payment-momo-flow.test.ts` (PG réel) | Rapprochable quel que soit le moment de l'arrêt |
| Paiement FedaPay direct | Référence désormais écrite **avant** la création chez FedaPay | `payments-fedapay-initiate.test.ts` (ordre d'appel) | Corrigé (`4df6b0e`) |
| Webhooks de paiement | `updateMany` conditionnel `status: PENDING` : rejeu sans effet | `payment-momo-flow.test.ts` (rejeu → `updatedAt` inchangé) | Idempotents |

### Tests existants modifiés (règle 4)

- `tests/api/system-retention.test.ts` : exigeait le message « Non authentifié » du garde de session par défaut, c'est-à-dire N2 lui-même.
- 8 tests (`class-subjects` ×2, `evaluation-types`, `evaluations`, `finance-payments`, `schedules`, `subject-categories`, `subjects`) exigeaient « 500 sur corps invalide (ZodError non interceptée) », c'est-à-dire M3 lui-même. Ils exigent désormais 400 `VALIDATION_ERROR`.
- `tests/api/payments-initiate.test.ts` : exigeait `reference = "TXN-1"` après l'appel au fournisseur, c'est-à-dire N7 lui-même.
- `tests/api/payments-fedapay-initiate.test.ts` : exigeait qu'aucune référence ne soit écrite quand FedaPay échoue, soit l'ordre qui rend un arrêt brutal irrécupérable.

### Décision en attente du propriétaire — Upstash (M6)

La validation de démarrage exige Upstash en production. Deux faits relèvent pourtant de la règle 11 :

- **Architecture.** PM2 tourne en mode `cluster` avec `instances: 'max'`. Sans magasin partagé, chaque processus a ses propres compteurs, et les limites sont multipliées par le nombre de cœurs.
- **Données personnelles.** Upstash est un service cloud tiers, et les clés de rate-limit contiennent des adresses IP.

Options :

- (a) conserver Upstash (cloud) ;
- (b) Redis auto-hébergé, exposé en REST compatible Upstash sur la machine locale ;
- (c) PM2 en mode `fork` avec 1 instance et le repli mémoire, en retirant l'exigence Upstash.

`.env.example` documente l'état actuel sans le changer.

---

## Registre des défauts

Statuts : **Confirmé** (rejoué au Lot 0) · **Constat audit** (non rejoué, preuve dans `docs/AUDIT.md`) · **En cours** · **Corrigé** (avec preuve) · **Accepté** (décision du propriétaire) · **Reporté**.

| ID | Sév. | Intitulé | Lot | Statut | Commit | Test de preuve | Avant | Après |
|---|---|---|---|---|---|---|---|---|
| C1 | Critique | Migrations Prisma non versionnées + dérive `offeredLevels` | 1 | Corrigé | `f4c709e` | `tests/integration-db/migrations.test.ts` (PG réel) ; CI `integration-tests` (`migrate deploy` + `migrate diff --exit-code`) ; baseline testée sur base `db push` ; clone neuf | P2021 table users absente ; 0 migration suivie ; dérive `offeredLevels` | clone neuf (`npm ci` 46 s, build, 34 migrations, **sans seed**) : `/login` 200, `/setup` 200, `/api/setup` `{"setupNeeded":true}`, 0 utilisateur ; diff = 0 |
| C2 | Critique | Next.js 16.3.1 (RCE Image Optimization AVIF) | 1 | Corrigé | `0fd0302` | `npm audit --omit=dev --audit-level=high` → code 0 | 1 critique (next 16.3.1) | next 16.3.5 ; 0 vulnérabilité prod |
| C3 | Critique | Endpoints non paginés (évaluations, statistiques, schedules, fees, health, scholarships, analytics) + N1 | 3 | Confirmé | — | smoke seuils 1 Mo/1 s, latency, Lighthouse, RSS | 35 violations ; 100 Mo ; 8,7 Go | — |
| H1 | Élevée | `/api/health` non public → healthcheck Docker en échec | 2 | Corrigé (conteneur `healthy` à vérifier au Lot 7) | `c749ec8` | `tests/lib/proxy-public-routes.test.ts` (10) ; `security.mjs health` sur build de prod | 401 | 200 `{"status":"ok"}` ; `/api/health/*` toujours 401 sans session |
| H2 | Élevée | Crons bloqués (middleware + N2) | 2 | Corrigé (accès) — durée du traitement : voir N8 | `c749ec8` | `proxy-public-routes.test.ts`, `cron-auth.test.ts` (4), `system-retention.test.ts` ; `security.mjs cron` | 401 ×4 (middleware) | secret invalide → 401 de la route elle-même ; secret valide → traitement lancé (maintenance > 300 s, N8) |
| H3 | Élevée | Rate-limit contournable via XFF | 1 | Corrigé | `3192078` | `tests/lib/security/client-ip*.test.ts` (14), `tests/lib/proxy-rate-limit.test.ts` ; `security.mjs xff` sur build de prod | 130×200, 0×429 | `{"200":93,"429":37}` |
| H4 | Élevée | Pas de limite IP sur `/api/auth/callback/credentials` | 1 | Corrigé (échecs seulement — voir Lot 1) | `e2b1751` | `tests/api/auth-login-rate-limit.test.ts` (5) ; `security.mjs bruteforce` sur build de prod | 12×302, 0×429 | `{"302":10,"429":2}` ; 30 succès même IP : 0×429 |
| H5 | Élevée | IDOR `subjects/categories/[id]` (+ N3) | 1 | Corrigé | `563ccb6` | `tests/integration-db/subject-categories-isolation.test.ts` (7, PG réel) ; `security.mjs idor` | GET/PATCH/DELETE 200 (persisté) | 404/404/404, rien persisté |
| H6 | Élevée | Redis injoignable : +4,3 s par requête | 2 | Corrigé | `1fe4a19` | `tests/lib/redis/circuit.test.ts` (5), `tests/lib/redis/outage.test.ts` (3, vrai port fermé) ; `redis-outage.mjs` sur build de prod | `/api/auth/csrf` p50 4 319 / p95 4 360 ms | 10×200, p50 14 / p95 24 ms ; `/api/health` 14–97 ms |
| M1 | Moyenne | `mustChangePassword` jamais imposé | 4 | Constat audit | — | E2E premier login forcé | — | — |
| M2 | Moyenne | RLS inerte | 4 | Constat audit | — | selon option retenue (a/b) | — | — |
| M3 | Moyenne | JSON invalide / ZodError → 500 | 2 | Corrigé | `6cd4595` | `tests/lib/api/api-handler-body.test.ts` (7) ; `tests/integration-db/api-body-validation.test.ts` (3, PG réel) ; `security.mjs json` | `{}` → 500, `{bad` → 500 ; corps de 5 Mo lu en entier | 400 `VALIDATION_ERROR` / 400 `INVALID_JSON` ; > 1 Mo → 413 ; rien écrit |
| M4 | Moyenne | Croissance mémoire (aggravée : N1) | 3 | Confirmé | — | RSS après série < 500 Mo | 8 746 Mo | — |
| M5 | Moyenne | 163/231 `findMany` sans `take` | 3 | Constat audit | — | revue + plafond helper | 163 | — |
| M6 | Moyenne | `.env.example` incohérent (18 variables, Upstash, `AUTH_TRUST_HOST`) | 2 | Corrigé (statut Upstash : décision en attente, voir Lot 2) | `2851521` | `tests/lib/config/env-documentation.test.ts` (2), `tests/lib/env-production.test.ts` (4) | 18 lues non documentées, 3 documentées jamais lues ; `EMAIL_API_KEY` exigée même en SMTP | 0 / 0 ; `SMTP_HOST` exigé en SMTP, `EMAIL_API_KEY` hors SMTP |
| M7 | Moyenne | Dépendances vulnérables (nodemailer, sharp) | 1 | Corrigé (prod) | `0fd0302` | `npm audit --omit=dev --audit-level=high` | 4 prod, 15 total | 0 prod ; 8 total, outils de dev uniquement (correctif = majeure/`--force`) |
| M8 | Moyenne | 3 E2E en échec | 5 | Constat audit | — | `npm run test:e2e` | 78/81 | — |
| M9 | Moyenne | Documentation d'API obsolète | 8 | Constat audit | — | OpenAPI généré | 33/452 | — |
| M10 | Moyenne | Panne DB indiscernable d'identifiants invalides | 2 | Corrigé | `fc28606` | `tests/integration-db/login-db-outage.test.ts` (3, vraies erreurs Prisma) ; `login-errors.test.ts` (5) ; `auth-login-rate-limit.test.ts` (+1) | `error=Configuration` → « Email ou mot de passe incorrect » | `code=service_unavailable` → « Service momentanément indisponible… » ; panne non comptée par la limite H4 |
| L1 | Faible | CSP `style-src 'unsafe-inline'` | 7 | Constat audit | — | en-tête | — | — |
| L2 | Faible | `X-XSS-Protection` obsolète | 7 | Constat audit | — | en-tête | — | — |
| L3 | Faible | Code mort / modules dupliqués | 8 | Constat audit | — | grep imports | 4 rate-limit | — |
| L4 | Faible | `SIGNATURE_SALT` avec repli codé | 2 | Corrigé | `2851521` | `tests/lib/signatures/signature-salt.test.ts` (3) ; `env-production.test.ts` | repli codé « edupilot » | obligatoire en production (démarrage refusé sinon) |
| L5 | Faible | `/api/system/backup` expose chemin + stdout | 7 | Constat audit | — | test de réponse | — | — |
| L6 | Faible | Fichiers géants | 8 (inventaire) | Constat audit | — | — | — | — |
| L7 | Faible | Données de cache servies pendant panne DB sans indicateur | 2 | Constat audit | — | — | — | — |
| L8 | Faible | `/api/setup` expose `setupNeeded` | 5 | Constat audit (probablement accepté : nécessaire au démarrage à vide) | — | — | — | — |
| L9 | Faible | Artefacts hors périmètre à la racine | 8 (liste à valider) | Constat audit | — | — | — | — |
| N1 | Critique | Épuisement mémoire (voir ci-dessus) | 3 | Confirmé | — | RSS | 8 746 Mo | — |
| N2 | Élevée | Retention : `requireAuth` par défaut + comparaison non constante | 2 | Corrigé | `c749ec8` | `system-retention.test.ts` (+2), `cron-auth.test.ts` (4) | 401 avec secret valide ; comparaison `===` | cron sans session → 200 ; `timingSafeEqual` ; SUPER_ADMIN pré-2FA refusé |
| N3 | Élevée | Désactivation inter-école via DELETE | 1 | Corrigé | `563ccb6` | `subject-categories-isolation.test.ts` (N3) ; `security.mjs idor` | 200, `isActive=false` | 404, catégorie toujours active |
| N4 | Moyenne | `e2e/global-setup.ts` code en dur les identifiants d'écoles et de classe d'un seed précis (`E2E_SCHOOLS`) : sur une base reseedée, `security-tenant` peut passer sans rien prouver (ressource inexistante) | 5 | Constat Lot 1 | — | comptes et données E2E dédiés, identifiants lus en base | — | — |
| N5 | Élevée | `lib/config/env-validation.ts` lève à l'import (y compris pendant `next build`) et ignore `SKIP_ENV_VALIDATION` : build d'un clone neuf sans `.env` en échec, **et étape de build du Dockerfile impossible** (aucun secret) | 2 | Corrigé (fusion des 2 modules : Lot 8, L3) | `828a6f8` | `tests/lib/config/env-validation.test.ts` (3) | build KO sans `.env` | build sans secret OK ; démarrage sans secret toujours refusé |
| N6 | Faible | `nodemailer` 9 hors de la plage peer de `next-auth` (`^7 \|\| ^8`) — préexistant (9.0.5), masqué par `legacy-peer-deps` | 8 | Constat Lot 1 | — | vérification de l'envoi d'email (Lot 5/7) | — | — |
| N9 | Élevée (données personnelles) | `GET /api/evaluations` ne filtre que par école ; seul TEACHER est restreint à ses matières. Un PARENT ou un STUDENT reçoit toutes les évaluations de l'établissement **avec les notes et les noms de tous les élèves** (notes de mineurs exposées à d'autres familles) | 3 (avec C3, même route) | Constat Lot 2 | — | test d'intégration par rôle (parent : ses enfants seulement) | lecture `src/app/api/evaluations/route.ts:24-32,79-105` [LU] | — |
| N8 | Élevée | Maintenance quotidienne (`runDailyMaintenance`) exécutée de façon synchrone dans la requête du cron : recalcul séquentiel de ~3 000 instantanés d'analyse (élève × période), CPU du serveur 100–126 % pendant toute la durée (l'application ralentit pour tous) ; **aucune exclusion mutuelle** : un planificateur qui réessaie après expiration lance une 2e exécution concurrente (observé : 2 exécutions simultanées) | 3 (analytics) / 7 (crons) | Constat Lot 2 | — | durée du cron sur base seedée ; test d'exclusion mutuelle | 11 min 49 s pour 2 982 instantanés (mesure perturbée : 2e exécution concurrente + suite E2E) ; client expiré à 300 s | — |
| N7 | Élevée | `payments/initiate` écrasait la référence de rapprochement (« PAY-… ») par l'identifiant du fournisseur ; les webhooks MoMo et FedaPay rapprochent par notre référence : paiements Mobile Money encaissés mais jamais rapprochés (restent PENDING), sans aucune panne | 2 | Corrigé | `8a34de6` | `tests/integration-db/payment-momo-flow.test.ts` (3, PG réel, fournisseur simulé) | PENDING après webhook signé | VERIFIED ; rejeu sans effet ; signature forgée → 401 |

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

**Ajustement du propriétaire (2026-09-11) : « garde la pagination mais elle ne doit pas peser sur le fonctionnement de l'app ».** Traduit en règles vérifiables pour le Lot 3 :

1. **Aucune troncature fonctionnelle.** Avant de paginer une route, recenser ses consommateurs front. Un écran qui a besoin de l'ensemble (sélecteurs, saisie de notes d'une classe, bulletins, exports) ne reçoit jamais une liste coupée silencieusement : soit la route reste complète parce que bornée par nature (commentaire justificatif + `select` minimal), soit l'écran reçoit un endpoint filtré adapté à son besoin (ex. évaluations d'une classe et d'une période), soit l'export est produit côté serveur.
2. **Aucun surcoût.** Pas d'`OFFSET` (keyset indexé) ; `count()` exécuté **uniquement sur la première page** (sans curseur) puis conservé par le hook client — les pages suivantes n'en paient pas.
3. **Aucun changement de comportement visible** : mêmes écrans, mêmes contrôles, mêmes libellés (design gelé).
4. **Preuve** : E2E des parcours concernés verts (`grades-flow`, `finance-flow`, `attendance-flow`) et smoke sans 400 nouveau sur les GET existants.

**Plan validé avec cet ajustement → Lot 1 lancé.**

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
| 1 | ✅ 0 erreur (46 s) | ✅ 0 erreur (41 s) | ✅ 2 729/2 729, 246 fichiers (33 s) | ✅ 87 s (next 16.3.5) ; clone neuf ✅ | ✅ 9/9 (`npm run test:integration`, PG réel) | ✅ 40/40 (`auth-flow`, `security-anonymous`, `security-rbac`, `security-tenant` ; build de prod, base seedée) | `security.mjs` : H3, H4, H5 ×3, TENANT → 6/6 PASS ; `npm audit --omit=dev --audit-level=high` → 0 ; base d'audit : 3 écoles, 2 698 utilisateurs, 994 élèves, 131 208 notes |
| 2 | ✅ 0 erreur | ✅ 0 erreur (`npm run lint` complet) | ✅ 2 776/2 776, 255 fichiers | ✅ 36 s ; 0 ligne de télémétrie Sentry | ✅ 18/18 (5 fichiers, PG réel) | ✅ 78/81 : exactement les 3 échecs connus de l'audit (M8 : a11y `/ecoles`, a11y `/dashboard/grades` TEACHER, `grades-flow` CTA) — aucune régression | `security.mjs` : H1, H2 ×2, M3 ×2, H5 ×3, TENANT → 9/9 PASS ; `redis-outage.mjs` PASS (10×200, p95 24 ms) ; cron valide : voir N8 |
