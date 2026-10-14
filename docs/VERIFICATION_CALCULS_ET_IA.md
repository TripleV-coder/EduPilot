# Vérification des calculs et fonctionnement de l'« IA »

*Vérification du 3 octobre 2026 ; prédiction refaite et paramètres réglables le même jour.*

Ce document répond à deux questions :

1. **L'application calcule-t-elle juste ?** En particulier, ne pénalise-t-elle jamais un élève qui n'a pas composé en lui donnant 0 par erreur ?
2. **Sur quoi se basent les prédictions et l'orientation « IA » ?**

---

## 1. Jeux de notes calculés à la main, puis par l'application

**Méthode**
- Pour chaque cas, j'ai construit moi-même une série de notes et calculé le résultat **à la main**, en fractions exactes. Le calcul est écrit dans le tableau.
- J'ai ensuite fait passer **exactement les mêmes notes** par le calcul du bulletin de l'application (le même code que celui qui produit les bulletins à l'écran et à l'impression).
- Les deux résultats sont comparés au centième près. Ces cas sont désormais vérifiés automatiquement à chaque modification du logiciel.

**Jeu de base.** Élève A en mathématiques, coefficient 3, trimestre 1 :
- interrogations 12 et 14, donc **MI = 13** ;
- devoirs **D1 = 10** et **D2 = 15** ;
- une composition, qui change selon le cas.

Un camarade B a toutes ses notes : les évaluations sont donc « corrigées dans la classe ». Formule officielle : (MI + D1 + D2 + composition) ÷ nombre de notes comptées.

