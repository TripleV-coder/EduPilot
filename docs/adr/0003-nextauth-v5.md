# ADR-0003 : NextAuth v5 (beta) avec adaptateur Prisma

**Statut** : Accepté
**Date** : 2025-01-15

## Contexte
Besoin d'authentification multi-providers (credentials + futurs OAuth Google/Microsoft pour les enseignants), session DB pour révocation immédiate, MFA TOTP, RBAC propagé dans la session, et compatibilité App Router.

## Options évaluées

| Option | Pros | Cons | Score |
|--------|------|------|-------|
| **NextAuth v5 beta** | Adapter Prisma natif, gratuit, server-side, supporté par Vercel | API encore instable, doc clairsemée | **8/10** |
| Clerk | DX top, MFA OOB | Coût ~25 USD/mois/1k MAU, lock-in fournisseur | 7/10 |
| Auth0 | Très mature | Coût élevé, complexité | 6/10 |
| Supabase Auth | Gratuit si on prend la DB | Nécessite Supabase, pas de session DB propre | 6/10 |
| Lucia + custom | Contrôle total | Trop de boilerplate à maintenir | 5/10 |

## Décision
**NextAuth v5** avec :
- `CredentialsProvider` pour login email/password
- `PrismaAdapter` pour persister sessions et users
- MFA TOTP implémenté en couche au-dessus (otplib + crypto AES-256-GCM)
- Session DB (pas JWT only) pour pouvoir invalider à la révocation

## Conséquences positives
- Coût zéro (uniquement les ressources DB)
- Session révocable instantanément (suppression de la row dans `Session`)
- Adapter Prisma génère tous les modèles requis automatiquement

## Conséquences négatives
- NextAuth v5 est **en beta** : risque de breaking changes sur upgrade — pinned à `5.0.0-beta.30`
- Le wrapper d'auth (`auth()`) doit être appelé dans chaque API route, pas centralisé via middleware en V1
- Documentation parfois obsolète, recours fréquent au code source

## Règles
- `src/lib/auth/config.ts` est la seule source de vérité pour la configuration NextAuth
- `auth()` (export from `@/lib/auth`) est l'unique helper pour récupérer la session côté serveur
- La session doit toujours inclure `user.role`, `user.schoolId`, `user.isTwoFactorEnabled`, `user.isTwoFactorAuthenticated` (callbacks `session()` et `jwt()`)
- Aucune session ne doit jamais durer > 30 jours (rotation forcée à la connexion)
