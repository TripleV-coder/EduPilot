# Livrable 8 — Performance et montée en charge

> Aucun test de charge n'a été exécuté dans ce lot. Les chiffres ci-dessous viennent de mesures **existantes**, dont les conditions sont rappelées. Ils sont classés en **[MESURÉ]**, **[ESTIMÉ]** et **[À DÉMONTRER]**.
> Objectif déclaré : des millions d'utilisateurs. **Aucune mesure ne démontre aujourd'hui cette capacité.**

## 1. Mesures existantes et leurs conditions

| Source | Conditions | Résultats |
|---|---|---|
| `docs/ANALYSE_PERFORMANCE_CAPACITE.md` §1-4 (2026-10-01) | Portable i7-1355U (2 cœurs performance), 15 Go ; PostgreSQL 16 jetable, rôle applicatif sous RLS ; 1 école peuplée (995 élèves, 131 208 notes, 3 328 paiements, 2 706 comptes, 111 Mo) ; autocannon ; build de production | **[MESURÉ]**<br>• mélange réaliste, 10 connexions : 136 req/s, p50 68 ms (1 processus) ; 168 req/s, p50 47 ms (4 processus)<br>• 400 connexions : 213 req/s, p50 1,8 s, **0 erreur**<br>• accueil direction : 27 req/s ; accueil enseignant : 40 req/s<br>• 30 connexions simultanées depuis une même IP : 30/30 |
| Même document, « Ce qui n'a pas été mesuré » (`:118-119`) | — | Latence réseau réelle, Sentry, n8n/LLM, SMS et emails en masse, **base multi-écoles de taille réelle** |
| Mesures de la session du 2026-10-15 (lot B, commit `e9191c3`) | Banc jetable (port 5433), serveur `next start` sous `--trace-gc` | **[MESURÉ]**<br>• vue famille réaliste, 1 connexion : p50 2 139 → **773 ms**<br>• 10 connexions : 8,75 → **13,8 req/s**<br>• requête des notes annuelles : 1 544 → 405 ms<br>• recalcul complet d'une école : **236 s** (2 985 instantanés)<br>• ramasse-miettes non limitant (utilisation du mutateur 0,99) |
| `ANALYSE_PERFORMANCE_CAPACITE.md` §0, §5 | Projection à partir des mesures | **[ESTIMÉ]**<br>• ≈ 200 à 300 utilisateurs actifs par vCPU applicatif<br>• ≈ 500 actifs par cœur PostgreSQL<br>• au-delà de ≈ 120 écoles (300 000 comptes), un seul PostgreSQL n'est plus confortable |

**Capacité qui reste à démontrer [À DÉMONTRER]** :
- plusieurs dizaines d'écoles **réellement peuplées** dans une même base ;
- rentrée (connexions massives) ;
- publication de bulletins ;
- envoi de notifications en masse ;
- clôture de période ;
- RLS à grand volume ;
- plusieurs instances derrière un répartiteur.

## 2. Goulots identifiés dans le code

