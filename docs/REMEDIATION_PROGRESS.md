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
| M1 | Moyenne | `mustChangePassword` jamais imposé | 4 | Constat audit | — | E2E premier login forcé | — | — |
| M2 | Moyenne | RLS inerte | 4 | Constat audit | — | selon option retenue (a/b) | — | — |
| M3 | Moyenne | JSON invalide / ZodError → 500 | 2 | Corrigé | `6cd4595` | `tests/lib/api/api-handler-body.test.ts` (7) ; `tests/integration-db/api-body-validation.test.ts` (3, PG réel) ; `security.mjs json` | `{}` → 500, `{bad` → 500 ; corps de 5 Mo lu en entier | 400 `VALIDATION_ERROR` / 400 `INVALID_JSON` ; > 1 Mo → 413 ; rien écrit |
| M4 | Moyenne | Croissance mémoire (aggravée : N1) | 3 | Corrigé | `0356461` (N1) `2a24ac2` (N28) | RSS relevée pendant la batterie du Lot 3 | 8 746 Mo | 395 Mo après smoke 7 rôles + latences + Lighthouse |
| M5 | Moyenne | 163/231 `findMany` sans `take` | 3 | Corrigé — revue faite, N+1 corrigés, les 6 occurrences non bornées traitées ; `alumni` reporté (N14) | `618933d` `0d3a609` `82baca8` `d926558` `9eb7657` `8d2c446` `b62db28` `6911d97` | revue + plafond helper | 163 | voir « Revue M5 » (Lot 3) |
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
| N1 | Critique | Épuisement mémoire (voir ci-dessus) | 3 | Corrigé | `0356461` `2a24ac2` | RSS (batterie du Lot 3) | 8 746 Mo | 395 Mo après smoke 7 rôles + latences + Lighthouse |
| N2 | Élevée | Retention : `requireAuth` par défaut + comparaison non constante | 2 | Corrigé | `c749ec8` | `system-retention.test.ts` (+2), `cron-auth.test.ts` (4) | 401 avec secret valide ; comparaison `===` | cron sans session → 200 ; `timingSafeEqual` ; SUPER_ADMIN pré-2FA refusé |
| N3 | Élevée | Désactivation inter-école via DELETE | 1 | Corrigé | `563ccb6` | `subject-categories-isolation.test.ts` (N3) ; `security.mjs idor` | 200, `isActive=false` | 404, catégorie toujours active |
| N4 | Moyenne | `e2e/global-setup.ts` code en dur les identifiants d'écoles et de classe d'un seed précis (`E2E_SCHOOLS`) : sur une base reseedée, `security-tenant` peut passer sans rien prouver (ressource inexistante) | 5 | Constat Lot 1 | — | comptes et données E2E dédiés, identifiants lus en base | — | — |
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
| N17 | Élevée | `e2e/global-setup.ts` réinitialise mot de passe, verrouillage et 2FA de 8 comptes dans la base désignée par le `DATABASE_URL` du `.env` — la base locale du développeur (5432) si l'E2E est lancé sans surcharge — sans aucun garde-fou (règles 5 et 6) | 5 (comptes E2E dédiés + marqueur d'environnement) | Constat Lot 3 — contourné pendant la remédiation : `DATABASE_URL` de la base jetable toujours passé explicitement | — | — | — | — |
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
| 2 | ✅ 0 erreur | ✅ 0 erreur (`npm run lint` complet) | ✅ 2 776/2 776, 255 fichiers | ✅ 36 s ; 0 ligne de télémétrie Sentry | ✅ 18/18 (5 fichiers, PG réel) | ✅ 78/81 : exactement les 3 échecs connus de l'audit (M8 : a11y `/ecoles`, a11y `/dashboard/grades` TEACHER, `grades-flow` CTA) — aucune régression | `security.mjs` : H1, H2 ×2, M3 ×2, H5 ×3, TENANT → 9/9 PASS ; `redis-outage.mjs` PASS (10×200, p95 24 ms) ; cron valide : voir N8 |
