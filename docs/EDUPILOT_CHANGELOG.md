# EduPilot — Modifications effectivement apportées (mission du 2026-11-24)

Branche `feat/parcours-ux-mobile`, **non commité** à la date de rédaction.

## Correctifs

### FIN-01 — Bourses justes partout (P0, finance)
- Nouveau `src/lib/finance/scholarships.ts` : source unique du dû après bourse (frais visés,
  bourse annuelle, enveloppe fixe unique, réduction en partant de la dernière échéance, trop-perçu
  signalé).
- `Scholarship.feeIds` (migration `20261124100000_scholarship_fee_targets`, rétrocompatible : vide =
  frais obligatoires).
- Dû sans échéancier corrigé dans `getFeeBalance` (guichet, paiement en ligne, parent),
  `computeStudentBalances`, `computeStudentFeeDues`, `computePlanlessExpected`.
- Avis de paiement : utilisaient le montant plein même avec un échéancier ; ils prennent désormais
  le total de l'échéancier ou le frais moins les bourses.
- Création d'échéancier : même règle que partout (plus de calcul local).
- Routes des bourses : création, modification et suppression **transactionnelles avec recalcul**
  des échéanciers ; frais visés vérifiés (même école) ; montant **ou** pourcentage (passer de l'un
  à l'autre efface l'autre) ; alerte « Trop-perçu à rembourser » à la direction et à la
  comptabilité.
- Dialogue « Nouvelle bourse » : choix des frais concernés, message de trop-perçu.
- Guide utilisateur `09-finance.md` §9.4, §9.6, §9.7 mis à jour.
- Tests : `tests/lib/finance/scholarships.test.ts` (13), `tests/integration-db/scholarships-due.test.ts`
  (10, dont la concurrence avec le guichet) ; test historique renommé.

### QA-01 — CI rouge depuis axe 4.14 (P0)
- `EduTopBar` : bouton de recherche sans `aria-label` (nom = texte visible, WCAG 2.5.3),
  `aria-haspopup="dialog"`. Test composant mis à jour (échec vérifié avant le correctif).

### OFF-02 — Page « Hors ligne » honnête (P1)
- Liste alignée sur la politique de cache réelle : aucune donnée scolaire n'est annoncée hors
  ligne.

### Chantier mobile (sessions du 2026-11-23 et 2026-11-24)
- Saisie de notes en 390 px : colonne « Élève » figée, « Évolution » masquée sous 640 px ;
  `--mobile-nav-h`, appel, bandeau cookies (voir mémoire du chantier).

## Documentation produite
`EDUPILOT_CURRENT_STATE`, `TECHNICAL_AUDIT`, `COMPETITIVE_INTELLIGENCE`, `COMPETITIVE_SCORECARD`,
`PRODUCT_STRATEGY`, `TARGET_ARCHITECTURE`, `FINANCIAL_RELIABILITY`, `SECURITY_AUDIT`, `ROADMAP`,
`TEST_STRATEGY`, ce journal.

## Non fait (volontairement)
- Rien n'est poussé ni déployé, aucune base réelle n'a été modifiée.
- `scholarshipSchema` de `lib/validations/finance.ts` (types `SPORTS`/`ACADEMIC` inexistants en
  base) : utilisé uniquement par des tests, laissé en l'état et signalé.
