# Architecture Decision Records (ADR)

Chaque décision architecturale majeure d'EduPilot est consignée ici. Format inspiré de [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

> Une décision est "majeure" si elle :
> - Verrouille un fournisseur (lock-in) sur > 12 mois
> - Coûte > 5 jours-personnes à inverser
> - Impacte la sécurité, la confidentialité ou la conformité
> - Touche le contrat d'API ou le schéma DB

## Index

| ID | Titre | Statut | Date |
|----|-------|--------|------|
| [0001](./0001-nextjs-app-router.md) | Next.js 16 + App Router | Accepté | 2024-12-01 |
| [0002](./0002-prisma-postgres.md) | Prisma + PostgreSQL | Accepté | 2024-12-01 |
| [0003](./0003-nextauth-v5.md) | NextAuth v5 (beta) | Accepté | 2025-01-15 |
| [0004](./0004-rbac-permissions.md) | RBAC par énumération de permissions | Accepté | 2025-02-10 |
| [0005](./0005-zod-validation.md) | Zod pour toutes les validations entrantes | Accepté | 2025-02-10 |
| [0006](./0006-rest-vs-trpc.md) | REST + Server Actions (pas tRPC) | Accepté | 2025-02-15 |
| [0007](./0007-cache-upstash.md) | Upstash Redis pour cache et rate-limit | Accepté | 2025-03-05 |
| [0008](./0008-multi-tenancy.md) | Multi-tenant : row-level scoping app | Accepté | 2025-03-10 |
| [0009](./0009-ai-gemini.md) | Gemini pour IA (bulletins, action plans) | Accepté | 2025-09-20 |
| [0010](./0010-mobile-money-providers.md) | Flutterwave + Paystack pour le mobile money | Accepté | 2025-04-01 |

## Conventions

- Numérotation séquentielle, non recyclée
- Une fois un ADR `Accepté`, il ne se modifie plus — un nouvel ADR vient le **superseder** si la décision change
- Les statuts possibles : `Proposé`, `Accepté`, `Déprécié`, `Supersedé par ADR-XXXX`
