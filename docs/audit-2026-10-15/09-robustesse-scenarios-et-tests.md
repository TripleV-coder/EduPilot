# Livrable 9 — Robustesse, scénarios limites et niveau de preuve

> Ce livrable couvre aussi les sections 19 à 22 de la mission (scénarios limites, interactions entre modules, matrice de couverture, priorisation).
> Statuts des scénarios :
> - **Protégé** : mécanisme vérifié et testé.
> - **Protégé (code)** : vérifié, non testé.
> - **Anomalie** : confirmée.
> - **Plausible** : à tester.
> - **Non examiné.**

## 1. Mécanismes de fiabilité existants (vérifiés)

| Mécanisme | Où | Preuve |
|---|---|---|
| Transactions Prisma | 40 fichiers de routes (drapeau T, annexe A1) ; journal d’audit dans 59 ; validation Zod dans 162 sur 313 | annexe A1 |
| Clés uniques servant l'idempotence | `Grade(evaluationId, studentId)` (upsert), `Payment.reference`, `TeacherSchoolAssignment(teacherId, schoolId)`, `StudentLinkCode`, `TeacherInvitation.codeHash` | schéma |
| Transitions conditionnelles (`updateMany where status = …`) | paiements (`online-payments.ts`), promotion (`promotion.ts`), invitations (`school-membership.ts:53`) | tests d'intégration |
| Verrous consultatifs | Paiements par élève et par frais | `online-payments.ts:39` + test de concurrence |
| Bail exclusif (job lease) | Maintenance quotidienne | `system/automation/route.ts`, `tests/integration-db/job-lease.test.ts` |
| File de tâches durable | Email et SMS | `queue.ts`, `tests/integration-db/job-queue.test.ts` |
| Coupe-circuits et délais bornés | Redis, fournisseurs de paiement, SMTP, SMS | `src/lib/resilience/*` |
| Arrêt propre | Serveur | `scripts/server/graceful-shutdown.cjs` |
| Verrou de période et d'année | 7 routes d'écriture | `year-lock.ts` |
| Verrou de conseil de classe | Notes | `grade-write-guard.ts` |

## 2. Catalogue des scénarios limites

### A. Parcours

