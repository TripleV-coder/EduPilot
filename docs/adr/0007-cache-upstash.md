# ADR-0007 : Upstash Redis pour cache et rate-limiter

**Statut** : Accepté
**Date** : 2025-03-05

## Contexte
Le rate-limiter en mémoire (Map locale) ne fonctionne pas en multi-instance (Vercel serverless, PM2 cluster, K8s pods). Il faut un store partagé. Idem pour le cache des listes (`/api/students` × 50 écoles).

## Options évaluées

| Option | Pros | Cons | Score |
|--------|------|------|-------|
| **Upstash Redis (serverless)** | Pay-as-you-go, REST API (compat edge runtime), pas d'infra à gérer | Coût croissant si trafic explose | **8/10** |
| Redis ElastiCache | Plus rapide, plus de features | Coût fixe ~30 USD/mois min, infra à gérer | 7/10 |
| Vercel KV | Intégration native | Lock-in Vercel, pricing flou | 6/10 |
| Memcached | Très rapide | Pas de persistance, features limitées | 5/10 |
| DB Postgres (table cache) | Zéro nouveau service | Pas adapté pour rate-limit à haut débit | 4/10 |

## Décision
**Upstash Redis** via `@upstash/redis` (REST API). Configuration via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

Fallback in-memory (`InMemoryStore`) si les variables d'env ne sont pas configurées (utile en dev local et test).

## Conséquences positives
- Compatibilité **edge runtime** (utilisable depuis middleware Next)
- Coût quasi nul en dev/staging (free tier 10k commandes/jour)
- `@upstash/ratelimit` fournit un sliding window prêt à l'emploi
- Cache HTTP `X-Cache: HIT/MISS` exposé pour debugging

## Conséquences négatives
- REST API = latence ~50ms par appel (vs 1ms en TCP Redis natif). Pour les pathologies à haut débit, on évite de cascader 5 GET cache successifs.
- Dépendance externe : si Upstash est HS, le rate-limiter bascule en mémoire (perte d'isolation cross-instance)

## Règles
- Le cache **n'est jamais une source de vérité** : la DB l'est. Le cache peut être vidé sans dataloss.
- TTL conservateur : SHORT=60s (listes), MEDIUM=120s (dashboards), LONG=300s (référentiels)
- Toute mutation invalide explicitement le path concerné : `await invalidateByPath(CACHE_PATHS.students)`
- Le rate-limiter ne doit **jamais** bloquer l'auth : si Upstash répond en > 1s, on laisse passer la requête (`fail-open`)
- Les clés sont préfixées par environnement (`prod:`, `staging:`) pour éviter les collisions

## Évolution V2
Si la facture Upstash dépasse 100 USD/mois, migrer vers ElastiCache ou Redis Cloud auto-hébergé.
