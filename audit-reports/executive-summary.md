# Résumé exécutif — audit technique d'EduPilot, 2026-10-14

## État général

Application Next.js 16 / Prisma / PostgreSQL de gestion scolaire (313 routes API, 181 pages, 129 modèles).
Au départ (commit `75b2377`) : installation, types, lint, build et tests d'intégration **verts** ; tests
unitaires **4 096 réussis sur 4 098 exécutés** (2 échecs par dépassement de délai, pas d'erreur de calcul).

**Verdict : C — PRÊT SOUS RÉSERVES** (voir `final-verdict.md`).

## Ce qui a été vérifié par exécution

- Exactitude des moyennes : **écart nul** contre un oracle indépendant sur 2 000 élèves générés, et sur
  66 moyennes servies par le serveur réel avant/après changement de formule ; 2 985 moyennes stockées
  identiques au recalcul en direct.
- Moteur de formules modifiables : aucune exécution de code possible (8 injections refusées), formules
  invalides refusées sans écraser la formule valide, isolation entre écoles, droits respectés.
- Sécurité sur serveur réel sous RLS : IDOR et accès inter-établissement refusés, force brute limitée,
  usurpation de `X-Forwarded-For` ignorée, en-têtes de sécurité et CORS corrects (11/12 contrôles).
- Schéma : les 50 migrations reproduisent exactement le schéma Prisma.
- Performance : lectures courantes p50 14–100 ms ; charge 71–249 req/s sur un processus, 0 erreur.

## Principaux défauts trouvés

| ID | Prio | Constat | Statut |
|---|---|---|---|
| DEF-001 | P1 | `next@16.3.5` : vulnérabilité **critique** (RCE `next/og`, module utilisé) | corrigé (16.3.8), retesté |
| DEF-002 | P2 | Moyenne annuelle non bornée : **30/20 publié** avec une formule acceptée | corrigé, test de régression |
| DEF-003 | P2 | « Mes notes » élève/parent : 3,6 s (p50) | amélioré à ~1,95 s, reste ouvert |
| DEF-004 | P2 | `axios` (7 avis élevés), `brace-expansion`, `dompurify` | corrigés |
| DEF-012 | P3 | Chaque changement de règles relance un recalcul complet de l'école (> 20 min de CPU pour 3 changements) | ouvert |
| DEF-014 | P3 | `sharp`, `source-map-js` : avis élevés sans version corrigée publiée | ouvert |

Registre complet : `defects-register.md` (20 défauts, 2 indices).

## Contrôles non réalisés / bloqués

E2E Playwright (navigateurs absents, téléchargement non autorisé), CI distante, sauvegarde/restauration
(`pg_dump` absent), base de production, tests de mutation, DAST, fournisseurs externes réels.

## Actions prioritaires

1. **Immédiat** : valider et intégrer les corrections (7 fichiers modifiés + 1 fichier de tests) ; lancer
   `npx prisma migrate deploy` sur la base de développement locale.
2. **Court terme** : exécuter les E2E et la CI ; tester sauvegarde/restauration ; mettre en cache les
   moyennes par classe (DEF-003) ; regrouper les recalculs d'arrière-plan (DEF-012).
3. **Moyen terme** : contraintes `CHECK` en base, validation des formules par intervalles, `callbackUrl`
   après connexion, jeton d'installation.

## Limites de l'audit

Une seule machine locale, un seul processus, sans Redis ni réseau réel ; la machine s'est mise en veille
pendant une partie de l'audit (certaines durées journalisées sont faussées et signalées) ; un serveur
étranger à l'audit tournait sur le port 3000.
