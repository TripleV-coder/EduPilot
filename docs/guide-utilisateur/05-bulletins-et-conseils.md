# 5. Bulletins, rangs et conseil de classe

---

## 5.1 Le bulletin ✅

On l'ouvre dans *Notes → Bulletins* : on choisit la classe, la période, puis un élève ou **toute la classe**. Le bouton **« Imprimer ou enregistrer en PDF »** produit le document officiel (une page A4 par élève).

### Ce que contient le bulletin
- **En-tête** : nom, adresse, contacts, devise et logo de l'établissement ; code de l'établissement.
- **L'élève** : nom, prénom, matricule, date de naissance, classe, niveau, année scolaire, période.
- **Un tableau, une ligne par matière** :

  | Colonne | Contenu |
  |---|---|
  | Coef. | coefficient de la matière dans la classe (figé si le conseil est validé) |
  | Moy. interro | moyenne des interrogations (MI) |
  | Moy. période précédente | pour suivre la progression |
  | Moy. de la période | moyenne de la matière ; **« NC »** si l'élève n'est pas classé dans la matière |
  | Moy. classe | moyenne de la classe dans la matière |
  | Min · Max | plus faible et plus forte moyenne de la classe dans la matière |
  | Appréciation | commentaire du professeur ; à défaut, l'appréciation automatique (voir 5.3) |

- **La ligne « Moyenne générale »** : total des coefficients, moyenne générale de la période précédente, moyenne générale de la période, moyenne générale de la classe, **rang**.
- **Sur le dernier bulletin de l'année** : une ligne **« Moyenne annuelle »** ((T1 + T2 + T3) ÷ 3 ou (S1 + S2) ÷ 2) et le **rang annuel**. Elle porte la mention « provisoire » si une période n'a pas de moyenne.
- **Vie scolaire de la période** : nombre de jours d'absence, de retards, d'absences excusées, et nombre d'incidents.
- **Un numéro de référence** du bulletin, de la forme BJ-année-T(numéro de période)-fin du matricule.

### Notes « NC » sur le bulletin
Si un élève a des notes « NC » (non tranchées par le professeur), un encadré l'indique au-dessus du bulletin. **L'impression n'est pas bloquée** : ces notes sont simplement retirées du calcul (chapitre 4).

### Calcul adapté pour un élève ✅
Quand le professeur a adapté le calcul pour l'élève (note non comptée ou formule particulière, chapitre 4.3), la moyenne de la matière porte un **astérisque**, et une ligne sous le tableau explique : nombre de notes non comptées, formule utilisée et motif. Rien n'est caché à la famille.

✅ Le second bulletin imprimable (version « fiche de résultats » d'un seul élève) suit exactement les mêmes règles : il n'est plus bloqué par une note manquante, il compte l'effectif de la même façon et il affiche les mêmes moyennes et le même rang que le bulletin principal. Les vues de l'élève et du parent affichent elles aussi les moyennes du bulletin, sans les recalculer.

---

## 5.2 Les rangs ✅

| Rang | Sur quoi | Quand |
|---|---|---|
| **Rang de classe** | moyenne générale de la **période** | sur chaque bulletin de période |
| **Rang annuel** | moyenne **annuelle** | sur le dernier bulletin de l'année |
| **Rang de promotion** (option) | même moyenne, mais parmi **tous les élèves du même niveau** (toutes les 3ᵉ, par exemple) | si l'école l'active |

- **Ex aequo** : deux élèves qui ont la même moyenne affichée ont le **même rang**, et le rang suivant est sauté (deux 5ᵉ, puis un 7ᵉ).
- **Effectif affiché** (« 12ᵉ sur 45 ») : élèves **inscrits et actifs** dans la classe. Un élève qui **abandonne** n'est plus compté.
- Un élève sans aucune moyenne n'a pas de rang.
- ✅ Le rang de promotion s'active dans *Paramètres → Règles de l'établissement*.

---

## 5.3 Mentions et appréciations ✅

Le barème officiel retenu :

| Moyenne | Mention |
|---|---|
| 18 et plus | Excellent |
| de 16 à moins de 18 | Très bien |
| de 14 à moins de 16 | Bien |
| de 12 à moins de 14 | Assez bien |
| de 10 à moins de 12 | Passable |
| moins de 10 | **Échec** |

Toute moyenne a exactement une mention : il n'y a pas de « trou » entre deux tranches. La mention se lit sur la moyenne affichée (arrondie au centième).

---

## 5.4 Le conseil de classe

On l'ouvre dans *Notes → Conseils de classe*, pour une classe et une période.

### Ce qu'il présente ✅
- La liste des élèves classés par moyenne, avec leur **rang**, leur moyenne générale, leur nombre d'incidents de la période et le nombre de notes NC.
- Une **décision proposée** pour chaque élève (voir ci-dessous).
- Un **statut** :
  - « À saisir » : aucune note ;
  - « En discussion » : matières incomplètes, ou décision d'avertissement ;
  - « Validé ».
- Des **chiffres de classe** : moyenne de la classe, médiane, part des élèves à 14 et plus, part des élèves sous 10, nombre de tableaux d'honneur, d'encouragements et d'avertissements.
- Les **participants** attendus (professeur principal et enseignants de la classe) et la date du prochain conseil prévu au calendrier.

### Les décisions proposées (seuils réglables par l'école) ✅

| Décision | Condition par défaut |
|---|---|
| **Avertissement conduite** | 3 incidents ou plus dans la période (prime sur tout le reste) |
| **Tableau d'honneur** | moyenne générale de 16 ou plus |
| **Encouragements** | moyenne générale de 14 ou plus |
| **Avertissement travail** | moyenne générale inférieure à 10 |
| Aucune | entre 10 et 14 |

L'école règle ces seuils dans la configuration académique, avec deux contrôles : le seuil du tableau d'honneur ne peut pas être inférieur à celui des encouragements, et celui des encouragements doit dépasser celui de l'avertissement. Les décisions sont des **propositions** : c'est le conseil qui décide.

### Valider le conseil
- ✅ La **direction** valide le conseil d'une classe pour une période. Cette validation :
  1. **fige les notes** de la période. Une note ne peut plus être modifiée que par une **réclamation** (chapitre 6) ;
  2. **gèle les coefficients** appliqués à la période ;
  3. est **définitive** et tracée (qui, quand).
- ✅ Sur l'écran du conseil de classe, le bouton **« Valider le conseil »** (visible de la direction) demande une confirmation, puis affiche « Conseil validé · notes figées ».
- ✅ Les **règles de calcul** en vigueur sont gelées en même temps que les coefficients.
- ✅ Le verrouillage s'applique partout : saisie des notes, modification ou suppression d'une note isolée, création d'une évaluation, évaluation de compétence.

---

## 5.5 Ce que voient les familles

- Le parent et l'élève consultent les bulletins dans *Mes notes* ou *Notes de mes enfants*, et peuvent ouvrir le bulletin officiel.
- *Mes notes* affiche les notes, les moyennes par matière et la moyenne générale. Pour « Toute l'année », c'est la moyenne des périodes déjà évaluées.
