# Précision des calculs — moyennes, rang, conseil, orientation, prédiction

> **Document technique historique.**
>
> Les règles en vigueur, expliquées sans terme technique, sont dans le [Guide d'utilisation](guide-utilisateur/04-notes-et-moyennes.md). Les décisions qui les fondent sont dans le [Registre des décisions](QUESTIONS_NOTES_MOYENNES.md).
>
> Depuis le 3 octobre 2026, une note manquante est marquée « NC » et **ne bloque plus** l'impression du bulletin. Les passages de ce rapport qui parlent de blocage décrivent un état antérieur.

*Mesuré le 2026-10-01. Banc reproductible : `npx vitest run tests/precision/precision.test.ts` → résultats bruts dans `.quality-tmp/precision-results.json`.*

## ✅ Règles officielles complétées (2026-10-02, 2e passe)

| Règle | Comportement |
|---|---|
| Absence **non justifiée** | compte **0** et reste **modifiable** : si l'élève recompose, on saisit la note (l'absence est retirée). L'écran **« Modifier les notes »** est accessible depuis le cahier de notes, sur chaque évaluation dépliée. |
| Absence **justifiée** / dispense | exclue : la matière se divise par une note de moins, par exemple (MI + D1) / 2. Une case « justifiée » apparaît à côté de « Absent » à la saisie. |
| Devoir **manquant** alors que les camarades sont notés | **jamais tranché en silence**. Le bulletin passe en « Moyenne provisoire » avec la liste des notes à justifier, l'impression est bloquée, le conseil affiche « En discussion » et le cahier « N à justifier ». L'enseignant tranche : saisir la note, absence justifiée (÷2) ou absence non justifiée (0, ÷3). Une note supprimée redevient « à justifier ». |
| Moyenne **annuelle** | Semestres : **(S1 + S2) / 2**. Trimestres : **(T1 + T2 + T3) / 3**. Le diviseur est le nombre de périodes de l'année. Tant qu'une période manque, la moyenne annuelle n'existe pas : seule une moyenne **provisoire** s'affiche, et l'écran de passage ne propose plus « Promouvoir ». |
| Découpage de l'année | Exactement **2 semestres ou 3 trimestres**, même système pour toute l'année, sans chevauchement, à l'intérieur de l'année. La règle est vérifiée à la configuration et à la création ou modification d'une période. |
| Notes saisies | **2 décimales au plus** (la base arrondissait 12,345 sans prévenir). Une absence n'a jamais de valeur. |
| **Séries** | Référentiel unique `src/lib/benin/series.ts` avec les intitulés officiels, **EA, MIA et HR** (filières DT) compris. Une migration ajoute EA et MIA à l'énumération. L'aide à l'orientation raisonne **par discipline** : C ≠ D, l'EPS ne compte plus comme matière scientifique, et la philosophie (non enseignée au collège) ne pénalise plus A1. Plus de « série D par défaut » sans notes : la demande est refusée (422). |

Le banc `tests/precision` a été mis à jour avec ces règles : l'oracle indépendant gère les absences justifiées et non justifiées, et le jeu de données contient une vraie note manquante. Résultat : **0 écart** et **0 note à justifier manquée**. J'ai réintroduit volontairement l'ancienne règle (absence non justifiée exclue) dans le moteur : 9 tests échouent, donc le banc détecte bien l'erreur.

### Défauts similaires trouvés lors du balayage

