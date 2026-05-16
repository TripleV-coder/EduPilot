<!--
Merci de votre contribution à EduPilot.
Cochez chaque case avant de soumettre.
-->

## Résumé
<!-- Décrire le changement en 1–3 phrases : pourquoi, pas seulement quoi. -->

## Type de changement
- [ ] feat (nouvelle fonctionnalité)
- [ ] fix (correction de bug)
- [ ] perf (amélioration de performance)
- [ ] refactor (changement sans impact fonctionnel)
- [ ] chore / build / ci
- [ ] docs

## Modules impactés
<!-- ex: auth, finance, library, dashboard, prisma schema, etc. -->

## Ticket / Issue
Closes #

## Captures d'écran (si UI)
<!-- Drag & drop l'image ou colle l'URL -->

## Checklist auteur

### Code
- [ ] `npm run type-check` passe en local (0 erreur)
- [ ] `npm run lint` passe en local (0 erreur)
- [ ] `npm run test` passe en local (tous tests verts)
- [ ] `npm run test:e2e` exécuté si UI critique modifiée
- [ ] Pas de `console.log`, `debugger`, `TODO` non documenté
- [ ] Pas de `any` ajouté (sauf justification documentée dans le PR)

### Sécurité
- [ ] Aucun secret commité (vérifier `.env*`)
- [ ] Validation Zod sur tous les nouveaux endpoints API
- [ ] Vérification RBAC (`requiredPermissions` ou `allowedRoles`) sur les routes
- [ ] Pas de SQL brut sans paramètre — Prisma uniquement
- [ ] Isolation tenant (`schoolId`) respectée si données scoped

### Données
- [ ] Migration Prisma générée si schema changé (`prisma migrate dev`)
- [ ] Seed mis à jour si nouvelles entités requises au démarrage
- [ ] Index ajouté sur les nouvelles colonnes filtrées fréquemment

### Tests
- [ ] Tests unitaires ajoutés (validations, helpers, pure functions)
- [ ] Tests d'intégration ajoutés si nouvelle route API critique
- [ ] Tests E2E ajoutés/mis à jour si parcours utilisateur impacté

### Documentation
- [ ] README / CHANGELOG mis à jour si feature visible
- [ ] ADR créé si décision architecturale (>200 lignes ou nouvelle abstraction)
- [ ] Runbook mis à jour si nouveau type d'incident possible

### A11y / UX (si UI)
- [ ] Navigation clavier testée (Tab, Enter, Esc)
- [ ] Labels ARIA présents sur les contrôles sans texte visible
- [ ] Contraste vérifié (devtools accessibility checker)
- [ ] États gérés : loading, empty, error, success

## Plan de test
<!-- Comment vérifier que ça marche, étape par étape -->
1.
2.
3.

## Risques connus / dette technique introduite
<!-- Si applicable, sinon "Aucun" -->
