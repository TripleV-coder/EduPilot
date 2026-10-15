# Résultats des tests — audit du 2026-10-14

Chaque ligne renvoie à un journal dans `evidence/` (commande exacte, code de sortie et durée dans
`evidence/commands.tsv`). Durées : celles rapportées par l'outil quand l'horloge système a sauté (veille
de la machine pendant `62-unit-after`, journalisée 9 052 s pour 288,8 s réelles selon Vitest).

## A. Baseline (commit `75b2377`, avant toute correction)

| ID | Contrôle | Code | Résultat | Preuve |
|---|---|---|---|---|
| B1 | `npm ls --depth=0` | 0 | dépendances installées cohérentes | `01` |
| B2 | `prisma validate` | 0 | schéma valide | `02` |
| B3 | `npm run type-check` | 0 | 0 erreur (22,1 s) | `03` |
| B4 | `npm run lint` | 0 | 0 erreur (87,8 s) | `04` |
| B5 | `npx vitest run` | **1** | 371 fichiers : 370 OK, 1 KO ; **4 096 réussis, 2 échoués (délai 10 s dépassé), 11 ignorés** sur 4 109 | `05` |
| B5b | `precision.test.ts` seul | 0 | 28/28 (128 s) — échecs de B5 = dépassement de délai sous charge | `05b` |
| B6 | `npm run test:integration` | 0 | 54 fichiers, **344/344** (113,1 s) | `06` |
| B7 | `npm run build` | 0 | réussi (85,0 s) | `07` |
| B8 | couverture unitaire | 1 | interrompue sans résumé ; versions Vitest désalignées signalées | `08` |
| B9 | `npm audit --omit=dev` | 1 | 6 avis : 1 critique, 4 élevés, 1 faible | `09` |

## B. Moteur de formules — nouvelle suite `tests/precision/formula-engine.audit.test.ts` (40 tests)

| Groupe | Tests | Avant correction | Après correction | Preuve |
|---|---|---|---|---|
| Grammaire (priorités, signes, décimales, rejets, ambiguïté de la virgule) | 25 | PASS | PASS | `10`, `50` |
| Sécurité (8 injections, bornes, temps d'analyse) | 10 | PASS | PASS | idem |
| Oracle exact 2 000 cas + propriétés 1 000 cas + arrondis | 3 | PASS | PASS | idem |
| Validation : préréglages, limite démontrée (45/20) | 2 | PASS | PASS | idem |
| Garde-fou de la moyenne annuelle (DEF-002) | 1 | **FAIL** (30/20 publié) | PASS | idem |

(Avant : 39 réussis + 1 échec ; après : 40/40. Graine fast-check : `20261014`.)

## C. Scénarios dynamiques du moteur (serveur réel, base jetable) — `formula-scenarios.mjs`

| ID | Scénario | Build initial `evidence/37` | Build corrigé `evidence/71` |
|---|---|---|---|
| F0 | réglages lisibles, règles par défaut | PASS | PASS |
| S1 | 33 moyennes de matière = oracle | PASS (écart 0) | PASS (écart 0, sortie identique octet pour octet) |
| S2 | modification persistée et relue | PASS | PASS |
| S3 | nouvelle formule appliquée, 33 = oracle | PASS | PASS |
| S5 | formule invalide refusée, valide conservée | PASS | PASS |
| S5b | mauvais diviseur refusé | PASS | PASS |
| S9 | autre école non affectée | PASS | PASS |
| S9b | enseignant → 403 | PASS | PASS |
| S1bis | restauration exacte | PASS | PASS |

## D. Sécurité dynamique — `scripts/quality/security.mjs` + sondes

| Contrôle | 1ᵉʳ passage `23` | 2ᵉ passage `24` | Build corrigé `74` |
|---|---|---|---|
| H4 force brute un compte | PASS | PASS | PASS |
| G3 comptes différents depuis une IP d'école | PASS | PASS | PASS |
| H3 usurpation XFF | FAIL (contrôle non probant) | FAIL (idem) | **PASS** (contrôle discriminant) |
| SETUP connexion admin | FAIL (mots de passe du seed inconnus) | PASS (après réinitialisation sur base jetable) | PASS |
| H5 IDOR GET/PATCH/DELETE | non exécuté | PASS ×3 | PASS ×3 |
| TENANT `?schoolId` | non exécuté | PASS | PASS |
| H1 santé | PASS | PASS | PASS |
| H2 `automation` sans secret | FAIL (500) | FAIL (500) | FAIL (500) — DEF-010 |
| H2 `retention` | PASS | PASS | PASS |
| M3 JSON vide / cassé | FAIL (401, non connecté) | PASS ×2 | PASS ×2 |
| **Total** | 4/9 | 10/12 | **11/12** |

Sonde XFF discriminante (`evidence/25`) : 12 IP usurpées → `{"302":10,"429":2}` → PASS.
En-têtes HTTP et CORS (`evidence/26`) : conformes (voir `security-audit.md` §4).

## E. Fumée, latence, charge

Voir `performance-report.md`. Fumée (`28`) : 7 violations de seuils, dont `/api/grades` élève/parent ~3,9 s
et `/api/system/automation` 500. Latence avant/après (`29–31`, `75–76`). Charge (`35-load-rep1..3`) : 0 erreur.

## F. Parcours navigateur (navigateur intégré, serveur local, compte élève de test)

| Étape | Résultat |
|---|---|
| Connexion | OK → consentement imposé → OK |
| Redirection après connexion | `/dashboard` au lieu de `callbackUrl` (DEF-019) |
| « Mes notes » (bureau) | moyenne 17,73 = API ; Anglais 18,58 = API ; 132 notes, 11 matières |
| Console (build initial) | 403 `/api/students` (DEF-006) ; erreurs service worker / SSL (artefact HTTP local) |
| Console (build corrigé) | plus de 403 ; un seul appel `/api/grades` (deux avant) |
| Mobile 375 px | pas de débordement horizontal, `lang="fr"`, 1 `h1`, 0 contrôle sans nom, 0 champ sans libellé, 0 image sans `alt` |
| Accueil élève | « Ma moyenne 17,35 » = moyenne de la 3ᵉ période (API) ; « Présence 0,0 % » sur 1 seul relevé (DEF-020) |

## G. Tests non exécutés ou bloqués

| Campagne | Statut | Raison |
|---|---|---|
| E2E Playwright (31 specs) | **BLOQUÉ** | navigateurs Playwright absents ; téléchargement (~150 Mo) non autorisé |
| Workflows CI distants | non exécutés | pas de push pendant l'audit |
| Sauvegarde / restauration | **BLOQUÉ** | `pg_dump` absent de l'hôte |
| Concurrence des modifications de formules (S8) | non exécuté | — |
| Tests de mutation | non exécutés | aucun outil (Stryker) dans le projet |
| Fournisseurs externes (paiement, SMS, e-mail, LLM) | non exécutés | aucune clé |

## R. Contrôles complémentaires après corrections

| Contrôle | Résultat | Preuve |
|---|---|---|
| Moyennes stockées (`student_analytics`) = recalcul en direct, après 3 changements de formule | **2 985 / 2 985 identiques** (29 classes × 3 périodes ; 3 « NC » des deux côtés) | `65` |
| Même contrôle après arrêt volontaire du serveur pendant un recalcul | 2 985 / 2 985 identiques | `72` |
| S6 persistance : formule relue après redémarrage du serveur | formule restaurée avant l'arrêt, relue par le nouveau processus (F0) | `71` |
| Test temporel `redis/outage` sous couverture | échec (375 ms > 300) ; 3/3 sans couverture | `80`, `81` |
