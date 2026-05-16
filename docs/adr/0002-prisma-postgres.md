# ADR-0002 : Prisma + PostgreSQL

**Statut** : Accepté
**Date** : 2024-12-01

## Contexte
89 modèles relationnels, contraintes d'intégrité fortes (notes ↔ évaluations ↔ classes ↔ écoles), reporting analytique sur volumes croissants, conformité légale Bénin imposant 10 ans de rétention sur certaines tables.

## Options évaluées

| ORM/DB | Pros | Cons | Score |
|--------|------|------|-------|
| **Prisma + Postgres** | Migrations versionnées, type-safety automatique, écosystème mature, JSONB pour `oldValues/newValues` audit | Pas d'agrégations SQL avancées (window functions limitées), perf modérée vs SQL brut | **9/10** |
| Drizzle + Postgres | Plus proche du SQL, meilleur perf | Moins mature, migrations plus manuelles | 7/10 |
| TypeORM + Postgres | Plus mature en entreprise | Type safety moins forte, syntaxe verbose | 6/10 |
| MongoDB + Mongoose | Schemas flexibles | Pas de transactions cross-collection robustes, modèle relationnel fort de l'app | 4/10 |

## Décision
**Prisma 6.x + PostgreSQL 16**. Migrations via `prisma migrate`, seed via `prisma db seed`. Postgres en RDS / Neon / Supabase selon environnement.

## Conséquences positives
- Types Prisma générés automatiquement et utilisables partout (`Prisma.UserGetPayload<...>`)
- `prisma migrate deploy` intégré au pipeline CD
- JSONB natif pour `oldValues/newValues` dans `AuditLog`
- Postgres `pg_stat_statements` permet l'identification des slow queries

## Conséquences négatives
- Pas de RLS (Row-Level Security) Postgres activé en V1 — l'isolation est applicative (ADR-0008)
- Pour les agrégations complexes (rapports financiers), recours occasionnel à `$queryRawUnsafe` typé manuellement

## Règles
- **Toute** modification de schema = `prisma migrate dev --name <descriptif>`
- **Aucun** `$queryRawUnsafe` accepté sans validation Zod préalable des paramètres
- Les types côté frontend sont importés depuis `@prisma/client` (jamais redéfinis)
- Index obligatoire sur toute colonne de FK et toute colonne filtrée régulièrement
