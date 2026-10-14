# 4. Les notes et le calcul des moyennes

Ce chapitre explique **exactement** comment EduPilot calcule chaque moyenne : celle d'une matière, la moyenne générale de la période, la moyenne annuelle. Il dit aussi ce qui se passe quand un élève est absent, dispensé, ou qu'une note manque.

Toutes les règles ci-dessous sont les **règles officielles retenues pour le Bénin**. Ce sont celles qui s'appliquent quand l'école ne change aucun réglage.

---

## 4.1 Les évaluations

Une **évaluation** est un contrôle donné à une classe, dans une matière, pendant une période. Elle a :
- un **titre** (facultatif) ;
- une **date** ;
- un **barème**, c'est-à-dire la note maximale (sur 20, sur 10, sur 40…) ;
- un **type** (interrogation écrite, devoir surveillé, composition, travaux pratiques…).

### Interrogation ou devoir ?
Chaque type d'évaluation est rangé dans l'une de deux familles :

| Famille | Exemples | Rôle dans la moyenne |
|---|---|---|
| **Interrogation** | interrogations écrites, interrogations orales, exposés, travaux pratiques, participation | elles forment ensemble la **moyenne des interrogations** |
| **Devoir** | devoirs surveillés, devoirs de niveau, **compositions**, examens blancs | chaque devoir compte **seul**, à part entière |

- ✅ Les types déjà créés ont été rangés automatiquement : tout type dont le nom ou le code évoque un devoir ou un examen est un « devoir », une composition est une « composition » (comptée comme un devoir avec la formule officielle) ; les autres sont des « interrogations ».
- ✅ L'école choisit elle-même le rôle de chaque type dans *Paramètres → Types d'évaluation* (chapitre 3.6), y compris le rôle **« Compétence »**, qui ne compte jamais dans les moyennes.

### Le barème est toujours ramené sur 20 ✅
Avant tout calcul, chaque note est convertie sur 20 :

> 8/10 devient 16/20 · 30/40 devient 15/20 · 12/20 reste 12/20.

### Saisie d'une note ✅
- La note est comprise entre 0 et le barème (une note au-dessus du barème est refusée).
- Elle a **au plus deux chiffres après la virgule** (12,25 ou 12,37 sont acceptés ; 12,345 est refusé).

---

## 4.2 La moyenne d'une matière (pour une période) ✅

### La formule officielle

> **Moyenne de la matière = (MI + D1 + D2) ÷ 3**
>
> - **MI** = moyenne des interrogations (moyenne simple de toutes les interrogations de la période) ;
> - **D1, D2** = les devoirs de la période (la composition compte comme un devoir).

S'il y a plus de deux devoirs, on les ajoute tous et on divise par « 1 + nombre de devoirs ». Par exemple, avec trois devoirs : (MI + D1 + D2 + D3) ÷ 4.

### Exemple
En mathématiques, un élève a eu :
- trois interrogations : 12, 14 et 16 ;
- deux devoirs : 10 et 13.

1. MI = (12 + 14 + 16) ÷ 3 = **14**
2. Moyenne = (14 + 10 + 13) ÷ 3 = 37 ÷ 3 = **12,33**

### Cas particuliers
| Situation | Calcul |
|---|---|
| Pas d'interrogation dans la période | moyenne des devoirs seuls |
| Pas de devoir prévu dans la période | moyenne = MI |
| Des devoirs étaient prévus mais **aucun** n'est compté (tous justifiés, ou tous « NC ») | la matière est **« NC » (non classé)** pour la période ; elle sort de la moyenne générale |

### La colonne « Moy. interro » ✅
La moyenne des interrogations (MI) est affichée sur le bulletin, à côté de la moyenne de la matière, pour que les familles comprennent le calcul.

---

## 4.3 Absences, dispenses et notes manquantes

Chaque note d'un élève à une évaluation est dans l'une de ces situations :

| Situation | Ce que fait le calcul | Exemple sur (MI + D1 + D2) ÷ 3 |
|---|---|---|
| **Note saisie** | elle compte | normal |
| **Absent sans justificatif** | la note vaut **0** et compte | (14 + 10 + **0**) ÷ 3 = 8 |
| **Absent avec justificatif**, ou **dispensé** | la note est **retirée** du calcul : on divise par une note de moins | (14 + 10) ÷ **2** = 12 |
| **« NC »** : pas encore de note alors que les camarades sont notés | la note est **retirée** du calcul tant que le professeur n'a pas tranché | (14 + 10) ÷ 2 = 12, avec la mention NC |