| ID | Facteur | Code | Scénario problématique | Preuve disponible | Mesure à faire |
|---|---|---|---|---|---|
| PF-01 | Recalcul des analyses d'une école entière | `analytics-sync.ts` (`syncAllStudentsForSchoolNow`) | Changement d'un paramètre de calcul ou maintenance quotidienne × N écoles : 236 s par école → **dizaines d'heures** pour des centaines d'écoles dans une maintenance **séquentielle** (`automation.service.ts`, boucle sur les écoles) | Mesuré (1 école) ; > 20 min observées après des PUT de règles (mémoire 2026-10-14) | Durée de la maintenance sur 10 / 50 écoles ; parallélisation bornée ; reprise |
| PF-02 | Boucles de requêtes base (N+1) | `promotion.ts:246-288` (par élève) ; imports (`student/parent/teacher-import.ts`, ~3 requêtes par ligne, ≤ 500 lignes **dans une transaction**) ; `attendance/bulk/route.ts:106` (1 lecture par élève) ; `accounting/entries:233-239` ; `reminders.ts:221-243` ; `analytics-sync.ts:103,151` | Promotion de grosses classes, imports de 500 lignes (transaction longue, verrous), appel d'une classe de 80 | Repérage statique (19 fichiers) | Durée et verrous d'un import de 500 lignes ; promotion de 30 classes |
| PF-03 | Liste des élèves | `/api/students` | Coût croissant avec la taille de l'école (≈ 7 900 lignes lues pour en afficher 20, `ANALYSE…:81`) | Mesuré | Plan d'exécution sur une école de 5 000 élèves |
| PF-04 | Politiques RLS en `EXISTS` corrélé | migration `20260914090000_rls_policies_index_friendly` | Coût par ligne lue sur les grosses tables (notes, présences) | « L'enveloppe RLS double le coût de chaque requête SQL » (`ANALYSE…:96`, avant corrections) | Comparaison avec et sans RLS à 1 M de notes |
| PF-05 | Cache par utilisateur | `cacheScope` (`cache-helpers.ts:39`) | Clés propres à chaque compte : faible taux de réussite à grande échelle ; cache mémoire de 5 000 entrées par processus | Conception | Taux de réussite en charge réaliste |
| PF-06 | Mémoïsation propre au processus | `memo.ts` | N processus = N calculs du même tableau de bord ; aucune invalidation inter-processus | Conception | Charge multi-processus |
| PF-07 | Génération des bulletins | `grades/report-cards` POST : données par élève ; **PDF généré côté navigateur** | Classe entière = N requêtes, chacune recalculant les moyennes (mémoïsées 15 s) | Code | Temps de génération d'une classe de 60 |
| PF-08 | Notifications en masse | `createBulkNotifications` (une ligne par destinataire) + file de tâches limitée en débit (`JOB_WORKER_RATE_PER_MIN`) | Diffusion à toute une école (parents) : délai d'envoi borné par le débit | Code | Débit réel de la passerelle SMS et de SMTP |
| PF-09 | Flux SSE (inutilisé) | `notifications/stream/route.ts` | S'il est réactivé : une connexion Redis par onglet, ou une requête en base toutes les 5 s par client | Code | — |
| PF-10 | Connexion : bcrypt | `src/lib/auth/password.ts` (natif, pool libuv) | Rentrée : connexions massives | Mesuré : 30/30 sans dégradation après correction | 1 000 connexions par minute |
| PF-11 | `KEYS` Redis (Upstash) | `redis.ts:212` | Invalidation sur une grosse base Redis | Code | — |
| PF-12 | Pool de connexions | `DATABASE_POOL_SIZE` (défaut 10 par processus) ; refus de démarrer en multi-processus sans `REDIS_URL` | Instances × processus × 10 > `max_connections` | Mesuré (« Too many database connections » à 4 × 25) | PgBouncer au-delà d'une machine |

## 3. Scénarios de charge nécessaires (non exécutés)

| Scénario | Mesures à relever | Pré-requis |
|---|---|---|
| Rentrée : 1 000 connexions en 5 min, dont 30 par IP d'école | Latence p50/p95/p99, taux de refus (débit limité), CPU, `pg_stat_activity` | Base multi-écoles peuplée |
| Publication de notes : 50 enseignants saisissent en même temps | Durée des `upsert`, verrous, invalidations, recalcul des moyennes | idem |
| Consultation des résultats : 5 000 familles en 30 min | Débit des vues famille (773 ms p50 actuel), cache | idem |
| Maintenance quotidienne sur 50 écoles | Durée totale, contention avec le trafic du matin | Planification 06:00 |
| Diffusion SMS à 10 000 parents | Longueur de file, débit, FAILED, saturation (`QueueSaturatedError`) | Passerelle simulée (`e2e/recette/sms-catcher.mjs`) |
| Paiements en ligne : 200 essais par minute avec webhooks | Verrous `pg_advisory_xact_lock`, latence des webhooks | Fournisseur simulé |
| Clôture de période et promotion de 30 classes | Durée, verrous, cohérence des inscriptions | — |

## 4. Lecture prudente pour l'objectif de « millions d'utilisateurs »

- Les estimations existantes placent la limite d'**un** PostgreSQL vers ≈ 120 écoles peuplées.
- Au-delà, il faut : répartiteur et plusieurs instances (déjà prévus : `cluster.cjs`, `REDIS_URL`), réplicas de lecture pour les tableaux de bord, PgBouncer, maintenance distribuée (file de tâches par école), voire partitionnement par école ou par réseau.
- **Aucune** de ces options n'est mesurée. C'est le premier chantier de démonstration à mener avant tout engagement de capacité.
