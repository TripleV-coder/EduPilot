# Journal des corrections — 2026-10-14

Toutes les corrections ont été faites **après** la baseline (`evidence/01`–`09`, commit `75b2377`).
Ordre chronologique. Aucune correction n'a modifié une règle métier pour faire passer un test.

| # | Défaut | Fichiers modifiés | Changement | Vérification ciblée | Vérification globale |
|---|---|---|---|---|---|
| 1 | DEF-002 | `src/lib/academic/average-engine.ts` | garde-fou [0;20] → « NC » sur la moyenne annuelle (fermeture `fullMean`) | `evidence/50` : 85/85 (audit + `tests/lib/academic`) | `evidence/60–64` |
| 2 | DEF-003 | `src/lib/academic/class-averages.ts` | `studentAveragesSummary` : calcul annuel et calculs de période en parallèle | `evidence/51` : 138/138 (routes grades, orientation/me, bulletins, règles, banc de précision) ; latences `evidence/75`, `76` ; S1 identique `evidence/71` | idem |
| 3 | DEF-006 | `src/components/grades/family-grades.tsx` | clé SWR `null` pour l'élève (liste des enfants réservée au parent) | navigateur : plus d'appel `/api/students`, plus de 403 | idem |
| 4 | DEF-005 | `tests/precision/precision.test.ts` | délai de 60 s sur le bloc A (import à froid des routes) ; assertions inchangées | suite complète verte `evidence/62` | idem |
| 5 | DEF-011 | `scripts/quality/security.mjs` | contrôle H3 remplacé par un test discriminant (compteur par compte, IP usurpée différente à chaque essai) ; `loginAttempts` accepte une fonction d'IP ; utilitaire `statuses` devenu inutile retiré | `evidence/74` : H3 PASS | — |
| 6 | DEF-001, DEF-004, DEF-007 | `package.json`, `package-lock.json` | `next`/`eslint-config-next` ~16.3.8 ; override `axios` ^1.20.0 ; override ciblé `brace-expansion@^5` ^5.0.12 ; `dompurify` ^3.4.17 ; `vitest`/`@vitest/coverage-v8` ^4.1.11 | `evidence/55` : prod 0 critique, 2 élevés restants | `evidence/60–64` |

Ajouts (aucun comportement de production modifié) :
- `tests/precision/formula-engine.audit.test.ts` : 40 tests (grammaire, sécurité, oracle exact, propriétés, limites).
- `audit-reports/` : rapports et preuves (`evidence/`), scripts de sonde en lecture seule ou sur base jetable.

## Résultats de la régression complète (après corrections)

| Contrôle | Résultat | Preuve |
|---|---|---|
| `npm run type-check` | 0 erreur | `evidence/60` |
| `npm run lint` | 0 erreur | `evidence/61` |
| `npx vitest run` | 372 fichiers, **4 138 réussis**, 11 ignorés, 0 échec | `evidence/62` |
| `npm run test:integration` | 54 fichiers, **344 réussis** | `evidence/63` |
| `npm run build` | réussi (next 16.3.8) | `evidence/64` |
| Sécurité dynamique | 11/12 (DEF-010 restant) | `evidence/74` |
| Scénarios de formules (serveur corrigé) | 9/9 | `evidence/71` |

## Corrections non appliquées (proposées)

DEF-008 (validation par intervalles ou refus des formules non affines), DEF-009 (exiger `;` dans les
fonctions), DEF-010 (401 au lieu de 500), DEF-012 (regrouper/annuler les recalculs par école, ou passer par
la file `background_jobs`), DEF-016 (`SETUP_TOKEN`), DEF-017 (contraintes `CHECK`), DEF-019 (`callbackUrl`
validé même origine), DEF-003 restant (cache par classe). Raisons : changement de comportement ou de contrat
nécessitant une décision produit, ou correction non minimale.

## Opérations sur les environnements

- Base de développement (5432) : lecture seule ; base temporaire `audit_shadow_20261014` créée puis supprimée.
- Base jetable (5433, `.quality-tmp/pg`) : migrations appliquées, marquée jetable (`--allow-non-empty`),
  rôle `edupilot_app` créé, mots de passe de démonstration réinitialisés, réglages de calcul modifiés puis
  **restaurés** (vérifié : S1bis).
- Aucune donnée réelle touchée, aucun déploiement, aucun push pendant l'audit.
