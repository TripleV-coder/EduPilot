# Design — Prédictif renforcé : nouvelles prédictions (Sous-projet B, slice 1)

Date : 2026-07-02
Statut : validé (brainstorming)
Portée : `src/lib/services/ai-predictive/`

## Contexte

EduPilot tourne en mode **100% autonome** : aucune clé LLM cloud n'est
disponible et il n'y en aura jamais. Toute la valeur « IA » doit donc venir
du moteur prédictif **déterministe et local** (pur calcul sur les données
Prisma) et de l'assistant ancré sur les données.

Le moteur prédictif existant (`src/lib/services/ai-predictive/`) est déjà
mature : ensemble learning pour la prédiction de note (linéaire + polynomiale
+ EMA + baseline, pondéré par R², validation croisée, bootstrap), modèle
multi-facteurs de risque d'échec avec facteurs causaux, risque comportemental,
orientation, prédictions de classe. Algorithmes disponibles : régression,
K-means, détection d'anomalies par z-score, pondération temporelle, sigmoïde.

Cette slice ajoute de **nouvelles prédictions** à ce moteur, sans réinventer
l'existant, et corrige un défaut de fiabilité (non-déterminisme).

## Problèmes adressés

1. **Non-déterminisme (fiabilité)** — `bootstrapConfidenceInterval` et
   `simpleKMeans` utilisent `Math.random()` sans seed. Le même élève produit
   une prédiction différente à chaque appel, et les tests sont instables.
2. **Pas de vrai modèle de décrochage** — le `dropoutRisk` d'une classe est
   aujourd'hui juste « % d'élèves à risque d'échec ≥ 50 ». Aucun signal réel
   de désengagement (chute d'assiduité, absences consécutives, abandon des
   devoirs).
3. **Pas d'alerte précoce** — `detectAnomalies` existe mais ne sert qu'en
   interne pour nettoyer les notes ; aucune détection exposée de « chute
   soudaine ».
4. **Modèle comportemental naïf** — `predict-behavior.ts` calcule
   `fréquence × 15` de façon arbitraire, sans facteurs causaux, ni
   recommandations, ni confiance, ni qualité de données (contrairement au
   modèle d'échec, riche).

## Objectifs

- Ajouter 3 capacités prédictives : modèle de décrochage, détection d'alerte
  précoce, modèle comportemental refondu.
- Rendre l'ensemble du moteur **déterministe et reproductible** (même entrée →
  même sortie), donc testable de façon fiable.
- Rester 100% local, zéro appel externe, jamais d'exception non gérée (défaut
  sûr quand les données sont insuffisantes), payload API rétrocompatible.

## Non-objectifs (réservés à d'autres slices/sous-projets)

- Clustering cohorte, bandes de niveau, comparaison classe-vs-école (axe 3 de B).
- Refonte de la logique d'orientation (keyword-matching → `src/lib/benin/levels.ts`).
- Transformation des prédictions en alertes/notifications proactives et cartes
  dashboard (sous-projet C).
- Assistant conversationnel ancré sur les données (sous-projet A).

## Architecture

Tout reste dans `src/lib/services/ai-predictive/`. Chaque nouvelle prédiction
est un module autonome à responsabilité unique, orchestré par
`predict-student.ts` et exposé via le barrel `index.ts`. Aucune modification de
schéma Prisma.

### Modèles Prisma & champs utilisés (confirmés)

- `Attendance` : `status` (`AttendanceStatus` = PRESENT | ABSENT | LATE |
  EXCUSED), `date`, index `[studentId, date]`.
- `HomeworkSubmission` / `Homework` : `createdAt`, `dueDate`, `isPublished`,
  liaison classe via `classSubject.class.enrollments`.
- `BehaviorIncident` : `severity` (`IncidentSeverity` = LOW | MEDIUM | HIGH |
  CRITICAL), `type`, `date`.
- `GradeHistory` : `average`, `period.sequence` (moyenne générale =
  `subjectId: null`).
