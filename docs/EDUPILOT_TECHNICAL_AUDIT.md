# EduPilot — Audit technique (phase 1)

> 2026-11-24, branche `feat/parcours-ux-mobile` (base `e397776`). Fait suite à
> [`EDUPILOT_CURRENT_STATE.md`](EDUPILOT_CURRENT_STATE.md).
> Preuves : **[M]** mesuré aujourd'hui · **[C]** lu dans le code aujourd'hui · **[D]** audit antérieur
> du dépôt, non re-vérifié.
> Priorités : **P0** argent, fuite ou perte de données, ou CI bloquée · **P1** fiabilité du cœur et
> UX · **P2** différenciation · **P3** confort.

## 1. Mesures de référence

| Contrôle | Résultat | Preuve |
|---|---|---|
| Vérification de types | 0 erreur | [M] |
| Lint | propre | [M] |
| Tests unitaires | 4 553 verts, 5 ignorés | [M] |
| Tests d'intégration (PostgreSQL réel, base jetable) | **878 / 878 verts**, 103 fichiers, 144 s | [M] |
| Build de production | vert, 56 s ; contrôle « aucun secret dans l'artefact » réussi | [M] |
| `npm audit` (production) | **0 vulnérabilité** | [M] |
| `npm audit` (développement) | 14 (6 élevées : `effect`/`@prisma/config` via la CLI Prisma, `@serwist/build`, `zod` imbriqué ; 8 modérées : `minimatch`/`typescript-eslint`) ; aucune n'est livrée | [M] |
| CI sur `main` (`e397776`, 2026-11-18) | **Rouge** : 8 tests E2E d'accessibilité en échec (81 réussis) ; CD en échec sur `4d030d5` (Lighthouse `staticDistDir`, chemin d'outil de l'analyse Trivy de l'image) | [M] `gh run` |
| Web vitals, desktop | LCP 0,6-0,8 s, TBT ≤ 153 ms : dans le budget | [D] `audit-reports/webapp-2026-11-18` |
| Web vitals, mobile (4G lente émulée) | LCP **2,7-3,9 s**, TBT **0,6-1,8 s** : hors budget (2,5 s / 200 ms) | [D] idem |
| Charge sur `/` (un processus) | ~35 req/s à saturation ; p95 2,3 s à 50 utilisateurs simultanés, 0 erreur | [D] idem, `charge/` |

## 2. Constats

Chaque constat porte sa gravité, sa probabilité, sa preuve, son coût de correction et sa priorité.

### FIN-01 — Bourses appliquées une seule fois, à la création de l'échéancier · **P0** · ouvert, décision métier requise

- **Preuve [C]** : la seule lecture des bourses dans le calcul des montants dus est
  `src/app/api/payment-plans/route.ts:163-191`. Aucune autre partie de `src/lib/finance` ni des routes
  de paiement ne les lit. Le test `payment-collection-guard` « bourse active sans échéancier :
  comportement actuel conservé (montant plein du frais) » documente le comportement sans le corriger.
- **Effets** :
  1. Frais sans échéancier : bourse ignorée pour le reste à payer du parent, le plafond du guichet,
     les relances et les avis de paiement.
  2. Bourse accordée après la création de l'échéancier : aucun recalcul. Le parent est relancé pour
     le montant plein. C'est le scénario n° 6 exigé par la mission.
  3. Le modèle `Scholarship` n'a pas de lien vers un frais. Une bourse **en montant fixe** est donc
     déduite de *chaque* échéancier créé pour l'élève (scolarité, cantine, tenue…). Une bourse en
     pourcentage s'applique aussi aux frais facultatifs.
  4. `endDate` et `isActive` ne sont lus qu'à la création : une bourse retirée en cours d'année
     reste déduite.
- **Gravité** : élevée (montant réclamé faux, conflits parent/école). **Probabilité** : certaine dès
  qu'une école utilise les bourses.
- **Décisions à prendre avant de corriger** :
  - à quels frais une bourse s'applique (scolarité seule, liste de frais, tous) ;
  - que devient l'échéancier quand une bourse arrive en cours d'année (réduire les échéances
    restantes ou la dernière) ;
  - que faire d'un trop-perçu créé par une bourse rétroactive (remboursement ou avoir).
- **Coût** : moyen, environ 2 à 3 jours avec les tests sur base réelle. La correction doit
  centraliser « dû = frais − bourses applicables » dans `getFeeBalance` / `computeStudentBalances`.

### QA-01 — CI de `main` rouge depuis la mise à jour d'axe 4.14 · **P0 (bloque toute livraison)** · **corrigé, non commité**

