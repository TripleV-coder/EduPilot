# Audit cartographique d'EduPilot — 2026-10-15

> Mission : cartographie exhaustive des parcours (sections 1 à 22 du cahier des charges), plus l'audit multi-écoles et l'audit du cache.
> Mode **lecture seule** : aucun fichier source, schéma, migration ou configuration modifié.
> Ajouts au dépôt :
> - ce dossier `docs/audit-2026-10-15/` ;
> - le test `tests/integration-db/multi-school-teacher.test.ts` (21 tests : 18 verts, 3 `it.fails` qui documentent des anomalies).
>
> Ces deux ajouts ne sont **pas commités**.

## Livrables

| N° | Document | Contenu |
|---|---|---|
| 1 | [01-synthese.md](01-synthese.md) | Architecture, acteurs, constats majeurs, couverture |
| 2 | [02-roles-et-permissions.md](02-roles-et-permissions.md) | Matrice des rôles et des périmètres, combinaisons de fonctions, écarts menu / serveur |
| 3 | [03-catalogue-parcours.md](03-catalogue-parcours.md) | 18 parcours critiques détaillés + inventaire des autres parcours |
| 4 | [04-ecrans-et-navigation.md](04-ecrans-et-navigation.md) | Écrans, navigation, pages inaccessibles, doublons |
| 5 | [05-donnees.md](05-donnees.md) | Modèles, données maîtres et dérivées, contraintes, données sensibles |
| 6 | [06-api-et-traitements.md](06-api-et-traitements.md) | Routes, traitements planifiés et asynchrones, intégrations |
| 7 | [07-multi-ecoles-et-cache.md](07-multi-ecoles-et-cache.md) | Changement d'école, isolation, permissions, caches, options d'architecture, plan de correction |
| 8 | [08-performance-et-charge.md](08-performance-et-charge.md) | Mesures existantes, goulots, scénarios de charge à mener |
| 9 | [09-robustesse-scenarios-et-tests.md](09-robustesse-scenarios-et-tests.md) | Scénarios limites (A à J), matrice d'interactions, couverture des tests, priorisation |
| 10 | [10-opportunites-amelioration.md](10-opportunites-amelioration.md) | Simplifications argumentées |
| 11 | [11-questions-metier.md](11-questions-metier.md) | 22 décisions à prendre |
| 12 | [12-index-des-preuves.md](12-index-des-preuves.md) | Fichiers, lignes, tests et commandes pour chaque constat |

## Annexes générées (inventaires exhaustifs)

| Annexe | Contenu |
|---|---|
| [A1-routes-api.md](annexes/A1-routes-api.md) | 313 routes par domaine : méthodes, rôles et permissions, modèles, gardes, drapeaux, appelants |
| [A2-pages.md](annexes/A2-pages.md) | 181 pages : gardes, appels API, référencement, accès depuis le menu |
| [A3-modeles-donnees.md](annexes/A3-modeles-donnees.md) | 130 modèles : école, RLS, cascades, unicités, champs sensibles |
| [A4-matrice-permissions.md](annexes/A4-matrice-permissions.md) | 102 permissions × 9 rôles |
| [A5-navigation-par-role.md](annexes/A5-navigation-par-role.md) | Menus latéraux par rôle |

## État d'avancement par domaine

