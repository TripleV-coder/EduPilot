# EduPilot — Fiabilité financière

> 2026-11-24. Règles **en vigueur dans le code** (avec leur fichier source) et évolutions proposées.
> Audit : [`EDUPILOT_TECHNICAL_AUDIT.md`](EDUPILOT_TECHNICAL_AUDIT.md). Guide utilisateur :
> `docs/guide-utilisateur/09-finance.md`.

## 1. Le dû (ce que la famille doit)

| Situation | Dû | Source |
|---|---|---|
| Frais avec échéancier en vigueur | total de l'échéancier, tenu aligné sur les bourses | `syncScholarshipPlans` |
| Frais sans échéancier | montant du frais − remise des bourses applicables | `loadScholarshipDiscounts` |
| Frais facultatif non souscrit | non dû | `applicableFamilyFees` |
| Montants | FCFA entiers, jamais de centimes | `money.ts` |

**Encaissé** = paiements VERIFIED + RECONCILED, remboursements (montants négatifs) inclus.
**Réservé** = paiements en ligne PENDING, quel que soit leur âge.
**Reste dû** = dû − encaissé. **Disponible pour un nouveau paiement** = reste dû − réservé.
Un seul calcul fait autorité côté serveur : `getFeeBalance` (`online-payments.ts`). Le guichet, le
paiement en ligne et l'espace parent l'utilisent tous.

## 2. Imputation et modes de paiement

- **Imputation chronologique** : un versement remplit les échéances de la plus ancienne à la plus
  récente (`syncPaymentPlanLedger`). Un remboursement est déduit du paiement qu'il annule.
- **Mode A, montant libre** (`mode: "AMOUNT"`) : plafonné au disponible, sous verrou.
- **Mode B, tranches** : `NEXT_INSTALLMENT` (montant recalculé par le serveur, celui de la requête
  est ignoré) ou `FULL_BALANCE`. Le parent ne choisit pas une tranche arbitraire : cela découle de
  l'imputation chronologique, et l'école n'a pas demandé le contraire (Q-FIN-02).

## 3. Bourses et réductions (FIN-01, corrigé le 2026-11-24)

Décisions validées par le fondateur le 2026-11-24 :

1. **Frais visés : décision de l'école**, bourse par bourse (`Scholarship.feeIds`). Par défaut,
   tous les frais obligatoires.
2. **Bourse annuelle** : elle s'applique au montant annuel entier si sa période recoupe l'année
   scolaire en cours, quelle que soit la date d'octroi (pas de prorata). *Pourquoi* : une bourse
   est attribuée pour une année. Un prorata pénaliserait l'élève selon la date de la commission,
   que l'élève ne choisit pas.
