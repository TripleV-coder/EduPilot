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

### Décisions du propriétaire (2026-09-12)

| Sujet | Décision | Application |
|---|---|---|
| Rate-limit / cache partagés (M6) | **PM2 à 1 instance + repli mémoire**, pas d'Upstash | Appliqué : `validateEnv` sans Upstash, `ecosystem.config.js` en `fork` ×1 avec préchargement H3 (commit « instance unique ») |
| RLS (M2) | **(a) RLS effective** | Lot 4 |
| 2FA obligatoire | **Aucune obligation** (reste facultative pour tous) | Rien à implémenter |
| Modules sensibles (Lot 6) | **Tout activé par défaut** | Mécanisme d'activation par module au Lot 6, défaut « activé » |

### Contexte de la décision Upstash (historique)

La validation de démarrage exige Upstash en production. Deux faits relèvent pourtant de la règle 11 :

- **Architecture.** PM2 tourne en mode `cluster` avec `instances: 'max'`. Sans magasin partagé, chaque processus a ses propres compteurs, et les limites sont multipliées par le nombre de cœurs.
- **Données personnelles.** Upstash est un service cloud tiers, et les clés de rate-limit contiennent des adresses IP.

Options :

- (a) conserver Upstash (cloud) ;
- (b) Redis auto-hébergé, exposé en REST compatible Upstash sur la machine locale ;
- (c) PM2 en mode `fork` avec 1 instance et le repli mémoire, en retirant l'exigence Upstash.

`.env.example` documente l'état actuel sans le changer.

## Lot 3 — Performance et bornage (terminé le 2026-09-13 ; lots enchaînés sur décision du propriétaire du même jour)

Décisions appliquées : pagination par curseur (keyset), `total` sur la première page seulement, hook client qui conserve « Page X / Y » (`useCursorPagination`), export complet par `fetchAllPages` ; ajustement du propriétaire « la pagination ne doit pas peser sur le fonctionnement de l'app ».

### Commits

