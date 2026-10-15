# Rapports d'audit — EduPilot, 2026-10-14

Commencer par `executive-summary.md`, puis `final-verdict.md`.

| Fichier | Contenu |
|---|---|
| `executive-summary.md` | état général, principaux défauts, actions prioritaires |
| `final-verdict.md` | 13 dimensions, critères, verdict (C — prêt sous réserves) |
| `project-inventory.md` | stack, architecture, environnements |
| `test-plan.md` | périmètre, préconditions, campagnes, tolérances, limites |
| `test-results.md` | résultats détaillés (baseline, après corrections, bloqués) |
| `static-analysis.md` | lint, types, indicateurs, code mort, architecture |
| `security-audit.md` | authentification, autorisation, injections, en-têtes, dépendances |
| `calculation-engine-audit.md` | moteur de formules : architecture, oracle, scénarios S1–S10, verdict |
| `numerical-validation.md` | calculs contrôlés, références, écarts |
| `database-schema-audit.md` | schéma Prisma ↔ migrations ↔ bases réelles |
| `performance-report.md` | protocole, fumée, latence avant/après, charge |
| `coverage-report.md` | couverture mesurée et ses limites |
| `defects-register.md` | 20 défauts + 2 indices, statut |
| `remediation-log.md` | corrections appliquées et vérifications |
| `machine-readable-results.json` | indicateurs, campagnes, défauts (schéma en tête du fichier) |
| `evidence/` | journaux de chaque commande (`commands.tsv` : nom, code de sortie, durée, commande), scripts de sonde |

## Rejouer les vérifications

- `evidence/run.sh <nom> <commande…>` : exécute et journalise (identifiants de connexion masqués).
- Suite du moteur : `npx vitest run tests/precision/formula-engine.audit.test.ts` (graine `20261014`).
- Scénarios sur serveur : voir l'en-tête de `evidence/formula-scenarios.mjs` (base **jetable** uniquement,
  préparation décrite dans `scripts/quality/README.md`).