3. **Montant fixe = une enveloppe**, répartie sur les frais visés (échéance la plus proche
   d'abord), jamais déduite deux fois. **Pourcentage** : appliqué frais par frais. La remise
   cumulée ne dépasse jamais le montant du frais.
4. **Échéancier en cours** : la baisse est retirée **en partant de la dernière échéance**. Une
   échéance ramenée à 0 est annulée ; une hausse (bourse retirée) va sur la dernière échéance.
   *Pourquoi* : les versements s'imputent de la plus ancienne à la plus récente. Réduire par la fin
   ne modifie donc jamais une échéance déjà couverte, sauf en dernier recours, et le parent voit
   ses dernières échéances baisser ou disparaître.
5. **Trop-perçu → remboursement** : la direction et la comptabilité sont alertées avec le montant.
   Rien n'est effacé, et le remboursement passe par l'extourne tracée (§5) au moment où l'argent
   est rendu. *Pourquoi* : seul l'humain qui rend l'argent peut attester qu'il a été rendu.

Atomicité : la création, la modification ou la suppression d'une bourse et le recalcul des
échéanciers se font dans **une transaction**, sous le verrou élève/frais. Un encaissement simultané
au guichet est testé.

## 4. Machine à états d'un paiement

État actuel (`PaymentStatus`), transitions codées dans `online-payments.ts`, `collection.ts` et
`refunds.ts` :

```
PENDING ──(webhook signé ou fournisseur : payé, bon montant et bonne devise)──▶ VERIFIED ──(rapprochement)──▶ RECONCILED
   │  ├─(échec ou expiration définitifs chez le fournisseur)─▶ CANCELLED (source PROVIDER)
   │  ├─(annulation par l'école)──────────────────────────────▶ CANCELLED (source MANUAL)
   │  └─(échec prouvé de l'initialisation)─────────────────────▶ EXPIRED
   └─ 24 h sans réponse : le fournisseur est interrogé ; incertain → reste PENDING (réservé), alerte à 48 h
CANCELLED / EXPIRED ──(confirmation authentique tardive)──▶ VERIFIED (état antérieur noté, trop-perçu signalé)
VERIFIED / RECONCILED ──(remboursement)──▶ extourne : ligne négative liée (refundOfId), l'original reste VERIFIED
```

| État | Effet sur le reste dû |
|---|---|
| PENDING | réservé : bloque le disponible, ne réduit pas le reste dû |
| VERIFIED, RECONCILED | encaissé |
| CANCELLED, EXPIRED | aucun (réservation libérée) |
| Extourne (montant négatif) | réduit l'encaissé |

**Transitions manuelles (FIN-03 / FIN-06, fait le 2026-11-24)** : `src/lib/finance/payment-state.ts`.
1. Aucun paiement ne revient à PENDING, garanti aussi par un trigger en base.
2. Un paiement en ligne n'est jamais validé à la main ; il n'est rapproché qu'une fois validé.
3. L'annulation manuelle reste possible (lot 3b) : une confirmation authentique tardive revalide
   alors le paiement et alerte la comptabilité.
REFUNDED et DISPUTED restent modélisés par l'extourne et la note « à rapprocher », plutôt que par
de nouveaux états : cela évite de toucher plus de 150 tests verts pour un gain nul.

## 5. Remboursements

Extourne : ligne négative validée d'emblée, liée au paiement, avec motif obligatoire. Le cumul est
plafonné sous verrou (`refunds.ts`). Paiement en ligne : l'argent est rendu depuis l'espace FedaPay
de l'école, puis tracé dans EduPilot. Aucun appel de remboursement automatique au fournisseur.

## 6. Souveraineté des fonds

Chaque école encaisse sur **son** compte marchand FedaPay (ADR-0011, secrets chiffrés). Le compte
global est refusé pour les frais scolaires, et un garde-fou en base empêche tout paiement entre
deux écoles. FedaPay propose un mode **Marketplace** à sous-comptes ([docs](https://docs-v1.fedapay.com/sub-accounts)),
réservé à un compte validé comme Marketplace, et sa répartition des frais n'est pas documentée
publiquement. **Recommandation** : ne pas l'utiliser pour la scolarité. Facturer les frais de
service d'EduPilot à part (abonnement), jamais par prélèvement sur les fonds scolaires, sans
validation juridique (activité réglementée).

## 7. Journal et traçabilité (évolutions)

- **FIN-02** : table `PaymentProviderEvent` (fournisseur, identifiant d'événement unique, signature
  vérifiée, charge utile, résultat du traitement), écrite avant le traitement. Un webhook rejoué
  est alors visible et rejouable.
- **FIN-04** : écritures OHADA générées automatiquement à la validation, à l'annulation et au
  remboursement des frais de scolarité, dans la même transaction. Le plan de comptes est à valider
  avec un comptable (prérequis).

## 8. Tests qui font foi

Les 11 scénarios du §7.F de la mission sont détaillés dans `EDUPILOT_TECHNICAL_AUDIT.md` §3. Le
scénario n° 6 (bourse après un premier paiement) est désormais couvert par
`tests/integration-db/scholarships-due.test.ts` (10 cas sur base réelle, dont la concurrence) et
`tests/lib/finance/scholarships.test.ts` (13 cas de règles pures).
