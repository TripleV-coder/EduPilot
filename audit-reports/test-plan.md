# Plan de tests — audit du 2026-10-14

## Périmètre

Application complète (API, moteur de calcul, base de données, interface critique « Mes notes »), sur
environnements locaux isolés. Hors périmètre : production, fournisseurs externes réels (paiement, SMS,
e-mail, LLM), infrastructure CI distante.

## Préconditions

- Dépendances installées (`npm ci`), client Prisma généré.
- Suite d'intégration : PostgreSQL éphémère embarqué (`tests/integration-db/global-setup.ts`).
- Tests dynamiques : base **jetable** `edupilot_audit` (port 5433, marqueur `edupilot:disposable`),
  migrations appliquées, mots de passe des comptes de démonstration réinitialisés par
  `scripts/reset-passwords.ts` (garde « base jetable »), rôle applicatif `edupilot_app` soumis à la RLS,
  serveur `next start` (build de production) sur le port 3100.
- Aucune opération sur la base de développement (port 5432) autre que des lectures.

## Campagnes et méthodes

| # | Campagne | Méthode | Outil / preuve |
|---|---|---|---|
| T1 | Baseline qualité | type-check, lint, build | `evidence/03,04,07` |
| T2 | Tests unitaires existants | Vitest, 371 fichiers | `evidence/05` |
| T3 | Tests d'intégration existants | vraie base PostgreSQL | `evidence/06` |
| T4 | Grammaire et sécurité du moteur de formules | nouveaux tests | `tests/precision/formula-engine.audit.test.ts` |
| T5 | Exactitude : oracle indépendant | fractions BigInt écrites dans le test, fast-check graine `20261014`, 2 000 + 1 000 cas | idem |
| T6 | Scénarios dynamiques de formules (S1–S9) | serveur réel, oracle recalculé depuis les notes brutes de l'API | `evidence/formula-scenarios.mjs`, `evidence/37` |
| T7 | Sécurité dynamique | `scripts/quality/security.mjs` + sonde XFF discriminante + en-têtes HTTP | `evidence/23,24,25,26` |
| T8 | Fumée de toutes les routes GET, 7 rôles | `scripts/quality/smoke.mjs ALL` | `evidence/28` |
| T9 | Latence répétée | `scripts/quality/latency.mjs` (20–30 répétitions) | `evidence/29,30,31` |
| T10 | Charge | autocannon 10 connexions × 15 s, 3 répétitions | `evidence/35-load-rep*` |
| T11 | Schéma de base | `migrate diff` migrations↔schéma (base vierge) et base réelle↔schéma, `migrate status` | `evidence/11,12,13` |
| T12 | Parcours navigateur | navigateur intégré : connexion élève → « Mes notes », cohérence affichage/API, console, réseau | session navigateur (captures) |
| T13 | Dépendances | `npm audit` avant/après | `evidence/09,55` |
| T14 | Régression après corrections | T1–T5 relancés + T6–T9 sur le nouveau build | `evidence/6x`, `7x` |

## Données de test

- Unitaires/oracle : générées, reproductibles (graine fixe), notes entières en centièmes de 0 à 20.
- Base jetable : seed volumineux du projet (3 écoles, 995 élèves, 131 208 notes, 3 697 évaluations).

## Tolérances

Égalité **exacte** imposée pour toutes les moyennes : le moteur calcule en fractions rationnelles et
publie un arrondi au centième (demi vers le haut). Aucune tolérance flottante n'est admise ; l'écart
attendu est 0 en fraction comme en centièmes.

## Limites connues du plan

- E2E Playwright (31 specs) : bloqués, navigateurs non installés.
- Concurrence de modifications de formules (scénario 8) : non exécuté.
- Gel des formules par conseil validé : non exercé dynamiquement (aucun conseil dans la classe testée) ;
  couvert seulement par les tests unitaires existants.
- Tests de mutation : non exécutés (aucun outil installé dans le projet).
- Sauvegarde/restauration : bloqué (`pg_dump` absent).
