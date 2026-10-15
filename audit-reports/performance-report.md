# Rapport de performance — 2026-10-14

## 1. Protocole

| Élément | Valeur |
|---|---|
| Machine | Intel i7-1355U (12 threads), 15 Go RAM, Linux 7.0.0-38, Node 22.22.3 |
| Application | build de production (`npm run build`, `next start`), **un seul processus**, sans Redis (repli mémoire) |
| Base | PostgreSQL 16.14 embarqué, local (port 5433), rôle `edupilot_app` soumis à la RLS |
| Données | 3 écoles, 2 706 comptes, 995 élèves, 131 208 notes, 3 697 évaluations |
| Outils | `scripts/quality/smoke.mjs`, `latency.mjs` (séquentiel), `load.mjs` (autocannon 10 connexions × 15 s) |
| Quotas | fumée : `RATE_LIMIT_RELAXED=true` ; latence après correction : limites de production ; charge : quotas à 1 000 000 pour mesurer l'application et non le limiteur |
| Limites | client et serveur sur la même machine ; un second serveur Next (port 3000) lancé hors de l'audit tournait en parallèle ; aucune latence réseau ; une seule machine ; la machine s'est mise en veille pendant une partie de l'audit (horloge sautée de ~2 h 30) |

Aucun objectif de performance (SLO) n'existe dans le dépôt. Les seuils de `smoke.mjs` (500 ms, 500 Ko)
sont des alertes du projet. **Seuils candidats proposés (à valider par l'équipe, non mesurés comme
obligation)** : p95 < 500 ms pour les lectures courantes, p95 < 1 s pour les vues famille.

## 2. Mesures de base

| Indicateur | Valeur | Unité | Source |
|---|---|---|---|
| Build de production | 85,0 (baseline, machine calme) ; 204,1 (après, machine chargée) | s | `evidence/07`, `64` |
| Démarrage jusqu'à `/api/health` = 200 | 4,9 | s | boucle `curl` |
| Suite unitaire complète | 184,8 (baseline) ; 288,8 (après) — durées rapportées par Vitest | s | `evidence/05`, `62` |
| Suite d'intégration | 113,1 (baseline) ; 127,9 (après) | s | `evidence/06`, `63` |
| Mémoire résidente serveur | 250 → 760 Mo pendant les mesures « élève » (build corrigé) | Mo | `evidence/75` |

## 3. Fumée : 178 routes GET × 7 rôles (build initial) — `evidence/28`

| Rôle | Réponses 200 | p50 / p95 (réponses 200) | Routes > 500 ms |
|---|---|---|---|
| SUPER_ADMIN | 106 | 37 / 135 ms | `/api/grades/statistics` 792 ms (1ᵉʳ appel) |
| SCHOOL_ADMIN | 123 | 26 / 213 ms | aucune |
| DIRECTOR | 118 | 25 / 202 ms | aucune |
| ACCOUNTANT | 93 | 28 / 115 ms | aucune |
| TEACHER | 92 | 23 / 219 ms | `/api/grades/statistics` 503 ms |
| STUDENT | 84 | 32 / 90 ms | **`/api/grades` 3 933 ms**, `/api/orientation/me` 1 954 ms |
| PARENT | 86 | 29 / 91 ms | **`/api/grades` 3 936 ms** |

Aucune réponse > 500 Ko. Seule erreur 5xx : `/api/system/automation` (500 sans `CRON_SECRET`, DEF-010).
Les 400/403 observés correspondent à des routes appelées sans paramètres requis ou hors droits du rôle.

## 4. Latence répétée — avant / après correction de DEF-003

| Route (rôle) | n | p50 avant | p95 avant | p50 après | p95 après | Variation p50 | Sources |
|---|---|---|---|---|---|---|---|
| `/api/grades` (élève) | 20 | 3 619 ms | 4 001 ms | **1 983 ms** | **2 626 ms** | −45 % | `evidence/29` → `75` |
| `/api/grades` (parent) | 20 | 3 484 ms | 4 607 ms | **1 928 ms** | **2 421 ms** | −45 % | `evidence/30` → `76` |
| `/api/orientation/me` (élève) | 20 | 1 819 ms | 2 111 ms | 1 743 ms | 2 102 ms | −4 % (non significatif) | `evidence/29` → `75` |
| `/api/grades/statistics` (élève) | 20 | 23 ms | 27 ms | 23 ms | 30 ms | — | idem |

Référence : la même liste de notes côté administration (`/api/grades?classId=`) : p50 78 ms, p95 93 ms (`evidence/31`).

Cause de DEF-003 : `studentAveragesSummary` calcule toute la classe sur l'année, puis toute la classe pour
chaque période, en séquence. Profil hors serveur (rôle propriétaire, sans RLS) : année 595 ms, période
167–175 ms × 3, total 1 099 ms (`evidence/32`). Correction : calculs lancés en parallèle (résultats
identiques : S1 octet pour octet avant/après, `evidence/37` vs `71`). Le reste (~2 s) vient du calcul de
toute la classe sous RLS — non résolu ; piste : mémoïser les moyennes d'une classe par période, invalidées
à chaque écriture de note.

## 5. Charge (10 connexions × 15 s, 3 répétitions, build initial) — `evidence/35-load-rep*`

| Route | Rép. 1 | Rép. 2 | Rép. 3 | p50 (rép. 3) | p99 (rép. 3) | Erreurs |
|---|---|---|---|---|---|---|
| `/api/classes` | 100,0 req/s | 124,6 req/s | 148,3 req/s | 63 ms | 129 ms | 0 |
| `/api/students?limit=20` | 71,2 req/s | 94,1 req/s | 98,0 req/s | 100 ms | 131 ms | 0 |
| `/api/health` | 145,6 req/s | 176,6 req/s | 248,6 req/s | 39 ms | 60 ms | 0 |

Tendance : débit croissant d'une répétition à l'autre (échauffement). Une mesure avec quotas « relâchés »
a été **écartée** : 2 183 à 4 205 réponses non-2xx — elle mesurait le limiteur (`evidence/33`).
Non mesuré : charge sur les vues famille, montée en charge progressive, endurance, multi-processus.

## 6. Recalcul après changement de règles (DEF-012)

Trois enregistrements des règles de calcul ont déclenché trois recalculs complets de l'école en
arrière-plan ; le processus serveur est resté à 181–195 % CPU pendant **plus de 20 minutes** (observé avec
`top` ; fin des écritures à 13:48:41 UTC, 2 985 instantanés). Pendant ce temps, la machine entière était
ralentie (charge 13 ; vérification de types 210 s au lieu de 22 s). Aucune donnée incohérente n'en a
résulté (§R de `test-results.md`), mais aucun regroupement ni annulation des recalculs n'existe.

## 7. Interprétation

- Les lectures courantes (listes, tableaux de bord mémoïsés) sont rapides sur ce jeu de données.
- Les vues famille restent les plus lentes (~2 s après correction) : risque de saturation si de nombreux
  parents consultent en même temps (calcul de toute une classe par requête, sans cache). Non mesuré en charge.
- Ces mesures ne prouvent pas la tenue en charge en production (réseau, multi-processus, Redis, volume).
