# ADR-0004 : RBAC par énumération de permissions

**Statut** : Accepté
**Date** : 2025-02-10

## Contexte
8 rôles distincts, scopes spéciaux (own, children), navigation conditionnelle, contrôle d'accès API. Risque #1 : laisser un rôle accéder à des données qu'il ne devrait pas voir (OWASP A01).

## Options évaluées

| Modèle | Pros | Cons | Score |
|--------|------|------|-------|
| **Énumération de permissions + matrice par rôle** | Simple, déclaratif, facile à auditer | Nombre de permissions explose (~80) | **8/10** |
| ABAC (attribute-based) | Très flexible (règles complexes) | Difficile à raisonner sur la sécurité, lent | 6/10 |
| Casbin | Standard, externalisable | Lourd à intégrer pour 8 rôles | 6/10 |
| Booléens dans le code | Rapide à coder | Cauchemar à maintenir, on perd la vue d'ensemble | 3/10 |

## Décision
Une énumération TypeScript `Permission` (`src/lib/rbac/permissions.ts`), une matrice `rolePermissions: Record<UserRole, Permission[]>`, des helpers `hasPermission` / `hasAnyPermission` / `hasAllPermissions`.

Application :
- Backend : décorateur `createApiHandler({ requiredPermissions: [...] })`
- Frontend : composant `<Guard permission="X">` qui masque l'élément
- Navigation : `navConfig` filtre les entrées du sidebar selon les permissions

## Conséquences positives
- Auditable : un seul fichier liste **toutes** les permissions et qui les a
- TypeScript empêche d'utiliser une permission inexistante
- L'ajout d'un rôle = compléter la matrice (le compilateur force à le faire)

## Conséquences négatives
- Quand on ajoute une nouvelle permission, il faut mettre à jour 8 rôles → tentation d'oublier
- Les scopes (`:own`, `:children`) sont vérifiés en plus de la permission par chaque route — la double-checke est nécessaire

## Règles
- **Jamais** de check du type `if (role === "TEACHER")` dans le code métier — toujours passer par une permission
- L'ajout d'une permission doit être accompagné d'une mise à jour de tous les rôles dans `rolePermissions`
- Les permissions sont **immuables** une fois utilisées en prod ; pour les déprécier, créer une nouvelle (`ENTITY_ACTION_V2`) plutôt que renommer

## Hiérarchie associée
`roleHierarchy` (numérique) permet `canManageRole(creator, target)` : un rôle ne peut pas gérer un rôle de niveau ≥ au sien.