### Le professeur décide ✅
Une note « NC » **ne bloque rien** : ni le bulletin, ni l'impression, ni le conseil. Elle signale seulement au professeur qu'une décision l'attend. Il a trois choix :
1. **saisir la note**, si l'élève a recomposé : elle remplace tout ;
2. cocher **« absence justifiée »** : la note est retirée du calcul (division ajustée) ;
3. cocher **« absent »** sans justificatif : la note vaut 0.

Ce choix reste modifiable à tout moment **jusqu'au conseil de classe** de la période (après, voir le chapitre 6).

### Le motif d'une absence justifiée
- ✅ Pour qu'une absence soit justifiée, il faut un **motif** (billet visé par le directeur des études). Sans motif, l'enregistrement est refusé.
- ✅ À l'écran de saisie, cocher « justifiée » fait apparaître une case **Motif**. L'école peut rendre ce motif facultatif (chapitre 3.8).
- ✅ La **précision de saisie** suit le réglage de l'école (au centième par défaut) : une note comme 12,33 est refusée si l'école saisit au demi-point.

### L'élève qui recompose ✅
Si un élève absent compose plus tard, le professeur saisit simplement sa note : l'absence est retirée automatiquement. Le changement est gardé dans l'historique.

### Élève arrivé en cours de période ✅
Les évaluations faites **avant la date d'inscription de l'élève dans la classe** sont ignorées pour lui. Elles ne comptent ni comme 0 ni comme « NC ».

### Élève qui change de classe dans l'établissement ✅
Ses notes de l'ancienne classe le suivent pour la période en cours, **dans les matières identiques**. Une matière qui n'existe pas dans sa nouvelle classe est écartée.

### Une note supprimée
Une note supprimée n'existe plus. Si les camarades sont notés à cette évaluation, l'élève redevient « NC » pour celle-ci, en attendant la décision du professeur.

### Adapter le calcul pour un élève ✅
Il arrive qu'une note ne doive pas compter pour **un élève précis** (copie perdue, devoir annulé pour lui, situation particulière). Dans *Saisie des notes*, le professeur de la matière clique sur **« Adapter »** sur la ligne de l'élève. Un encadré montre toutes les notes de l'élève dans la matière pour la période, chacune avec son **nom** : I1, I2… (interrogations), D1, D2… (devoirs), C1… (compositions), dans l'ordre des dates.

Deux possibilités :

1. **Ne pas compter une note** : sur la ligne de la note, « Ne pas compter… », puis écrire le motif. La formule de la matière s'applique alors **sans cette note** : par exemple (MI + D1 + D2) ÷ 3 devient (MI + D1) ÷ 2 pour cet élève seulement. La note reste visible ; on peut la faire compter de nouveau à tout moment.
2. **Écrire une formule particulière pour cet élève**, avec le nom de ses notes, par exemple `(MI + D1) / 2` ou `moyenne(MI ; D2 ; C1)`, et son motif. Elle remplace la formule de la matière pour cet élève, dans cette matière et cette période. « Revenir au calcul normal » l'annule.

Dans les deux cas :
- l'encadré montre le résultat **avant de l'enregistrer** (calcul normal et calcul adapté), calculé exactement comme le bulletin ;
- la formule passe les mêmes contrôles que toutes les autres (20 partout donne 20, jamais hors de 0 à 20) ;
- seul le professeur de la matière peut le faire, avec un **motif obligatoire** ; c'est enregistré dans l'historique (avant, après, qui, quand) ;
- ce n'est plus modifiable une fois le **conseil de classe validé** (ensuite : réclamation, chapitre 6) ;
- le **bulletin le signale** : un astérisque à côté de la moyenne de la matière et, sous le tableau, une note qui explique (notes non comptées, formule, motif) ;
- les camarades ne sont pas concernés : leur calcul ne change pas.