| Domaine (grille §5) | État |
|---|---|
| A Administration plateforme, B Réseaux, C Écoles, D Utilisateurs et rôles, E Authentification | **Terminé** pour le lot 1 (parcours critiques + inventaire) |
| F Inscriptions, G Élèves, H Parents, I Enseignants | **Terminé** (parcours critiques) ; transfert d'élève **à confirmer** (Q-INSCR-01) |
| J Personnel | **Partiel** : inaccessible par la navigation (NAV-01) ; contenu de la paie non relu |
| K Classes, L Matières, M Calendriers, N Emplois du temps | **Partiel** : inventaire et statut, sans parcours détaillé |
| O Notes, P Moyennes, Q Bulletins, R Classements | **Terminé** (parcours + scénarios) |
| S Assiduité | **Terminé** (anomalie DA-01) |
| T Devoirs et ressources, U Orientation | **Partiel** : inventaire seul |
| V Messagerie, W Cellule d'écoute | **Partiel** : inventaire et rôles ; contenu non relu |
| X à AD Finance | **Terminé** (paiements, guichet, relances, DA-10 révisé le 2026-10-16) ; remboursements **absents** |
| AE Tableaux de bord, AF Imports et exports | **Partiel** : performance et isolation examinées ; détail des exports non relu |
| AG Notifications | **Terminé** pour les absences, la file et le SSE ; diffusion en masse non mesurée |
| AH Préférences | **Partiel** |
| AI Support | **Absent** du code |
| AJ Audit, AK Sauvegardes, AL Automatisations | **Partiel** : restauration non relue ; purge non planifiée |
| AM Modules secondaires (cantine, transport, bibliothèque, clubs, LMS, examens, IA, gamification, signatures, portefeuille, cagnottes, alumni, contrôle d'accès) | **Non examiné** au-delà de l'inventaire (routes, pages, rôles) |

## Points restant à confirmer (lot 2)
1. Recette de navigation réelle par rôle : confirme NAV-01 et NAV-02 (navigateur requis).
2. Tests d'intégration à écrire (sans modifier le code applicatif) :
   - doublons de présences (DA-01) ;
   - paiement en ligne sans resynchronisation de l'échéancier, puis relances et plafond du guichet (DA-10) ;
   - encaissements simultanés au guichet (SC-B-11) ;
   - matricule concurrent (DA-02) ;
   - modification concurrente d'une note (SC-B-01) ;
   - révocation pour le personnel (R-MS-06).
3. E2E du service worker en build de production (MS-03).
4. Parcours détaillés des domaines « partiels » ci-dessus.
5. `npm audit` et revue des dépendances.
6. Scénarios de charge multi-écoles (livrable 8 §3), après validation de l'objectif de capacité (Q-PERF-01).

## Journal des corrections

### C-01 — 2026-10-16 — Révision de DA-10 (comptabilité des échéanciers)

**Constat initial erroné (2026-10-15).**
- « Seule la route `POST /api/payment-plans/[id]/installments/[installmentId]/pay` met à jour `paidAmount` et le statut des échéances. »
- « Deux comptabilités parallèles. »
- « Deux encaissements complets **successifs** au guichet sont acceptés. »
- « Une famille qui a payé **au guichet** est relancée. »

**Cause de l'erreur.** L'extraction automatique ne repérait que les écritures Prisma **directes** dans les fichiers de routes. La recherche `grep paidAmount … update` ne voyait pas l'écriture `paidAmount: totalPaid` faite dans la fonction partagée `syncPaymentPlanLedger` (`src/lib/finance/helpers.ts:269-400`).

**Constat retenu.**
- `syncPaymentPlanLedger` recalcule échéances, `paidAmount` et état de l'échéancier à partir des paiements validés ou rapprochés, en affectant les paiements à l'échéance impayée la plus ancienne.
- Les 8 appels recensés sont tous dans des voies d'encaissement manuel.
- Les confirmations en ligne et la réconciliation à 24 h ne l'appellent pas.

**Conséquences.**
- Incohérence temporaire, après un paiement en ligne, des échéances, relances, SMS, espace parent et plafond du guichet.
- Tableaux de bord, rapports et avis de paiement non affectés.
- Deux encaissements successifs au guichet refusés d'après le code.

**Risque distinct ajouté (SC-B-11).** Encaissements **simultanés** au guichet : le plafond est lu hors transaction et sans verrou.

**Niveau de preuve inchangé.** Défaut observé dans le code, **non reproduit par un test** ; les conséquences restent plausibles. Aucun des constats n'est requalifié en « reproduit ».

**Q-FIN-02 reformulée.** La règle d'affectation existe déjà ; seules sa validation et ses exceptions restent à décider.

**Documents modifiés.** `00-INDEX.md`, `01-synthese.md`, `03-catalogue-parcours.md`, `05-donnees.md`, `09-robustesse-scenarios-et-tests.md`, `10-opportunites-amelioration.md`, `11-questions-metier.md`, `12-index-des-preuves.md`.