| Commit | Objet |
|---|---|
| `95fb78e` | feat(api) : pagination par curseur — format unique du projet (`getCursorParams`, `keysetWhere`, `buildCursorPage`, 400 `INVALID_CURSOR`) |
| `0356461` | fix(perf,privacy) **[C3][N1][N9]** : `/api/evaluations` paginé, sans notes individuelles (`gradeCount`), périmètre par rôle ; consommateurs front (page Notes, planning des examens, `EvaluationList`, `EvaluationSheet`) mis à jour dans le même commit |
| `811016c` | refactor(auth) **[N9]** : périmètre famille partagé (`getOwnStudentIds` : parent → enfants, élève → lui-même) |
| `20d56d1` | fix(perf,privacy) **[C3][N10]** : statistiques de notes agrégées en SQL paramétré, classement nominatif réservé |
| `9ae0515` | fix(perf) **[C3]** : `/api/fees` sans paiements, `/api/schedules` sans duplication des matières de classe |
| `6965078` | fix(perf) **[C3]** : `/api/analytics/students` borné (200, plafond 500), trié par risque **avant** la limite, champs minimaux |
| `083f228` | fix(perf) **[C3]** : `/api/performances` agrégé par PostgreSQL (`grade.groupBy`) |
| `7364584` | perf(health) **[C3]** : listes de santé de l'équipe paginées et minimisées (plus de données médicales imbriquées) |
| `e6e7725` | perf(analytics) **[C3]** : tableaux de bord admin/enseignant sans chargement massif des analyses |
| `8ed0a34` | perf(analytics) **[C3]** : `/api/analytics/school/overview` sans chargement massif |
| `618933d` | fix(class-subjects) **[M5]** : lot validé en entier (une requête par modèle) puis écrit dans une transaction — corrige une écriture partielle |
| `0d3a609` | perf(subjects) **[M5]** : import du référentiel en une lecture et une insertion groupée |
| `82baca8` | fix(access-control) **[M5]** : régénération des badges d'une classe dans une transaction |
| `d926558` | perf(attendance) **[M5]** : statistiques de présence comptées par PostgreSQL (`groupBy`) |
| `93f633f` | fix(privacy) **[C3]** : liste des bourses réduite aux champs affichés (profil complet de mineurs retiré) |
| `9eb7657` | perf(payments) **[M5]** : liste de rapprochement paginée, résumé agrégé, statut inconnu → 400 |
| `8d2c446` | perf(health) **[M5]** : vaccinations en retard réduites aux champs renvoyés |
| `ab8aa4c` | fix(ops) **[N8]** : maintenance quotidienne asynchrone (202) sous bail exclusif (`job-lease.ts`), 409 si déjà en cours |
| `f0259bd` | feat(api) : keyset sur un champ de relation, réponse complète exposée par `useCursorPagination` |
| `959ce87` | perf(api) : élèves, parents, ressources, annuaire public paginés par curseur (écrans migrés, `?page=` toléré) |
| `761d460` | perf(maintenance) **[N8]** : synchronisation parallèle bornée (4 élèves), absentéisme en une requête |
| `51bbf26` | fix(api) **[N16]** : plafond de page et saisie non numérique tolérée sur 8 routes |
| `b62db28` | fix(analytics) **[M5]** : tableau BI agrégé en SQL ; réussite calculée sur chaque élève (troncature `take: 500`) |
| `ba9b24a` | fix(api) **[N16]** : plafonds alignés sur les écrans — régression de `51bbf26` (journal 500, rendez-vous et incidents 200) |
| `a812b42` | fix(api) **[N19]** : effectif complet d'une classe (plafond 1 000 avec `?classId=`) |
| `3f8913c` | fix(front) **[N18]** : listes d'élèves vides sur cinq écrans (appel, incident, paiement, médical, documents) |
| `6d40e3e` | test(quality) : scripts de mesure respectant les 429 (`Retry-After`) |
| `6911d97` | perf(finance) **[M5]** : statistiques financières agrégées en SQL (plans de toutes les années et encaissements) |
| `b428aed` | perf(grades) **[C3]** : statistiques de notes en un parcours (`GROUPING SETS`), 578 → 271 ms ; `EXPLAIN` : aucun index justifié |
| `cf89599` | perf(api) : journal d'audit (école et root), événements, demandes RGPD en curseur ; `list-window.ts` (fenêtre commune) ; l'écran de conformité charge **toutes** les demandes (il n'en voyait que 20) |
| `9b9d790` | perf(api) : messagerie (`unreadCount` conservé), devoirs, incidents en curseur |
| `967ae3d` | perf(api) **[N23]** : annonces (curseur positionnel), rendez-vous, paiements comptables, cours en curseur ; écran des cours toujours vide corrigé |
| `5a66f12` | perf(api) : organisations, écoles, utilisateurs (console root comprise), classes (positionnel, 200 par défaut au lieu de 50), paiements (positionnel) — **fin de la migration** |
| `9baafd0` | fix(front) **[N25]** : listes de classes illisibles (emploi du temps, matières par classe, fiche d'évaluation, import) |

### Mesures (base de l'audit, build de production, serveur local 3100, base jetable 5433)

| Endpoint | Lot 0 | Lot 3 | Source |
|---|---|---|---|
| `/api/evaluations` | p95 14 937 ms, 99 547 Ko | < 500 ms et < 500 Ko (n'apparaît plus dans le smoke) | smoke Lot 3a |
| `/api/grades/statistics` | timeout 20 s | < 500 ms (admin), 526 ms (enseignant) | smoke Lot 3a |
| `/api/schedules`, `/api/analytics/students`, `/api/fees` | 8 883 / 5 121 / 2 812 Ko | < 500 Ko | smoke Lot 3a |
| `/api/analytics/dashboard` (admin) | p95 1 026 ms ; 1 971 ms au smoke 3a | **p95 226 ms** (p50 192) | `latency.mjs SCHOOL_ADMIN 30` |
| `/api/analytics/dashboard` (enseignant) | 1 766 ms (smoke 3a) | **p95 161 ms** (p50 149) | `latency.mjs TEACHER 30` |
| `/api/analytics/school/overview` | 1 504 ms ; 1 711 ms (smoke 3a) | **p95 165 ms** (p50 142) | `latency.mjs SCHOOL_ADMIN 30` |
| `/api/performances` | 2 037 ms ; 862 / 1 044 ms (smoke 3a) | à re-mesurer (corrigé après le smoke 3a) | smoke final |
| Listes de santé | 2 644 / 1 548 / 975 Ko | à re-mesurer (paginées après le smoke 3a) | smoke final |
| RSS du serveur | 216–246 Mo → **5 710 Mo** après `latency.mjs` | 221 Mo → **457 Mo** après 90 requêtes analytiques | `/proc/<pid>/status` |

| Maintenance quotidienne (N8) | 616,7 s séquentielle, dans la requête du cron | **277,4 s** (× 2,2), exécutée après une réponse 202, un seul détenteur | mesure A/B sur la base d'audit, le nouveau code mesuré en premier (cache froid) |

Smoke Lot 3a (avant les correctifs des tableaux de bord et de la santé) : 3 violations au lieu de 35.

Smoke Lot 3b (2026-09-12, build avant `b62db28`, 4 rôles mesurés sur 7) : **aucune réponse > 1 s ni > 500 Ko** ; pire temps `grades/statistics` 587 / 638 / 668 ms (admin, directeur, comptable) ; p95 (200) admin 138 ms, super-admin 93 ms. 5xx : `/api/root/analytics` (N15) et `/api/system/automation` (serveur de mesure lancé sans `CRON_SECRET` : réponse 500 « Configuration Error » attendue, pas un défaut). Mesure incomplète : à partir du 4e rôle, 429 du rate-limit (tous les appels partagent une adresse depuis H3), puis connexions refusées — outil corrigé par `6d40e3e`.

### Tests existants modifiés (règle 4)

- `tests/api/evaluations.test.ts`, `tests/api/grades.test.ts`, `tests/api/performances.test.ts` : exigeaient les notes individuelles dans la liste, le calcul en mémoire ou le chargement de toutes les notes, c'est-à-dire C3/N9 eux-mêmes.
- `tests/api/health-medical-records.test.ts`, `tests/api/health-emergency-contacts.test.ts` : exigeaient un `findMany` de tous les dossiers de l'école avec un `where` littéral ; même périmètre d'école vérifié dans `where.AND[0]`, plus la borne `take`.
- `tests/api/analytics-school-overview.test.ts` : ses analyses simulées portaient l'élève et les performances par matière que la route ne charge plus ; mêmes valeurs fournies par les nouvelles requêtes ciblées, mêmes assertions.
- `tests/api/class-subjects.test.ts` (lot) et `tests/api/admin-subjects.test.ts` (import) : simulaient les lectures unitaires par ligne (N+1) ; mêmes données via `findMany`, mêmes assertions.
- `tests/api/attendance-stats` (unitaire, `d926558`), `tests/api/payments-reconcile` (`9eb7657`), `tests/api/analytics-bi.test.ts` (`b62db28`) : simulaient les lectures ligne à ligne ; mêmes données fournies agrégées, mêmes assertions.
- `tests/api/system-automation` (`ab8aa4c`) : « should run maintenance with a valid bearer token » exigeait une exécution synchrone dans la requête, c'est-à-dire N8 ; vérifie désormais 202, l'exécution après la réponse et la libération du bail.
- `tests/integration-db/list-limit-cap.test.ts` (écrit en `51bbf26`) : exigeait le plafond de 100 pour le journal, les rendez-vous et les incidents, c'est-à-dire la troncature de ces écrans ; plafond propre à chaque route (`ba9b24a`).
- `tests/api/compliance.test.ts` (`cf89599`) et `tests/api/homework.test.ts` (`9b9d790`) : exigeaient l'ancien format (`requests`, `homeworks`) pour une requête **sans** `?page=`, contraire au format par défaut décidé ; ils vérifient `data` (l'ancien format reste prouvé avec `?page=` par les tests d'intégration).

Tests de caractérisation écrits **avant** chaque optimisation et verts avant/après, sur PostgreSQL réel : `analytics-dashboard.test.ts`, `analytics-school-overview.test.ts` (jeu de données commun `fixtures/analytics-school.ts`), `health-lists.test.ts`, `batch-writes.test.ts` (l'atomicité du lot de matières échouait avant le correctif).

### Revue M5 — `findMany` sans `take`

Inventaire par script (heuristique) : 235 `findMany` dans les routes, 74 bornés, 161 sans `take`, dont 79 sur des tables qui grandissent avec l'usage (inscriptions, utilisateurs, paiements, analyses, notes, présences…).

- **Bornés par leur `where`** (une classe, un élève, une liste d'identifiants, une fenêtre de dates) : la grande majorité (bulletins, conseils, cartes, tableau de bord parent sur 30 jours, analyses par classe, lots par identifiants).
- **Complets par nature** : exports comptables et financiers, rapports financiers, envoi de notifications à tous les destinataires. Un plafond les tronquerait silencieusement.
- **Réellement non bornés à l'échelle d'une école** : `attendance/stats` ✅ `d926558` (comptage SQL) ; liste `payments/reconcile` ✅ `9eb7657` (curseur + résumé agrégé) ; liste `scholarships` ✅ `93f633f` (champs minimaux ; liste complète conservée, la page calcule ses indicateurs sur l'ensemble, bornée par l'effectif) ; `analytics/bi` ✅ `b62db28` (SQL, et fin de la troncature à 500 instantanés) ; vaccinations en retard ✅ `8d2c446` ; `finance/stats` ⏳ (tous les plans de paiement de toutes les années chargés à chaque appel).
- **Reporté au suivi** : la liste `alumni`. La page calcule ses répartitions dans le navigateur sur la liste entière ; la paginer fausserait ces chiffres sans refonte de l'écran (design gelé). La liste est bornée par le nombre d'anciens élèves d'un établissement.

**Plafond global écarté** : une extension Prisma qui imposerait un `take` par défaut tronquerait sans erreur les rapports et exports (un bulletin ou un bilan calculé sur 1 000 lignes au lieu de 1 500). C'est de plus une décision d'architecture (règle 11). Traitement retenu : route par route, sur les occurrences ci-dessus.

### Reste à faire (Lot 3)

1. ✅ `finance/stats` (`6911d97`) : plans de paiement et encaissements agrégés en SQL ; caractérisation `tests/integration-db/finance-stats.test.ts` verte avant/après.
1 bis. ✅ N28 : cache mémoire borné (voir registre).
2. ✅ N8 (`ab8aa4c`, `761d460`).
3. ✅ Migration vers le curseur terminée : les 22 routes paginées renvoient le format unique `{ data, pagination: { limit, nextCursor, hasNextPage, total? } }` (`959ce87`, `cf89599`, `9b9d790`, `967ae3d`, `5a66f12`). `?page=` reste toléré avec l'ancien format de chaque route jusqu'au Lot 8. Tris composés ou sur colonne nullable (annonces, classes, `/api/payments`) : **curseur positionnel** — même format et curseur opaque côté client, position encodée (listes de taille modérée). Preuves : `tests/integration-db/list-cursor-*.test.ts` (5 fichiers, 38 cas, PG réel), chaque parcours rouge sur le code d'origine.
4. ✅ Index : **aucun ajouté**, faute de justification. Les parcours séquentiels relevés pendant le smoke sur 7 rôles (`pg-seq-scans.mjs`) visent de petites tables (présences 8 293 lignes / 1,4 Mo, paiements 3 328 / 584 Ko, utilisateurs 2 698, élèves 994). `EXPLAIN (ANALYZE, BUFFERS)` des requêtes dominantes (`.quality-tmp/explain-seq.cjs`, 2026-09-13) : présences d'une école par statut **10,7 ms** (jointure sur `classes_schoolId_…_idx`, parcours séquentiel choisi par le planificateur car une école = toute la table) ; matières du dernier instantané BI **~50 ms** ; encaissements d'une école **5,5 ms** (`fees_schoolId_idx`). Les notes (123 720 lignes) passent par index (31 164 parcours d'index contre 1 séquentiel). À ce volume, un index n'accélère rien de mesurable et ralentirait les écritures. À réévaluer au Lot 9 si une base plus grosse est seedée.
5. ✅ Batterie du Lot 3 (2026-09-13, build de `2da4d02`, base d'audit sur 5433, serveur `next start -p 3100` avec préchargement H3, `RATE_LIMIT_RELAXED=true`) — voir le tableau ci-dessous et le journal des batteries.

### Critères de sortie du Lot 3 — relevé final (2026-09-13)

| Critère | Mesure | Verdict |
|---|---|---|
| Aucune réponse du smoke > 1 Mo | `smoke.mjs ALL` (7 rôles × 164 GET) : aucune > 500 Ko | ✅ |
| Aucune réponse > 1 s | aucune > 500 ms ; p95 (200) par rôle : 41 à 130 ms | ✅ |
| `/api/analytics/dashboard` p95 < 300 ms | `latency.mjs` : admin **251 ms** (p50 208), enseignant **208 ms** (p50 166) | ✅ |
| Page Notes < 2 Mo | Lighthouse desktop : **687 Ko**, 91 requêtes, TBT 142 ms, perf 0,87 (Lot 0 : 100 206 Ko, TBT 1 408 ms, perf 0,68) | ✅ |
| RSS < 500 Mo après la série | 221 Mo au repos → 323 Mo après le smoke → 348 Mo après les latences → **395 Mo** après Lighthouse (Lot 0 : 8 746 Mo ; avant N28 : 545 Mo) | ✅ |
| E2E `grades-flow` vert | `grades-flow` 4/4, `class-lists` 3/3 (dont la fiche N26), `student-lists` 5/5 : **18/18** avec le setup | ✅ |

Réserves, consignées honnêtement :
- Le smoke compte **1 violation** : `GET /api/root/analytics` → 500 pour le SUPER_ADMIN (N15, sévérité moyenne, laissé au suivi par la règle 10). Ce n'est pas un critère du Lot 3 (taille, durée), mais la route reste cassée.
- `latency.mjs` a compté 2 `TIMEOUT` (`grades/statistics` admin, `users` enseignant). Ce sont des artefacts de l'outil : le délai d'abandon était armé avant l'attente d'un 429. L'outil est corrigé (`f053ae1`) ; les 29 autres mesures de ces routes sont sous 320 ms.
- Tableau de bord mobile (Lighthouse) : perf 0,67, TBT 692 ms, LCP 4 397 ms. Hors critères du Lot 3 : objectifs du **Lot 8** (≥ 0,80, TBT < 600 ms).
- Accessibilité de la page Notes (desktop) : 0,92, l'une des 2 violations axe connues (M8, Lot 5/8).

---

## Lot 4 — Isolation, comptes et contrôle d'accès (terminé le 2026-09-14 ; en attente du feu vert)

Décisions déjà prises par le propriétaire (2026-09-12) : **2FA facultative pour tous** (rien à implémenter) ; **RLS option (a)**, effective (rôle applicatif non propriétaire, `FORCE ROW LEVEL SECURITY`).

### Commits

| Commit | Objet |
|---|---|
| `6fbd7e2` | fix(auth) **[M1]** : `mustChangePassword` dans `authorize()` → JWT → session (Node et Edge) ; middleware : pages → `/first-login`, API → 403 `PASSWORD_CHANGE_REQUIRED`, `/api/auth/*` joignable, second facteur prioritaire ; `POST /api/auth/first-login` sans jeton = changement depuis la session ; les deux parcours lèvent l'indicateur et positionnent `passwordChangedAt` ; écran `/first-login` : logique dans `hooks/use-first-login` |
| `e983006` | fix(api) **[N33]** : promotion d'une classe ou vers une année hors établissement → 404 au lieu de 400 (`PromotionError` porte son statut) |
| `36fecda` | fix(security) **[N32]** : IDOR `DELETE /api/courses/[id]` (garde d'établissement ajouté) + **balayage des routes `[id]`** (`tenant-isolation-sweep.test.ts`, fixture `tenant-graph.ts`) |
| `89080bd` | fix(security) **[M1][N31]** : mot de passe provisoire unique par compte (`lib/auth/provisional-password`) pour les 4 créations unitaires, le déploiement root et les 5 imports ; fin de « 00000000 » ; identifiants renvoyés une seule fois et affichés (écrans enseignant/utilisateur : `<code>` existant ; inscription : `Card` ; root : `Dialog` ; import : téléchargement CSV) |
| `aa074b9` | fix(security) **[M2]** : RLS effective — contexte par requête (`lib/db/db-context`, AsyncLocalStorage), client Prisma à portée (`lib/db/scoped-client` : `set_config` en portée transaction), posé par `createApiHandler` et la page serveur du tableau de bord ; contextes système déclarés (connexion, webhooks après signature, crons après secret, garde d'accès) ; migration `ENABLE` + `FORCE` sur 11 tables, idempotente ; rôle applicatif (`scripts/db/setup-app-role.mjs`) ; refus de démarrer en production avec un rôle superutilisateur/BYPASSRLS ; ADR-0010 ; CI E2E sur le rôle applicatif |
| `005be2d` | perf(rls) **[M2]** : politiques corrélées (`EXISTS` sur la clé, fonctions en InitPlan) qui conservent les plans par index ; nombre de notes de la liste des évaluations et nombre de paiements du rapport des frais comptés par requête groupée (`_count` dégénérait sous RLS : 11 s) |

### Parcours du titulaire d'un compte créé par un tiers

1. L'auteur (admin, import, console root) reçoit **une fois** le mot de passe provisoire, différent pour chaque compte.
2. Le titulaire se connecte avec son email et ce mot de passe. Le middleware le confine à `/first-login`.
3. Il saisit le mot de passe provisoire et choisit le sien. L'indicateur est levé, la session est fermée, il se reconnecte.

### Tests existants modifiés (règle 4)

- M1 / N31 : aucun. Les tests unitaires des routes modifiées (111 cas) passent sans changement.
- M2 (`aa074b9`) :
  - `tests/setup.ts` : le double de `PrismaClient` n'a pas `$extends` ; le client à portée y est l'identité. Son comportement est prouvé sur PostgreSQL réel (`rls-effective.test.ts`).
  - `tests/api/classes-id.test.ts`, `tests/api/orientation-recommendations.test.ts` : simulaient `findUnique` puis attendaient 403 pour une autre école. La route cherche désormais dans l'établissement (sous RLS, lire l'élève masqué faisait échouer Prisma, 500) : 404, filtre vérifié. Le 403 reste testé pour une ligne renvoyée hors établissement.
  - `tests/integration-db/*` : jeux de données et vérifications par le rôle propriétaire (`owner-db.ts`, remplacement de l'import) ; le code testé tourne avec le rôle applicatif.
  - `analytics-dashboard.test.ts` (annexe) : la session était construite sans l'annexe, contrairement à la connexion réelle ; elle est calculée par la vraie `getAccessibleSchoolIdsForUser`.
  - `payment-momo-flow.test.ts` : le webhook était appelé avec la session du comptable, ce qui masquait l'absence de contexte système dans la route (défaut réel, corrigé) ; il est appelé anonymement, comme en production.
- M2 (`005be2d`) : `tests/api/evaluations.test.ts` et `tests/api/finance-reports.test.ts` simulaient `_count` dans les lignes ; ils simulent la requête groupée et vérifient qu'elle ne porte que sur la page ou les frais listés.

### Risques résiduels (M1 / N31)

- **Mot de passe provisoire perdu.** Il n'est affiché qu'une fois (réponse de l'API). Si l'auteur ferme l'écran sans le noter, il faut réinitialiser le mot de passe du compte. L'existence d'une réinitialisation par l'admin reste à vérifier au Lot 5 (parcours de démarrage à vide).
- **Robustesse du format.** Le format « XXXX-9999 » donne ~1,15 × 10⁹ combinaisons. La devinette est bornée par le verrouillage de compte et la limite d'échecs par adresse (H4), et la fenêtre dure jusqu'à la première connexion.
- **Code mort.** `lib/import/initial-password.ts` (`generateImportPassword`) n'est plus appelé mais conservé, car son test existe (règle 4). `lib/auth/user-creation.ts` n'est importé nulle part et ne positionnait pas `mustChangePassword`. Les deux relèvent de **L3** (Lot 8).
- **E2E du premier login forcé** (créer un compte depuis l'écran, se connecter avec le mot de passe affiché, être forcé de le changer) : à ajouter au Lot 5 avec les comptes E2E dédiés (N4/N17).

### Reste à faire (Lot 4)

1. ✅ Balayage des routes `[id]` (`36fecda`), sur PostgreSQL réel. Chaque méthode exportée de **67 routes** est appelée par l'admin d'une autre école : seules 403 et 404 sont acceptées, et la ligne visée par une écriture doit rester identique en base. Un contrôle positif du propriétaire (GET 200) écarte les faux 404. Il a d'ailleurs révélé que le DELETE vulnérable supprimait en cascade modules et leçons. Résultat : **1 fuite réelle (N32) et 1 refus en 400 (N33), corrigés : 67/67**. Trois routes sont hors balayage, avec justification : `auth/[...nextauth]` (pas une ressource), `public/schools/[code]` (vitrine publique par conception), `uploads/[type]/[filename]` (contrôle par manifeste de fichiers ; le cas inter-écoles est couvert par `uploads-route.test.ts:187`, 403). Soit 70 routes au total.
2. **M2 — RLS effective** (option a retenue). Rôle applicatif non propriétaire, `FORCE ROW LEVEL SECURITY`, extension aux tables sensibles. Les scripts destinés à la base réelle sont exécutés par le propriétaire (règle 5).
   **Décisions du propriétaire (2026-09-13)**, prises après mesure du surcoût (+0,8 ms par requête : 1,27 → 2,08 ms p50 sur la base d'audit, `.quality-tmp/rls-overhead.cjs`) :
   - **fermée par défaut** : sans contexte d'établissement, les tables couvertes apparaissent vides ; les contextes système (connexion, crons, webhooks, console root, installation) sont déclarés explicitement ;
   - **périmètre « données sensibles »** : élèves, notes, paiements, dossiers médicaux, allergies, vaccinations, contacts d'urgence, incidents de discipline, présences, évaluations.
   Constat préalable : 283 routes sur 285 passent par `createApiHandler` (les 2 autres, `setup` et `auth/[...nextauth]`, sont des contextes système). Le contexte peut donc être posé automatiquement.
   ✅ **Réalisé** (`aa074b9`, `005be2d`, ADR-0010). Constats faits pendant la mise en œuvre, tous corrigés avant commit :
   - **Requêtes paresseuses.** `runAsSystem(…, () => prisma.x.op())` renvoie une promesse Prisma qui ne part qu'au `await`, hors de la portée : la requête partait sans contexte. Les trois webhooks de paiement avaient ce motif ; ils n'auraient **jamais rapproché** un paiement. Détecté par `rls-effective.test.ts`, corrigé une fois pour toutes dans `runWithDbContext`/`runAsSystem` (le `then` est appelé dans la portée). Le test d'intégration MoMo passait quand même, parce qu'il appelait le webhook avec la session du comptable ; il est désormais anonyme.
   - **Relations obligatoires vers un élève masqué.** Une ligne non couverte (rendez-vous, certificat, bourse…) lue avec son élève d'une autre école fait échouer Prisma (« Inconsistent query result ») : le balayage `[id]` est passé de 67/67 à 8 routes en 500. Corrigé au garde central `assertModelAccess` (résolution du seul `schoolId` en contexte système déclaré, puis 403) et dans `classes/[id]` et `orientation/[id]/recommendations` (recherche dans l'établissement, 404).
   - **Plans d'exécution.** Voir « Mesures RLS » ci-dessous.
3. ✅ Batterie du Lot 4 (2026-09-14) — voir le journal des batteries.

### Mesures RLS (base d'audit, build de production, serveur sur le rôle applicatif `edupilot_app`)

Surcoût mesuré avant décision : +0,8 ms par requête SQL (aller-retour `set_config`). Le vrai coût était ailleurs : la forme des politiques changeait les plans.

| p50 (admin / enseignant) | Lot 3 (sans RLS) | RLS, forme `IN (sous-requête)` | RLS, forme corrélée + comptes groupés |
|---|---|---|---|
| `/api/evaluations` | 55 / 75 ms | 149 / 144 ms | **33 / 37 ms** |
| `/api/grades?classId` | 50 / 53 ms | 122 / 124 ms | 58 / 58 ms |
| `/api/analytics/dashboard` (p95) | 251 / 208 ms | 292 / 236 ms | 267 / 211 ms (< 300) |
| `/api/grades/statistics` | 289 / 286 ms | 367 / 364 ms | 322 / 319 ms |

- Diagnostic par `EXPLAIN (ANALYZE, BUFFERS)` : avec `IN (sous-requête)`, parcours séquentiel des 131 208 notes au lieu du chemin par index (17 → 114 ms pour les notes d'une classe) ; forme corrélée : 18 ms. Contrepartie : un agrégat sur toutes les notes d'une école passe de 83 à 114 ms (+33 ms mesurés sur `grades/statistics`).
- Sous la forme corrélée, `_count: { grades }` (liste des évaluations) était réexécuté pour chaque évaluation : **11 s** pour l'enseignant (smoke 7 rôles). Compté par requête groupée : 37 ms.
- Index couvrants essayés (`student_profiles(id, schoolId)`, `classes(id, schoolId)`, `class_subjects(id, classId)`) : aucun gain, **non ajoutés**.
- Smoke 7 rôles × 164 GET (seuils 500 ms / 500 Ko) : aucune violation hors les deux connues (`/api/root/analytics` N15 ; `/api/system/automation` 500 sur un serveur de mesure lancé sans `CRON_SECRET`). Comparaison route par route avec le smoke final du Lot 3 : statuts et tailles identiques (±50 %) pour les 7 rôles — aucune donnée masquée à tort.
- RSS : 227 Mo au repos → 452 Mo après smoke, latences et suite E2E complète (plafond 500 Mo).
- Garde de démarrage : serveur de production sur le superutilisateur → « Démarrage refusé : … rôle « edupilot » (superutilisateur), qui ignore la sécurité par ligne… », aucune requête servie (HTTP 000). Voir N34.
- Script du propriétaire `setup-app-role.mjs` exécuté deux fois sur la base d'audit : idempotent ; propriétaire `BYPASSRLS=true`, applicatif `superutilisateur=false, BYPASSRLS=false`.
- Maintenance quotidienne déclenchée par le cron (secret valide → 202), exécutée après la réponse en contexte système, sous RLS : « Maintenance quotidienne terminée », 2 982 élèves traités, **0 erreur**, 11 min 05 s. En base : 2 982/2 982 `student_analytics` et 35 784/35 784 `grade_history` réécrits, **moyenne générale non nulle pour les 2 982** (moyenne 13,22). Les notes ont donc été lues à travers la RLS ; le contexte système est conservé par `runInBackground`.

### Risques résiduels (M2)

- La RLS isole les **établissements**. L'isolation plus fine (un parent ne voit que ses enfants, un enseignant ses classes) reste applicative.
- Une injection SQL pourrait poser elle-même `app.rls_bypass` : la RLS protège des oublis de filtre, pas d'une injection (requêtes brutes paramétrées).
- Les tables hors périmètre (inscriptions, rendez-vous, bourses, certificats, messages…) restent protégées par le seul code applicatif, comme décidé.
- Scripts de maintenance qui passent par `@/lib/prisma` : ils doivent tourner avec le rôle propriétaire, ou déclarer leur contexte. Documenté dans `docs/MIGRATIONS.md`.
- Tout nouveau `_count` ou agrégat relationnel sur une table couverte peut dégénérer sous RLS. Il faut le mesurer (smoke 7 rôles) avant de l'accepter.
- Déploiement Docker (Lot 7) : l'image PostgreSQL crée un superutilisateur ; il faudra y ajouter la création du rôle applicatif, sans quoi l'application refusera de démarrer.

---

## Lot 5 — Démarrage à vide, import et tests fiables (terminé le 2026-09-14 ; en attente du feu vert)

### Démarrage à vide depuis l'interface — E2E `e2e/fresh-install/fresh-install.spec.ts`

Conditions : base neuve `edupilot_fresh` (`migrate deploy`, aucun seed, aucun utilisateur), rôle applicatif `edupilot_app` sous RLS, build de production, `ROOT_USER_EMAILS` vide (installation neuve), `playwright.fresh.config.ts`.

Parcours en 15 étapes, uniquement par l'interface : `/setup` → déploiement de l'école (console root) → premier changement du mot de passe provisoire de l'admin → années et périodes → niveau de collège → matière et type d'évaluation → enseignant → classe avec professeur principal → matière affectée → inscription d'un élève → compte parent et code de liaison → note saisie par l'enseignant → connexion de l'élève → rattachement et lecture de la note par le parent. **Résultat : vert (1,1 min).**

Blocages trouvés en le déroulant, chacun prouvé rouge avant correctif :

| ID | Étape | Blocage | Commit |
|---|---|---|---|
| N36 | 2 | Console root refusée (403) au super-admin créé par `/setup` quand `ROOT_USER_EMAILS` est absente | `388ccae` |
| N37 | 12, 15 | Aucun compte parent créable depuis l'interface ; `POST /api/users` sans profil parent → rattachement 404 | `7117bb0` |
| N38 | 5 | Écran des périodes : accents écrits `é` en JSX, affichés tels quels (« Nouvelle Période ») | `b8c6a88` |
| N39 | 6 | Niveaux de collège et de lycée refusés (valeurs `MIDDLE`/`HIGH` hors enum) | `e6afa61` |
| N40 | 9 | « Créer une classe » plantait au chargement (`<SelectItem value="">`) | `df0bd5c` |
| N41 | 3, 13–15 | Activation des comptes : 3 tentatives / 15 min par adresse, réussites comprises | `c188894` |

Constats sans blocage, laissés au suivi (règle 10) :
- **N42** : `/dashboard/grades` montre au parent l'interface de l'équipe (« Saisissez les notes », bouton « Saisir Notes »). Le serveur refuse ces écritures (`allowedRoles`) : aucun risque pour les données. Le parent consulte les notes par « Mes enfants » → fiche → Scolarité.
- **N43** : bouton « Ajouter » (et « Catalogue global ») de l'écran « Matières par classe » sans action ; l'affectation se fait depuis la fiche de la classe.
- **N44** : `/dashboard/alerts` (navigation super-admin) répond 404.
- **N27 (complément)** : pendant le premier changement de mot de passe, des navigations vers `https://localhost:3100/…` échouent (`ERR_SSL_PROTOCOL_ERROR`) : sur une installation en HTTP seul, la directive `upgrade-insecure-requests` casse aussi des navigations. Lot 7.
- Le déploiement d'une école crée déjà son année courante et ses trimestres (`lib/schools/provisioning.ts`) : le parcours le vérifie, puis crée l'année suivante.

### Règle 6 — scripts dangereux verrouillés (N17, `9a811aa`)

Marqueur `edupilot:disposable` posé sur la base (commentaire PostgreSQL), vérifié par `scripts/lib/disposable-guard.mjs` dans `prisma/seed.ts`, les 5 seeds annexes, les 8 scripts `create-*`/`seed-*`, `reset-passwords.ts`, `wipe-users.js` et `e2e/global-setup.ts`. Pose : `scripts/db/mark-disposable.mjs` (refuse une base contenant des comptes sauf `--allow-non-empty`), `disposable-pg.mjs`, CI (après `migrate deploy`). Vérifié en réel : seed et `reset-passwords` refusés sur une base non marquée ; base d'audit refusée sans `--allow-non-empty`. Comptes E2E dédiés : voir plus bas (`cc8e1ea`).

### États vides — toutes les pages d'une école sans données (`ad82d49`)

Second test du démarrage à vide (même fichier, en série) : le super-administrateur déploie « École Sans Données », son administrateur crée un enseignant et un parent, puis chacun des trois comptes visite les 145 pages statiques du tableau de bord (liste lue dans `src/app`, routes `[param]` exclues). Anomalie relevée si : statut ≥ 500 ou 404, écran d'erreur, exception non rattrapée, « NaN » / « Infinity » / « undefined » affichés, perte de session. « Accès refusé » (page d'un autre rôle) n'en est pas une.

**Résultat : 145 pages × 3 rôles, 0 anomalie (11,8 min).** Limites : le tableau de bord n'a pas d'élément `<main>` propre au contenu, donc le contrôle du texte porte sur le corps entier ; rôle élève non parcouru (un élève n'existe pas sans classe).

### Import CSV/Excel (`c28e0e1`, `a157849`)

| ID | Défaut | Correctif | Preuve |
|---|---|---|---|
| N45 | Fichier lu par `readAsBinaryString` : CSV UTF-8 sans BOM → « AÃ¯cha » ; Windows-1252 → apostrophe typographique perdue ; noms enregistrés ainsi | `lib/import/read-spreadsheet` lit les octets : XLSX/XLS reconnus à leur signature, UTF-8 strict sinon Windows-1252, BOM retiré, séparateur `;` ou `,` | `tests/lib/import/read-spreadsheet.test.ts` (6) |
| N46 | Élèves : une transaction par ligne, lignes invalides ignorées sous « Importation réussie », classe introuvable → élève inscrit nulle part, date `JJ/MM/AAAA` passée à `new Date()`, arrêt en cours → import partiel | Tout le fichier validé d'abord (schéma, dates, doublons fichier et base, classes, année en cours) ; à la moindre erreur 422 et rien d'écrit, rapport `{ row, field, message }` ; sinon une seule transaction ; collision concurrente → 409 | `tests/lib/import/dates.test.ts` (5) ; `tests/integration-db/import-students.test.ts` (6, PG réel, tous rouges avant) |
| N47 | Enseignants, parents, classes : même import partiel ; matricule d'enfant inconnu ignoré (parent sans enfant) ; niveau inconnu **créé** en `PRIMARY` ; professeur principal introuvable → classe sans titulaire | Socle `lib/import/all-or-nothing` ; mêmes règles que N46 ; niveau trouvé par code ou nom, enseignant de l'école exigé, noms de classe en double signalés | `tests/integration-db/import-accounts-classes.test.ts` (8, PG réel, 6 rouges avant) |

Écran (règle 8, même commit que chaque contrat) : refus affiché comme tel (« Import refusé : aucun enregistrement créé ») avec le rapport complet.

Tests existants modifiés (règle 4, `a157849`) : `tests/api/import-{teachers,parents,classes}.test.ts` exigeaient l'import partiel (« erreurs de validation → 200, 1 créé », « email existant ignoré », « niveau manquant créé », « enseignant inconnu → classe sans titulaire ») ; ils exigent désormais 422 sans écriture, ou 500 et transaction annulée. Cas d'accès, de format et de quota inchangés.

### Comptes E2E dédiés — N4 / N17 (`cc8e1ea`)

`e2e/global-setup.ts` (base marquée jetable obligatoire, contexte système RLS) crée ou remet à zéro des comptes propres aux E2E (`e2e.*@edupilot-e2e.test`, `e2e/e2e-accounts.ts`) dans les écoles du seed retrouvées par code, plus un jeu dédié (classe, matière enseignée, évaluation, élève inscrit, parent rattaché), et écrit les identifiants réels dans `e2e/.auth/fixtures.json`, lus par `security-tenant`. Les comptes de démonstration ne sont plus réécrits : empreinte des 8 comptes (hash du mot de passe, `updatedAt`, échecs, 2FA) **identique avant et après** chacun des trois passages de la suite complète.

Tests existants modifiés (règle 4) : `auth.setup.ts` et `auth-flow.spec.ts` importaient les comptes depuis `global-setup` (import dynamique qui chargeait Prisma dans le processus de test) ; même compte administrateur de l'école 1, désormais dédié.

### M8 et N49 — suite E2E complète (`90930dd`, `b500a09`)

- M8 : `/ecoles` reçoit son `<main>` ; la liste des évaluations passe de `h4` à `h2` (elle suit le `h1` de la page Notes) et son bouton à icône reçoit un nom accessible. Le troisième échec de l'audit (`grades-flow`, CTA) est vert depuis la batterie du Lot 4.
- N49 : les données dédiées ont mis au jour un plantage de « Matières par classe » (`.map` sur `{ data, pagination }` de `/api/teachers`) dès qu'une classe a une matière affectée. `class-lists.spec.ts` rouge avant, vert après.

Suite complète (build de production, base d'audit, rôle applicatif) : 87/89 → **89/89**.

### CI (`c80117e`)

- Seed du job `e2e` bloquant (retrait de `continue-on-error`).
- Nouveau job `fresh-install` : PostgreSQL neuf, `migrate deploy` sans seed, rôle applicatif, build, serveur de production sans `ROOT_USER_EMAILS`, `playwright.fresh.config.ts`. Ajouté aux vérifications requises du Quality Gate.
- L'intégration PostgreSQL tourne déjà en CI (job `integration-tests`, Lot 1). Les deux `continue-on-error` restants (envoi Codecov, relevé des licences) sont informatifs et ne portent aucun test.
- Non vérifié : aucune exécution sur GitHub Actions dans cette session (YAML validé, étapes rejouées en local).

### Constats du Lot 5 laissés au suivi (règle 10)

- **N48** : bouton « autres actions » de la liste des évaluations sans action (nom accessible ajouté par M8, comportement inchangé).
- **N50 — corrigé après la batterie (`d0c3122`)**, sur décision du propriétaire du 2026-09-14. Pas de rattachement par un email saisi dans un tableur, qui relierait un adulte aux données d'un mineur sans vérification. Pas de refus du fichier non plus, par égard pour les exports d'autres logiciels. La colonne est signalée dès la vérification puis dans le rapport, et un bouton « Importer les parents » suit l'import des élèves. Dans l'import « Parents », la même colonne se rattache désormais à l'email du parent : le même fichier sert aux deux imports. Relevé par le nouveau test : sans garde-fou, le retrait du champ envoyait l'en-tête vers l'email de l'élève. Vérifications : `vitest` 2 894/2 894, intégration 253/253, `tsc`, `lint` et `build` verts. Aucune spec E2E ne visite l'écran d'import.
- **N51** : `/api/import/schedules` écrit les lignes valides et ignore les autres (import partiel). Aucun écran ne l'appelle.
- **N52** : `/api/students/bulk-import`, second point d'entrée d'import d'élèves, appelé par aucun écran et non couvert par N46. Il rattachait un parent à l'élève par simple email, sans vérification, c'est-à-dire précisément le chemin écarté par N50. **Corrigé (`f7c2f08`)** sur décision du propriétaire du 2026-09-14 : la route délègue désormais à l'import en tout ou rien. Plus de rattachement par email, rapport 422 situé, et un modèle CSV sans colonne email du parent. La suppression de la route a été écartée, parce qu'elle aurait retiré son test (règle 4). Test unitaire recentré sur la route, avec justification dans le commit.
- **N54 — corrigé (`517b289`)**, sur décision du propriétaire du 2026-09-14 : l'adresse est enregistrée. C'est une donnée fournie par l'école, dans un champ déjà prévu par la fiche élève ; bulk-import l'enregistrait déjà. Espaces retirés, 255 caractères au plus. Au-delà, la ligne est signalée et rien n'est écrit.
- **N55 — trouvé et corrigé (`4f08d91`, règle 10 : données personnelles)** : `/api/import` (type STUDENTS), troisième point d'entrée de l'import des élèves. Il prenait l'établissement de la requête pour tout rôle ; la RLS du Lot 4 bloquait l'écriture dans l'autre école, d'où un 500. Il inventait « Élève » / « Nouveau » quand un nom manquait, et ignorait la classe, la date, le genre et l'adresse. Désormais : école de l'appelant seule (le super-administrateur choisit une école vérifiée), quota contrôlé, import en tout ou rien. Les trois chemins d'import d'élèves suivent maintenant les mêmes règles.
- Vérifications après N52, N54 et N55 (code de `4f08d91`) : `tsc` et `lint` verts ; `vitest` 2 892/2 892 (la réécriture justifiée du test de bulk-import retire 3 cas d'import partiel ou de rattachement par email et ajoute le cas des 500 lignes) ; intégration 259/259, 39 fichiers (PG réel) ; `build` vert. Aucune spec E2E ne visite ces routes.
- **N53** : le spinner de chargement de `PageGuard` n'a ni texte ni `role="status"`. Au passage de la batterie, l'E2E des états vides a relevé une fois « TEACHER /dashboard/settings/profile : zone principale vide ». Aucune reproduction en 15 chargements ciblés (362 caractères affichés à chaque fois, `networkidle` atteint en 1,3 à 1,9 s) : c'est un état de chargement capturé, pas une page vide.

---

## Lot 6 — Modules, consentement, droits RGPD, conservation, traçabilité (terminé le 2026-09-17 ; en attente du feu vert)

### Décisions du propriétaire (2026-09-14)

- **Modules par défaut** : socle actif pour une nouvelle école (élèves, classes, notes et bulletins, appel, emploi du temps, messagerie, finance). Le reste est à activer par l'école : santé, discipline, IA, badges et contrôle d'accès, RH et paie, cantine, transport, cours en ligne, alumni, signature. Les écoles existantes gardent tous leurs modules actifs.
- **Conservation** : durées prudentes, modifiables par chaque école, à valider juridiquement (loi n° 2017-20 portant Code du numérique, APDP) :

  | Donnée | Durée par défaut |
  |---|---|
  | Compte de l'élève parti (anonymisé) | 1 an après la fin de la dernière inscription |
  | Notes et bulletins | 5 ans après le départ |
  | Santé | 1 an après le départ |
  | Pièces comptables | 10 ans (OHADA) |
  | Journaux d'accès aux badges | 3 mois |
  | Journaux techniques | 12 mois |
  | Journal d'audit | 5 ans |

  La purge affiche ce qu'elle va effacer avant d'agir.
- **Consentement des mineurs** : par enfant, par un parent rattaché de façon vérifiée. Il est enregistré avec sa date, son auteur et sa révocation (`DataConsent`). Un refus ou un retrait d'un seul parent suffit, et l'élève ne consent pas seul. Le choix déjà fait sur le compte d'un parent est repris pour chacun de ses enfants.

### Commits

| Commit | Objet |
|---|---|
| `8f183b4` | fix(logs) **[N56]** : masquage central dans `lib/utils/logger` — emails, téléphones, clés de secret et d'identité, messages, contextes imbriqués, textes et piles d'erreurs |
| `6cf87d7` | fix(rgpd) **[N57]** : purge de conservation en **mois**, comptée depuis le départ de l'élève, avec aperçu ; une seule définition pour l'aperçu et la purge |
| `c298b03` | feat(rgpd) : durées par défaut — actives pour une nouvelle école, **inactives** pour les écoles existantes (une migration ne déclenche jamais d'effacement d'elle-même) |
| `74aac22` | fix(rgpd) **[N60]** : `/api/compliance/dashboard` réservé à l'administration (tout compte connecté y lisait les demandes RGPD, avec noms et emails) |
| `c29cbcc` | fix(rgpd) **[N59]** : la page Conformité affiche des indicateurs réels, plus ses valeurs de repli (85 %, 100 %) |
| `885d4bb` | feat(rgpd) : l'école **règle et active** ses durées de conservation (aperçu par le code de la purge, plancher OHADA, changement tracé) |
| `73d7daf` | feat(rgpd) : **modules par établissement** — navigation masquée ET API fermée (403 `MODULE_DISABLED`) |
| `f17f191` | feat(rgpd) : **consentement** horodaté et versionné, par enfant pour les mineurs ; taux de consentement enfin mesuré |
| `5682b72` | fix(rgpd) **[N61][N62]** : les trois droits des personnes réellement exerçables ; fin de l'anonymisation immédiate en un clic |
| `525cd2f` | feat(rgpd) : **traçabilité** centrale des notes, de la santé, des paiements et des rôles |
| `4293183` | feat(rgpd) : **sortie d'un établissement** — export, effacement, rapport de vérification |

### Minimisation — modules par établissement (`73d7daf`)

Un module éteint n'est pas seulement masqué : son API répond 403. Une école sans infirmerie ne détient aucune donnée de santé, même par appel direct à `/api/health/medical-records`.

- **Catalogue** : `src/lib/modules/catalog.ts`, sans dépendance. Comparaison par segments, pour que `health/medical-records` ne capture jamais `/api/health` (le contrôle de santé du serveur, H1).
- **Enforcement** une seule fois, dans `createApiHandler` (283 routes sur 285) ; état en cache TTL 30 s, comme le mode maintenance. Base indisponible ou valeur inconnue : rien n'est bloqué.
- **Navigation** : `requiresModule` sur les liens, `visibleNavGroups` filtre, palette de commandes filtrée par le chemin, `ModuleGuard` monté une fois dans la coque. Liste de modules inconnue = rien n'est masqué (défaut sûr).
- `/api/schools/context` — la seule route que **tous** les rôles appellent — porte désormais `enabledModules` et `offeredLevels`. `/api/schools/[id]` est réservé à l'administration : la navigation d'un enseignant ou d'un parent n'aurait rien pu filtrer.
- Écran `/dashboard/settings/modules`, mêmes composants que l'écran Cycles (règle 9).
- **Migration** : la colonne est créée avec **tout** le catalogue par défaut (les écoles existantes gardent leurs modules), puis le défaut est ramené au socle pour les écoles créées ensuite. Aucun `UPDATE`, rejouable sans effet.

**Extension du 2026-09-17 (décision du propriétaire : « ça doit être flexible »).** Les fonctions restées hors du périmètre initial deviennent elles aussi réglables : bibliothèque, récompenses et classements, orientation, événements et clubs, rendez-vous, documents et attestations, bien-être, comparaison entre établissements, notifications vocales et WhatsApp. **17 → 26 modules ; seuls « Élèves » et « Classes et matières » restent imposés** — sans eux l'application ne fonctionne pas.

Les écoles existantes les gardent actives (migration `20260917140000_school_modules_extended` : elles s'en servent peut-être déjà). Une nouvelle école ne reçoit toujours que le socle et active ce dont elle a besoin.

### Consentement (`f17f191`)

Avant, les consentements vivaient dans `user.preferences.consents` (JSON), sans date, sans version, sans lien avec l'enfant concerné — et rien n'était demandé à la première connexion.

- `DataConsent` porte `subjectUserId` (de qui parle le consentement) et `version`. Unicité `(userId, consentType, subjectUserId)` ; `subjectUserId` non nul, sinon `NULL ≠ NULL` laisserait passer des doublons.
- Écran de consentement rendu **à la place** du tableau de bord tant que ce n'est pas fait, et redemandé à chaque nouvelle version (`LEGAL_TERMS_VERSION`).
- Parent : il répond pour chacun de ses enfants rattachés ; son propre choix est repris par défaut pour chaque enfant et reste modifiable. Un refus ou un retrait d'un seul parent suffit ; l'élève ne consent jamais à sa propre place (403, et **rien n'est écrit**, pas même l'acceptation envoyée dans la même requête).
- Retour sur le choix depuis « Mes données ».
- Le **taux de consentement** de la page Conformité est enfin mesuré (part des comptes ayant accepté la version courante). N59 l'avait laissé à « non mesuré » plutôt que de l'inventer.

### Droits des personnes (`5682b72`) — deux défauts trouvés en les déroulant

| ID | Sévérité | Constat |
|---|---|---|
| **N61** | **Élevée** | `DELETE /api/user/data` anonymisait le compte **sur-le-champ**, alors que l'écran annonçait « votre demande a été enregistrée » et que le code portait le commentaire « in production, this should queue for manual review ». N'importe quel compte — un élève compris — effaçait ainsi en un clic ses notes, son dossier médical, ses sessions d'examen et son historique, sans retour possible et sans que l'établissement en soit informé |
| **N62** | Moyenne | Le traitement d'une demande ne savait faire que l'export : rectification et effacement recevaient « type de demande non supporté ». Ces deux droits ne pouvaient jamais être honorés |

Désormais : la demande d'effacement est **enregistrée** (202), l'administration la traite ; un élève encore inscrit n'est pas effacé (409 `STUDENT_STILL_ENROLLED`, demande laissée en attente) — le droit à l'effacement ne prime pas sur l'obligation de tenir le registre scolaire ; une rectification se clôt en décrivant la correction apportée, qui reste au dossier.

### Traçabilité (`525cd2f`)

Trace posée au **passage central**, donc aucune route ne peut l'oublier : modification réussie → `DATA_MODIFICATION`, consultation → `DATA_ACCESS` **dédupliquée sur 5 minutes** par personne et par chemin (sans quoi la revalidation automatique des écrans rendrait le journal illisible). Une requête refusée ne laisse aucune trace de modification. Zones : notes et bulletins, santé et bien-être, paiements, comptes et rôles. `AuditLog.schoolId` est enfin renseigné.

`auditLog.securityEvent` écrivait toujours l'action « SECURITY_EVENT » : une anonymisation, un verrouillage de compte et une alerte de connexion étaient indistinguables. L'action porte désormais le nom de l'événement.

### Fin de conservation — sortie d'un établissement (`4293183`)

`lib/security/school-offboarding` + `scripts/db/school-offboarding.ts` : export (JSON Lines, un fichier par table, par lots de 1 000), purge, **rapport de vérification** (lignes restantes par table, pour l'école et pour ses comptes). Les tables sont lues dans le schéma (`information_schema`), pas listées à la main. Export seul par défaut ; l'effacement exige `--purge --confirm <code de l'école>`.

**Déroulé en réel sur une base jetable** (port 5433, migrations, école + école voisine) : export de 4 tables, purge refusée sans confirmation, purge confirmée → `remaining: []`, école voisine et son compte intacts.

### Tests existants modifiés (règle 4)

- `tests/integration-db/helpers.ts` (`createSchool`) : une école de test a désormais tous ses modules, comme une école existante après migration. Ces suites portent sur la pagination, l'isolation et les contrats, pas sur la minimisation, qui a sa propre suite. Sans cela, 19 cas recevaient 403.
- `tests/integration-db/compliance-dashboard.test.ts` exigeait `consentRate: null` (« non mesuré tant que le consentement par enfant n'existe pas ») : il existe ; un second cas prouve que le taux suit les acceptations réelles.
- `tests/api/compliance-dashboard.test.ts` : double de `prisma.dataConsent.count` ajouté pour la nouvelle lecture, avec vérification que ce comptage est lui aussi cloisonné à l'école.
- `tests/api/system-retention.test.ts`, `tests/lib/rgpd.test.ts` : voir `6cf87d7`.
- `prisma/seeds` et `e2e/global-setup` : les comptes de démonstration et les comptes E2E dédiés ont leurs conditions déjà acceptées et tous leurs modules actifs, sinon chaque scénario s'arrêterait sur l'écran de consentement ou recevrait 403. Un compte réellement neuf voit bien l'écran (E2E `fresh-install`).

### Batterie du Lot 6 (2026-09-17)

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | vert |
| `eslint src` | vert |
| `vitest run` | **2 907 / 2 907** (279 fichiers) |
| `vitest --config vitest.integration.config.ts` (PostgreSQL réel) | **313 / 313** (49 fichiers) |
| `npm run build` | vert |
| E2E `playwright test` (base seedée, rôle applicatif, build de production) | **89 / 89** |
| E2E démarrage à vide (`playwright.fresh.config.ts`, base neuve `edupilot_fresh_lot6`) | **2 / 2** (12,3 min) |

Deux défauts trouvés **par** cette batterie, corrigés :
- Le tableau de bord d'un **parent** répondait **500**. La lecture du consentement dans le `layout` serveur passe par `student_profiles`, table fermée par la sécurité par ligne (M2) : sans contexte déclaré, Prisma échouait sur la relation masquée. C'est exactement le piège consigné au Lot 4 — la première occurrence hors `createApiHandler`.
- Le parent E2E dédié a un enfant rattaché : sans réponse pour lui, l'écran de consentement remplaçait le tableau de bord dans les 5 scénarios `parent-flow`. `e2e/global-setup` répond pour lui ; le parcours réel « nouvel enfant rattaché → le parent répond » est couvert par `fresh-install`.

### Points ouverts du Lot 6

1. ~~Modules hors décision~~ — **tranché le 2026-09-17** : tout est réglable (voir l'extension ci-dessus).
2. **Version des documents légaux** : `LEGAL_TERMS_VERSION = "2026-09-17"`. Les textes de `/terms` et `/privacy` sont ceux du dépôt ; leur rédaction juridique reste hors périmètre (votre liste « hors périmètre »).
3. **Coût de la traçabilité** : une écriture supplémentaire par requête sensible (modification, ou consultation une fois par 5 min et par chemin). À re-mesurer au Lot 9 avec les seuils de latence du Lot 3.

---

## Lot 7 — Outils d'exploitation (terminé le 2026-09-17 ; en attente du feu vert)

### Commits

| Commit | Objet |
|---|---|
| `22cefef` | fix(security) **[L1][L2][L5]** : `X-XSS-Protection` retiré, CSP des styles, `/api/system/backup` sans chemin ni `stdout` |
| `2490be1` | feat(ops) : arrêt propre sur SIGTERM (préchargement `graceful-shutdown.cjs`, `/api/health` 503 `shutting_down`) |
| `6b2b991` | feat(ops) : sauvegarde chiffrée (AES-256, manifeste avec lignes par table, rotation avec plancher) et restauration prouvée par recomptage |
| `f2c78fe` | feat(ops) : tâches planifiées sans Vercel Cron (`scripts/cron/run-task.sh`, `/etc/cron.d`, `GET /api/system/retention` = aperçu) |
| `871e686` | fix(config) **[M6]** : `BACKUP_DIR` et les variables de sauvegarde documentées (régression de `6b2b991`) |
| `233d633` | feat(payments) : parcours FedaPay éprouvé en bac à sable ; argent réel refusé sans `PAYMENTS_LIVE_ENABLED` |
| `8fa0b5f` | feat(ops) **[N68]** : identifiant de requête dans la réponse **et dans chaque ligne de journal** |
| `de01b15` | feat(ops) **[N70]** : mémoire, disque et dernière sauvegarde sur l'écran d'exploitation |
| `ba40b0b` | fix(rgpd) **[N69]** : Sentry prouvé inactif sans DSN ; `setUserContext` n'exporte plus l'adresse électronique |
| `96c3986` | fix(build) **[N64]** : **l'instrumentation ne s'exécutait pas du tout en production** |
| `5808189` | fix(docker) **[N65]** : **l'image ne pouvait pas se construire** ; migrations appliquées au démarrage |
| `877ec17` | fix(docker) **[N66]** : PostgreSQL, Redis et n8n ne sont plus publiés sur le réseau de l'établissement |
| `9f3f482` | fix(logs) **[N67]** : l'absence de Redis n'est plus signalée à chaque requête |
| `8900716` | docs(ops) : `docs/EXPLOITATION.md` |

### Défauts trouvés **en exécutant** (règle 14)

Ces quatre défauts n'étaient visibles qu'en lançant réellement le serveur de
production. Aucun test unitaire ne pouvait les révéler.

| ID | Sév. | Constat | Preuve avant | Traitement |
|---|---|---|---|---|
| **N64** | **Critique** | `.next/standalone/.next/server/instrumentation.js` **absent** de la sortie standalone : en production (image Docker, `node server.js`), `register()` n'était jamais appelé. Donc **aucune** validation d'environnement au démarrage, **aucune** garde RLS (M2), pas d'init Sentry, pas de préchauffage, et **pas de fermeture de Prisma ni de Redis à l'arrêt** — la promesse du commit `2490be1` | Journal du serveur standalone : « Arrêt terminé … **tasks: 0** » | `96c3986` — recopie par fermeture transitive (`scripts/build/copy-instrumentation.mjs`, branché sur `npm run build`) + `instrumentation.ts` durci : fermetures enregistrées en premier, Sentry chargé en dernier, seulement avec DSN, échec sans conséquence. Après : « tasks: **2**, failedTasks: 0 » et « Cache warming completed » |
| **N65** | **Élevée** | `docker build` **échouait** : `.dockerignore` exclut `scripts`, que le Dockerfile copie (préchargements H3 et arrêt propre). L'image n'avait pas été construite depuis le Lot 1 | Lecture croisée `.dockerignore` / `Dockerfile` | `5808189` — exception `!scripts/server` ; entrypoint qui migre puis `exec` le serveur |
| **N66** | **Élevée** | `docker-compose.yml` publiait PostgreSQL, Redis et n8n sur **toutes** les interfaces : depuis le Wi-Fi de l'établissement, connexion directe à la base (notes, santé, paiements) sans passer par l'application ni par la RLS | `docker compose config` : `published: 5432/6379/5678` sans `host_ip` | `877ec17` — `127.0.0.1` seulement ; port hôte PostgreSQL 5433 (conflit avec un PostgreSQL déjà installé) |
| **N67** | Faible | « Redis non configuré » écrit à **chaque requête** : 3 lignes identiques en 300 ms dans le journal de production | `.quality-tmp/server-lot7*.log` | `9f3f482` — une fois par processus |

Trois autres défauts trouvés en écrivant les tests du lot :

| ID | Sév. | Constat | Traitement |
|---|---|---|---|
| **N68** | Moyenne | `catch` final de `createApiHandler` : `console.error("[API Error]", { path: request.url })` — l'URL **brute**, chaîne de requête comprise (email, matricule), hors de l'expurgation du Lot 6 | `8fa0b5f` — `logger.error`, chemin seul. Test : `?email=parent@exemple.fr` n'apparaît plus |
| **N69** | Moyenne | `setUserContext` transmettait l'adresse électronique de la personne à Sentry (service tiers). Fonction non appelée aujourd'hui, mais prête à l'être | `ba40b0b` — identifiant interne et rôle seulement |
| **N70** | Faible | `errors.last24h` de l'écran Monitoring valait la longueur d'une liste plafonnée par son `take: 50` : au-delà, l'écran affichait « 50 » indéfiniment — précisément quand le chiffre compte | `de01b15` — `count` |

### Image de production — ce qui est prouvé et ce qui ne l'est pas

**Docker n'a pas pu être utilisé** : démon `inactive`, `sudo` avec mot de passe.
L'image n'a été **ni construite ni lancée**.

Ce qui **a** été prouvé, en reproduisant hors conteneur exactement la chaîne que
le conteneur exécute (`sh docker-entrypoint.sh`, base jetable port 5433, rôle
applicatif `edupilot_app`, build de production) :

- l'entrypoint applique les migrations : **5 migrations en attente appliquées** ;
- le serveur standalone démarre avec les deux préchargements ;
- `GET /api/health` → **200** (375 ms), en-tête `x-request-id` présent ;
- `SIGTERM` → « plus aucune nouvelle connexion », « Client Redis fermé »,
  « Connexions PostgreSQL fermées », « Arrêt terminé … tasks: 2, failedTasks: 0 »,
  port libéré ;
- journaux JSON avec `requestId` par requête, et **sans** `requestId` hors requête.

Ce qui reste **non vérifié** : la construction de l'image, le `HEALTHCHECK`,
l'utilisateur non-root, et le démarrage de la pile `docker compose`. Procédure
exacte à rejouer : `docs/EXPLOITATION.md` §10.

### Tâches planifiées — vérification à l'exécution

| Commande | Résultat |
|---|---|
| `run-task.sh retention --dry` | **200**, aperçu de toutes les écoles, `totalAffected: 0`, **aucune écriture** |
| `run-task.sh automation` | **202** `{"accepted":true}` |
| `run-task.sh automation` pendant l'exécution | **409** traité comme un succès, code de sortie **0** |
| `CRON_SECRET` invalide | **401**, le script sort en erreur |

### Paiements (règle 11)

Aucun paiement en argent réel n'a été activé ni tenté. Le parcours FedaPay est
prouvé **en bac à sable** sur vraie base : initiation → webhook **signé** →
VERIFIED ; rejeu → 0 rapprochement, `paidAt` et `updatedAt` inchangés ;
signature forgée → 401, paiement resté PENDING ; `transaction.canceled` →
CANCELLED. Le garde-fou `PAYMENTS_LIVE_ENABLED` refuse en 503 toute
configuration de production **avant** appel au fournisseur — le test montrait
qu'avant, l'appel partait pour de bon (502 du fournisseur).

### Limitation connue, assumée

Avec l'image (sortie standalone), fournir un DSN Sentry **ne suffira pas** :
ses modules OpenTelemetry (`require-in-the-middle`) ne sont pas embarqués. Le
serveur démarre et le signale dans le journal ; la surveillance reste
indisponible dans ce mode. Pour utiliser Sentry : `npm run start`. Documenté
dans `docs/EXPLOITATION.md` §10. Sans DSN — le cas de cette installation — le
module n'est même pas chargé.

### Points ouverts du Lot 7

1. **Deux générations de scripts de sauvegarde coexistent** : `postgres-backup.sh`
   / `postgres-restore.sh` (chiffrés, Lot 7) et `backup.sh` / `restore.sh` /
   `setup-cron.sh` / `crontab.example` (anciens, **non chiffrés**). Les anciens
   ne sont référencés nulle part. Leur suppression sort du code applicatif :
   **votre décision** (règle 11). En attendant, `docs/EXPLOITATION.md` ne
   documente que les nouveaux.
2. **Sentry en sortie standalone** : voir ci-dessus.
3. `setUserContext` garde un paramètre `_email` ignoré, pour ne toucher à aucun
   appelant — à retirer avec le code mort (L3, Lot 8).

---

## Registre des défauts

Statuts : **Confirmé** (rejoué au Lot 0) · **Constat audit** (non rejoué, preuve dans `docs/AUDIT.md`) · **En cours** · **Corrigé** (avec preuve) · **Accepté** (décision du propriétaire) · **Reporté**.

| ID | Sév. | Intitulé | Lot | Statut | Commit | Test de preuve | Avant | Après |
|---|---|---|---|---|---|---|---|---|
| C1 | Critique | Migrations Prisma non versionnées + dérive `offeredLevels` | 1 | Corrigé | `f4c709e` | `tests/integration-db/migrations.test.ts` (PG réel) ; CI `integration-tests` (`migrate deploy` + `migrate diff --exit-code`) ; baseline testée sur base `db push` ; clone neuf | P2021 table users absente ; 0 migration suivie ; dérive `offeredLevels` | clone neuf (`npm ci` 46 s, build, 34 migrations, **sans seed**) : `/login` 200, `/setup` 200, `/api/setup` `{"setupNeeded":true}`, 0 utilisateur ; diff = 0 |
| C2 | Critique | Next.js 16.3.1 (RCE Image Optimization AVIF) | 1 | Corrigé | `0fd0302` | `npm audit --omit=dev --audit-level=high` → code 0 | 1 critique (next 16.3.1) | next 16.3.5 ; 0 vulnérabilité prod |
| C3 | Critique | Endpoints non paginés (évaluations, statistiques, schedules, fees, health, scholarships, analytics) + N1 | 3 | Corrigé | `0356461` `20d56d1` `9ae0515` `6965078` `083f228` `7364584` `e6e7725` `8ed0a34` `93f633f` `b62db28` | smoke seuils 1 Mo/1 s, latency, Lighthouse, RSS | 35 violations ; 100 Mo ; 8,7 Go | smoke final 7 rôles : 0 réponse > 500 ms ou > 500 Ko ; `analytics/dashboard` p95 251 / 208 ms ; page Notes 687 Ko ; RSS 395 Mo |
| H1 | Élevée | `/api/health` non public → healthcheck Docker en échec | 2 | Corrigé (conteneur `healthy` à vérifier au Lot 7) | `c749ec8` | `tests/lib/proxy-public-routes.test.ts` (10) ; `security.mjs health` sur build de prod | 401 | 200 `{"status":"ok"}` ; `/api/health/*` toujours 401 sans session |
| H2 | Élevée | Crons bloqués (middleware + N2) | 2 | Corrigé (accès) — durée du traitement : voir N8 | `c749ec8` | `proxy-public-routes.test.ts`, `cron-auth.test.ts` (4), `system-retention.test.ts` ; `security.mjs cron` | 401 ×4 (middleware) | secret invalide → 401 de la route elle-même ; secret valide → traitement lancé (maintenance > 300 s, N8) |
| H3 | Élevée | Rate-limit contournable via XFF | 1 | Corrigé | `3192078` | `tests/lib/security/client-ip*.test.ts` (14), `tests/lib/proxy-rate-limit.test.ts` ; `security.mjs xff` sur build de prod | 130×200, 0×429 | `{"200":93,"429":37}` |
| H4 | Élevée | Pas de limite IP sur `/api/auth/callback/credentials` | 1 | Corrigé (échecs seulement — voir Lot 1) | `e2b1751` | `tests/api/auth-login-rate-limit.test.ts` (5) ; `security.mjs bruteforce` sur build de prod | 12×302, 0×429 | `{"302":10,"429":2}` ; 30 succès même IP : 0×429 |
| H5 | Élevée | IDOR `subjects/categories/[id]` (+ N3) | 1 | Corrigé | `563ccb6` | `tests/integration-db/subject-categories-isolation.test.ts` (7, PG réel) ; `security.mjs idor` | GET/PATCH/DELETE 200 (persisté) | 404/404/404, rien persisté |
| H6 | Élevée | Redis injoignable : +4,3 s par requête | 2 | Corrigé | `1fe4a19` | `tests/lib/redis/circuit.test.ts` (5), `tests/lib/redis/outage.test.ts` (3, vrai port fermé) ; `redis-outage.mjs` sur build de prod | `/api/auth/csrf` p50 4 319 / p95 4 360 ms | 10×200, p50 14 / p95 24 ms ; `/api/health` 14–97 ms |
| M1 | Moyenne | `mustChangePassword` jamais imposé | 4 | Corrigé (E2E du premier login forcé : Lot 5) | `6fbd7e2` `89080bd` | `must-change-password-gate.test.ts` (8), `use-first-login.test.tsx` (6), intégration PG `first-login-session` (3), `first-login-token` (1), `provisional-passwords` (9), `provisional-passwords-root` (2) | indicateur lu nulle part ; imports : un secret par lot, communiqué à personne | session confinée à `/first-login` (API 403 `PASSWORD_CHANGE_REQUIRED`) ; mot de passe provisoire unique par compte, renvoyé une fois ; indicateur levé et session invalidée au changement |
| M2 | Moyenne | RLS inerte | 4 | Corrigé — option (a), fermée par défaut, 11 tables sensibles | `aa074b9` `005be2d` | `tests/integration-db/rls-effective.test.ts` (13, PG réel : 11 tables en lecture, écriture, transactions, annulation, pool) ; toute la suite d'intégration sur le rôle applicatif (230/230) ; démarrage refusé sur superutilisateur | 3 tables, contexte posé dans 2 routes, rôle qui contourne les politiques | 11 tables sous `FORCE` ; contexte sur 283/285 routes + contextes système déclarés ; latences : voir « Mesures RLS » (Lot 4) |
| M3 | Moyenne | JSON invalide / ZodError → 500 | 2 | Corrigé | `6cd4595` | `tests/lib/api/api-handler-body.test.ts` (7) ; `tests/integration-db/api-body-validation.test.ts` (3, PG réel) ; `security.mjs json` | `{}` → 500, `{bad` → 500 ; corps de 5 Mo lu en entier | 400 `VALIDATION_ERROR` / 400 `INVALID_JSON` ; > 1 Mo → 413 ; rien écrit |
| M4 | Moyenne | Croissance mémoire (aggravée : N1) | 3 | Corrigé | `0356461` (N1) `2a24ac2` (N28) | RSS relevée pendant la batterie du Lot 3 | 8 746 Mo | 395 Mo après smoke 7 rôles + latences + Lighthouse |
| M5 | Moyenne | 163/231 `findMany` sans `take` | 3 | Corrigé — revue faite, N+1 corrigés, les 6 occurrences non bornées traitées ; `alumni` reporté (N14) | `618933d` `0d3a609` `82baca8` `d926558` `9eb7657` `8d2c446` `b62db28` `6911d97` | revue + plafond helper | 163 | voir « Revue M5 » (Lot 3) |
| M6 | Moyenne | `.env.example` incohérent (18 variables, Upstash, `AUTH_TRUST_HOST`) | 2 | Corrigé (statut Upstash : décision en attente, voir Lot 2) | `2851521` | `tests/lib/config/env-documentation.test.ts` (2), `tests/lib/env-production.test.ts` (4) | 18 lues non documentées, 3 documentées jamais lues ; `EMAIL_API_KEY` exigée même en SMTP | 0 / 0 ; `SMTP_HOST` exigé en SMTP, `EMAIL_API_KEY` hors SMTP |
| M7 | Moyenne | Dépendances vulnérables (nodemailer, sharp) | 1 | Corrigé (prod) | `0fd0302` | `npm audit --omit=dev --audit-level=high` | 4 prod, 15 total | 0 prod ; 8 total, outils de dev uniquement (correctif = majeure/`--force`) |
| M8 | Moyenne | 3 E2E en échec | 5 | Corrigé | `90930dd` (a11y `/ecoles`, `/dashboard/grades` enseignant) ; `grades-flow` vert depuis le Lot 4 | `npm run test:e2e` (build de prod, base d'audit, rôle applicatif) | 78/81 | 89/89 |
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
| N1 | Critique | Épuisement mémoire (voir ci-dessus) | 3 | Corrigé | `0356461` `2a24ac2` | RSS (batterie du Lot 3) | 8 746 Mo | 395 Mo après smoke 7 rôles + latences + Lighthouse |
| N2 | Élevée | Retention : `requireAuth` par défaut + comparaison non constante | 2 | Corrigé | `c749ec8` | `system-retention.test.ts` (+2), `cron-auth.test.ts` (4) | 401 avec secret valide ; comparaison `===` | cron sans session → 200 ; `timingSafeEqual` ; SUPER_ADMIN pré-2FA refusé |
| N3 | Élevée | Désactivation inter-école via DELETE | 1 | Corrigé | `563ccb6` | `subject-categories-isolation.test.ts` (N3) ; `security.mjs idor` | 200, `isActive=false` | 404, catégorie toujours active |
| N4 | Moyenne | `e2e/global-setup.ts` code en dur les identifiants d'écoles et de classe d'un seed précis (`E2E_SCHOOLS`) : sur une base reseedée, `security-tenant` peut passer sans rien prouver (ressource inexistante) | 5 | Corrigé | `cc8e1ea` | `security-tenant` lit `e2e/.auth/fixtures.json` écrit par `global-setup` ; suite complète 89/89 | identifiants d'un seed précis codés en dur | identifiants réels lus en base |
| N5 | Élevée | `lib/config/env-validation.ts` lève à l'import (y compris pendant `next build`) et ignore `SKIP_ENV_VALIDATION` : build d'un clone neuf sans `.env` en échec, **et étape de build du Dockerfile impossible** (aucun secret) | 2 | Corrigé (fusion des 2 modules : Lot 8, L3) | `828a6f8` | `tests/lib/config/env-validation.test.ts` (3) | build KO sans `.env` | build sans secret OK ; démarrage sans secret toujours refusé |
| N6 | Faible | `nodemailer` 9 hors de la plage peer de `next-auth` (`^7 \|\| ^8`) — préexistant (9.0.5), masqué par `legacy-peer-deps` | 8 | Constat Lot 1 | — | vérification de l'envoi d'email (Lot 5/7) | — | — |
| N9 | Élevée (données personnelles) | `GET /api/evaluations` ne filtre que par école ; seul TEACHER est restreint à ses matières. Un PARENT ou un STUDENT reçoit toutes les évaluations de l'établissement **avec les notes et les noms de tous les élèves** (notes de mineurs exposées à d'autres familles) | 3 (avec C3, même route) | Corrigé | `0356461` `811016c` | test d'intégration par rôle (parent : ses enfants seulement) | lecture `src/app/api/evaluations/route.ts:24-32,79-105` [LU] | `evaluations-list.test.ts` (10, PG réel) : parent → ses enfants, élève → lui-même |
| N10 | Élevée (données personnelles) | `GET /api/grades/statistics` : périmètre et classement nominatif non restreints par rôle (noms et moyennes d'élèves exposés au-delà de l'équipe concernée) ; calcul en mémoire sur toutes les notes | 3 | Corrigé | `20d56d1` | `grade-statistics.test.ts` (8, PG réel) | timeout 20 s (Lot 0) | classement réservé aux rôles autorisés et à l'enseignant de la classe ; agrégation SQL |
| N8 | Élevée | Maintenance quotidienne (`runDailyMaintenance`) exécutée de façon synchrone dans la requête du cron : recalcul séquentiel de ~3 000 instantanés d'analyse (élève × période), CPU du serveur 100–126 % pendant toute la durée (l'application ralentit pour tous) ; **aucune exclusion mutuelle** : un planificateur qui réessaie après expiration lance une 2e exécution concurrente (observé : 2 exécutions simultanées) | 3 (analytics) / 7 (crons) | Corrigé | `ab8aa4c` `761d460` | `tests/integration-db/job-lease.test.ts` (PG réel : 1 détenteur sur 5 acquisitions simultanées, reprise d'un bail expiré) ; `concurrency.test.ts` ; `automation-service.test.ts` ; route : 202 puis 409 pendant l'exécution | 1re exécution 11 min 49 s, 2e exécution HTTP 200 en 733 s, pour 2 982 instantanés chacune (exécutions simultanées + suite E2E en parallèle) ; client expiré à 300 s | réponse 202 immédiate ; exécution concurrente refusée (409) ; 277,4 s au lieu de 616,7 s (A/B) |
| N11 | Moyenne | `/api/analytics/school/overview` compte une moyenne générale **nulle** comme 0 (moyenne de l'établissement et taux d'échec), alors que le tableau de bord l'exclut : les deux écrans affichent des chiffres différents pour les mêmes données | Suivi | Constat Lot 3 — **conservé** (réponse identique exigée par l'optimisation) | — | `analytics-school-overview.test.ts` (élève sans moyenne : 9,17 au lieu de 11) | — | — |
| N12 | Faible | `src/lib/services/analytics/helpers.ts` duplique les builders de `analytics-dashboard/` et n'est importé nulle part (code mort) | Suivi | Constat Lot 3 | — | `grep` des imports | — | — |
| N13 | Moyenne | RSS du serveur 221 → 457 Mo après 90 requêtes analytiques séquentielles (plafond du Lot 3 : 500 Mo) | 3 | Corrigé (cause : N28) | `2a24ac2` | `latency.mjs` + `/proc/<pid>/status` | 457 Mo ; 545 Mo avant N28 | 395 Mo |
| N14 | Faible | Liste `GET /api/alumni` non bornée ; la page calcule ses répartitions sur la liste entière côté navigateur | Suivi | Constat Lot 3 — reporté (refonte d'écran nécessaire) | — | — | — | — |
| N7 | Élevée | `payments/initiate` écrasait la référence de rapprochement (« PAY-… ») par l'identifiant du fournisseur ; les webhooks MoMo et FedaPay rapprochent par notre référence : paiements Mobile Money encaissés mais jamais rapprochés (restent PENDING), sans aucune panne | 2 | Corrigé | `8a34de6` | `tests/integration-db/payment-momo-flow.test.ts` (3, PG réel, fournisseur simulé) | PENDING après webhook signé | VERIFIED ; rejeu sans effet ; signature forgée → 401 |
| N15 | Moyenne | `GET /api/root/analytics` → 500 pour le SUPER_ADMIN : `DATE()` renvoie un objet `Date` que le code trie avec `localeCompare` (`TypeError`) ; la page d'analyse de la console root est inutilisable | Suivi | Constat Lot 3 — non corrigé (règle 10 : sévérité moyenne, hors données personnelles) | — | smoke SUPER_ADMIN | 500 | — |
| N16 | Moyenne | 8 routes lisaient la pagination par `parseInt` sans plafond (`?limit=100000` → liste entière en mémoire, famille N1) ; `?page=abc` → `take: NaN` → 500. **Son premier correctif a tronqué 3 écrans** (plafond uniforme de 100) | 3 | Corrigé | `51bbf26` `ba9b24a` | `tests/integration-db/list-limit-cap.test.ts` (PG réel, 19 cas) | liste entière ; 500 sur saisie invalide ; puis journal 500 → 100, rendez-vous et incidents 200 → 100 | plafond de chaque route au niveau demandé par son écran (100 / 200 / 500) ; valeurs par défaut sur saisie invalide |
| N17 | Élevée | `e2e/global-setup.ts` réinitialise mot de passe, verrouillage et 2FA de 8 comptes dans la base désignée par le `DATABASE_URL` du `.env` — la base locale du développeur (5432) si l'E2E est lancé sans surcharge — sans aucun garde-fou (règles 5 et 6) | 5 (comptes E2E dédiés + marqueur d'environnement) | Corrigé | `9a811aa`, `cc8e1ea` | `tests/integration-db/disposable-guard.test.ts` (4, PG réel) ; seed et `reset-passwords` refusés sur base non marquée (exécution réelle) ; empreinte des 8 comptes de démonstration identique avant et après la suite E2E complète (3 passages) | aucun garde-fou ; comptes de démonstration réécrits | base non marquée refusée par les 16 scripts d'écriture et `e2e/global-setup.ts` ; E2E sur comptes dédiés |
| N18 | Élevée | 5 écrans lisaient la clé `students` alors que `/api/students` renvoie `{ data, pagination }` (antérieur à la remédiation) : appel, déclaration d'incident, recherche d'élève du paiement, médical et documents affichaient une liste vide | 3 | Corrigé | `3f8913c` | `e2e/student-lists.spec.ts` (5) ; `tests/lib/student-list.test.ts` (4) | 5 E2E rouges sur le build d'avant le correctif | 5 verts |
| N19 | Élevée | `/api/students?classId=…` plafonné à 100 : appel, saisie de notes, bulletins et promotion perdaient sans erreur les élèves au-delà du 100e d'une classe (effectifs courants dans le public au Bénin) | 3 | Corrigé | `a812b42` | `tests/integration-db/class-roster.test.ts` (2, PG réel) | classe de 120 : 100 renvoyés | 120 renvoyés ; listes de l'établissement toujours plafonnées à 100 |
| N20 | Moyenne | Sélecteurs d'élèves à l'échelle de l'établissement tronqués sans indication (antérieur) : documents (20 premiers), médical (100), déclaration d'incident et tableau des risques (200 demandés → 100), gamification et orientation (100). Correction propre : recherche côté serveur dans les sélecteurs (changement d'interface, design gelé) | Suivi — décision du propriétaire | Constat Lot 3 | — | — | — | — |
| N21 | Faible | Recherche d'élève du paiement et écran médical : la classe s'affiche « Aucune classe » (les écrans lisent `class`, l'API fournit `enrollments`) | Suivi | Constat Lot 3 | — | — | — | — |
| N23 | Élevée | Écran des cours (LMS) : lisait `data.courses` alors que `/api/courses` renvoie `{ data, pagination }` (antérieur) — liste des cours toujours vide | 3 | Corrigé | `967ae3d` | lecture du code + `list-cursor-school-life.test.ts` (format de la route) ; E2E de l'écran à ajouter au Lot 5 | liste vide | lit `data` |
| N24 | Moyenne | `GET /api/announcements` : le filtre d'expiration (`where.OR`, l. 124) est écrasé par le filtre de rôles (`where.OR`, l. 132) — les annonces expirées restent affichées | Suivi | Constat Lot 3 — non corrigé (règle 10) | — | lecture du code | — | — |
| N25 | Élevée | `/api/classes` renvoie `{ data, pagination }` (antérieur) ; nouvel emploi du temps (lisait `classes` : sélecteur vide, aucun créneau créable), matières par classe (réponse traitée comme un tableau : section vide, affectation impossible), fiche « Nouvelle évaluation » (`.map` sur un objet), import (noms de classe jamais vérifiés) | 3 | Corrigé | `9baafd0` | `e2e/class-lists.spec.ts` (3) ; `tests/lib/list-payload.test.ts` (2) | 3 E2E rouges sur le build d'avant le correctif | voir batterie du Lot 3 |
| N26 | Élevée | Page Notes : ouvrir « Nouvelle évaluation » fait planter le module (« Erreur dans le module Notes ») — dans `EvaluationSheet`, le sélecteur de classe (état local) utilise `FormLabel`/`FormControl` hors de tout `<FormField>` (`useFormField should be used within <FormField>`). Antérieur : aucune évaluation créable depuis la page Notes | 3 | Corrigé | `09d4187` | `tests/components/evaluation-sheet.test.tsx` (rouge avant : « useFormField should be used within <FormField> », vert après) ; `e2e/class-lists.spec.ts` (fiche) | plantage à l'ouverture (sonde navigateur : `pageerror`, écran d'erreur du module) | fiche ouverte sans erreur (E2E : voir batterie du Lot 3) |
| N27 | Moyenne | La CSP contient `upgrade-insecure-requests` (`src/proxy.ts:36`) : servie en HTTP simple (réseau local sans TLS), le navigateur réécrit les sous-ressources en HTTPS et elles échouent (`ERR_SSL_PROTOCOL_ERROR` observé sur le serveur de mesure). HTTPS est hors périmètre (propriétaire), mais une installation HTTP seule est cassée sans avertissement | 7 (documentation d'exploitation ; éventuelle directive conditionnelle) | Constat Lot 3 | — | console navigateur (sonde) | — | — |
| N28 | Élevée | Le cache mémoire (`MemoryCache`, `lib/cache/redis.ts`) — **cache de production** (instance unique sans Upstash, décision du propriétaire) — est une `Map` sans borne ; une entrée expirée n'est retirée qu'à la relecture de la même clé. Les clés portent l'URL, ses paramètres (curseur, recherche) et l'utilisateur, les valeurs la réponse entière : la mémoire du serveur croît jusqu'au redémarrage (famille M4/N1) | 3 | Corrigé | `2a24ac2` | `tests/lib/cache/memory-cache.test.ts` (6 ; rouge avant : classe non bornée, non exportée) | RSS 338 → 545 Mo après la série de mesures (critère < 500 Mo) | 5 000 entrées / 64 Mo max, LRU, purge des expirées à l'écriture (toutes les 60 s) ; RSS 395 Mo en fin de batterie |
| N29 | Élevée (données personnelles) | `withCache` (`lib/api/cache-helpers.ts`, 14 routes : notes, paiements, messages, statistiques…) renvoie `Cache-Control: public, max-age=…` sur des réponses propres à un utilisateur ou à une école : un proxy ou cache partagé du réseau d'établissement peut les stocker et les resservir à un autre utilisateur | 3 | Corrigé | `2da4d02` | `tests/lib/api/cache-helpers-privacy.test.ts` (2, rouges avant) | `public, max-age=60` (MISS et HIT) | `private, max-age=60` |
| N30 | Faible | `getUpstashClient()` journalise « Redis non configuré — cache désactivé » en `warn` à **chaque** appel en production (des dizaines de lignes par seconde dans `server.log`), et le message est faux : le cache mémoire est actif (mode de production retenu) | 7 (journaux) | Constat Lot 3 | — | `.quality-tmp/server.log` | — | — |
| N31 | Élevée (comptes, dont mineurs) | Mot de passe standard « 00000000 » : `DEFAULT_PASSWORD` des routes élève/enseignant quand aucun mot de passe n'est fourni ; écrans « Ajouter un enseignant », « Nouvel utilisateur », « Nouvelle inscription » qui envoyaient « 00000000 » (refusé par la validation forte : **création impossible depuis ces écrans**) et l'affichaient comme identifiant ; console root pré-remplie à « 00000000 » pour l'admin d'une nouvelle école. Sans M1, un compte à mot de passe connu restait ouvert indéfiniment | 4 | Corrigé | `89080bd` | `provisional-passwords.test.ts` (9, PG réel), `provisional-passwords-root.test.ts` (2, PG réel), `use-create-account.test.tsx` (5), `inscription-submit.test.ts` (3), `credentials-export.test.ts` (3) | création sans mot de passe → 400 ; mot de passe choisi par l'admin jamais à changer | mot de passe provisoire unique généré et affiché une fois ; changement exigé pour tout compte créé par un tiers ; plus aucune occurrence de « 00000000 » dans `src/` |
| N32 | Élevée | IDOR : `DELETE /api/courses/[id]` ne vérifiait que le rôle TEACHER, pas l'établissement. L'admin de n'importe quelle école supprimait le cours d'une autre, **et en cascade ses modules et leçons** | 4 | Corrigé | `36fecda` | `tenant-isolation-sweep.test.ts` (PG réel) | 200, cours et contenu supprimés | 403, cours intact |
| N33 | Faible | `POST /api/classes/[id]/promote` sur une classe ou une année d'une autre école : refus en **400** (« introuvable dans votre établissement ») au lieu de 404 | 4 | Corrigé | `e983006` | `tenant-isolation-sweep.test.ts` | 400 | 404, classe intacte |
| N34 | Faible | Démarrage de production refusé (garde RLS, comme la garde H3 de `validateEnv`) : l'erreur est levée dans le hook d'instrumentation, Next affiche « Failed to prepare server », mais le processus **ne se termine pas** (aucune requête servie, HTTP 000). Un superviseur ne voit pas d'échec ; seule la sonde de santé le révèle | 7 (arrêt propre, supervision) | Constat Lot 4 | — | `.quality-tmp/guard-superuser.log` (processus vivant après 60 s) | — | — |
| N35 | Faible | Outil `scripts/quality/security.mjs` : attendait 200 pour la maintenance, alors que N8 (Lot 3) la rend asynchrone (202) ; la rafale H3, placée avant H4, épuisait le budget de l'adresse et H4 ne mesurait plus rien (`csrf-429` ×12) | 4 | Corrigé (outil) | commit de clôture du Lot 4 | H4 seul : `{"302":10,"429":2}` | 11/13 PASS | voir journal |
| N36 | Élevée | Console root : `requireRoot` exigeait l'appartenance à `ROOT_USER_EMAILS` (vide sur une installation neuve) — le super-admin créé par `/setup` ne pouvait déployer aucune école ; comparaison sensible à la casse | 5 | Corrigé | `388ccae` | `tests/lib/security/root-access-fresh-install.test.ts` (5, 2 rouges avant) ; E2E démarrage à vide (étape 2) | 403 « Accès root refusé » | école déployée depuis la console |
| N37 | Élevée | Aucun compte parent créable depuis l'interface (rôle absent de « Nouvel utilisateur », inscription publique désactivée) ; `POST /api/users` ne créait pas le profil parent → `link-child` 404 | 5 | Corrigé | `7117bb0` | `tests/integration-db/parent-account-link.test.ts` (2, PG réel, rouges avant) ; E2E (étapes 12, 15) | profil absent, rattachement 404 | parent créé, enfant rattaché, note lue |
| N38 | Moyenne | Écran des périodes : accents écrits en séquences d'échappement dans le JSX, affichés tels quels (bouton de création illisible) | 5 | Corrigé | `b8c6a88` | `tests/lib/ui/jsx-unicode-escapes.test.ts` (rouge avant : 15 lignes) ; E2E (étape 5) | libellés illisibles | libellés corrects ; plus aucune occurrence dans `src/` |
| N39 | Élevée | Écran des niveaux : cycles `MIDDLE`/`HIGH`/`UNIVERSITY` refusés par l'API (400) — aucun niveau de collège ou de lycée créable | 5 | Corrigé | `e6afa61` | E2E (étape 6, rouge avant : 400 « Invalid option ») | 400 | niveau créé |
| N40 | Élevée | « Créer une classe » plantait au chargement (`<SelectItem value="">`, Radix 2.2.6) — aucune classe créable depuis l'interface | 5 | Corrigé | `df0bd5c` | E2E (étape 9, rouge avant : erreur de rendu) | écran d'erreur | classe créée avec professeur principal |
| N41 | Élevée | `first-login` : 3 tentatives / 15 min par adresse, réussites comprises — activation bloquée au 4e compte derrière un même NAT | 5 | Corrigé | `c188894` | `tests/integration-db/first-login-rate-limit.test.ts` (2, PG réel, rouges avant) | `[200,200,200,429,429]` | 5 × 200 ; échecs limités à 10 / 15 min |
| N42 | Faible | `/dashboard/grades` montre au parent l'interface de l'équipe (« Saisir Notes ») ; écritures refusées par le serveur | Suivi | Constat Lot 5 | — | E2E (texte de la page) | — | — |
| N43 | Faible | « Matières par classe » : boutons « Ajouter » et « Catalogue global » sans action (l'affectation se fait depuis la fiche de la classe) | Suivi | Constat Lot 5 | — | lecture du code | — | — |
| N44 | Faible | `/dashboard/alerts` (navigation super-admin) → 404 | Suivi | Constat Lot 5 | — | console navigateur (E2E) | — | — |
| N45 | Élevée | Import : fichier lu par `readAsBinaryString` — CSV UTF-8 sans BOM → « AÃ¯cha », Windows-1252 → apostrophe perdue ; noms enregistrés corrompus (données personnelles) | 5 | Corrigé | `c28e0e1` | `tests/lib/import/read-spreadsheet.test.ts` (6) | « AÃ¯cha », « NDiaye » | « Aïcha », « N’Diaye » |
| N46 | Élevée | Import des élèves partiel et silencieux (lignes invalides ignorées sous « Importation réussie », élève sans classe, dates `JJ/MM/AAAA` mal lues, arrêt → import partiel) | 5 | Corrigé | `c28e0e1` | `tests/integration-db/import-students.test.ts` (6, PG réel, rouges avant) ; `tests/lib/import/dates.test.ts` (5) | lignes valides créées, autres ignorées (200) | 422, rien d'écrit, rapport complet ; sinon une transaction |
| N47 | Élevée | Imports enseignants / parents / classes partiels ; parent créé sans enfant ; niveau inconnu créé en `PRIMARY` ; classe sans titulaire | 5 | Corrigé | `a157849` | `tests/integration-db/import-accounts-classes.test.ts` (8, PG réel, 6 rouges avant) | import partiel (200) | 422, rien d'écrit ; sinon une transaction |
| N48 | Faible | Liste des évaluations : bouton « autres actions » sans action | Suivi | Constat Lot 5 | — | lecture du code | — | — |
| N49 | Élevée | « Matières par classe » plantait dès qu'une classe avait une matière affectée (`.map` sur `{ data, pagination }` de `/api/teachers`) | 5 | Corrigé | `b500a09` | `e2e/class-lists.spec.ts` (rouge avant) | « Une erreur inattendue est survenue » | liste et affectations affichées |
| N50 | Moyenne | Import des élèves : colonne « Email parent » proposée et acceptée, jamais utilisée (aucun rattachement, aucun avertissement) ; une adresse mal saisie refusait tout le fichier | 5 (décision du propriétaire du 2026-09-14 : pas de rattachement par email, renvoi vers l'import « Parents ») | Corrigé | `d0c3122` | `tests/lib/import-mapping-utils.test.ts` (6, rouges avant) ; `tests/integration-db/import-students.test.ts` (N50, PG réel, rouge avant) | colonne ignorée en silence | colonne signalée avant et après l'import, bouton « Importer les parents », `warnings` dans la réponse 200 |
| N51 | Moyenne | `/api/import/schedules` : lignes valides écrites, autres ignorées (import partiel) ; aucun écran ne l'appelle | Suivi | Constat Lot 5 | — | lecture du code | — | — |
| N52 | Moyenne | `/api/students/bulk-import` : second import d'élèves, appelé par aucun écran, non couvert par N46 ; rattache un parent à l'élève par simple email, sans vérification (le chemin écarté par N50) | 5 (décision du propriétaire du 2026-09-14 : alignement) | Corrigé | `f7c2f08` | `tests/integration-db/bulk-import-students.test.ts` (2, PG réel, rouges avant) ; `provisional-passwords` inchangé et vert | parent rattaché par email ; import partiel ; 400 global sur une adresse invalide | aucun rattachement, avertissement ; 422 situé, rien d'écrit ; sinon une transaction |
| N53 | Faible | `PageGuard` : pendant le chargement de la session, un spinner sans texte ni `role="status"` — rien n'est annoncé aux lecteurs d'écran, et la zone principale paraît vide | Suivi | Constat Lot 5 | — | E2E des états vides (relevé intermittent sur `/dashboard/settings/profile`, enseignant) ; lecture du code | — | — |
| N54 | Moyenne | Import des élèves : colonne « Adresse » proposée et acceptée, jamais enregistrée (`StudentProfile.address` existe), sans avertissement | 5 (décision du propriétaire du 2026-09-14 : l'enregistrer) | Corrigé | `517b289` | `tests/integration-db/import-students.test.ts` (N54, PG réel, rouge avant) | `address` null | adresse enregistrée (espaces retirés, 255 caractères au plus, au-delà ligne signalée) |
| N55 | Élevée | `/api/import` (type STUDENTS), troisième import d'élèves appelé par aucun écran : établissement de la requête pris tel quel pour tout rôle (autre école visée ; la RLS bloquait l'écriture → 500) ; prénom ou nom manquant remplacé par « Élève » / « Nouveau » ; classe, date, genre, adresse ignorés ; aucune validation | 5 (règle 10 : données personnelles) | Corrigé | `4f08d91` | `tests/integration-db/generic-import-students.test.ts` (3, PG réel, rouges avant) | 500 ; 200 avec « Élève » inventé ; adresse null | école de l'appelant seule (SUPER_ADMIN : école choisie et vérifiée) ; 422 situé ; données enregistrées |
| N56 | Moyenne | Journaux applicatifs : email (mot de passe oublié, vérification), téléphone (SMS) et erreurs Prisma citant un email écrits en clair | 6 | Corrigé | `8f183b4` | `tests/lib/logger-pii.test.ts` (7, 6 rouges avant) | email et téléphone en clair | masqués ; identifiants, compteurs et dates restent lisibles |
| N57 | Moyenne | Purge de conservation : durées en années (3 mois impossible), dossiers médicaux effacés selon leur date de mise à jour (élèves inscrits compris), départ jamais pris en compte, badges et journaux techniques jamais purgés, aucun aperçu, erreurs avalées | 6 | Corrigé | `6cf87d7` | `tests/integration-db/retention.test.ts` (7, PG réel) | — | durées en mois depuis le départ, aperçu = purge, règle en échec rapportée |
| N58 | Moyenne | Règles de conservation posées inactives sur les écoles existantes, sans aucun écran pour les revoir et les activer (alerte « N règle(s) à activer » sans suite) | 6 | Corrigé | `885d4bb` | `tests/integration-db/compliance-retention.test.ts` (5, PG réel, rouges avant) | aucune interface | durée et activation par règle, plancher OHADA, changement tracé |
| N59 | Moyenne | Page Conformité : l'API ne renvoyait aucun des champs lus → valeurs de repli affichées comme réelles (85 % de conformité, 100 % de consentements, 0 demande) | 6 | Corrigé | `c29cbcc` `f17f191` | `tests/integration-db/compliance-dashboard.test.ts` (PG réel) | chiffres inventés | indicateurs calculés ; taux de consentement mesuré |
| N60 | Élevée | `/api/compliance/dashboard` sans restriction de rôle : tout compte connecté de l'école — élève, parent, enseignant — lisait les compteurs de conformité et les dix dernières demandes RGPD, avec nom et email de chaque demandeur | 6 | Corrigé | `74aac22` | `tests/integration-db/compliance-dashboard-access.test.ts` (4, PG réel) | élève, parent, enseignant → 200 + email d'un parent | 403 |
| N61 | Élevée | `DELETE /api/user/data` anonymisait le compte sur-le-champ alors que l'écran annonçait une demande enregistrée : n'importe qui — un élève compris — effaçait en un clic ses notes, son dossier médical et son historique, sans retour possible | 6 | Corrigé | `5682b72` | `tests/integration-db/data-rights.test.ts` (8, PG réel, 5 rouges avant) | compte anonymisé immédiatement | demande enregistrée (202), traitée par l'administration |
| N62 | Moyenne | Traitement d'une demande RGPD limité à l'export : rectification et effacement recevaient « type de demande non supporté » et ne pouvaient jamais être honorés | 6 | Corrigé | `5682b72` | idem N61 | 400 « non supporté » | effacement (sauf élève inscrit, 409) et rectification (correction décrite) |
| N63 | Moyenne | `auditLog.securityEvent` écrivait toujours l'action « SECURITY_EVENT » : anonymisation, verrouillage de compte et alerte de connexion indistinguables dans le journal | 6 | Corrigé | `525cd2f` | `tests/integration-db/data-rights.test.ts` | action unique | action nommée `SECURITY_EVENT_<ÉVÉNEMENT>` |
| N64 | Critique | Instrumentation absente de la sortie standalone : en production, aucune validation d'environnement, aucune garde RLS, aucune fermeture Prisma/Redis à l'arrêt | 7 | Corrigé | `96c3986` | `tests/lib/copy-instrumentation.test.ts` (4), `tests/lib/instrumentation.test.ts` (5) ; serveur standalone lancé | « Arrêt terminé … tasks: 0 » | « tasks: 2, failedTasks: 0 », « Cache warming completed » |
| N65 | Élevée | `docker build` échouait : `.dockerignore` excluait les préchargements que le Dockerfile copie | 7 | Corrigé | `5808189` | entrypoint rejoué hors conteneur (5 migrations, `/api/health` 200, arrêt propre) | build impossible | chaîne du conteneur verte ; image elle-même non construite (démon inactif) |
| N66 | Élevée | PostgreSQL, Redis et n8n publiés sur toutes les interfaces par `docker-compose.yml` | 7 | Corrigé | `877ec17` | `docker compose config` | `published: 5432/6379/5678`, aucune restriction d'hôte | `host_ip: 127.0.0.1` sur 5433/6379/5678 ; 3000 inchangé |
| N67 | Faible | « Redis non configuré » journalisé à chaque requête | 7 | Corrigé | `9f3f482` | `tests/lib/redis-unconfigured-log.test.ts` | 25 appels → 25 lignes | 25 appels → 1 ligne |
| N68 | Moyenne | `catch` d'`api-helpers` journalisait l'URL brute (chaîne de requête : email, matricule) hors expurgation | 7 | Corrigé | `8fa0b5f` | `tests/api/request-id.test.ts` (6) | `?email=parent@exemple.fr` dans le journal | chemin seul, ligne identifiée par `requestId` |
| N69 | Moyenne | `setUserContext` exportait l'adresse électronique vers Sentry | 7 | Corrigé | `ba40b0b` | `tests/lib/sentry-config.test.ts` (5) | email transmis | identifiant interne et rôle seulement |
| N70 | Faible | `errors.last24h` plafonné à 50 par le `take` de la liste | 7 | Corrigé | `de01b15` | `tests/api/root-monitoring.test.ts` (10) | 25 erreurs comptées via la liste | `count` dédié |
| N22 | Moyenne | La page Notes (`/dashboard/grades`) demande `/api/grades/statistics` sans période ni classe : l'agrégat porte sur **tout l'historique** de l'établissement et son coût croît d'année en année (271 ms pour 129 575 notes après `b428aed`, soit ~1 s vers 500 000 notes). Restreindre à l'année scolaire courante changerait les chiffres affichés : décision produit | Suivi — décision du propriétaire | Constat Lot 3 | — | `EXPLAIN` + chronométrage (`.quality-tmp/explain-grades*.cjs`) | 578 ms | 271 ms (agrégat), croissance linéaire non traitée |

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
| 3 | ✅ 0 erreur (9 s) | ✅ 0 erreur (62 s) | ✅ 2 845/2 845, 268 fichiers (34 s) | ✅ 48 s | ✅ 134/134, 26 fichiers (43 s, PG réel) | ✅ 18/18 (`grades-flow`, `class-lists`, `student-lists` ; build de prod, base d'audit) | Build de `2da4d02`. Smoke 7 rôles : 0 > 500 ms / 500 Ko, 1 violation N15 ; RSS finale 395 Mo ; `analytics/dashboard` p95 251 / 208 ms ; page Notes 687 Ko |
| 4 | ✅ 0 erreur | ✅ 0 erreur | ✅ 2 871/2 871, 273 fichiers | ✅ (next 16.3.5) | ✅ 230/230, 32 fichiers (PG réel, code sur le **rôle applicatif** soumis à la RLS) | ✅ 87/89 (suite complète) : les 2 échecs a11y M8 connus (`/ecoles`, `/dashboard/grades` TEACHER) ; `grades-flow` CTA désormais vert | Build de `005be2d`, serveur sur `edupilot_app`, base d'audit. `security.mjs` **13/13 PASS** aux limites de production (réserve : H4 `{"429":12}`, fenêtre d'échecs d'un rejeu isolé 5 min plus tôt encore ouverte ; rejeu isolé : `{"302":10,"429":2}`). Smoke 7 rôles : 0 réponse > 500 ms / 500 Ko hors N15 et automation (serveur sans secret). RSS 452 Mo. Maintenance quotidienne en contexte système sous RLS : voir « Mesures RLS » |
| 2 | ✅ 0 erreur | ✅ 0 erreur (`npm run lint` complet) | ✅ 2 776/2 776, 255 fichiers | ✅ 36 s ; 0 ligne de télémétrie Sentry | ✅ 18/18 (5 fichiers, PG réel) | ✅ 78/81 : exactement les 3 échecs connus de l'audit (M8 : a11y `/ecoles`, a11y `/dashboard/grades` TEACHER, `grades-flow` CTA) — aucune régression | `security.mjs` : H1, H2 ×2, M3 ×2, H5 ×3, TENANT → 9/9 PASS ; `redis-outage.mjs` PASS (10×200, p95 24 ms) ; cron valide : voir N8 |
| 5 | ✅ 0 erreur (10 s) | ✅ 0 erreur (54 s) | ✅ 2 888/2 888, 277 fichiers (35 s) | ✅ (next 16.3.5) | ✅ 252/252, 37 fichiers (64 s, PG réel) | ✅ suite standard 89/89 (build de prod, base d'audit, rôle applicatif) ; ✅ démarrage à vide 2/2 (installation 1,3 min + 145 pages × 3 rôles, 0 anomalie, 13,6 min) | Code de `90930dd`. Démarrage à vide rejoué sur une base neuve vérifiée (`setupNeeded:true`). Premier passage : installation verte, états vides avec 1 relevé non reproduit (N53, état de chargement ; 0 en 15 chargements ciblés) ; second passage vert. Empreinte des 8 comptes de démonstration identique avant et après chaque suite standard. Job CI `fresh-install` non exécuté sur GitHub Actions dans cette session |
| 7 | ✅ 0 erreur | ✅ 0 erreur | ✅ 2 970/2 970, 288 fichiers (37 s) | ✅ (next 16.3.5) + recopie de l'instrumentation | ✅ 320/320, 50 fichiers (77 s, PG réel) | ✅ **89/89** (suite complète, build de production, base E2E jetable, rôle applicatif) | Serveur standalone lancé par l'entrypoint du conteneur : 5 migrations appliquées, `/api/health` 200, `x-request-id` présent, arrêt propre `tasks: 2`. Crons éprouvés à l'exécution (200/202/409/401). Docker **non exécutable** (démon inactif) |
