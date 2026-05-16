# ADR-0006 : REST + Server Actions (pas tRPC)

**Statut** : Accepté
**Date** : 2025-02-15

## Contexte
Choix du transport entre le client et le serveur. Critères : type-safety, future-mobile (Flutter), tooling externe (Postman), génération OpenAPI.

## Options évaluées

| Option | Pros | Cons | Score |
|--------|------|------|-------|
| **REST + Zod + Swagger** | Standard, mobile-friendly, Postman, cache HTTP | Pas de type-safety automatique sans codegen | **8/10** |
| tRPC | Type-safety automatique, DX top | Lock-in TypeScript, mobile devra parler tRPC ou avoir un layer REST | 7/10 |
| GraphQL | Très flexible | Sur-dimensionné pour le besoin, complexité | 5/10 |

## Décision
**REST classique** sur `/api/*` avec :
- Validation Zod systématique (cf. ADR-0005)
- Standard de réponse : `{ data, pagination }` pour les listes, `{ error, code, requestId }` pour les erreurs
- Codes HTTP semantiques (200/201/204/400/401/403/404/409/422/429/500)
- En complément : **Server Actions** Next.js pour les mutations triviales de form (réduction du boilerplate)

## Conséquences positives
- L'app mobile future (Flutter) consommera la même API que le frontend web
- Postman / Bruno / Insomnia utilisables pour tester
- Cache HTTP natif (étag, Cache-Control) géré par Next.js
- Génération `swagger.json` automatique via une convention (à implémenter)

## Conséquences négatives
- Le client doit re-déclarer le type de chaque réponse (jamais inféré automatiquement)
- Risque de drift entre la validation Zod côté serveur et le type côté client — mitigé par partage des `z.infer<>` quand le client est en TS

## Règles
- **Aucune** route API sans validation Zod
- **Toutes** les routes API utilisent `createApiHandler` (cf. `src/lib/api/api-helpers.ts`)
- Server Actions **uniquement** pour : login form, mark-as-read, toggle d'une seule valeur. Tout le reste passe par REST.
- Réponses paginées toujours via `createPaginatedResponse(data, page, limit, total)`
- Erreurs toujours via `apiErrorResponse(...)` avec un `code` (pas seulement un `error` message)
