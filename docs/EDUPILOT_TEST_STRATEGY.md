# EduPilot — Stratégie de test

> 2026-11-24. Chiffres **mesurés** dans cette session.

## 1. État mesuré

| Niveau | Volume | Résultat | Commande |
|---|---|---|---|
| Unitaires et composants (jsdom) | 418 fichiers | 4 566 réussis, 5 ignorés (après ce lot) | `npm test` |
| Intégration sur PostgreSQL réel (base jetable) | 104 fichiers | 888 réussis (après ce lot) | `npm run test:integration` |
| E2E Playwright (CI) | 15 scénarios, 95 tests | 81 réussis, 8 échecs axe sur `main` → corrigés dans ce lot | CI |
| Accessibilité | axe 4.14, WCAG 2.1 AA | 0 violation sur les 6 pages vérifiées | `e2e/a11y.spec.ts` |
| Précision des calculs | banc de formules | 0 écart [D] | `tests/precision` |
| Build et secrets | build de production | vert, aucun secret | `npm run build` |

## 2. Règles

1. **Toute règle d'argent se teste sur base réelle**, jamais sur Prisma simulé. Les verrous, la RLS
   et les triggers n'existent que dans PostgreSQL.
2. **La concurrence est réellement lancée** (`Promise.all` contre PostgreSQL), pas simulée.
3. **Chaque défaut corrigé a un test de non-régression**, qui échoue avant le correctif et passe
   après (QA-01 vérifié ainsi).
4. **Un test ne fige jamais un défaut** : l'ancien test « bourse… comportement actuel conservé »
   a été renommé pour décrire la vraie règle.
5. **Isolation des tests** : données propres à chaque test (niveau, école). Le partage du niveau
   « BOURSE » faussait l'enveloppe fixe.

## 3. Manques à combler (par priorité)

| Manque | Pourquoi | Priorité |
|---|---|---|
| Balayage IDOR automatique de toutes les routes `[id]` | Les routes récentes n'ont pas été rejouées | P1 |
| Charge sur routes authentifiées (notes, finance, appel) | Seule `/` est mesurée | P1 |
| Restauration de sauvegarde chronométrée | Promesse d'exploitation non prouvée | P1 |
| Synchronisation hors ligne (coupure, rejeu, conflit) | À créer avec OFF-01 | P1 |
| Contrats API (OpenAPI ↔ réponses réelles) | `docs/openapi.json` peut dériver | P2 |
| Couverture réelle des routes | L'heuristique donne ≈ 290/336, ce qui surestime | P2 |