- **Preuve [M]** : la règle axe `label-content-name-mismatch`, activée par la mise à jour Dependabot
  du 2026-11-18, échoue sur 8 pages. Seul en cause : le bouton de recherche de la barre du haut
  (`EduTopBar`), dont le texte visible « Rechercher… » ne figurait pas dans son nom accessible
  « Ouvrir la palette de commandes » (WCAG 2.5.3). En CI, `/login` et `/forgot-password` affichaient
  déjà la coque connectée, d'où leur échec.
- **Correction** : `aria-label` retiré et `aria-haspopup="dialog"` ajouté. Le test
  `tests/cov/comp-2/edu-shell.test.tsx` exige désormais ce comportement (échec vérifié avant le
  correctif, réussite après). L'audit axe complet de la CI repasse à **0 violation** sur
  `/dashboard`, `students`, `finance`, `messages`, `design-system` (admin) et `grades` (enseignant).
- **Reste** : pousser, puis réparer la CD (Lighthouse `staticDistDir`, chemin d'outil Trivy). La CD
  n'a encore jamais déployé.

### FIN-06 — Un paiement en ligne pouvait être validé à la main · **P0** · **corrigé le 2026-11-24**

- **Preuve [M]** : `PUT /api/finance/payments/[id]` avec `{ status: "VERIFIED" }` sur un paiement
  FedaPay en attente répondait **200**. L'argent était compté comme encaissé sans aucune
  confirmation du fournisseur. Un paiement annulé ou validé pouvait aussi repasser « en attente »
  (200). Les statuts `COMPLETED` et `FAILED`, inexistants en base, provoquaient une 500.
- **Correction** : règles de transition manuelles centralisées (`src/lib/finance/payment-state.ts`).
  Un paiement en ligne n'est validé que par le fournisseur, et le retour à PENDING est interdit,
  aussi par un **trigger en base** (`payments_no_return_to_pending`). Le schéma est limité aux
  statuts réels.
- **Tests** : 4 cas dans `provider-bound-edits.test.ts` (échec vérifié avant le correctif), dont
  une écriture SQL directe refusée.

### FIN-02 — Pas de journal des événements fournisseur · **P2**

- **Preuve [C]** : aucune table d'événements webhook. Rejouer une notification est sans danger : les
  tests `online-payment-binding` et `payment-fedapay-flow` le prouvent. Mais l'événement brut
  (identifiant, signature vérifiée, charge utile) n'est conservé nulle part.
- **Effet** : un litige avec le fournisseur, ou un rapprochement a posteriori, repose sur les notes
  du paiement et les journaux applicatifs.
- **Coût** : faible à moyen. Il faut un modèle `PaymentProviderEvent` (unique par fournisseur et par
  identifiant d'événement) écrit avant le traitement.

### FIN-03 — Machine à états des paiements implicite · **P2**

- **Preuve [C]** : les transitions de `PaymentStatus` (PENDING, VERIFIED, RECONCILED, CANCELLED,
  EXPIRED) sont codées dans `online-payments.ts`, `collection.ts`, `refunds.ts` et les routes.
- **Atténuation** : elles sont couvertes par plus de 100 tests sur base réelle (§3).
- **Risque** : une nouvelle route peut introduire une transition illégale sans qu'aucun contrôle
  central ne la refuse.
- **Coût** : faible. Il faut une table des transitions autorisées et une fonction `assertTransition`
  appelée par toutes les écritures, plus éventuellement un trigger en base.

### FIN-04 — Encaissements de scolarité absents de la comptabilité · **P1**

- **Preuve [C]** : `JournalEntry` (OHADA) n'est alimenté que par la paie et les cagnottes.
- **Effet** : le comptable ressaisit les encaissements ; la comptabilité et l'encaissé peuvent
  diverger sans alerte.
- **Coût** : moyen. Il faut des écritures générées à la validation, à l'annulation et au
  remboursement, dans la même transaction, plus une décision sur le plan de comptes.

### FIN-05 — Paiement groupé de plusieurs enfants absent · **P2**

- **Preuve [C]** : un `Payment` = un élève + un frais. Un parent de trois enfants fait trois
  transactions Mobile Money, donc trois fois les frais du fournisseur.

### OFF-01 — Aucun fonctionnement hors ligne pour les données · **P1**

- **Preuve [C]** : le service worker ne garde que les ressources statiques
  (`src/lib/pwa/cache-policy.ts`, choix de sécurité MS-03). Il n'y a ni file d'attente, ni
  IndexedDB, ni synchronisation ; seul un brouillon de notes en `localStorage` existe.
- **Effet** : l'appel et la saisie de notes échouent dès que le réseau tombe.

### OFF-02 — La page « Hors ligne » annonce des fonctions inexistantes · **P1** · petit correctif

- **Preuve [C]** : `src/app/(dashboard)/dashboard/offline/page.tsx:26-33` marque « Consultation
  dossier élève » et « Cahier de liaison · lecture » comme disponibles hors ligne, ce qui contredit
  la politique de cache réelle.

### INT-01 — Aucune passerelle EducMaster · **P2**

- **Preuve [M]** : aucune occurrence dans le code ni dans la documentation. L'existence d'une API ou
  d'un format d'export officiel reste à établir (phase 2).

### PERF-01 — Mobile lent : JavaScript trop lourd sur le fil principal · **P1**

- **Preuve [D]** : TBT de 0,6 à 1,8 s et LCP de 2,7 à 3,9 s sur mobile, alors que le desktop est
  bon. C'est le profil d'un coût d'hydratation et de JS client, pas d'un serveur lent (TTFB p50
  35 ms).

### PERF-02 — Rendu entièrement dynamique, débit public bas · **P2**

- **Preuve [D/C]** : environ 35 req/s sur `/`. Le nonce CSP impose le rendu dynamique de toutes les
  pages (`force-dynamic`, décision du 2026-06-13).
- **Effet** : à surveiller avant toute campagne publique (vitrine, annuaire). Ce n'est pas bloquant
  pour l'usage d'une école.

### PERF-03 — Vues famille des notes ~2 s · **P2** · DEF-003 [D]

### SEC-01 — Dépendances de développement vulnérables · **P3**

- **Preuve [M]** : rien n'est livré en production. À suivre avec Dependabot (CLI Prisma et Serwist
  build).

### Défauts antérieurs encore ouverts [D]

- **DEF-014** : `sharp` / `source-map-js`, sans correctif amont.
- **DEF-015** : test de seuil sous couverture.
- **DEF-018** : version de formule non tracée sur les moyennes stockées.
- **DEF-020** : taux de présence calculé sur un seul relevé.
- **IND-002** : recalcul d'arrière-plan non durable.
- **Escalade latente** en cumul de rôles STAFF + TEACHER.
- **TD-025** : réserves sur les paiements sans issue.

## 3. Scénarios financiers exigés par la mission (§7.F)

| Scénario | Couvert ? | Test (`tests/integration-db/`) |
|---|---|---|
| Deux parents paient simultanément | ✅ | `online-payments`, `parent-payment-journey`, `payment-collection-guard` |
| Même webhook reçu plusieurs fois | ✅ | `online-payment-binding`, `payment-fedapay-flow`, `online-payment-ledger` |
| Fournisseur confirme, requête initiale expirée | ✅ | `online-payments` (confirmation tardive, panne réseau 502) |
| Paiement inférieur à la tranche | ✅ | `installment-payment`, `payment-collection-guard` |
| Paiement supérieur au reste dû | ✅ | refus 400 ; trop-perçu tardif enregistré et signalé |
| Bourse appliquée après un premier paiement | ❌ **défaut FIN-01** | le test existant fige le comportement actuel |
| Paiement remboursé | ✅ | `payment-refunds` (y compris deux remboursements simultanés) |
| Transaction en attente depuis longtemps | ✅ | `online-payments`, `payment-collection-guard` (réservée après 24 h, alerte à 48 h) |
| Fournisseur confirme un montant différent | ✅ | `online-payments`, `parent-payment-journey` |
| Paiement pour plusieurs enfants | — sans objet | fonction absente (FIN-05) |
| Reçu par le mauvais compte marchand | ✅ | `online-payment-binding`, `parent-payment-journey` (compte de B visant A) |

**Verdict** : la fiabilité de l'encaissement en ligne est au-dessus de ce que la mission supposait.
Elle est démontrée par des tests de concurrence réels, pas seulement déclarée. Le maillon faible de
la finance n'est pas le paiement : c'est **le calcul du dû** (bourses), puis **la traçabilité
comptable**.

## 4. Points forts démontrés (à ne pas réécrire)

- Encaissement en ligne : verrou par élève et par frais, réservation des paiements en attente,
  montant et devise exacts, confirmation tardive, souveraineté du compte marchand. Plus de
  150 scénarios sur base réelle.
- Isolation multi-écoles : 333 routes sur 336 passent par le gestionnaire central, RLS forcée,
  `Cache-Control: private, no-store` imposé sur toutes les réponses privées
  (`src/lib/api/api-helpers.ts:365`), garde-fou en base contre les paiements entre écoles.
- Moteur de moyennes unique, banc de précision à 0 écart.
- Artefact de build contrôlé contre les fuites de secrets.

## 5. Non couvert par cette phase

- Revue du dossier APDP.
- Restauration de sauvegarde.
- Charge sur les routes authentifiées.
- Revue des modules secondaires (cantine, transport, LMS, examens).
- Garde-fous de l'IA au-delà de l'absence d'écriture directe en base dans `src/lib/ai` et
  `src/app/api/ai`.
- Re-balayage IDOR complet. Le dernier date d'octobre (70 routes `[id]`) [D].
