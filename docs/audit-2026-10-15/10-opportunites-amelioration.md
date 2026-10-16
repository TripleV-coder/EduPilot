# Livrable 10 — Opportunités d'amélioration

> Aucune de ces pistes n'est appliquée. Pour chacune : fonctionnement actuel, problème, changement possible, bénéfices, risques, impacts, tests et niveau de confiance du constat.
> Les corrections d'anomalies (livrables 7 et 9 §5) sont des **corrections**, pas des simplifications. Elles sont rappelées ici seulement quand elles touchent la structure.

## SIMP-01 — Resynchroniser l'échéancier sur **toutes** les voies d'encaissement
*(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)*
- **Actuel** : le solde est la somme des paiements validés ou rapprochés. L'échéancier (statut des échéances, `paidAmount`, état) en est **dérivé** par `syncPaymentPlanLedger`, qui affecte les paiements dans l'ordre chronologique à l'échéance impayée la plus ancienne. Les voies manuelles l'appellent ; les confirmations en ligne non.
- **Problème** : DA-10 (incohérence temporaire après un paiement en ligne) et SC-B-11 (plafond du guichet lu hors transaction, sans verrou).
- **Changement possible** :
  1. appeler `syncPaymentPlanLedger` dans la transaction de `confirmOnlinePayment`, sous le verrou existant ;
  2. au guichet, lire le plafond **dans** la transaction, sous le même verrou par élève et par frais ;
  3. vérifier l'opportunité de fonder ce plafond sur la somme des paiements plutôt que sur `paidAmount`.
- **Bénéfices** : un seul moment de mise à jour pour tous les canaux ; plus de relances à tort.
- **Risques** : durée des transactions (la resynchronisation relit tous les paiements du frais) ; interblocages si l'ordre de prise des verrous diffère selon les voies.
- **Impacts** : paiement en ligne, guichet, relances, SMS, espace parent.
- **Tests** : intégration complète. Paiement en ligne confirmé → échéance PAID et `paidAmount` à jour → aucune relance → tentative concurrente au guichet refusée.
- **Confiance** : élevée (appels recensés par `grep`, absence d'appel vérifiée dans `online-payments.ts`).

## SIMP-02 — Un modèle de rattachement unique
- **Actuel** : quatre règles de rattachement aux écoles (enseignant, réseau, parent, direction et annexes) calculées dans `school-access.ts`.
- **Problème** : révocation non propagée (MS-01) ; combinaisons de fonctions impossibles (livrable 2 §3).
- **Changement possible, en deux temps** :
  1. sans changer le schéma : version d'accès (`roleChangedAt` ou équivalent) mise à jour à chaque changement de rattachement, et recalcul périodique ;
  2. seulement si Q-ROLE-01 l'exige : table de rattachements avec un rôle par école (option 3 du livrable 7 §9).
- **Risques (étape 2)** : 499 gestionnaires et la RLS à adapter ; migration de `User.role`.
- **Tests** : `multi-school-teacher.test.ts` (les `it.fails` deviennent verts) et extension aux autres rôles.
- **Confiance** : élevée pour l'étape 1 ; l'étape 2 dépend d'une décision.

## SIMP-03 — Navigation : un catalogue d'écrans par module
- **Actuel** : menus courts (3 à 8 liens), 67 écrans non atteignables par liens, 5 alias dont un masque le hub RH.
- **Changement possible** : dériver les entrées « Plus » ou les hubs du catalogue des modules (`catalog.ts`, qui connaît déjà `pagePrefixes`), et retirer l'alias `/dashboard/staff`.
- **Bénéfices** : un module activé apparaît automatiquement.
- **Risques** : surcharge des menus ; choix par rôle (Q-NAV-01).
- **Tests** : recette de navigation par rôle (`e2e/recette/12-parcours-par-role.spec.ts`).
- **Confiance** : élevée pour le constat (analyse statique), moyenne pour l'étendue exacte (liens dynamiques non détectés).

## SIMP-04 — Supprimer ou rebrancher les écrans et routes en doublon ou sans appelant
- **Candidats** :
  - écrans : `/dashboard/admin/*` (4 pages), `/dashboard/admin/logs` contre `/dashboard/audit-logs`, `/dashboard/settings/levels` contre `class-levels` et `cycles`, `academic-config`/`periods` contre `academic`, les 5 fichiers de page masqués par un alias ;
  - routes sans appelant : livrable 6 §1 ;
  - code : `src/lib/cache/warm.ts` (factice) ; modèles `SubjectGroupAnalysis`, `CommunicationLog`, `CommunicationPreference` (référencés nulle part).
- **Risques** : un appelant externe non détecté (application mobile, n8n). À vérifier dans les journaux d'accès de production avant toute suppression.
- **Confiance** : moyenne.

## SIMP-05 — Restriction des enseignants à leurs classes : une seule fonction
- **Actuel** : `taughtClassIds` pour les élèves ; rien pour les notes ni les bulletins (MS-02).
- **Changement possible** : un garde unique « portée enseignant », appliqué aux élèves, notes, bulletins, présences et devoirs, selon la décision Q-ROLE-03.
- **Tests** : `it.fails` MS-02.
- **Confiance** : élevée.

## SIMP-06 — Étendre la RLS aux tables personnelles restantes
- **Actuel** : 16 tables sous RLS ; 60 modèles hors RLS reliés à une personne.
- **Priorité suggérée** : `wellbeing_reports`, `psy_appointments`, `enrollments`, `payment_plans`, `scholarships`, `student_analytics`, `messages`, `payroll_entries`.
- **Risques** : pièges connus (promesses paresseuses, `_count`, politiques `EXISTS` coûteuses, PF-04) ; à faire table par table avec `rls-effective.test.ts`.
- **Confiance** : élevée.

## SIMP-07 — Suppressions irréversibles
- **Actuel** : suppression définitive d'une école (cascade sur 52 relations) et d'un compte. Le journal d'audit est supprimé avec l'utilisateur.
- **Changement possible** : suppression logique ou archivage d'une école (le parcours de « départ d'école » existe déjà : `tests/integration-db/school-offboarding.test.ts`) ; `AuditLog.userId` en `SetNull` plutôt que `Cascade`.
- **Risques** : obligations de conservation et d'effacement (Q-RGPD-01).
- **Confiance** : élevée pour le constat.

## SIMP-08 — Service worker : réduire au mode hors-ligne utile
Voir MS-03 : `NetworkOnly` pour `/api/` et les pages authentifiées, purge à la déconnexion. Bénéfice : suppression d'un risque de fuite ; perte de la lecture hors-ligne de pages déjà vues (fonction d'ailleurs non documentée).

## Problèmes d'expérience utilisateur constatés
- Modules activables mais introuvables (NAV-02).
- Brouillon d'inscription qui réapparaît (MS-04).
- Familles non prévenues d'une correction de note ou d'un bulletin (A6).
- Message « un utilisateur existe déjà » qui révèle un compte (décision prise : message neutre).
- Bulletin sans état « publié » (Q-BULL-01).
