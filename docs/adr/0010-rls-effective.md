# ADR-0010 : RLS PostgreSQL effective sur les données sensibles

**Statut** : Accepté (2026-09-13, décision du propriétaire, audit M2)
**Remplace** : la « Décision V2 (prévue) » de l'[ADR-0008](0008-multi-tenancy.md)

## Contexte

L'audit (M2) a constaté une RLS inerte : politiques sur 3 tables, contexte d'établissement posé dans 2 routes seulement, et application connectée avec un rôle qui contourne toute politique. L'isolation reposait uniquement sur les filtres `schoolId` écrits dans le code ; le balayage du Lot 4 a encore trouvé une route qui l'oubliait (N32).

Options présentées au propriétaire :
- (a) RLS effective : rôle applicatif non propriétaire, `FORCE ROW LEVEL SECURITY` ;
- (b) abandon documenté.

Surcoût mesuré avant décision : +0,8 ms par requête SQL (p50 1,27 → 2,08 ms, base d'audit).

## Décision

Option (a), avec deux choix du propriétaire :
- **fermée par défaut** : sans contexte d'établissement, les tables couvertes apparaissent vides et refusent toute écriture ;
- **périmètre « données sensibles »** : `student_profiles`, `grades`, `payments`, `attendances`, `behavior_incidents`, `sanctions`, `medical_records`, `allergies`, `vaccinations`, `emergency_contacts`, `evaluations`.

### Mécanisme

| Élément | Rôle |
|---|---|
| `lib/db/db-context.ts` | Contexte par unité de travail (`AsyncLocalStorage`) : `tenant` (liste d'établissements) ou `system` (déclaré, avec une raison) |
| `lib/db/scoped-client.ts` | Extension Prisma : chaque opération hors transaction part dans `[set_config(…, true), opération]` ; `$transaction` pose le contexte en tête ; portée transaction, rien ne reste sur la connexion rendue au pool |
| `createApiHandler` | Pose le contexte de la session (283 routes sur 285) : SUPER_ADMIN → système ; autres → établissements accessibles de la session |
| Migration `20260913120000_rls_effective_sensitive_tables` | Fonctions `app_school_ids()`, `app_rls_bypass()` ; `ENABLE` + `FORCE` ; une politique `USING` + `WITH CHECK` par table |
| `scripts/db/setup-app-role.mjs` | Rôle applicatif `LOGIN NOSUPERUSER NOBYPASSRLS` ; propriétaire `BYPASSRLS` (migrations, `pg_dump`, maintenance) |
| `instrumentation.ts` + `lib/db/rls-guard.ts` | Refus de démarrer en production avec un rôle superutilisateur ou `BYPASSRLS` |

### Contextes système déclarés (`runAsSystem`)

`auth:school-access` (calcul des établissements accessibles à la connexion), `webhook:payments`, `webhook:momo`, `webhook:fedapay` (après vérification de la signature), `cron:daily-maintenance`, `cron:retention` (après vérification du secret), `tenant-guard:resolve-school` (lecture du seul `schoolId` du propriétaire d'une ressource, pour la refuser en 403), `super-admin`.

## Conséquences

Positives :
- Un filtre oublié dans une route ne peut plus exposer les données sensibles d'une autre école : prouvé par `tests/integration-db/rls-effective.test.ts` (11 tables, lecture, écriture, transactions) et par toute la suite d'intégration exécutée avec le rôle applicatif.
- Les requêtes sans contexte (code hors `createApiHandler`) échouent fermées, visiblement.

Négatives et limites :
- Surcoût d'un aller-retour `set_config` par opération Prisma hors transaction.
- Une ligne d'une table **non couverte** rattachée à un élève masqué fait échouer Prisma (« Inconsistent query result ») si elle est lue avec cet élève : les routes concernées cherchent la ressource avec un filtre d'établissement (404).
- Le contexte d'un parent ou d'un enseignant est l'ensemble de ses établissements accessibles : la RLS isole les **écoles**, pas les familles ni les classes. L'isolation fine reste applicative (`getOwnStudentIds`, périmètres par rôle).
- Une injection SQL pourrait poser elle-même `app.rls_bypass` : la RLS protège des oublis de filtre, pas d'une injection. Les requêtes brutes restent paramétrées.
- Les scripts de maintenance qui passent par `@/lib/prisma` doivent déclarer leur contexte ou s'exécuter avec le rôle propriétaire.
- Code Prisma écrit après coup : une requête lancée dans `runWithDbContext`/`runAsSystem` part dans la portée (le `then` est appelé dans la portée : les requêtes Prisma sont paresseuses).

## Règles

- Toute nouvelle table portant des données personnelles sensibles reçoit sa politique dans la même migration.
- Tout nouveau point d'entrée sans session (webhook, cron, page serveur) déclare son contexte (`runAsSystem("<raison>", …)` ou `runWithDbContext(dbContextForSession(session), …)`).