- `StudentAnalytics` : `generalAverage`, `subjectPerformances` (`isWeakness`).
- `Enrollment` : `studentId`, `classId`, `status: "ACTIVE"`.

## Composants

### 1. `algorithms/rng.ts` (nouveau) — déterminisme

- `mulberry32(seed: number): () => number` — PRNG déterministe, uniforme [0,1).
- `seedFromId(id: string): number` — hash stable (FNV-1a 32 bits) d'un
  identifiant vers une seed entière.
- Refactor `bootstrapConfidenceInterval(values, confidence, iterations, rng?)`
  et `simpleKMeans(data, k, rng?)` : acceptent un `rng: () => number`
  optionnel. Sans argument → `Math.random` (rétrocompat des appels internes qui
  n'exigent pas le déterminisme), mais tous les appels dans le pipeline de
  prédiction passent un RNG seedé sur l'`studentId`.
- Effet : `predict-grade` (qui utilise le bootstrap) et toute prédiction
  deviennent reproductibles par élève.

### 2. `predict-dropout.ts` (nouveau) — risque de décrochage

`predictDropoutRisk(studentId): Promise<DropoutRisk>`

Mesure une **trajectoire de désengagement**, distincte du risque d'échec
(niveau de notes). Signaux, chacun normalisé 0–100 puis pondéré :

| Signal | Poids | Calcul |
|---|---|---|
| Tendance d'assiduité | 0.30 | Taux d'absences non justifiées (ABSENT, hors EXCUSED) fenêtre 0–30j vs 30–60j ; le score monte si le taux récent augmente. |
| Absences consécutives | 0.20 | Plus longue série d'absences non justifiées consécutives (jours d'école) sur 30j. |
| Abandon des devoirs | 0.20 | Taux de rendu fenêtre récente (0–30j) vs précédente (30–60j) ; le score monte si le taux **baisse**. |
| Effondrement des notes | 0.15 | Pente négative de `GradeHistory` via `linearRegression` (réutilisé). |
| Escalade comportementale | 0.10 | Fréquence d'incidents 0–30j vs 30–60j en hausse. |
| Récence d'engagement | 0.05 | Jours depuis dernier devoir rendu / dernière présence. |

- Composite = somme pondérée, borné 0–100. `level` : TRÈS FAIBLE (<15) …
  TRÈS ÉLEVÉ (≥75), mêmes seuils que le risque d'échec pour cohérence.
