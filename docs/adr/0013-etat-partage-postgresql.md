# ADR-0013 : État partagé dans PostgreSQL — plus de Redis

**Statut** : Accepté (décision du propriétaire, 2026-11-07)
**Remplace** : [ADR-0007 (Upstash Redis)](0007-cache-upstash.md)

## Contexte

Redis (Upstash en HTTP, ou `REDIS_URL` en TCP via ioredis) servait à partager entre processus et instances :

- les seaux à jetons du proxy (débit général, **une** opération Redis par requête API) ;
- les fenêtres fixes des limites sensibles (connexion, 2FA, mot de passe oublié) ;
- l'état des coupe-circuits des fournisseurs (SMS, e-mail, paiement) ;
- un cache de réponses, un miroir du mode maintenance, la publication des notifications.

Le propriétaire veut un hébergement sans serveur et un `.env` minimal : chaque service ajoute un compte, un secret, un point de panne. Le cache de réponses n'était invalidé que par sa durée de vie (aucune invalidation sur écriture), et aucun écran n'ouvrait le flux de notifications poussées.

## Décision

PostgreSQL, déjà indispensable, porte l'état partagé (`src/lib/shared-state/`) :

| Besoin | Mise en œuvre |
|---|---|
| Fenêtres fixes (connexion, 2FA…) | `rate_limit_counters` UNLOGGED, une instruction `INSERT … ON CONFLICT` atomique, horloge du serveur ; un refus est retenu localement jusqu'à la fin de sa fenêtre (force brute refusée sans toucher la base) |
| Seaux du proxy | Décision **locale** sur le dernier niveau connu ; synchronisation quand ce niveau a plus de 2 s ou après 5 % du quota accordé ; synchronisations simultanées regroupées en **un** appel (`edupilot_sync_token_buckets`, verrous dans l'ordre des clés) ; un compte inconnu est admis dans la limite d'un lot pendant sa première synchronisation |
| Coupe-circuits | Clés à durée de vie dans `rate_limit_counters` (`PgBreakerKV`) |
| Cache de réponses | Mémoire du processus, bornée (LRU), taux de succès mesuré |
| Maintenance au proxy | Le proxy tourne sur Node (Next 16) : lecture en base, cache 15 s |
| Notifications SSE | Relève en base (déjà en place sans Redis) |

Tables **UNLOGGED** : aucune écriture dans le journal de PostgreSQL ; vidées après un arrêt brutal, sans conséquence (limites remises à zéro). Client brut (`prismaBase`) : un aller-retour, sans la transaction RLS du client contextualisé. Base lente ou injoignable : coupe-circuit du magasin (1 s une fois, puis repli mémoire 15 s).

## Garanties

- Fenêtres fixes : **exactes** (40 tentatives simultanées pour 10 autorisées → 10, test d'intégration).
- Seaux du proxy : jamais de refus à tort (le niveau réel ne peut être que plus bas que l'estimation locale) ; dépassement borné à un lot (5 % du quota) par processus et par période de 2 s.
- Coupe-circuit ouvert par une instance : ouvert pour toutes.

## Mesures (même machine, PostgreSQL et Redis locaux, 3 passages)

Débit général du proxy, ancien script Lua Redis contre le nouveau chemin :

| Charge | Redis p50 / p99 | PostgreSQL p50 / p99 | Allers-retours |
|---|---|---|---|
| 50 comptes × 100 req., séquentiel | 0,15 / 0,42 ms | 0,004 / 0,011 ms | 5 000 → 50 |
| 50 comptes × 100 req., 32 simultanées | 1,05 / 2,0 ms | 0,07 / 0,2 ms | 5 000 → 50 |
| 500 comptes × 20 req., 64 simultanées | 1,9 / 3,0 ms | 0,1 / 1,3 ms | 10 000 → 500 (en lots) |

Limite sensible (connexion), une instruction par appel : Redis 0,18 ms, PostgreSQL 0,49 ms au p50. Plus lent par appel, mais seulement sur les connexions et écritures sensibles, jamais sur le chemin de chaque requête.

## Conséquences

- `ioredis` et `@upstash/redis` retirés ; `REDIS_URL`, `UPSTASH_*`, `CLUSTER_ALLOW_LOCAL_LIMITS` n'existent plus ; plus de service Redis ni de volume dans docker-compose.
- Plusieurs processus (`WEB_CONCURRENCY`) ou instances : limites communes sans configuration.
- Le cache de réponses n'est plus partagé : chaque instance recalcule une fois par durée de vie (fraîcheur inchangée).
- Rôle restreint `edupilot_app` : rejouer `scripts/db/setup-app-role.mjs` après la migration (droits sur les nouvelles tables).
