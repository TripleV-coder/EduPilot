# Registre des défauts — audit du 2026-10-14

Priorités : P0 critique · P1 élevée · P2 moyenne · P3 faible · P4 informatif.
Preuve : **[E]** exécution · **[S]** inspection · **[C]** indice à investiguer.
Tous les défauts ci-dessous étaient présents sur le commit de départ `75b2377` (aucun n'a été introduit par
les corrections : la régression complète après corrections est verte).

| ID | Prio | Composant | Description | Preuve | Statut |
|---|---|---|---|---|---|
| DEF-001 | P1 | dépendances | `next@16.3.5` vulnérable (critique RCE `next/og ImageResponse`, module utilisé ; élevé SSRF optimisation d'images ; modérés empoisonnement de cache) | [E] `evidence/09` ; [S] `src/app/opengraph-image.tsx` | **corrigé et retesté** (16.3.8 ; `evidence/55`, build et tests verts) |
| DEF-002 | P2 | moteur de calcul | Moyenne annuelle non bornée : formule annuelle acceptée par la validation → **30/20 publié** pour un élève à 10 | [E] `evidence/10` + sonde | **corrigé et retesté** (`evidence/50`) |
| DEF-003 | P2 | performance | `/api/grades` (élève, parent) p50 3,5–3,6 s, p95 4,0–4,6 s : calcul de toute la classe, année puis chaque période en séquence | [E] `evidence/29`, `30`, `32` | **amélioré, ouvert** : p50 ~1,95 s, p95 ~2,4–2,6 s après correction (`evidence/75`, `76`) |
| DEF-004 | P2 | dépendances | `axios@1.19.0` (via `fedapay`) : 12 avis dont 7 élevés ; `brace-expansion@5.0.9` élevé ; `dompurify@3.4.13` faible | [E] `evidence/09` | **corrigé et retesté** (1.20.0 / 5.0.12 / 3.4.17) |
| DEF-005 | P3 | tests | 2 tests de précision (`/api/bulletins`) dépassent 10 s sous la charge de la suite complète (12,7 s et 12,2 s) ; passent isolés | [E] `evidence/05`, `05b` | **corrigé et retesté** (délai du bloc à 60 s ; suite complète verte `evidence/62`) |
| DEF-006 | P4 | interface | « Mes notes » (élève) appelle `/api/students?limit=1` à chaque affichage → 403 | [E] réseau navigateur ; [S] `family-grades.tsx:54` | **corrigé et retesté** (navigateur : plus d'appel ni de 403) |
| DEF-007 | P4 | outillage | `vitest@4.1.11` et `@vitest/coverage-v8@4.1.6` désalignés (« Running mixed versions is not supported ») | [E] `evidence/08` | **corrigé** (4.1.11 / 4.1.11 ; couverture `evidence/80`) |
| DEF-008 | P3 | moteur de calcul | `validateFormula` ne teste que des cas types : une formule construite pour les éviter est acceptée (45/20 pour MI = 5) ; à l'exécution elle donne « NC » silencieux | [E] test « LIMITE » | **ouvert** (atténué par les garde-fous [0;20]) |
| DEF-009 | P4 | moteur de calcul | `max(12,5)` lu comme `max(12.5)` (virgule décimale collée) | [E] | **ouvert** |
| DEF-010 | P4 | API | `/api/system/automation` répond 500 « Configuration Error » sans `CRON_SECRET` (`retention` : 401) | [E] `evidence/24`, `74` | **ouvert** (reste fermé, code d'erreur incohérent) |
| DEF-011 | P4 | outillage | Contrôle H3 de `security.mjs` devenu non probant (130 requêtes contre un seau de 1 000/min) | [E] `evidence/23` | **corrigé et retesté** (contrôle discriminant, PASS `evidence/74`) |
| DEF-012 | P3 | performance | Chaque enregistrement des règles lance un recalcul complet de l'école, sans regroupement : 3 enregistrements → ~2 cœurs pendant > 20 min | [E] `top`, `evidence/34` | **ouvert** ; données restées cohérentes (`evidence/65`, `72`) |
| DEF-013 | P3 | environnement | Base de développement locale (5432) : 27 migrations non appliquées | [E] `evidence/11`, `12` | **ouvert** — action de l'exploitant (`prisma migrate deploy`) |
| DEF-014 | P3 | dépendances | `sharp@0.35.4` et `source-map-js@1.2.1` : avis élevés, aucune version corrigée trouvée par `npm view` | [E] `evidence/55` | **ouvert** (non démontré exploitable) |
| DEF-015 | P4 | tests | `tests/lib/redis/outage.test.ts` (seuil 300 ms) échoue sous instrumentation de couverture (375 ms) ; 3/3 sans | [E] `evidence/80`, `81` | **ouvert** |
| DEF-016 | P4 | sécurité | Installation initiale sans jeton : le premier visiteur de `/setup` d'un déploiement neuf devient SUPER_ADMIN | [S] | **ouvert** (procédure) |
| DEF-017 | P3 | base de données | Aucune contrainte `CHECK` sur les bornes métier (note ≤ barème, montant > 0) | [S] | **ouvert** |
| DEF-018 | P4 | traçabilité | Les moyennes stockées ne référencent pas la version de formule qui les a produites | [S] | **ouvert** |
| DEF-019 | P4 | interface | Après connexion, `callbackUrl` est ignoré : retour forcé à `/dashboard` | [E] navigateur ; [S] `src/app/(auth)/login/page.tsx:97` | **ouvert** (à corriger avec contrôle de même origine) |
| DEF-020 | P4 | métrique | « Présence 0,0 % depuis la rentrée » pour un élève n'ayant qu'un relevé (absence justifiée) : taux calculé sur les seuls relevés | [E] navigateur + base | **ouvert** (définition à préciser) |
| IND-001 | C | paiement | Webhook Flutterwave : « verif-hash » implémenté en HMAC du corps ; contrat fournisseur à confirmer | [S] `src/app/api/payments/webhook/route.ts` | à investiguer |
| IND-002 | C | données | Recalcul d'arrière-plan non durable (promesse en mémoire) : risque théorique de moyennes stockées périmées en cas d'interruption | [S] ; [E] interruption volontaire → aucune incohérence observée | à investiguer |

## Fiches détaillées des défauts corrigés

### DEF-001 — `next` vulnérable
- Reproduction : `npm audit --omit=dev --json` → `next` 16.0.0–16.3.7, avis GHSA-vcvr-r3jv-pc5j (critique, ≥16.2.0 <16.3.6).
- Attendu : aucune vulnérabilité critique connue. Observé : critique.
- Correction : `"next": "~16.3.8"`, `"eslint-config-next": "~16.3.8"` (correctif seulement ; npm avait d'abord
  résolu 16.4.0 avec `^`, version écartée pour limiter le risque).
- Vérification : `npm ls next` → 16.3.8 ; `npm audit` → 0 critique ; type-check, lint, 4 138 tests,
  344 tests d'intégration, build : verts.

### DEF-002 — Moyenne annuelle hors bornes
- Reproduction : formule annuelle `P1 + P1*(20-P1)*(P1-8)/10` (acceptée par `validateFormula(…, "ANNUAL", 1)`) ;
  une période, un élève à 10/20 → `computeAnnualAverages` → générale **30**, matière **30**.
- Cause racine : `fullMean` (`computeAnnualAverages`) appelait `evaluateFormula` sans le garde-fou [0;20]
  pourtant présent pour la moyenne de matière (`subjectBreakdown`).
- Correction : même garde-fou → « NC ». Test de régression : `tests/precision/formula-engine.audit.test.ts`.
- Vérification : FAIL avant (`evidence/10`), PASS après (`evidence/50`), suite complète verte.

### DEF-003 — Lenteur des vues famille
- Mesure : 20 requêtes séquentielles par route sur 131 208 notes (`evidence/29`, `30`).
- Cause racine : `studentAveragesSummary` (`src/lib/academic/class-averages.ts`) : `computeClassAnnual` puis
  `computeClassPeriod` pour chaque période, en séquence ; chaque appel recharge et recalcule toute la classe.
- Correction minimale : appels lancés en parallèle (`Promise.all`), association par identifiant de période.
- Vérification : résultats identiques (S1 octet pour octet, `evidence/37` vs `71`) ; p50 −45 %.
- Reste ouvert : ~2 s par requête ; piste : mémoïsation par classe et période invalidée à l'écriture des notes.
