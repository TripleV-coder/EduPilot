# Audit du schéma et de l'intégrité de la base — 2026-10-14

## A. Technologie

PostgreSQL 16 (développement : conteneur `edupilot-postgres` ; tests : embedded-postgres 16.14). **[E]**

## B. Outil de gestion du schéma

Prisma 6.19 : `prisma/schema.prisma` (129 modèles, 70 énumérations) et 50 migrations SQL
(`prisma/migrations/*/migration.sql`), appliquées en production par `prisma migrate deploy` au démarrage du
conteneur (`scripts/server/docker-entrypoint.sh`). **[S]**

## C. Fichiers de définition et migrations

Schéma : `prisma/schema.prisma`. Migrations : 50 dossiers, de `20251221113919_init` à
`20261003160000_student_formulas`, toutes suivies par Git. RLS : 6 migrations activent la sécurité de
niveau ligne ; 16 tables en `FORCE ROW LEVEL SECURITY`. **[S]**

## D–G. Les schémas comparés

| Comparaison | Méthode | Résultat | Statut |
|---|---|---|---|
| Schéma Prisma valide | `npx prisma validate` | valide | **CONFORME ET VÉRIFIÉ** [E] `evidence/02` |
| Migrations ↔ schéma Prisma | `prisma migrate diff --from-migrations … --to-schema-datamodel` sur une base vierge temporaire (`audit_shadow_20261014`, créée puis supprimée) | « This is an empty migration. » : les 50 migrations reproduisent exactement le schéma | **CONFORME ET VÉRIFIÉ** [E] `evidence/13` |
| Création d'une base neuve par les migrations | `prisma migrate deploy` (suite d'intégration, à chaque exécution) | 54 fichiers de tests d'intégration exécutés sur ce schéma | **CONFORME ET VÉRIFIÉ** [E] `evidence/06` |
| Mise à niveau d'une base existante | `prisma migrate deploy` sur la base jetable (créée lors d'un audit antérieur) | migrations manquantes appliquées sans erreur | **CONFORME ET VÉRIFIÉ** [E] `evidence/21` |
| Base de **développement locale** (port 5432) ↔ schéma | `prisma migrate status` + `migrate diff --from-url` (lecture seule) | **27 migrations non appliquées** (de `20260628152219_add_alumni` à `20261003160000_student_formulas`) ; diff de 47 instructions (table `background_jobs`, colonnes de formules, `evaluation_types.category`, `grades.excuseReason/excludedReason`…) | **NON CONFORME** (environnement local, pas un défaut du code) [E] `evidence/11`, `12` |
| Base de production | — | aucun accès | **NON VÉRIFIÉ** |

Conséquence pratique : l'application **actuelle** lancée sur la base de développement locale échouerait
sur les tables et colonnes manquantes. Aucune migration n'a été appliquée à cette base sans autorisation.
Commande à lancer par l'exploitant : `npx prisma migrate deploy` (n'applique que des migrations existantes).

## H. Relations et contraintes (inspection [S])

- Clés primaires `cuid`, clés étrangères avec `onDelete: Cascade` sur les entités dépendantes
  (`StudentFormula`, `ClassCouncil`, `Grade`…).
- Unicités métier : `Grade(evaluationId, studentId)`, `ClassCouncil(classId, periodId)`,
  `StudentFormula(classSubjectId, periodId, studentId)`, `TeacherProfile(schoolId, matricule)`.
- **Aucune contrainte `CHECK`** sur les valeurs métier (note entre 0 et le barème, montant > 0) : les
  bornes sont contrôlées dans l'application (zod, `checkGradeValues`) seulement. P3 : une écriture hors API
  (script, import SQL) pourrait stocker une note hors barème.
- `Enrollment` : unicité retirée volontairement pour permettre les transferts (commentaire dans le schéma).

## I. Cohérence avec le code

- `prisma generate` + `tsc` sans erreur : toutes les requêtes typées référencent des champs existants [E].
- Requêtes SQL brutes (`$queryRaw`) : colonnes vérifiées indirectement par la suite d'intégration [E].
- Transactions : corrections de notes, formules, clôture d'année et réclamations sont écrites dans des
  `$transaction` avec journal d'audit dans la même transaction [S].

## J. Intégrité des données vérifiée

- Isolation multi-établissements : tests IDOR/TENANT exécutés sur le serveur réel sous RLS → tous refusés [E].
- Volume réel de la base jetable : 3 écoles, 2 706 comptes, 995 élèves, 131 208 notes, 3 697 évaluations,
  8 293 présences, 3 328 paiements [E] `scripts/quality/db-counts.mjs`.
- Cohérence moyennes stockées ↔ moyennes recalculées : voir `calculation-engine-audit.md` §I.
- Recherche d'orphelins : non réalisée (les clés étrangères en base l'empêchent pour les relations déclarées).

## K. Stockage des formules (moteur de calcul)

| Élément | Stockage | Constat |
|---|---|---|
| Formules par défaut | **dans le code** (`SUBJECT_PRESETS`, `ANNUAL_PRESETS`, `formula.ts`) | pas de table ; normal |
| Formule de l'école | réglages de l'école (relus en base à chaque calcul par `getGradingSettings`, pas de cache) | persistance vérifiée par relecture [E] S2 |
| Formule de l'enseignant (par matière) | `class_subjects.averageFormula VARCHAR(300)` | [S] |
| Formule adaptée à un élève | table `student_formulas` (motif obligatoire, `createdById`) | [S] |
| Version figée | `class_councils.rules` (JSON) : règles et formules gelées à la validation du conseil | [S] ; gel non exercé dynamiquement |
| Historique | `audit_logs` (`SUBJECT_FORMULA_CHANGED`, `STUDENT_FORMULA_CHANGED`, …) | [S] |
| Formule invalide qui remplacerait une valide | refusée avant écriture (400) ; la valide reste | **vérifié** [E] S5 |
| Lien résultat → version de formule | **absent** pour les moyennes non figées : les moyennes stockées (`student_analytics`) ne portent pas l'identifiant de la formule utilisée | limite de traçabilité (P4) |

## L. Tests exécutés

Voir `test-results.md` : suite d'intégration (vraie base), comparaisons de schéma, scénarios dynamiques.

## M. Problèmes détectés

1. Base de développement locale en retard de 27 migrations — environnement (P3).
2. Absence de contraintes `CHECK` sur les bornes métier — défense en profondeur (P3).
3. Pas de lien entre une moyenne stockée et la version de formule qui l'a produite — traçabilité (P4).

## N. Contrôles bloqués ou non réalisés

- Sauvegarde/restauration (`scripts/backup/postgres-backup.sh`) : **BLOQUÉ** — `pg_dump` absent de l'hôte,
  la base jetable n'écoute que sur 127.0.0.1.
- Base de production : **NON VÉRIFIÉ** (aucun accès, hors périmètre).
- Analyse des plans d'exécution (`EXPLAIN`) : non réalisée dans cet audit.

## O. Verdict

Définition du schéma **cohérente et reproductible** : les migrations recréent exactement le schéma
déclaré, et la suite d'intégration fonctionne dessus. La base locale de développement n'est pas à jour.
La conformité d'une base de production n'a pas pu être vérifiée.
