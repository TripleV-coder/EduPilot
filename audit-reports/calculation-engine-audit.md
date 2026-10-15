# Audit du moteur de calcul à formules dynamiques — 2026-10-14

## A. Architecture réelle du moteur

```
Formule (texte)                      src/lib/academic/formula.ts
  ├─ par défaut : SUBJECT_PRESETS / ANNUAL_PRESETS (code)
  ├─ école : réglages (getGradingSettings, relus en base à chaque calcul)
  ├─ enseignant/matière : class_subjects.averageFormula
  ├─ élève/matière/période : student_formulas
  └─ gelée : class_councils.rules (au conseil validé)
        ↓ validateFormula (syntaxe, variables, types, cas types 0→0 / 20→20 / dans [0;20])
        ↓ parseFormula : analyseur descendant récursif maison (≤ 300 caractères, imbrication ≤ 20)
        ↓ cache d'arbres indexé par le TEXTE de la formule (≤ 500 entrées)
        ↓ evaluateFormula : arithmétique Rational (fractions BigInt), division par 0 → « vide »
src/lib/academic/average-engine.ts : ramène chaque note sur 20, range I / D / C, applique la formule,
        garde-fou [0;20] → « NC » ; moyenne générale pondérée ; moyenne annuelle (formule annuelle)
src/lib/academic/class-averages.ts : charge les notes d'une classe, règles et formules gelées,
        rang olympique ; utilisé par bulletins, PDF, conseils, statistiques, espaces famille
Affichage : toDisplay = arrondi au centième, demi vers le haut (ou troncature, réglable), calculé en entiers
Stockage : student_analytics (instantanés recalculés en arrière-plan après changement de règles)
Traçabilité : audit_logs (changements de formules) ; pas d'identifiant de formule sur les résultats
```

