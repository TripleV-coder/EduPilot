# Évaluation finale — audit du 2026-10-14

Périmètre évalué : application EduPilot au commit `75b2377` plus corrections de l'audit, exécutée
localement (build de production, un processus, PostgreSQL 16 avec RLS, base jetable de 131 208 notes).
Objectif évalué : **exactitude des calculs, sécurité applicative et fonctionnement de l'API, pour un
déploiement sur l'infrastructure prévue** — pas une certification de production.

## Dimensions

| # | Dimension | Vérifié | Observé | Défauts ouverts | Non réalisé | Confiance |
|---|---|---|---|---|---|---|
| 1 | Fonctionnalité | 4 138 unitaires, 344 intégration, 178 routes × 7 rôles, 1 parcours navigateur | aucune erreur 5xx hors cron sans secret | DEF-019, DEF-020 | E2E Playwright (31 specs) | moyenne |
| 2 | Qualité du code | tsc, ESLint, indicateurs | 0 erreur ; 2 `any`, 0 `@ts-ignore` | code mort mineur | complexité, cycles | élevée |
| 3 | Architecture | contrôle d'accès central (310/313), moteur unique, RLS | cohérente | DEF-012 (recalculs non regroupés) | — | moyenne-élevée |
| 4 | Sécurité | tests dynamiques (IDOR, tenant, force brute, XFF, en-têtes), webhooks, moteur de formules, `npm audit` | 11/12 ; critique `next` corrigée | DEF-014 (2 élevés sans correctif publié), DEF-010, DEF-016 | DAST, fuzzing, injection SQL dynamique | moyenne |
| 5 | Intégrité des données | migrations ↔ schéma (diff vide), base stockée ↔ calcul (2 985/2 985) | conforme | DEF-017 (pas de `CHECK`), DEF-013 (base locale non migrée) | sauvegarde/restauration, production | moyenne |
| 6 | Exactitude numérique | oracle indépendant 2 000 cas, 66 moyennes serveur, arrondis | écart 0 ; défaut hors bornes corrigé | DEF-008, DEF-009 | conformité réglementaire, prédictions IA | **élevée** (implémentation) |
| 7 | Performance | fumée, latence répétée, charge 3 répétitions | lectures rapides ; vues famille ~2 s | DEF-003 (partiel), DEF-012 | multi-processus, endurance, charge famille | moyenne |
| 8 | Robustesse | interruption pendant recalcul, Redis injoignable (test existant), formules invalides | aucune incohérence observée | IND-002 | coupures réseau, base indisponible en charge | faible-moyenne |
| 9 | Maintenabilité | taille, dette, tests | bonne ; gros fichiers d'interface | — | — | moyenne |
| 10 | Automatisation des tests | 4 149 unitaires, 344 intégration, 31 E2E | suites unitaires et intégration vertes | DEF-015 (test temporel) | E2E, mutation | moyenne |
| 11 | Accessibilité | contrôles de base sur 1 page, mobile 375 px | rien de bloquant | — | axe complet, clavier, lecteur d'écran | faible |
| 12 | Reproductibilité | toutes les commandes consignées ; base jetable ; graines fixes | reproductible localement | DEF-013 | CI distante | élevée |
| 13 | Préparation au déploiement | Docker/CI/entrypoint inspectés, build vert | cohérent (Node 24, migrations au démarrage) | DEF-016 | image Docker non construite, CI non exécutée | faible-moyenne |

## Critères de décision

- Aucun défaut P0. Le seul P1 (DEF-001) est corrigé et retesté.
- DEF-002 et DEF-004 (P2) sont corrigés et retestés ; DEF-003 (P2) est amélioré mais reste ouvert.
- Contrôles importants non réalisés : E2E Playwright, CI distante, sauvegarde/restauration, base de production.

## Verdict : **C — PRÊT SOUS RÉSERVES**

Les contrôles réalisés sont satisfaisants sur les points les plus sensibles : exactitude des moyennes
(écart nul contre un oracle indépendant), isolation entre établissements (vérifiée sur serveur réel sous
RLS), sécurité du moteur de formules, cohérence du schéma. Réserves à lever avant de considérer le
périmètre comme entièrement validé :

1. Exécuter la suite E2E Playwright (31 specs) et la CI sur la branche corrigée.
2. Tester une sauvegarde puis une restauration réelles.
3. Décider pour `sharp`/`source-map-js` (surveiller la publication d'un correctif).
4. Traiter la latence des vues famille (DEF-003) et les recalculs d'arrière-plan (DEF-012) avant une forte
   fréquentation parentale.
5. Appliquer les migrations à la base de développement locale (DEF-013).

Ce verdict ne signifie pas que l'application est exempte de défauts.
