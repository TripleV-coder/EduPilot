# Rapport de couverture — 2026-10-14

## Mesure

Commande : `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary
--coverage.reportOnFailure` (`evidence/80`), après corrections, outil `@vitest/coverage-v8` 4.1.11
(aligné sur Vitest 4.1.11).

**Population** : tests **unitaires uniquement** (372 fichiers ; la suite d'intégration est exclue par
`vitest.config.ts`). **Périmètre instrumenté** (`vitest.config.ts`) : `src/lib/**/*.ts`,
`src/components/edu/**/*.tsx`, `src/components/messaging/**/*.tsx`, `src/app/api/**/*.ts` — **576 fichiers**.
Non instrumentés : pages (`src/app/(dashboard)/**`), la plupart des composants, `src/proxy.ts`.

| Mesure | Couvert / total | Taux |
|---|---|---|
| Instructions | 17 084 / 22 420 | 76,19 % |
| Branches | 10 743 / 15 951 | 67,35 % |
| Fonctions | 2 606 / 3 575 | 72,89 % |
| Lignes | 15 838 / 20 363 | 77,77 % |

Exécution de la mesure : 4 137 réussis, **1 échoué**, 11 ignorés — l'échec est `tests/lib/redis/outage.test.ts`
(délai 375 ms > 300 ms sous instrumentation ; réussi 3/3 sans instrumentation, `evidence/81`). La couverture
est donc calculée sur une exécution où ce test a échoué ; son impact sur les taux est négligeable mais non nul.

## Fichiers critiques

| Fichier | Lignes | Branches | Fonctions |
|---|---|---|---|
| `src/lib/academic/formula.ts` | 97,41 % | 88,10 % | 97,50 % |
| `src/lib/academic/average-engine.ts` | 96,15 % | 90,60 % | 98,00 % |
| `src/lib/academic/rational.ts` | 100 % | 88,63 % | 100 % |
| `src/lib/academic/class-averages.ts` | 66,11 % | 47,36 % | 67,56 % |
| `src/lib/api/api-helpers.ts` | 90,17 % | 82,35 % | 92,59 % |
| `src/lib/rate-limit.ts` | 72,80 % | 63,44 % | 64,70 % |

`class-averages.ts` (chargement des classes, gel des conseils, rangs par promotion) est le moins couvert des
fichiers de calcul ; il est en revanche exercé par la suite d'intégration et le banc de précision, non comptés ici.

## Couverture fonctionnelle (hors code)

| Parcours / règle | Couvert par |
|---|---|
| Formule officielle, arrondis, statuts de notes | unitaires + oracle (2 000 cas) + banc de précision + serveur réel (33 moyennes) |
| Modification des formules (école) | serveur réel S1–S9 |
| Formules enseignant / élève | tests unitaires d'API existants (mocks) — **pas** de scénario sur serveur réel |
| Gel au conseil de classe | tests unitaires existants — **pas** en dynamique |
| Isolation inter-établissements | intégration (RLS) + serveur réel (H5, TENANT, S9) |
| Parcours utilisateur complets | 1 parcours navigateur (élève) ; **E2E Playwright non exécutés** |

## Limites

- Couverture ≠ capacité à détecter les défauts : aucun test de mutation exécuté.
- Pas de comparaison avant/après : la mesure de baseline (`evidence/08`) n'a produit aucun résumé.
- Les tests d'intégration (344) ne contribuent pas à ces chiffres ; le projet dispose d'un script de fusion
  (`npm run test:coverage:all`) non exécuté pendant l'audit.
