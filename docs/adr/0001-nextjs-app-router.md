# ADR-0001 : Next.js 16 + App Router

**Statut** : Accepté
**Date** : 2024-12-01
**Décideurs** : Tech Lead

## Contexte
EduPilot doit supporter un mix de pages publiques (marketing, login), de dashboards riches (RBAC, charts), et d'APIs (web + mobile futur). Le framework doit offrir SSR pour le SEO des pages publiques, ISR pour les contenus semi-statiques, RSC pour réduire le JS client, et un système de routage type-safe.

## Options évaluées

| Option | Pros | Cons | Score |
|--------|------|------|-------|
| **Next.js App Router** | SSR/RSC/ISR, écosystème React, Vercel host gratuit, Server Actions | Lock-in Vercel pour les fonctions edge, complexité du modèle RSC | **9/10** |
| Remix + Vite | DX excellente, web standards | Écosystème plus jeune, moins de bibliothèques tierces compatibles | 7/10 |
| Nuxt 3 (Vue) | Modèle SSR mature, simple | Skills équipe = React | 6/10 |
| Astro + React islands | Très rapide pour les pages publiques | Pas adapté pour un dashboard interactif | 5/10 |

## Décision
**Next.js 16 avec App Router** (`src/app/`). Mélange Server Components par défaut + Client Components ciblés. API Routes dans `src/app/api/*/route.ts`.

## Conséquences positives
- Skills React de l'équipe immédiatement productifs
- Vercel offre un déploiement gratuit pour le MVP
- ISR utilisé pour les pages de profils établissement
- Server Actions pour les mutations simples (réduit le boilerplate API)

## Conséquences négatives / tech debt
- Couplage Vercel (mitigé par Docker self-host possible)
- Le modèle Server / Client component impose de la rigueur (`"use client"` au bon endroit)
- API routes typées via Zod uniquement (pas tRPC, voir ADR-0006)

## Règles
- Composants par défaut = Server Components. Marquer `"use client"` **uniquement** si nécessaire (useState, événements, browser APIs)
- Toute donnée venant de la DB passe par un Server Component ou un API route
- Les Server Actions ne sont autorisées que pour les mutations triviales (form simple) ; pour le reste, route API + SWR