| # | Situation | Calcul fait à la main | Attendu | Application | Écart |
|---|---|---|---|---|---|
| 1 | Toutes les notes, composition 13 | (13 + 10 + 15 + 13) ÷ 4 | 12,75 | 12,75 | 0 |
| 2 | **N'a pas composé : rien de saisi** | note retirée : (13 + 10 + 15) ÷ 3 | 12,67 | 12,67 | 0 |
| 3 | **N'a pas composé : absence justifiée** | note retirée | 12,67 | 12,67 | 0 |
| 4 | Composition saisie 2, **le professeur ne la compte pas** | note retirée (ni 2, ni 0) | 12,67 | 12,67 | 0 |
| 5 | **Composition pas encore corrigée pour personne** | ignorée | 12,67 | 12,67 | 0 |
| 6 | **Absence NON justifiée** (règle officielle) | 0 compté : (13 + 10 + 15 + 0) ÷ 4 | 9,50 | 9,50 | 0 |
| 7 | Absence non justifiée, école réglée sur « ne compte pas » | note retirée | 12,67 | 12,67 | 0 |
| 8 | Rien de saisi, école réglée sur « NC compte 0 » | 0 compté (choix de l'école) | 9,50 | 9,50 | 0 |
| 9 | Même réglage, mais composition corrigée pour personne | aucun 0 | 12,67 | 12,67 | 0 |
| 10 | **Élève arrivé en cours de période** (I1, I2, D1 avant son arrivée) | (13 + 15 + 13) ÷ 3, évaluations antérieures ignorées | 13,67 | 13,67 | 0 |
| 11 | Composition notée sur 40 (26/40) | 26/40 = 13/20 → (13 + 10 + 15 + 13) ÷ 4 | 12,75 | 12,75 | 0 |
| 12 | Formule particulière pour A : (MI + D1) / 2 | (13 + 10) ÷ 2 | 11,50 | 11,50 | 0 |
| 13 | Formule du professeur (MI + MD + 2×MC) / 4 | (13 + 12,5 + 26) ÷ 4 = 12,875 | 12,88 | 12,88 | 0 |
| 14 | Même formule, école en troncature | 12,875 → | 12,87 | 12,87 | 0 |
| 15 | Même formule, **composition manquante** | calcul impossible → « NC » (pas 0) | NC | NC | 0 |
| 16 | Absences justifiées à tous les devoirs | devoirs prévus, aucun compté → « NC » | NC | NC | 0 |
| 17 | Même cas, école réglée sur « matière jamais NC » | MI seule | 13,00 | 13,00 | 0 |
| 18 | Interrogation 12,01 et devoir 12,00 | 12,005 → au plus proche | 12,01 | 12,01 | 0 |
| 19 | Mêmes notes, école en troncature | 12,005 → | 12,00 | 12,00 | 0 |
| 20 | Moyenne générale : maths 38/3 (coef 3), français 14 (coef 2), anglais NC (coef 2) | (38 + 28) ÷ 5, l'anglais NC ne compte pas | 13,20 | 13,20 | 0 |
| 21 | Moyenne annuelle T1 = 11,50 ; T2 = 12,25 ; T3 = 14 | 37,75 ÷ 3 = 12,583… | 12,58 | 12,58 | 0 |
| 22 | Moyenne annuelle, **T3 pas encore évalué** | provisoire : (11,5 + 12,25) ÷ 2 (T3 n'est pas compté 0) | 11,88 | 11,88 | 0 |
| 23 | Moyenne annuelle libre (T1 + T2 + 2×T3) / 4 | 51,75 ÷ 4 = 12,9375 | 12,94 | 12,94 | 0 |
| 24 | Rangs : A et C à 12,75, B à 10 | A 1er, C 1er, B 3e | 1 / 3 / 1 | 1 / 3 / 1 | 0 |

**Résultat : 24 cas sur 24 identiques, aucun écart.**

Ces cas s'ajoutent aux vérifications déjà en place :
- 40 élèves simulés sur deux semestres, comparés à un calcul de contrôle indépendant ;
- 20 000 cas tirés au hasard ;
- 11 configurations de règles différentes ;
- le calcul adapté pour un élève.

Des erreurs ont aussi été volontairement glissées dans le logiciel pour vérifier que les contrôles les détectent : elles l'ont toutes été.

### Quand un élève reçoit-il 0 ?

**Seulement dans deux cas, toujours voulus :**

1. **Absence non justifiée.** C'est la règle officielle du Bénin, et l'école peut la désactiver. Le professeur peut toujours remplacer ce 0 par la note si l'élève recompose.
2. **L'école a choisi « une note non tranchée compte 0 ».** Ce n'est pas le réglage par défaut, et même dans ce cas aucun 0 n'est mis tant que l'évaluation n'a été corrigée pour personne.

**Dans tous les autres cas, la note est retirée du calcul et la division se fait sur une note de moins :**
- rien de saisi ;
- absence justifiée ;
- note écartée par le professeur ;
- évaluation pas encore corrigée ;
- élève arrivé après l'évaluation ;
- formule qui a besoin d'une valeur absente : la matière est alors « NC », jamais 0.

**Le vrai risque d'erreur humaine** : un professeur coche « Absent » et oublie de cocher « justifiée ». Pour l'éviter, l'écran de saisie affiche désormais en rouge, à côté de l'élève : « **compte 0 — cochez « justifiée » si l'élève a un justificatif** ». Jusqu'ici, l'information n'apparaissait qu'en passant la souris dessus.

---

## 2. Sur quoi se basent les prédictions et l'orientation

Point essentiel : **les calculs de moyennes, de rangs et de bulletins n'utilisent aucune IA.** Ce sont des formules exactes, celles vérifiées ci-dessus. L'« IA » n'intervient que pour des **aides à la décision**, toujours indicatives.

### 2.1 Prédiction de la moyenne de la période suivante

**Données utilisées.** Les moyennes générales passées de l'élève, lues dans l'ordre des dates de période.

*Corrigé :* elles étaient triées par numéro de période. Quand l'élève avait plusieurs années, les trimestres de deux années se mélangeaient (T1 de l'an 1, puis T1 de l'an 2, puis T2…).

**Comment la méthode a été choisie** (3 octobre 2026) :
- J'ai simulé 20 000 parcours d'élèves sur 3 à 8 périodes, selon cinq façons réalistes d'évoluer : niveau stable, tendance, dérive progressive, retour vers la moyenne, rupture brusque.
- J'ai comparé treize méthodes sur ces parcours.
- La plus précise, et la seule sans point faible dans les cinq situations : le **lissage exponentiel**. La prévision donne 60 % de poids à la dernière moyenne, et le reste aux précédentes, de moins en moins.
- L'ancien « mélange de quatre modèles » a été abandonné, car il était moins précis que la dernière moyenne seule.

**Fourchette calibrée.** La fourchette s'élargit quand les résultats de l'élève sont irréguliers et se resserre quand ils sont stables. Elle a été réglée sur des parcours puis **vérifiée sur d'autres, jamais vus au réglage**.

**Fiabilité mesurée**, dans l'application elle-même, sur 5 000 parcours de test :

| Méthode | Écart moyen avec la réalité | À ±1 point près | Fourchette « 95 % » qui contient la bonne valeur | Fourchette « 80 % » |
|---|---|---|---|---|
| **EduPilot (nouvelle méthode)** | **1,10 point** | **56 %** | **94,3 %** | **81,8 %** |
| Reprendre la dernière moyenne | 1,18 point | 54 % | — | — |
| Moyenne de tout l'historique | 1,29 point | 49 % | — | — |
| Prolonger une droite | 1,30 point | 49 % | — | — |
| *Ancienne prédiction « IA »* | *1,55 point* | — | *52 % (annoncée à 95 %)* | — |

Détail par situation :

| Situation | Écart moyen (EduPilot / dernière moyenne) | Fourchette 95 % |
|---|---|---|
| Niveau stable | 1,24 / 1,46 | 93,3 % |
| Tendance | 1,04 / 1,12 | 96,0 % |
| Dérive progressive | 0,92 / 0,90 | 96,7 % |
| Retour vers la moyenne | 0,96 / 0,98 | 96,4 % |
| Rupture brusque | 1,33 / 1,43 | 89,3 % |

La « dérive progressive » est le seul cas où reprendre la dernière moyenne fait à peine mieux (0,02 point). La rupture brusque est, par nature, imprévisible : la fourchette y tient dans 89 % des cas.

**Confiance affichée.** C'est la **probabilité que la vraie moyenne soit à ±1 point** de la prévision. Mesurée, elle est légèrement prudente :

| Annoncée | Observée |
|---|---|
| 36 % | 40 % |
| 45 % | 50 % |
| 55 % | 57 % |
| 63 % | 65 % |

Elle n'est jamais optimiste.

**Sans aucune moyenne passée :** aucune prévision. Avant, l'application affichait 10/20, valeur inventée.

Ces mesures sont refaites automatiquement à chaque modification du logiciel. Le test échoue si la méthode redevient moins précise que « dernière moyenne », ou si la fourchette « 95 % » sort de 92–97,5 %.

**Projections par matière** (assistant de l'équipe de direction) : même méthode et même fourchette. *Corrigé :* elles faisaient « dernière moyenne + dernier écart », ce qui double le bruit d'une période à l'autre.

### 2.2 Risque d'échec
C'est une **grille de points**, pas un apprentissage automatique. Chaque facteur donne un score de 0 à 100, puis les scores sont combinés avec ces poids :

| Facteur | Poids | Ce qui augmente le risque |
|---|---|---|
| Résultats | 35 % | moyenne sous 8 (fort), sous 10, sous 12 ; baisse de plus d'1 point par période |
| Assiduité (90 derniers jours) | 25 % | présence sous 85 %, critique sous 70 % |
| Comportement (180 derniers jours) | 20 % | incidents, pondérés par leur gravité |
| Devoirs rendus | 15 % | devoirs non rendus |
| Matières faibles | 5 % | nombre de matières en difficulté |

Chaque alerte affiche ses **causes en clair** (« Assiduité faible : 78 % »…) et des recommandations.

**Tous ces seuils, poids et fenêtres sont réglables par l'école** (Paramètres › Paramètres de l'établissement). Les valeurs ci-dessus sont les valeurs d'origine. Voir [l'inventaire complet](./PARAMETRES_ETABLISSEMENT.md).

**Un seul niveau de risque.** Avant, l'écran « Risques » et le tableau des risques d'échec et de décrochage recalculaient chacun leur propre « score » dans le navigateur, avec d'autres formules et d'autres seuils. Ils montraient aussi des « % de décrochage / d'échec » sans fondement, et une « évolution » inventée à partir de ce score. Désormais :
- le niveau affiché est le **niveau officiel**, enregistré, calculé avec les seuils de l'école ;
- les points de risque viennent du **même calcul** ;
- la matrice place chaque élève selon ses **vraies mesures** : taux d'absence et moyenne, avec des lignes aux seuils de l'école ;
- un élève sans moyenne ou sans appel n'y est pas placé, car une donnée absente n'est pas 0.

**Corrigé à cette occasion :** une période **sans moyenne** (pas encore évaluée) était lue comme une moyenne de **0/20**. L'élève pouvait alors être signalé « moyenne critique » à tort. Ces périodes sont désormais ignorées.

### 2.3 Risque de décrochage et alertes précoces
- **Décrochage**, grille de points :
  - évolution de l'assiduité (30 %) ;
  - absences consécutives (20 %) ;
  - abandon des devoirs (20 %) ;
  - effondrement des notes (15 %) ;
  - hausse des incidents (10 %) ;
  - activité récente (5 %).
- **Alertes précoces**, sur les 14 derniers jours :
  - chute de 3 points ou plus ;
  - 3 absences non justifiées d'affilée ;
  - arrêt des devoirs ;
  - 2 incidents graves.

  Le calcul est entièrement local : aucune donnée ne part à l'extérieur.

### 2.3 bis Préparation au CEP et au BEPC
- **Moyenne des matières d'examen** : calculée par le moteur du bulletin.
- **Chance d'admission estimée** : probabilité que la moyenne d'examen atteigne la moyenne d'admission réglée par l'école (10 par défaut). Le calcul suppose un écart habituel entre moyenne de l'année et note d'examen, de 2 points par défaut, réglable par l'école d'après ses résultats passés. Exemples avec 2 points d'écart : 12/20 donne 84 %, 10/20 donne 50 %, 8/20 donne 16 %. Les chances sont bornées entre 1 et 99 % : jamais de certitude annoncée.
- *Corrigé :* avant, c'était une simple ligne droite (50 % + 5 % par point au-dessus de 10). Un élève **sans aucune note** recevait « 5 % de réussite » ; il voit désormais « Pas encore de notes ».
- *Corrigé :* la page CEP affichait « Inscriptions DEC envoyées N/N » alors qu'aucune inscription n'est enregistrée dans l'application. Cet indicateur inventé est retiré.

### 2.4 Orientation après le BEPC
1. **Moyennes de l'élève**, exactement celles du bulletin, regroupées par discipline : mathématiques, physique-chimie, SVT, français, langues, histoire-géographie, philosophie, économie, technologie. L'EPS et les arts ne départagent pas les séries.
2. **Critères de chaque série**, réglables par l'école : disciplines indispensables et leur poids, disciplines d'appoint, moyenne conseillée. Par défaut, la série C demande mathématiques ×4 et physique-chimie ×3, avec une moyenne conseillée de 12.
3. **Score de chaque série** : la moyenne pondérée des disciplines retenues, ramenée sur 100.
   - Une discipline indispensable **sans aucune note** n'est **pas** comptée 0 : elle est signalée « critère non évalué », et le score est réduit en proportion de l'information manquante.
   - Une moyenne générale sous le niveau conseillé retire 15 points (réglable).
   - Points forts à partir de 12, points de vigilance sous 10 (réglables).
4. **Sans aucune note** dans une discipline déterminante, l'application **refuse de proposer** une série et explique pourquoi.
5. **IA externe** (seulement si elle est configurée) :
   - elle reçoit les moyennes de l'élève **sans son nom** (des initiales seulement) ;
   - elle doit répondre par une série de la liste officielle, sinon sa réponse est rejetée et la proposition locale est conservée.

   **Corrigé à cette occasion :** une matière sans moyenne lui était envoyée comme un **0**, ce qui pouvait fausser sa proposition. Désormais, elle n'est pas envoyée, et une moyenne générale absente est indiquée « non disponible ».

**Dans tous les cas, la décision d'orientation revient au conseil de classe.** L'application montre côte à côte la série proposée, le vœu de la famille et la décision du conseil.

### 2.5 Autres écarts corrigés lors de l'inventaire des paramètres

Ces corrections touchent toutes la même famille d'erreur : **une donnée absente lue comme un 0, ou une valeur inventée.**

| Où | Avant | Maintenant |
|---|---|---|
| Tableau de bord BI (taux de réussite, moyennes par matière) | élève sans moyenne compté **0/20** | écarté du calcul |
| Vue d'ensemble de l'école (taux d'échec) | élève sans moyenne compté en échec | écarté du calcul |
| Tableau des risques (moyenne de la page) | moyenne absente comptée 0 | écartée |
| Appréciation rédigée par l'assistant | un vrai 0/20 lu comme « pas de notes » | « pas de notes » seulement sans moyenne |
| Plan d'intervention de l'assistant | élève sans notes classé priorité **élevée** (lu 0/20) ; probabilité de risque **inventée** (80 % ou 60 % selon le niveau) | priorité selon le risque réel, « moyenne non disponible » |
| Alertes de l'assistant | assiduité jugée sous **80 %** ici, sous 85 % ailleurs | un seul seuil, celui de l'école |
| Prédictions de classe | élève sans historique compté **10/20** dans la moyenne prévue | écarté |