Grammaire acceptée : nombres (décimale `.` ou `,` collée entre deux chiffres), `+ - * /` (et `× ÷`),
parenthèses, signe unaire, variables (`MI MD MC INTERROS DEVOIRS COMPOS I1…I9 D1…D9 C1…C9` pour une matière ;
`P1 P2 P3 PERIODES` + alias `T1 T2 T3 S1 S2` pour l'année), fonctions `moyenne somme nombre min max`
(séparateur `;`, ou `,` hors chiffres). Aucun opérateur logique, aucune comparaison, aucune condition.

## B. Inventaire des formules par défaut

| ID | Formule | Portée | Référence métier |
|---|---|---|---|
| F-SUBJ-OFF | `moyenne(MI ; DEVOIRS ; COMPOS)` = (MI + D1 + … + Dn + C1 + … + Cm) / (1 + n + m) | matière | règle officielle du Bénin, documentée dans `docs/QUESTIONS_NOTES_MOYENNES.md` et l'en-tête de `average-engine.ts` |
| F-SUBJ-2 | `moyenne(moyenne(MI ; MD) ; MC)` | matière | préréglage |
| F-SUBJ-3 | `moyenne(MI ; DEVOIRS ; COMPOS ; COMPOS)` | matière | préréglage |
| F-SUBJ-4 | `(MI + MD + 2*MC) / 4` | matière | préréglage |
| F-ANN-OFF | `moyenne(PERIODES)` = (T1+T2+T3)/3 ou (S1+S2)/2 | année | règle officielle |
| F-ANN-2/3 | `(P1 + P2 + 2*P3) / 4`, `(P1 + 2*P2) / 3` | année | préréglages |

Justesse **métier** de F-SUBJ-OFF : seule la documentation interne du projet sert de référence (aucun texte
réglementaire béninois consulté pendant l'audit) — la conformité au règlement officiel n'est **pas
certifiée** par cet audit ; seule l'exactitude de l'implémentation par rapport à la formule documentée l'est.

## C. Référentiel (fiche F-SUBJ-OFF)

- Variables : MI = moyenne simple des interrogations (vide s'il n'y en a pas) ; Di, Cj = devoirs et
  compositions ramenés sur 20. Unité : points sur 20. Entrées admises : notes de 0 au barème, 2 décimales max.
- Statuts : absence non justifiée → 0 (réglable) ; absence justifiée, dispense, note écartée → exclue ;
  case vide → « NC », exclue ; note supprimée → ignorée ; avant l'inscription : seule une note saisie compte.
- Arrondi : un seul arrondi final au centième, demi vers le haut, sur la fraction exacte.
- Erreurs : formule illisible → « vide » (jamais un nombre faux) ; division par 0 → vide ; résultat hors
  [0;20] → « NC ».

## D. Résultats des tests indépendants

Oracle : fractions BigInt écrites dans le test (aucun appel à `Rational` du moteur), arrondi demi-haut
réimplémenté. Fichier `tests/precision/formula-engine.audit.test.ts`, graine fast-check `20261014`.

| ID | Version | Entrées | Formule attendue | Formule utilisée | Référence | Obtenu | Écart | Tolérance | Verdict | Preuve |
|---|---|---|---|---|---|---|---|---|---|---|
| O-1 | code `75b2377` | 2 000 élèves générés : 0–6 interros, 0–6 devoirs, 0–3 compos, notes 0,00–20,00 | (MI + ΣD + ΣC)/(1+n+m) | `moyenne(MI ; DEVOIRS ; COMPOS)` | fraction oracle | fraction moteur | **0** (égalité de fractions) | exacte | PASS | `evidence/10`, `50` |
| O-2 | idem | mêmes 2 000 cas | arrondi au centième demi-haut | `toDisplay` | centièmes oracle | centièmes moteur | **0** | exacte | PASS | idem |
| O-3 | idem | 1 000 cas, ≥1 interro et ≥1 devoir | min ≤ moyenne ≤ max | idem | propriété | — | — | — | PASS | idem |
| O-4 | idem | toutes notes = 10 | 10 | idem | 10 | 10 | 0 | exacte | PASS | idem |
| O-5 | idem | 1,005 ; 2/3 ; 41/3 ; 12,345 (troncature) | 1,01 ; 0,67 ; 13,67 ; 12,34 | `toDisplay` | calcul manuel | identiques | 0 | exacte | PASS | idem |
| D-S1 | serveur réel, règles par défaut | 33 moyennes de matière d'un élève (3 périodes × 11 matières) | F-SUBJ-OFF | réglage de l'école | oracle recalculé depuis les notes brutes de `GET /api/grades` | `summary` de la même réponse | **0** sur les 33 | exacte | PASS | `evidence/37` (S1) |
| D-S3 | serveur réel, formule modifiée | mêmes 33 | F-SUBJ-3 (composition double) | réglage modifié | oracle | `summary` | **0** sur les 33, valeurs changées | exacte | PASS | `evidence/37` (S3) |
| D-UI | navigateur | moyenne générale de l'élève | — | — | API : 17,73 ; périodes 18,23 / 17,61 / 17,35 | interface : 17,73 ; Anglais 18,58 = API | 0 | exacte | PASS | session navigateur |

Extrait D-S1 (période `…e5wz`) : Arts plastiques attendu 16,75 / affiché 16,75 ; Informatique 17,25 / 17,25.
Après passage à F-SUBJ-3 : 16,80 / 16,80 et 16,70 / 16,70.

## E. Opérateurs et priorités — [E] 11 cas

`2 + 3 * 4 = 14`, `(2 + 3) * 4 = 20`, `10 - 4 - 3 = 3` (gauche), `100 / 10 / 2 = 5`, `-2 * 3 = -6`,
`- - 5 = 5`, `2 * -3 = -6`, `2 × 3 ÷ 4 = 3/2`, `12,5 + 0.5 = 13`, `1 / 3 = 1/3` exact, `0.1 + 0.2 = 3/10`
exact. Rejets vérifiés : vide, parenthèse non fermée, opérateur final, juxtaposition `MI MD`, `**`, `^`,
fonction inconnue, `moyenne()`, `;` hors fonction, `.5`, variable inconnue, liste dans une addition,
`P3` dans une année à 2 périodes, formule sans aucune note.

## F. Précision numérique et arrondis

Aucune virgule flottante dans le calcul (BigInt) [S][E] ; la seule conversion en `number` est l'affichage
au centième (`Number(cents)/100`), sans perte (entiers < 2⁵³). Division par zéro → vide, jamais `Infinity`
ni `NaN` [E]. Très grands nombres exacts [E]. Le rang (`competitionRank`) compare les centièmes affichés,
conformément à la règle « rang sur la moyenne affichée » [S].

## G. Comportement lors des modifications (serveur réel, `evidence/37`)

| Scénario | Résultat |
|---|---|
| S1 formule par défaut | PASS (33/33 exactes) |
| S2 modification persistée et relue | PASS |
| S3 nouvelle formule appliquée immédiatement | PASS (33/33 exactes, valeurs changées) |
| S4 modification d'un paramètre | couvert par S3 (poids de la composition) |
| S5 formule invalide refusée, l'ancienne conservée | PASS (400 « La formule se termine trop tôt. ») |
| S5b mauvais diviseur refusé | PASS (400 « … donne 13,33 au lieu de 20 ») |
| S6 persistance après redémarrage | voir `test-results.md` §R |
| S7 cache | pas de risque d'ancienne formule : cache indexé par le texte [S] ; S3 confirme [E] |
| S8 concurrence | **non exécuté** |
| S9 isolation entre écoles / droits | PASS (autre école inchangée ; enseignant → 403) |
| S10 dépendances entre formules | non applicable : aucune formule ne dépend d'une autre ; l'annuelle consomme les moyennes de période |
| Restauration | PASS (retour exact aux valeurs de S1) |

## H. Persistance et versionnement

Les moyennes ne sont pas versionnées par résultat ; le gel au conseil (`class_councils.rules`) fige la
formule d'une période validée [S] — non exercé dynamiquement (aucun conseil dans la classe testée).

## I. Cohérence API / base / interface

API ↔ interface : identiques [E]. API ↔ bulletin : banc de précision existant (`tests/precision/precision.test.ts`,
28 tests, routes bulletins, PDF, conseils, orientation contre un oracle) [E]. Base (`student_analytics`) ↔
calcul en direct : voir `test-results.md` §R.

## J. Sécurité du moteur

Aucune exécution de code possible : analyseur à grammaire fermée, pas d'accès aux objets, au réseau ni aux
fichiers [S] ; 8 tentatives d'injection refusées [E] ; bornes de taille et d'imbrication [E] ;
modification réservée à la direction (école), à l'enseignant de la matière (sa formule), et seulement si
l'école l'autorise [S][E].

## K. Concurrence

Non testée. Observation [E] : chaque enregistrement des règles lance un recalcul complet de l'école en
arrière-plan (`syncAllStudentsForSchool`, 4 élèves en parallèle) ; trois enregistrements rapprochés ont
occupé ~2 cœurs pendant plus de 20 minutes sur 995 élèves (DEF-012).

## L. Défauts détectés

| ID | Gravité | Description |
|---|---|---|
| DEF-002 | P2 | Moyenne annuelle non bornée : formule annuelle validée `P1 + P1*(20-P1)*(P1-8)/10`, élève à 10 → **30/20 publié** (générale et matière) [E] |
| DEF-008 | P3 | `validateFormula` n'essaie que des cas types : une formule construite pour les éviter passe (démontré : 45/20 pour MI = 5) ; atténué par les garde-fous [0;20] → « NC » |
| DEF-009 | P4 | `max(12,5)` lu comme `max(12.5)` (virgule décimale) |
| DEF-012 | P3 | Recalculs d'arrière-plan non regroupés après changements de règles successifs |

## M. Défauts corrigés et retestés

DEF-002 : garde-fou ajouté dans `computeAnnualAverages` (`average-engine.ts`, fermeture `fullMean`) ; test
de régression `tests/precision/formula-engine.audit.test.ts` (« moyenne annuelle : un résultat hors de 0 à 20
n'est jamais publié ») : FAIL avant (`evidence/10`), PASS après (`evidence/50`).

## N. Contrôles impossibles ou incomplets

Concurrence (S8), gel au conseil en dynamique, tests de mutation (aucun outil), conformité réglementaire de
la formule officielle (aucune source officielle consultée).

## O. Risques métier restants

- Une formule pathologique mais acceptée produit « NC » silencieux pour certains élèves au lieu d'être
  refusée à l'enregistrement (DEF-008).
- Après un changement de règles, les moyennes stockées (tableaux de bord, espace parents) restent
  anciennes pendant toute la durée du recalcul (plusieurs minutes mesurées).

## P. Verdict technique

Pour le périmètre testé (formules par défaut et préréglages, arithmétique, arrondi, modifications,
validation, isolation) : **exact** — écart nul sur 2 000 cas générés et 66 moyennes servies par le serveur
réel. Le défaut de publication hors bornes (DEF-002) est corrigé et couvert. Réserves : DEF-008, concurrence
non testée, conformité réglementaire non certifiée.