La direction peut désactiver cette possibilité (*Règles de l'établissement*, chapitre 3.8).

---

## 4.4 La moyenne générale de la période ✅

> **Moyenne générale = somme de (moyenne de chaque matière × son coefficient) ÷ somme des coefficients**

On ne prend que les matières qui ont une moyenne. Une matière « NC » ou sans note sort du calcul, coefficient compris.

### Exemple
| Matière | Moyenne | Coefficient | Produit |
|---|---|---|---|
| Mathématiques | 12 | 3 | 36 |
| Français | 15 | 2 | 30 |
| Anglais | NC | 2 | — |
| **Total** | | **5** | **66** |

Moyenne générale = 66 ÷ 5 = **13,20**. L'anglais est « NC » : son coefficient n'entre pas dans le total.

### Quels coefficients ?
- Ce sont les **coefficients réglés pour chaque classe** (par exemple Mathématiques coefficient 3 en 4ᵉ A), et non un coefficient par défaut.
- Le coefficient d'une évaluation ne sert pas au calcul : seul le rôle de son type (interrogation, devoir, composition) compte. ✅ Ce champ a été retiré de l'écran de saisie.
- ✅ Quand le conseil de classe d'une période est validé, les coefficients de cette période sont **figés**. Un coefficient modifié plus tard ne change pas les bulletins déjà validés.

### Dispense d'EPS
Un élève dispensé d'EPS pour toute la période (raison médicale) n'a pas de moyenne d'EPS : la matière et son coefficient sortent de sa moyenne générale.

---

## 4.5 La moyenne annuelle ✅

L'école travaille **soit en trimestres, soit en semestres**, jamais les deux dans la même année.

> - En **trimestres** : **moyenne annuelle = (T1 + T2 + T3) ÷ 3**
> - En **semestres** : **moyenne annuelle = (S1 + S2) ÷ 2**

Le calcul se fait pour la moyenne générale et pour chaque matière.

**Tant qu'une période n'a pas encore de moyenne**, la moyenne annuelle officielle n'existe pas. L'application affiche alors une moyenne **provisoire** : la moyenne des périodes déjà évaluées, clairement marquée « provisoire ».

### Élève transféré en cours d'année
Pour un élève arrivé au 2ᵉ trimestre, la moyenne obtenue dans son **établissement d'origine** (lue sur son bulletin de transfert) est prise pour la période qu'il n'a pas suivie chez vous.
- ✅ Le calcul est prêt.
- 🔧 L'écran pour saisir ces moyennes est en cours de finalisation.

---

## 4.6 L'arrondi ✅

- Tous les calculs sont faits **sans aucun arrondi intermédiaire**, avec une précision totale.
- Un seul arrondi, à la fin, **au centième, demi vers le haut** : 12,345 devient **12,35** ; 12,344 devient **12,34**.
- Le rang, la mention et la décision du conseil se fondent sur cette moyenne arrondie, celle qui est **affichée**. Deux élèves à 12,35 sont donc ex aequo.

---

## 4.7 La précision est vérifiée en permanence ✅

EduPilot compare en continu ses calculs à un **calcul de contrôle indépendant**, fait avec une précision totale, sur une classe type : 40 élèves, plusieurs barèmes, absences, dispenses, notes manquantes, élèves ex aequo.

Résultat exigé : **aucun écart**, sur chaque moyenne, chaque rang et chaque décision. Si une modification venait à fausser un calcul, elle serait bloquée avant d'arriver dans les écoles.

---

## 4.8 Le cahier de notes

Dans *Notes → Cahier de notes*, l'enseignant voit toutes ses évaluations d'une classe :
- pour chaque évaluation : moyenne, note la plus basse et la plus haute (sur le barème de l'évaluation, sans compter les absents ni les dispensés) ;
- pour chaque élève : sa moyenne calculée avec les règles ci-dessus, le nombre de notes, le nombre d'absences, et le nombre de notes **« NC » à trancher**.

En dépliant une évaluation, le lien **« Modifier les notes »** permet de corriger une note, d'enregistrer une recomposition ou de justifier une absence, tant que le conseil de la période n'est pas validé.

---

## 4.9 Ce qui reste configurable par l'école

| Réglage | Valeur par défaut (Bénin) | Où |
|---|---|---|
| Découpage de l'année | 3 trimestres (ou 2 semestres) | Paramètres → Configuration académique |
| Coefficients par classe | à saisir par l'école | Paramètres → Matières par classe |
| Rôle de chaque type d'évaluation | rangement automatique | ✅ Paramètres → Types d'évaluation |
| Formule de la moyenne de matière (écrite par l'école), absences, notes NC, arrondi, formule de la moyenne annuelle, mentions, précision de saisie | règles du présent chapitre | ✅ Paramètres → Règles de l'établissement (chapitre 3.8) |
| Formule de la moyenne d'**une** matière | formule de l'école | ✅ l'enseignant de la matière, écran de saisie des notes (si l'école le permet) |
