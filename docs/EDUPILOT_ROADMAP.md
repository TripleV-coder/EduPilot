# EduPilot — Feuille de route priorisée (phase 5)

> 2026-11-24. Efforts en jours d'un développeur. ✅ = fait dans ce lot (voir
> [`EDUPILOT_CHANGELOG.md`](EDUPILOT_CHANGELOG.md)).

## P0 — argent, fuites, livraison bloquée

| ID | Problème | Fichiers | Tests / acceptation | Effort | État |
|---|---|---|---|---|---|
| FIN-01 | Bourses ignorées sans échéancier, jamais recalculées, montant fixe déduit plusieurs fois | `lib/finance/scholarships.ts`, `online-payments.ts`, `expected-fees.ts`, `payment-notices.ts`, routes `scholarships`, `payment-plans`, dialogue | 13 unitaires + 10 sur base réelle (dont concurrence) ; dû identique partout | 2 | ✅ |
| QA-01 | CI `main` rouge (axe 4.14) | `EduTopBar.tsx` | 0 violation axe sur 6 pages ; test composant | 0,2 | ✅ (à pousser) |
| OPS-01 | CD jamais déployée : job Lighthouse sans serveur, `trivy-action@master` cassé, **étiquette d'image `sha-` jamais produite** (type=sha ignore `value`), références d'image en majuscules | `.github/workflows/ci-cd.yml`, `ci.yml` | Une exécution CD verte jusqu'au déploiement (vérifiable au prochain passage sur `main`) ; secrets `STAGING_DEPLOY_COMMAND` / `*_DATABASE_URL` requis | 0,5 | ✅ corrigé, à confirmer sur `main` |

## P1 — fiabilité du cœur et expérience

| ID | Problème | Fichiers | Dépendances | Acceptation | Effort |
|---|---|---|---|---|---|
| OFF-02 | Page hors ligne mensongère | `dashboard/offline/page.tsx` | — | Liste conforme à `cache-policy.ts` | ✅ |
| SEC-03 | Balayage IDOR à rejouer sur les routes récentes | `tests/integration-db/` | — | Toute route `[id]` refuse une autre école | 1 |
| FIN-04 | Encaissements absents de la comptabilité | `lib/accounting`, `online-payments.ts`, `collection.ts`, `refunds.ts` | Plan de comptes validé | Écriture équilibrée par validation, annulation et remboursement ; somme compta = encaissé | 3 |
| OFF-01 | Appel et notes hors ligne | nouveau `lib/offline/`, pages appel et notes, routes avec clé d'idempotence | — | Coupure réseau simulée : aucune saisie perdue, conflits présentés, aucun doublon | 5-8 |
| PERF-01 | Mobile : TBT 0,6 à 1,8 s | écrans dashboard, students, finance | — | TBT < 300 ms, LCP < 2,5 s en 4G lente | 3-5 |
| FIN-03 | Transitions de paiement implicites | `lib/finance/payment-state.ts` + migration trigger | — | Transition illégale refusée en base ; 150+ tests toujours verts | 1,5 |

## P2 — différenciation

| ID | Sujet | Dépendances | Effort |
|---|---|---|---|
| FIN-02 | Journal des événements fournisseur | — | 1,5 |
| REC-01 | Reçus vérifiables par QR (page publique de vérification sans donnée personnelle) | — | 2 |
| FIN-05 | Paiement de plusieurs enfants en une transaction (répartition serveur, un verrou par élève et par frais) | FIN-02 conseillé | 4 |
| INT-01a | Matricule EducMaster de l'élève (fiche, import, bulletin, unicité) | — | ✅ 2026-11-24 |
| INT-01b | Export des notes au gabarit EducMaster + import des listes | **Gabarit officiel** (à obtenir d'une école pilote ou du MESTFP) | 3-5 |
| BIZ-01 | Grille tarifaire publique + essai de 30 jours | Décision fondateur | 1 |
| PIL-01 | 1 à 3 écoles pilotes avec indicateurs avant/après | Commercial | — |
| SEC-02 | Cumul de rôles sûr | Décision produit | 2 |

## P3 — expansion

IA (accélérer l'inférence ou proposer un serveur GPU mutualisé, avec mesure), API publique
documentée avec webhooks sortants, multi-pays (devises, calendriers), facture électronique
normalisée (marché ivoirien, cf. Lakoli).

## Ordre conseillé des prochaines sessions

1. Pousser QA-01 et réparer la CD (OPS-01).
2. SEC-03, puis FIN-03 et FIN-02 (petits, sûrs, renforcent la promesse n° 1).
3. FIN-04 dès que le plan de comptes est validé.
4. OFF-01.
5. PERF-01.