- `signals: { factor, severity, contribution, description }[]` triés par
  contribution (aligné sur `causalFactors` du modèle d'échec).
- `recommendations` mappées depuis le signal dominant (ex. absences → contact
  parents ; abandon devoirs → tutorat/suivi).
- `confidence` (0–100) et `dataQuality` (LOW|MEDIUM|HIGH) selon le volume de
  données disponibles (jours d'assiduité, périodes de notes, historique
  devoirs).
- Défaut sûr si aucune donnée : probabilité faible, `dataQuality: "LOW"`,
  `signals: []`. Jamais d'exception.

### 3. `detect-early-warning.ts` (nouveau) — alerte précoce

`detectEarlyWarnings(studentId): Promise<EarlyWarning[]>`

Signaux **aigus ponctuels** (déclencheurs), pas de tendance lente. Chaque
warning : `{ type, severity: "WARNING" | "CRITICAL", value, message, since }`.

| Type | Déclencheur |
|---|---|
| `GRADE_DROP` | Dernière période vs baseline pondérée temporellement : chute ≥ 3 pts, **ou** z-score anormal via `detectAnomalies` sur `GradeHistory`. |
| `ATTENDANCE_CLIFF` | ≥ 3 absences non justifiées consécutives sur 14 jours. |
| `HOMEWORK_STOP` | 0 devoir rendu sur 14 jours alors que ≥ 2 devoirs étaient dus. |
| `BEHAVIOR_SPIKE` | ≥ 2 incidents HIGH/CRITICAL sur 14 jours. |

- Seuils centralisés en constantes exportées (calibrage facile + tests).
- Tableau vide si rien à signaler. Déterministe. Jamais d'exception.

### 4. `predict-behavior.ts` (refonte)

`predictBehaviorRisk(studentId): Promise<BehaviorRisk>` — signature de retour
enrichie, alignée sur le modèle d'échec :

- Fréquence pondérée par récence (incidents récents > anciens), gravité
  (CRITICAL > HIGH > MEDIUM > LOW), tendance mois/mois, distinction
  premier incident vs récidive.
- Ajoute `causalFactors`, `recommendations`, `confidence`, `dataQuality`.
- Conserve `probability` et `nextIncidentPrediction` (rétrocompat).

### 5. Intégration

- **`types.ts`** : nouvelles interfaces `DropoutRisk`, `EarlyWarning`,
  `EarlyWarningType`, `BehaviorRisk` (enrichi). `StudentPrediction.predictions`
  gagne `dropoutRisk: DropoutRisk` et `earlyWarnings: EarlyWarning[]`.
  `ClassPrediction.predictions` : `dropoutRisk` devient l'agrégat du vrai
  modèle + ajout `studentsWithWarnings: number`.
- **`predict-student.ts`** :
  - `generateStudentPredictions` orchestre `predictDropoutRisk` et
    `detectEarlyWarnings` (ajoutés au `Promise.all`), et consomme le
    `BehaviorRisk` enrichi.
  - `generateClassPredictions` : une **seule passe** `Promise.all` par élève
    calculant note + risque d'échec + décrochage + alertes, puis agrège.
    Remplace le `dropoutRisk` factuellement faux (= % échec≥50) par la moyenne
    du décrochage réel et compte les élèves avec au moins une alerte active.
- **`index.ts`** : exporte `predictDropoutRisk`, `detectEarlyWarnings`, types
  et constantes de seuils.
- **Routes API** `/api/ai/predictions/student` et `/class` : inchangées côté
  code ; le payload est enrichi (champs additionnels), donc rétrocompatible.

## Gestion des erreurs

- Chaque module retourne un **défaut sûr** en cas de données insuffisantes
  (`dataQuality: "LOW"`, confiance basse, signaux/alertes vides). Aucun module
  ne lève d'exception — mêmes garanties que `predict-grade` (baseline).
- Division par zéro et fenêtres vides gérées explicitement (garde
  `length === 0`).

## Tests

Étendre les fichiers existants (`tests/lib/ai-predictive-*.test.ts`), mock
Prisma selon les conventions du projet (`vitest`, mocks prisma/auth).

- **Déterminisme** : deux appels consécutifs avec les mêmes données mockées →
  sorties strictement identiques (bootstrap + toute prédiction).
- **Décrochage** : fixtures élève sain / assiduité déclinante / abandon des
  devoirs / effondrement des notes → niveau et signal dominant attendus ;
  défaut sûr si aucune donnée.
- **Alerte précoce** : chaque type se déclenche au seuil et ne se déclenche pas
  en deçà ; tableau vide pour un élève sans signal.
- **Comportement** : présence de `causalFactors`/`recommendations`/
  `confidence` ; monotonie (plus d'incidents graves récents → probabilité plus
  haute).
- **Intégration** : `StudentPrediction` contient `dropoutRisk` et
  `earlyWarnings` ; `generateClassPredictions` agrège sans double-appel.

## Critères d'acceptation

1. `predictDropoutRisk`, `detectEarlyWarnings` et le `BehaviorRisk` enrichi
   existent, sont exportés et intégrés dans `StudentPrediction`.
2. Les prédictions sont reproductibles (déterminisme vérifié par test).
3. `generateClassPredictions` expose un `dropoutRisk` issu du vrai modèle et un
   `studentsWithWarnings`, calculés en une seule passe.
4. Aucun module ne lève d'exception sur données manquantes.
5. `pnpm test`, `lint` et `typecheck` verts ; payload API rétrocompatible.
