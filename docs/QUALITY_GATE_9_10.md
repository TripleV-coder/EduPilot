# Grille 9/10 — EduPilot

Grille de sortie utilisée pour valider qu'aucune dimension ne redescend sous `9/10`.

## Dimensions

| Dimension | Critère bloquant | Vérification |
|-----------|------------------|--------------|
| Tests | `npm run test:coverage` vert avec seuils par périmètre | CI `unit-tests` + audit local |
| E2E | Auth, finance, notes, parent, tenant isolation verts | CI `e2e` |
| Performance | Lighthouse performance >= `0.90` sur pages publiques critiques | `lighthouse-ci.yml` |
| Accessibilité | Axe + Lighthouse a11y >= `0.90` sur public + dashboard critique | `e2e/a11y.spec.ts` + LHCI |
| Sécurité | MFA, RBAC, tenant isolation, backup API fermée par défaut | tests API/E2E + revue config |
| Scalabilité | Redis obligatoire en production, health contract stable | `docs/OPERATIONS.md`, `/api/health` |
| Prod Ready | Build, smoke, migrations, déploiement staging/prod paramétrés | `ci-cd.yml` |
| Maintenabilité | Logique critique extraite progressivement hors routes, docs alignées | revue PR |
| Documentation | Docs ops/testing/prod cohérentes avec le code | audit manuel + CI |
| Observabilité | Web Vitals remontés, health check détaillé, logs structurés | code + dashboards |

## Commandes minimales avant merge

```bash
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
```

## Règles de rechute interdites

- Ne pas repasser Lighthouse performance en `warn`.
- Ne pas réintroduire de fallback mémoire en production pour le rate limiting distribué.
- Ne pas rouvrir l'API de backup en production sans `ALLOW_BACKUP_API_IN_PRODUCTION=true`.
- Ne pas ajouter de nouvelle route critique sans test comportemental associé.