| Endroit | Défaut | État |
|---|---|---|
| Écran de **passage** en classe supérieure | « Promouvoir » proposé à partir d'une moyenne SQL brute : toutes les notes mélangées, sans formule ni coefficient de matière, absences ignorées | ✅ moteur, moyenne annuelle officielle, aucune proposition si provisoire |
| **Préparation aux examens** (CEP/BEPC) | notes non ramenées sur 20 (8/10 comptait 8), toutes années mélangées, les vrais 0 ignorés | ✅ |
| **Tableau de bord parent** (API) | moyenne brute non ramenée sur 20 ; assiduité affichée 100 % sans aucun appel | ✅ (route sans écran consommateur aujourd'hui) |
| **Fiche élève 360°** | coefficient du catalogue au lieu de celui de la classe ; période sans moyenne tracée à 0 | ✅ |
| **Bulletin PDF** | rang mis en cache 5 min (une note corrigée n'était pas reflétée) ; élève sans aucune note déclaré « complet » | ✅ |
| **Cahier de notes** | notes supprimées affichées ; moyenne d'évaluation ignorant les dispenses et prenant 0 pour « vide » | ✅ |
| **Orientation « IA »** (modèle local et LLM) | 2ᵉ moteur : la « physique » de l'EPS comptait comme science, il proposait `SERIE_G` (inexistante), D par défaut pour un élève faible ; la réponse du LLM n'était pas validée ; score enregistré = 0 ou constante 75 | ✅ référentiel commun, réponse LLM validée, score réel |
| Conseil d'orientation, répartition | EA, MIA et FORMATION_PRO comptés dans les familles E, M et F | ✅ famille DT |
| **Plans de paiement** | 100 000 FCFA en 3 = 3 × 33 333,33 = 99 999,99, donc plan jamais soldé et relances à 0,01 FCFA ; échéance du 31/01 décalée au 03/03 | ✅ FCFA entiers (33 334 + 33 333 + 33 333), dates bornées |
| **Paiement Mobile Money** | montant NaN accepté ; centimes acceptés ; plafond = frais total (une famille pouvait payer deux fois) | ✅ FCFA entier, plafond = reste à payer |
| Saisies de montants (frais, paiements, bourses, cagnotte, comptabilité) | centimes acceptés ; NaN faisait planter la comptabilité ; une cagnotte de 0,4 donnait une contribution de 0 FCFA | ✅ FCFA entiers refusés sinon |
| Configuration académique | « 3 semestres » ou « 4 trimestres » acceptés ; périodes qui se chevauchent | ✅ |

### Reste à décider ou à faire (non corrigé)

- **Critères des séries** : les pondérations par discipline (ex. C = maths ×4, physique ×3, SVT en appoint) sont une **proposition** à faire valider par l'équipe pédagogique. Elles sont regroupées dans `PROFILES` (`src/lib/benin/series.ts`).
- **Classement des types d'évaluation** : « devoir » couvre les codes et noms DS, devoir, composition et examen ; tout le reste (IE, oral, TP…) entre dans MI. Chaque école doit nommer ses types en conséquence.
- **Prédiction** (voir § 4) : toujours moins précise que « dernière moyenne » ; elle n'a pas été modifiée.
- **Orientation post-BAC** : les choix « FAST », « EPAC »… de la page d'orientation ne correspondent à aucune valeur de l'énumération, leur enregistrement échoue (400).
- **Statistiques globales** (`/api/grades/statistics`, agrégats) : leur « moyenne » est la moyenne de toutes les notes, et non une moyenne générale officielle. C'est acceptable pour une statistique, à libeller comme telle.
- Une évaluation créée ne peut pas voir son barème, sa date ni son coefficient modifiés (aucune API) ; seules ses notes peuvent l'être.

### Étapes de déploiement

1. `npx prisma migrate deploy` (ajout de EA et MIA à `RecommendedSeries`).
2. Recalculer les moyennes stockées (calculées avec les anciennes formules) : `POST /api/analytics/sync-all` pour chaque école et son année en cours.
3. Vérifier dans chaque école que l'année compte 2 semestres ou 3 trimestres (les configurations incohérentes déjà en base ne sont pas corrigées automatiquement).

## ✅ Correction appliquée le 2026-10-02 — moteur unique, formule officielle

Toutes les moyennes passent désormais par **`src/lib/academic/average-engine.ts`** :

- **Formule officielle du Bénin** : moyenne de matière = (MI + D1 + D2) / 3. On la généralise en (MI + ΣDevoirs) / (1 + nombre de devoirs). MI est la moyenne simple des interrogations ; les devoirs regroupent devoir, DS, composition et examen. Tout le reste (interrogation écrite, oral, TP…) entre dans MI. Les coefficients d'évaluation ne sont plus utilisés.
- **Moyenne générale** : Σ(moyenne de matière × coefficient de matière) / Σ coefficients, sur les seules matières évaluées. **Moyenne annuelle** : moyenne simple des périodes.
- **Précision extrême** : le calcul se fait en fractions exactes (BigInt), sans aucune virgule flottante. Un **seul arrondi**, à la fin, au centième, demi vers le haut. Le **rang** (olympique : ex aequo = même rang), la **mention** et la **décision du conseil** se fondent sur cette moyenne affichée.
- Sont exclus : notes vides, notes **supprimées**, absences, dispenses. Toute note est **ramenée sur 20**.

Le moteur est branché sur : bulletin à l'écran, bulletin PDF (et son classement), conseil de classe, orientation (conseil, CEP, vue élève, recommandations indicatives), analyses élève (`GradeHistory`, qui nourrit la prédiction), cahier de notes et « Mes notes » élève/parent. Les anciennes fonctions de moyenne en flottants ont été **supprimées**. `getMention` n'a plus de trou entre ses tranches.

**Vérification** : le banc `tests/precision` compare désormais chaque route à l'oracle indépendant (formule officielle en fractions exactes) et **exige un écart nul**. Résultat : **0 écart** sur 1 128 moyennes, 0 rang faux, 0 mention fausse, 0 décision fausse. Le fuzz du moteur, 20 000 cas, donne 0 écart. Le banc détecte bien une erreur volontaire, même un simple arrondi « demi vers le bas ».

*Les sections ci-dessous décrivent l'état AVANT correction (mesure du 2026-10-01).*

## Méthode

- **Données** : une classe de 4ème simulée (40 élèves, 7 matières aux coefficients du Bénin, 2 semestres + 1 semestre de l'année précédente, 2 925 notes). Graine fixe. On y a mis volontairement les cas difficiles : interrogations notées sur 10, composition de français sur 40, absences, dispenses, 45 notes supprimées (saisies erronées), une copie à 0, deux élèves ex aequo, un élève sans aucune note, une matière où toutes les notes sont des absences.
- **Ce qui est testé** : le **vrai code** des routes et des fonctions. Seule la base est simulée : le Prisma simulé applique exactement les filtres `where` que demande chaque route, et refuse tout filtre qu'il ne sait pas interpréter.
- **Référence (oracle)** : `tests/precision/oracle.ts`, écrit sans rien importer de `src/`. Il calcule en fractions exactes, donc sans aucune erreur d'arrondi. La règle appliquée est celle que l'application déclare suivre : note ramenée sur 20, puis moyenne pondérée par le coefficient de l'évaluation, puis moyenne générale pondérée par le coefficient de la matière. Les absents, les dispensés et les notes supprimées sont exclus. Le rang suit le classement olympique : les ex aequo ont le même rang, et le rang suivant est sauté.
- Un écart est dit **visible** s'il atteint 0,005 point, c'est-à-dire s'il change le chiffre affiché à deux décimales.

## Résultats en bref

| Calcul | Écart moyen | Écart max | Élèves touchés | Effet concret |
|---|---|---|---|---|
| **Bulletin à l'écran** (`/api/bulletins`), moyenne générale | 0,28 (S1) / 0,36 (S2) | **1,14 pt** | **39/39** | mention fausse pour 4 (S1) et 6 (S2) élèves ; **rang faux pour 25 (S1) et 26 (S2) élèves sur 39** |
| Bulletin à l'écran, moyenne par matière | 1,33 | **12,2 pts** | 222 matières sur 269 | 101 mentions de matière fausses ; une matière affichée **20/20** alors que sa seule note avait été supprimée |
| Bulletin à l'écran, moyenne de classe par matière | 1,27 | 4,04 | 7/7 | — |
| **Conseil de classe** (`/api/grades/councils`) | identique au bulletin | 1,14 | 39/39 | **décision fausse pour 2 (S1) et 4 (S2) élèves** (exemples plus bas) |
| **Bulletin PDF** (`/api/grades/report-cards`) | 0,002 | 0,006 | 3 à 5 | correct ; seuls défauts : double arrondi et ex aequo mal classés |
| **Orientation : conseil** (`/api/orientation/council`), moyenne annuelle | 0,30 | 0,80 | 39/39 | mention fausse pour 6 élèves |
| **Orientation : élève** (`computeIndicativeRecommendations`) | 0,19 | 0,52 | 38/39 | 2 mentions fausses |
| Fonctions de moyenne pures (erreur de calcul flottant) | — | 5·10⁻¹⁵ | — | négligeable |
| Décision du conseil `pickDecision` (8 004 cas) | — | — | 0 erreur | exact |
| Régressions linéaire et quadratique | — | 3·10⁻¹² | — | mathématiquement exactes |
| **Prédiction** du semestre suivant | MAE **1,55 pt** | P90 3,2 | — | **moins précise que de reprendre la dernière moyenne (MAE 1,23)** |

**Conclusion** : dans ce banc, les formules mathématiques elles-mêmes sont justes. Les écarts viennent de **cinq implémentations différentes de « la moyenne »** qui n'appliquent pas les mêmes règles. Seul le bulletin PDF est conforme. Le bulletin à l'écran, le conseil de classe et l'orientation affichent des moyennes fausses dès qu'une évaluation n'est pas notée sur 20 ou qu'une note a été supprimée.

## 1. Moyennes, rangs et conseil de classe

### Cause, prouvée à 3,6·10⁻¹⁵ près

On a refait le calcul de `/api/bulletins` avec la formule « brute » (note **non ramenée sur 20**, notes **supprimées comprises**). Le résultat retombe exactement sur ce que l'application affiche. Deux défauts expliquent donc 100 % de l'écart :

1. **Pas de ramenée sur 20.** `calculateWeightedAverage` (`src/lib/utils/grades.ts:16`) ignore `maxGrade`. Un 8/10 compte comme un 8/20, un 30/40 comme un 30/20. Le schéma autorise un barème de 1 à 100 (`src/lib/validations/evaluation.ts:16`) ; dans le jeu de test, 28 % des notes ne sont pas sur 20.
2. **Notes supprimées comptées.** La suppression d'une note est « logique » (`deletedAt`, `src/app/api/grades/[id]/route.ts:179`), mais aucune des requêtes suivantes ne filtre `deletedAt: null` : `src/app/api/bulletins/route.ts`, `src/app/api/grades/councils/route.ts`, `src/app/api/orientation/council/route.ts`, `src/app/api/orientation/cep/route.ts` et la vue par matière de `src/app/api/orientation/me/route.ts`. Une note saisie par erreur puis supprimée reste donc dans la moyenne.

### Exemples de décisions du conseil faussées (S2)

| Moyenne affichée | Décision affichée | Moyenne réelle | Décision correcte |
|---|---|---|---|
| 16,15 | Tableau d'honneur | 15,26 | Encouragements |
| 15,20 | Encouragements | **16,00** | **Tableau d'honneur** |
| 14,33 | Encouragements | 13,81 | Aucune |
| 9,23 | **Avertissement travail** | 10,18 | Aucune |

### Bulletin PDF (`report-cards`) : le bon modèle, avec deux défauts mineurs

- **Ex aequo** : le classement attribue `index + 1`, si bien que deux élèves à moyenne égale reçoivent 30 et 31. Le reste de l'application, comme l'oracle, donne 30 et 30.
- **Double arrondi** : les moyennes par matière sont arrondies au centième *avant* le calcul de la moyenne générale, d'où un écart maximal de 0,006 au lieu de 0,005.
- Le classement compte les notes « dispensées » (son filtre n'exclut pas `isExcused`), alors que le bulletin de l'élève les exclut. Ce n'est pas visible ici, car une dispense n'a pas de valeur dans le jeu de test.

### Orientation : la moyenne annuelle n'est pas la bonne

- `/api/orientation/council` et `/api/orientation/cep` chargent **toutes les notes de l'élève, toutes années confondues** (la requête n'a aucun filtre). Ils les moyennent **sans coefficient de matière**, **sans ramenée sur 20** et **avec les notes supprimées**. Les notes de l'année précédente pèsent donc sur l'orientation de cette année.
- `computeIndicativeRecommendations` ramène bien les notes sur 20 et ignore les notes supprimées. En revanche, sa moyenne générale est la moyenne simple de *toutes les notes*, sans aucun coefficient, ni d'évaluation ni de matière. Les matières que le classifieur ne reconnaît pas en sont exclues, et l'EPS y est comptée.

## 2. Arrondis, mentions, configuration

- **Arrondi au centième** : `toFixed(2)` (`utils/grades`, `benin-curriculum-system`) arrondit mal les cas « à 5 » à cause de la représentation binaire : 9,545 donne 9,54, 11,495 donne 11,49. Cela touche **1,7 %** des moyennes (336 cas sur 20 000). `benin/config` (`Math.round`) en touche 0,56 %. Un enseignant qui calcule à la main trouve 0,01 de plus.
- **`getMention` a des trous** : ses tranches sont fermées, de la forme `[10 ; 11,99]`. Toute moyenne comprise entre 9,99 et 10, entre 11,99 et 12, etc. n'obtient **aucune mention** (`null`), soit 45 valeurs sur 20 001. Par exemple, `getMention(9.995)` et `getMention(11.999)` renvoient `null`.
- **Exacts** : `pickDecision` (0 erreur sur 8 004 cas, seuils et incidents de conduite), le schéma des règles du conseil (il refuse bien un seuil d'honneur inférieur aux encouragements, des seuils égaux, un nombre d'incidents fractionnaire), `validateGrade`, et `getAppreciation`, qui est cohérent avec les mentions à partir de 10.
- `validateCoefficient` accepte `1e-7`, car la vérification des décimales lit `toString()`. Sans effet en pratique, puisque le schéma des évaluations impose un minimum de 0,1.
- **Risque théorique, non observé** : `getRank` retrouve un élève par égalité stricte de flottants (`indexOf`). Recalculer les mêmes notes dans un autre ordre donne un flottant différent dans 41 % des cas avec des notes au centième (2 064 sur 5 000). Sur le jeu de test, aucun rang n'a été perdu (0/78). Ce code reste fragile.

## 3. Orientation : classement des matières et recommandations

`classifySubject` se trompe sur 4 des 21 intitulés réels testés :

| Matière | Attendu | Obtenu |
|---|---|---|
| Éducation Physique et Sportive | SPORT | **SCIENTIFIQUE** (le mot « physique » est détecté avant) |
| Sciences Économiques et Sociales | ECONOMIQUE | **SCIENTIFIQUE** (le mot « sciences ») |
| Éducation Artistique | ARTS | non classée |
| Lecture | LITTERAIRE | non classée |

Conséquences mesurées :

- **La note d'EPS change la recommandation scientifique.** Pour le même élève fort en sciences, le score en Série C vaut **75 avec 6 en EPS** et **85 avec 18 en EPS**.
- **Les Séries C et D ont toujours le même score** : elles reposent sur le même groupe SCIENTIFIQUE. Le moteur ne distingue pas un profil maths-physique d'un profil SVT. Un élève qui a 18 en SVT mais 8 en maths et 9 en physique-chimie se voit proposer **A1 et A2 (75) avant D (55)**.
- Les profils nets sont bien reconnus : un profil scientifique obtient C ou D, un profil littéraire A1 ou A2, un profil économique B.

## 4. Prédiction de la moyenne du semestre suivant

La prédiction a été rejouée sur 3 000 parcours simulés (niveau ~ N(11 ; 3), tendance ~ N(0 ; 0,35) par semestre, bruit σ = 1,1), en comparant chaque prédiction à la vraie valeur.

| Méthode | Erreur moyenne (MAE) | P90 | À 1 point près | « Intervalle 95 % » réellement couvert |
|---|---|---|---|---|
| **EduPilot (modèle d'ensemble)** | **1,55** | 3,17 | 43 % | **52 %** |
| EduPilot avec 3 semestres d'historique | **2,58** | 5,66 | 24 % | **19 %** |
| EduPilot avec 6 à 8 semestres | 1,19 – 1,24 | 2,4 – 2,7 | 49 – 53 % | 63 % |
| Référence : dernière moyenne | **1,23** | 2,56 | 48 % | — |
| Référence : droite des moindres carrés | 1,25 | 2,59 | 48 % | — |

- **Cause principale, vérifiée** : avec 3 points, la parabole passe exactement par les trois notes (R² = 1). Elle reçoit alors le poids maximal dans l'ensemble et part dans les extrêmes quand on la prolonge. Seule, elle a une erreur moyenne de **3,9 pts**, contre 1,28 pour la dernière valeur.
- **L'intervalle affiché n'est pas un intervalle à 95 %** : il ne contient la vraie valeur qu'une fois sur deux.
- **La « confiance » affichée ne dit rien de la précision** : elle vaut 15,5 % en moyenne, et sa corrélation avec l'erreur est de +0,11, donc du mauvais signe.
- Limite de la mesure : les parcours sont simulés avec une tendance linéaire. Le problème de la parabole sur 3 points ne dépend pas de ce choix, car il tient à la structure du modèle.

## Corrections recommandées (par priorité)

1. **Un seul calcul de moyenne pour toute l'application.** Partir du calcul du bulletin PDF : ramenée sur 20, `deletedAt: null`, absents et dispensés exclus. Ajouter le rang olympique et un seul arrondi, en fin de calcul. Puis le brancher dans `bulletins`, `councils`, `orientation/council`, `orientation/cep` et `orientation/me`. C'est ce qui supprime les rangs, mentions et décisions faux.
2. **Orientation** : restreindre aux notes de l'année et appliquer les coefficients. Classer les matières par mots entiers et tester SPORT avant SCIENTIFIQUE. Séparer les critères de C (maths, physique) de ceux de D (SVT).
3. **Prédiction** : n'utiliser la parabole qu'à partir de 5 ou 6 points, ou la retirer. Rapprocher la prédiction de la dernière moyenne quand l'historique est court. Calculer l'intervalle à partir des erreurs résiduelles réelles, et vérifier sa couverture avec ce banc.
4. **Mentions et arrondis** : tranches semi-ouvertes `[10 ; 12[` ; arrondi au demi supérieur, calculé en centièmes entiers.

Une fois ces corrections faites, le banc pourra devenir un test strict : il suffira de remplacer les mesures par des `expect(maxAbsErr).toBeLessThan(0.005)`.