| ID | Parcours | Scénario | Comportement implémenté | Statut | Test |
|---|---|---|---|---|---|
| SC-A-01 | ENSEIGNANT-001 | Double envoi d'un lot de notes | Upsert sur clé unique : pas de doublon | Protégé (code) | à écrire (2 POST simultanés) |
| SC-A-02 | VIESCO-001 | Double envoi de l'appel | `findFirst` puis `create`, `timeSlot` NULL non protégé par la contrainte : **doublon possible** | Anomalie structurelle (DA-01) | à écrire |
| SC-A-03 | INSCRIPTION-001 | Double envoi d'une inscription (même matricule) | Vérification applicative sans verrou ; l'email unique bloque seulement si un email est saisi | Plausible (DA-02) | à écrire |
| SC-A-04 | FINANCE-001 | Double clic « Payer » | Un seul essai (verrou + reprise d'un essai de moins de 5 min) | Protégé | `online-payments.test.ts` |
| SC-A-05 | FINANCE-002 | Double encaissement **successif** au guichet | Le premier encaissement resynchronise `paidAmount` (`cash/route.ts:91`), le second dépasse le plafond et est refusé | Protégé (code), non testé *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | à écrire |
| SC-A-06 | INSCRIPTION-001 | Brouillon rouvert par un autre compte | Pré-rempli avec les données de l'élève précédent | Anomalie (MS-04) | à écrire |
| SC-A-07 | Tous | Session expirée pendant une saisie | Brouillon local de notes conservé ; les autres formulaires perdent la saisie | Protégé partiellement | — |
| SC-A-08 | FINANCE-001 | Réussi chez le fournisseur, réponse perdue côté client | Webhook ou réconciliation à 24 h valident | Protégé | `online-payments.test.ts` |
| SC-A-09 | Tous | Ressource supprimée par un autre utilisateur | 404 par les routes `[id]` | Protégé (balayage) | `tenant-isolation-sweep` |

### B. Concurrence

| ID | Scénario | Protection | Statut |
|---|---|---|---|
| SC-B-01 | Deux enseignants modifient la même note | Pas de contrôle de version : **la dernière écriture gagne**, historique dans `GradeHistory` | Plausible (perte silencieuse d'une modification) |
| SC-B-02 | Deux paiements en ligne pour la même dette | Verrou + reste disponible | Protégé (testé) |
| SC-B-11 | Deux encaissements au guichet simultanés pour le même frais | Plafond lu avant la transaction (`cash/route.ts:67-74`, transaction à `:76`), sans le verrou `lockStudentFee` : les deux peuvent passer | Plausible (ajouté le 2026-10-16) |
| SC-B-03 | Paiement au guichet pendant une confirmation en ligne | Confirmation contrôlée ; trop-perçu noté | Protégé côté confirmation (testé). Le plafond du guichet ignore les paiements en ligne non resynchronisés (DA-10 |
| SC-B-04 | Révocation pendant une requête | La requête en cours termine avec l'ancien contexte ; les suivantes gardent le jeton (MS-01) | Anomalie (MS-01) |
| SC-B-05 | Maintenance pendant une saisie | Moyennes recalculées à la lecture ; instantanés éventuellement en retard d'une synchronisation | Limitation connue |
| SC-B-06 | Deux imports simultanés | Chacun dans sa transaction, sans verrou par école : doublons d'email bloqués par l'unicité, **doublons de matricule possibles** | Plausible |
| SC-B-07 | Maintenance lancée deux fois | Bail exclusif : 409 | Protégé (testé). **Mais** le bail expire après 1 h (`LEASE_TTL_MS`), alors que la maintenance est séquentielle par école (236 s par école peuplée, PF-01) : au-delà d'environ 15 écoles peuplées, un second déclenchement pendant l'exécution n'est plus refusé | Plausible à l'échelle |
| SC-B-08 | Tâche email ou SMS prise par deux processus | `FOR UPDATE SKIP LOCKED` | Protégé (testé) |
| SC-B-09 | Invalidation de cache concurrente d'une lecture | Une lecture peut réécrire une valeur ancienne juste après l'invalidation (pas de version de clé) ; fenêtre ≤ durée du cache | Plausible (faible) |
| SC-B-10 | Deux installations initiales simultanées | Recomptage dans une transaction sans verrou | Plausible (fenêtre minime) |

### C. Multi-écoles
Voir le livrable 7 : scénarios testés A à G, anomalies MS-01 à MS-05.

Autres scénarios :

| ID | Scénario | Statut |
|---|---|---|
| SC-C-01 | École désactivée | Connexion refusée, jeton invalidé (cache de 30 s) — Protégé (code) |
| SC-C-02 | Une direction suspend sa propre école via `isActive` | Anomalie de conception (DA-07) |
| SC-C-03 | Transfert d'un élève entre écoles | **Non trouvé** (pas de route de transfert ; une double inscription active est évitée par `EnrollmentStatus`) — Q-INSCR-01 |
| SC-C-04 | Tâche de fond dans le mauvais contexte | La file exécute chaque tâche dans le contexte RLS de **son** école (`types.ts`, `schoolId`) ; la maintenance s'exécute en contexte système déclaré — Protégé (code) |
| SC-C-05 | Export contenant plusieurs écoles | Exports finance et analyses filtrés par l'école contrôlée ; NETWORK_ADMIN multi-écoles non testé — Non examiné |

### D. Finance
SC-A-04, A-05, A-08, B-02, B-03 ci-dessus, ainsi que :

| ID | Scénario | Statut |
|---|---|---|
| SC-D-01 | Confirmation tardive après expiration | Protégé (testé) |
| SC-D-02 | Paiement partiel ou devise différente | Refusé, « à rapprocher » — Protégé (testé) |
| SC-D-03 | Relance d'une famille qui a payé **en ligne** | Défaut observé dans le code (DA-10), non reproduit. Après un paiement **au guichet**, l'échéancier est resynchronisé *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* |
| SC-D-04 | Remboursement d'un trop-perçu | **Absent** (Q-FIN-01) |
| SC-D-05 | Écart entre l'écran parent et les tableaux de bord | Défaut observé dans le code (DA-10), **seulement après un paiement en ligne** : l'écran parent lit `paidAmount`, les tableaux de bord la somme des paiements |
| SC-D-06 | Reçu numéroté en continu | Absent (guide 9.12) |

### E. Calcul et publication

| ID | Scénario | Statut |
|---|---|---|
| SC-E-01 | Note modifiée après calcul | Recalcul à la lecture (≤ 15 s), invalidation à l'écriture — Protégé (testé, `class-averages-invalidation.test.ts`) |
| SC-E-02 | Modification après conseil de classe | Refusée ; correction par demande validée — Protégé (code) |
| SC-E-03 | Bulletin « publié » puis modifié | **Pas d'état publié** : le bulletin reflète toujours l'état courant — Q-BULL-01 |
| SC-E-04 | Moyenne affichée ≠ moyenne exportée | Moteur unique (`average-engine`), banc strict à 0 écart — Protégé (`tests/precision`) |
| SC-E-05 | Instantanés d'analyse en retard sur les moyennes | Limitation connue (synchronisation) |

### F. Cache
Voir le livrable 7 §6 : Redis indisponible, divergence entre instances, invalidation après écriture, service worker (MS-03), données client (MS-04).

### G. Imports et exports

| ID | Scénario | Statut |
|---|---|---|
| SC-G-01 | Fichier trop volumineux | Plafond de 500 lignes (mémoire 2026-06-13), tout-ou-rien — Protégé (testé, `import-*.test.ts`) |
| SC-G-02 | Données d'une autre école dans le fichier | L'école cible est l'école active (le `schoolId` du corps n'est accepté que du SUPER_ADMIN) — Protégé (code) |
| SC-G-03 | Échec au milieu de l'import | Transaction : aucune ligne écrite — Protégé (code) |
| SC-G-04 | Injection de formule dans un export CSV | Corrigée en finance (mémoire 2026-06-13) ; non vérifiée sur les autres exports — Plausible |

### H. Notifications

| ID | Scénario | Statut |
|---|---|---|
| SC-H-01 | Notification d'absence en double | Envoyée seulement au changement de statut ; en double si l'appel est dupliqué (SC-A-02) |
| SC-H-02 | Échec du fournisseur SMS | Nouvel essai, puis FAILED ; coupe-circuit sans consommer de tentative — Protégé (testé) |
| SC-H-03 | Notification envoyée avant validation | Absences notifiées **après** la transaction (`attendance/bulk:159`) — Protégé (code) |
| SC-H-04 | Famille non prévenue d'une correction de note ou d'un bulletin | Absent (A6, Q-BULL-01) |

### I. Sécurité
Voir le livrable 7 (MS-01 à MS-05, R-MS-05 à R-MS-08), ainsi que DA-03 et DA-04 (suppressions non tracées). Dépendances : `npm audit` non exécuté dans ce lot.

### J. Exploitation

| ID | Scénario | Statut |
|---|---|---|
| SC-J-01 | Redémarrage pendant une tâche | Tâche reprise après expiration du verrou — Protégé (testé) |
| SC-J-02 | PostgreSQL indisponible à la connexion | Message « service indisponible » — Protégé (testé, `login-db-outage`) |
| SC-J-03 | Purge de conservation non planifiée | Absente du cron livré — Constat |
| SC-J-04 | Restauration de sauvegarde | Procédure dans `docs/RUNBOOK.md`, non relue ni testée dans ce lot — Non examiné |

## 3. Interactions entre modules (matrice des effets d'une modification)

| Modification | Données dérivées touchées | Caches à invalider | Notifications | Divergence possible |
|---|---|---|---|---|
| Note (création, modification, correction) | Moyennes, rangs, instantanés d'analyse, statistiques | `/api/grades*`, `/api/analytics*` (fait) + mémoïsation 15 s (fait) | **Aucune** | Instantanés en retard |
| Coefficient, formule, barème, paramètres | Toutes les moyennes de l'école | Idem | Aucune | Recalcul long (> 20 min observé) |
| Inscription, promotion | Effectifs, moyennes, frais attendus, accès parent | `/api/students`, `/api/classes` | Aucune | — |
| Paiement au guichet ou saisie manuelle | Somme des paiements + `syncPaymentPlanLedger` (échéances, `paidAmount`, état de l'échéancier) | `/api/payments`, `/api/finance/*` | Aucune | Cohérent |
| Paiement par échéance | idem (`syncPaymentPlanLedger`) | idem | Oui (notification) | Cohérent |
| **Confirmation de paiement en ligne** (webhook, réconciliation à 24 h) | Somme des paiements seulement | `/api/payments` | Aucune | **Échéances et `paidAmount` non resynchronisés (DA-10)** |
| Retrait d'une école (enseignant) | Cours, classes principales | — | — | Session ouverte (MS-01) |
| Clôture d'année | Verrous d'écriture (7 routes) | `/api/academic-years` | — | — |

**Règles implémentées plusieurs fois.**
- Solde : la somme des paiements et l'échéancier dérivé (`syncPaymentPlanLedger`) coexistent ; la dérivation est déclenchée par les voies manuelles, pas par les confirmations en ligne (DA-10).
- Rattachement aux écoles : quatre règles (livrable 7 §8).
- Restriction des enseignants : appliquée aux élèves, pas aux notes ni aux bulletins (MS-02).

## 4. Couverture de tests (par niveau)

| Niveau | Volume | Ce que cela démontre | Ce que cela ne démontre pas |
|---|---|---|---|
| Unitaires (Vitest) | 4 170 réussis (375 fichiers) au 2026-10-15 | Logique isolée, routes avec Prisma **simulé** | Comportement SQL réel, RLS, concurrence |
| Intégration sur base réelle | 56 fichiers, 363 tests + 21 nouveaux | RLS, transactions, isolation (70 routes `[id]`), paiements, file de tâches, connexion | Navigateur, service worker, multi-processus |
| Précision des calculs | `tests/precision/*` (banc strict à 0 écart) | Moteur de moyennes | Recalculs longs |
| E2E Playwright | 13 fichiers de parcours (+ dossiers `audit`, `fresh-install`, `tour`) et recette 00→15 | Parcours écran réels (dernier passage complet de recette : 65/109, mémoire 2026-09-28) | Non relancé dans ce lot (navigateur non autorisé) |
| Charge | Scripts `scripts/quality/*` (mesures du 2026-10-01 et du 2026-10-15) | Débit d'une machine, 1 école | Multi-écoles, multi-instances |
| Résilience | Coupe-circuits (unitaires), panne de base (intégration) | Dégradation propre | Panne Redis réelle, panne fournisseur réelle |

**Parcours sensibles sans test suffisant** :
- concurrence de l'appel (SC-A-02) ;
- encaissements **simultanés** au guichet (SC-B-11) ;
- resynchronisation de l'échéancier après un paiement en ligne, et relances (DA-10) ;
- révocation et changement de rôle pour le personnel (R-MS-06) ;
- service worker (MS-03) ;
- mémoïsation multi-contextes (R-CA-04) ;
- export NETWORK_ADMIN multi-écoles (SC-C-05) ;
- modification concurrente d'une note (SC-B-01).

## 5. Priorisation (§22 de la mission)

| Rang | Constat | Catégorie | Impact | Probabilité | Récupération |
|---|---|---|---|---|---|
| 1 | DA-10 échéancier non resynchronisé après un paiement en ligne (relances, SMS, espace parent, plafond du guichet) ; SC-B-11 encaissements simultanés au guichet | Défaut observé dans le code ; conséquences plausibles non reproduites | Financier + relation avec les familles | Élevée dès qu'une famille avec échéancier paie en ligne | Se résorbe au prochain encaissement manuel sur le frais ; sinon rapprochement manuel |
| 2 | MS-03 service worker : réponses API en cache | Anomalie confirmée (configuration) | Fuite de données personnelles sur un appareil partagé | Moyenne (réseau lent ou coupé) | Aucune après coup |
| 3 | MS-01 révocation non appliquée (24 h) | Anomalie confirmée | Lecture de données scolaires après départ | Moyenne | Expiration |
| 4 | DA-03 / DA-04 suppression d'école ou de compte : cascade non tracée | Anomalie confirmée | Perte irréversible, plus de traçabilité | Faible (SUPER_ADMIN) | Sauvegarde seule |
| 5 | NAV-01 module RH inaccessible ; NAV-02 modules sans menu | Anomalie confirmée | Fonctionnalités livrées invisibles | Certaine | Correction de navigation |
| 6 | DA-01 doublons de présences | Anomalie structurelle | Statistiques et SMS faux | Moyenne (double clic) | Nettoyage |
| 7 | MS-02 notes de toute l'école lisibles par un enseignant | Anomalie confirmée + décision | Confidentialité interne | Certaine | — |
| 8 | DA-07 `isActive` modifiable par la direction | Anomalie de conception | Blocage d'école | Faible | Réactivation par la plateforme |
| 9 | MS-04 brouillon d'inscription | Anomalie confirmée | Données de mineur sur l'appareil | Moyenne | Effacement manuel |
| 10 | MS-05 `root/users` libre | Anomalie confirmée | Modification non tracée | Faible | — |
