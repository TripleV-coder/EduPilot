# 3. Configurer l'établissement

Ces réglages se font une fois en début d'année, par l'administrateur de l'école ou la direction. Ils conditionnent les calculs du chapitre 4. **Faites-les dans l'ordre ci-dessous.**

---

## 3.1 L'établissement
*Paramètres → Établissement* : nom, adresse, téléphone, e-mail, logo, devise, code de l'établissement. Ces informations apparaissent en tête des bulletins et des documents.

## 3.2 Les cycles, niveaux et séries
1. *Paramètres → Cycles de l'établissement* : Primaire, Collège, Lycée. On ne peut pas retirer un cycle qui a déjà des niveaux.
2. *Paramètres → Cycles, niveaux et séries* : les niveaux (CI…CM2, 6ᵉ…3ᵉ, Seconde…Terminale) et, au lycée, les séries (chapitre 7).

## 3.3 L'année scolaire et son découpage ✅
*Paramètres → Configuration académique* :
- choisir **trimestres** ou **semestres** ;
- une année compte **exactement 3 trimestres** ou **exactement 2 semestres** ;
- **jamais de mélange** dans une même année.

À la création d'une année, les périodes sont créées automatiquement, avec des dates réparties sur l'année, modifiables ensuite dans *Paramètres → Séquences et périodes*.

L'application refuse une période :
- dont la fin est avant le début ;
- qui déborde de l'année scolaire ;
- qui chevauche une autre période ;
- qui mélange trimestres et semestres ;
- qui dépasse le nombre de périodes du système (une 4ᵉ « trimestre », par exemple).

🔧 Le type de découpage « hybride » sera retiré : seuls les trimestres et les semestres sont prévus.

### Le cycle de vie d'une année
| État | Signification |
|---|---|
| En préparation | l'année est créée, on la configure |
| Active | l'année en cours |
| Clôturée / Archivée | l'année est **figée** : plus aucune évaluation, note ni modification n'est possible |

## 3.4 Les classes
*Classes → Créer une classe* : nom, niveau, capacité, professeur principal. On ne peut créer qu'une classe d'un cycle offert par l'école.

## 3.5 Les matières et leurs coefficients
- *Paramètres → Matières & évaluations* : le catalogue des matières de l'école.
- *Paramètres → Catégories de matières* : familles de matières (sciences, langues, arts…).
- *Paramètres → Matières par classe* : pour **chaque classe**, les matières enseignées, leur **coefficient** et l'enseignant. **C'est ce coefficient qui compte dans la moyenne générale.** On ne peut pas retirer d'une classe une matière qui a déjà des notes.

## 3.6 Les types d'évaluation
*Paramètres → Types d'évaluation* : interrogation écrite, devoir surveillé, composition, oral, travaux pratiques…
- ✅ Pour chaque type, l'école choisit son **rôle dans la moyenne** :

| Rôle | Effet |
|---|---|
| Interrogation | entre dans la moyenne des interrogations (MI) |
| Devoir | compte comme un devoir à côté de la MI |
| Composition | compte comme un devoir avec la formule officielle, ou à part avec la formule « moyenne de classe puis composition » (3.8) |
| Compétence | sert seulement à la grille de compétences (Acquis / En cours / Non acquis) : **ne compte jamais dans les moyennes** |

- ✅ Le rôle d'un type **ne peut plus changer** dès qu'il a servi dans une période dont le conseil est validé : sinon, un bulletin déjà validé changerait. Il faut alors créer un nouveau type pour la suite.
- ✅ Chaque changement de rôle est tracé (avant, après, qui, quand).
- L'ancien champ « coefficient (poids) » d'un type a été retiré de l'écran : il n'avait aucun effet sur les moyennes.

## 3.7 Le conseil de classe
*Paramètres → Configuration académique → Mentions du conseil de classe* : seuils du tableau d'honneur (16), des encouragements (14), de l'avertissement travail (moins de 10), et nombre d'incidents déclenchant l'avertissement conduite (3). Détail au chapitre 5.

## 3.8 Les règles de l'établissement ✅
*Paramètres → Règles de l'établissement*. Toute l'équipe peut **lire** ces règles ; seule la **direction** peut les modifier. Une école qui ne touche à rien applique les **règles officielles du Bénin**. Le bouton « Règles officielles » y revient à tout moment.

Chaque choix est présenté avec un **exemple chiffré** calculé exactement comme les bulletins : on voit tout de suite l'effet d'un réglage avant de l'enregistrer.

### Moyenne d'une matière : une formule que l'école écrit elle-même
La direction **écrit la formule**, comme dans un tableur. Par défaut, c'est la règle officielle du Bénin :

`moyenne(MI ; DEVOIRS ; COMPOS)` — c'est-à-dire (MI + D1 + D2 + … + composition) ÷ (1 + nombre de devoirs).

**Ce qu'on peut utiliser dans une formule**

| Élément | Signification |
|---|---|
| `MI` | moyenne des interrogations |
| `MD` | moyenne des devoirs |
| `MC` | moyenne des compositions |
| `INTERROS`, `DEVOIRS`, `COMPOS` | toutes les notes d'une famille, une par une |
| `moyenne(…)`, `somme(…)`, `nombre(…)`, `min(…)`, `max(…)` | calculs sur ce qui est entre parenthèses, séparé par `;` |
| nombres, `+ − * /`, parenthèses | comme sur une calculatrice (`12,5` ou `12.5`) |

**Exemples**

| Formule | Effet |
|---|---|
| `moyenne(MI ; DEVOIRS ; COMPOS)` | règle officielle (par défaut) |
| `moyenne(moyenne(MI ; MD) ; MC)` | moyenne de classe, puis moyenne avec la composition |
| `moyenne(MI ; DEVOIRS ; COMPOS ; COMPOS)` | la composition compte deux fois |
| `(MI + MD + 2*MC) / 4` | poids fixes : la composition vaut la moitié de la note |

**Quand une note manque** (pas encore de composition, par exemple) : `moyenne(…)` ne tient compte que de ce qui existe ; un calcul avec `+ − * /` qui a besoin de la valeur manquante rend la matière « NC ». Chaque école choisit donc en connaissance de cause.

**Contrôles avant d'enregistrer** : une formule n'est acceptée que si elle est lisible, n'utilise que les éléments ci-dessus, donne **20 quand toutes les notes valent 20**, **0 quand toutes valent 0**, et ne sort **jamais** de 0 à 20. Sinon, un message explique le problème (par exemple « Avec toutes les notes à 20, la formule donne 13,33 au lieu de 20 : vérifiez les poids et le diviseur »). L'écran montre aussi le résultat de la formule sur un exemple chiffré avant l'enregistrement.

**La formule de chaque enseignant.** Si la direction le permet (réglage « Chaque enseignant peut écrire la formule de sa matière », activé par défaut), l'enseignant écrit **la formule de sa propre matière** depuis l'écran de saisie des notes (encadré « Calcul de la moyenne »), avec les mêmes contrôles et le même exemple chiffré. Il peut revenir à tout moment à la formule de l'école. Lui seul la modifie : il est maître de sa matière. Si la direction désactive ce réglage, la formule de l'école s'applique à toutes les matières.

| Autre réglage | Choix possibles | Par défaut |
|---|---|---|
| Absence **non justifiée** | compte 0 — ou ne compte pas | compte 0 |
| Note « NC » pas encore tranchée | retirée du calcul — ou compte 0 (seulement si l'évaluation a été corrigée pour les camarades) | retirée |
| Matière « NC » si des devoirs étaient prévus mais aucun ne compte | oui — non | oui |
| Arrondi au centième | au plus proche (12,345 → 12,35) — troncature (12,349 → 12,34) | au plus proche |

### Moyenne annuelle : une formule aussi
Par défaut `moyenne(PERIODES)`, soit (T1 + T2 + T3) ÷ 3 ou (S1 + S2) ÷ 2. L'école peut écrire sa propre formule avec `P1`, `P2`, `P3` (ou `T1`, `T2`, `T3`, `S1`, `S2`) et `PERIODES`, par exemple `(T1 + T2 + 2*T3) / 4` pour que le dernier trimestre compte double. Mêmes contrôles que pour les matières ; une formule qui utilise une période absente de l'année (T3 dans une année en semestres) est refusée. Tant qu'une période n'a pas de moyenne, la moyenne annuelle reste **provisoire** (moyenne des périodes déjà évaluées).

### Mentions
Le barème des mentions (Échec, Passable, Assez bien, Bien, Très bien, Excellent par défaut) se modifie : nom de chaque mention et moyenne à partir de laquelle elle s'applique. La première mention commence toujours à 0 et les seuils doivent monter. Ce barème sert sur les bulletins et pour le pronostic du CEP.

### Options de l'année
| Réglage | Par défaut |
|---|---|
| afficher aussi le rang de promotion (chapitre 5) | non |
| autoriser le rachat après le conseil de fin d'année (chapitre 7) | non |
| chaque enseignant peut écrire la formule de sa matière | oui |
| l'enseignant peut adapter le calcul pour un élève (note non comptée, formule particulière, chapitre 4.3) | oui |
| motif obligatoire pour une absence justifiée | oui |
| précision de saisie des notes : au centième, au quart de point, au demi-point ou au point | au centième |
| moyenne visée pour le pronostic du CEP | 10, à confirmer par l'établissement |
| moyenne visée pour le pronostic du BEPC | 10 |

Le **seuil de passage** (10 par défaut) se règle dans la configuration académique ; l'écran le rappelle.

### Critères d'orientation
Pour chaque série (A1 à G3, EA, MIA, HR) : les disciplines **indispensables**, celles **d'appoint**, leur poids (1 à 10) et la moyenne conseillée. Détail au chapitre 7.

### Garanties
- **Des formules libres mais contrôlées** : la formule est lue et calculée par l'application, jamais exécutée comme un programme ; elle est vérifiée à l'écran **et** au moment de l'enregistrement. Le calcul est exact (aucune erreur d'arrondi en cours de route), avec un seul arrondi final au centième.
- **Des règles gelées au conseil** : quand le conseil d'une période est validé, les règles, les coefficients **et les formules des enseignants** de cette période sont figés. Un changement ne modifie jamais un bulletin déjà validé.
- **Des changements tracés** : qui, quand, et la règle ou la formule avant / après (y compris les formules des enseignants).
- **Un recalcul automatique** : après un changement qui touche aux moyennes, les moyennes de l'année en cours (tableaux de bord, espace parents) sont recalculées en arrière-plan.
- Ces règles ne peuvent pas être modifiées depuis l'écran générique « Options de configuration » : seulement ici.

## 3.9 Les paramètres de l'établissement ✅
*Paramètres → Paramètres de l'établissement* : **tous les seuils, délais et poids** que l'application utilise pour juger et alerter. Ils sont rangés en sections :

| Section | Exemples |
|---|---|
| Niveaux de performance | « Excellent » à partir de 16, « Très bien » à 14, « Bien » à 12, « faible » sous 8 |
| Suivi des élèves et alertes | assiduité faible sous 85 %, critique sous 70 % ; « plusieurs incidents » à partir de 3 ; alerte « classe absente » ; climat de l'école |
| Alertes précoces | chute de notes, absences d'affilée, arrêt des devoirs |
| Analyses prédictives | périodes observées, poids de chaque facteur du risque d'échec et de décrochage, niveaux de risque |
| Examens et orientation | matière forte, mention « Bien » au CEP, candidats à risque ou confiants, points forts de l'orientation |
| Compétences | seuils Acquis / En cours, valeur enregistrée de chaque niveau |
| Finance | rappel avant échéance, retard critique, échéance minimum |
| Communication et services | signature du carnet de liaison, code parent, tickets de cantine, durée d'un prêt de bibliothèque |

**Comment faire :**
- Chaque valeur affiche ses **bornes** et sa **valeur d'origine**. Le lien « Revenir à … » la remet en un clic.
- Le bouton « Valeurs d'origine » remet toute la page.
- La recherche en haut de page trouve un réglage par son nom (« assiduité », « délai »…).
- Tant que vous n'avez pas cliqué sur **Enregistrer**, rien n'est changé.

**Garanties :**
- Une valeur hors bornes ou un réglage **contradictoire** est refusé, avec un message qui dit quoi corriger. Exemples : seuil critique au-dessus du seuil d'alerte, poids qui ne font pas 100 %.
- Chaque changement est **tracé** (avant, après, qui, quand).
- Si un seuil de risque ou de niveau change, les analyses de l'année en cours sont **recalculées** automatiquement.
- Le seuil de passage de l'école (3.3) s'applique partout : tableaux de bord, comparaisons, conseils, alertes.
- Les valeurs d'origine sont celles d'avant ces réglages. Sans rien toucher, rien ne change.

Toute l'équipe peut consulter cette page ; seule la direction modifie. La liste complète, et ce qui reste volontairement fixe (sécurité, limites techniques, barèmes nationaux), est dans `docs/PARAMETRES_ETABLISSEMENT.md`.

## 3.10 Les autres réglages
| Écran | Contenu |
|---|---|
| Salles de classe | salles physiques, partagées par tous |
| Options de configuration | listes de choix propres à l'école (motifs, catégories, types). Les règles de l'établissement et les définitions d'examens nationaux n'y sont pas modifiables : elles ont leur écran dédié |
| Rôles & permissions | consulter ce que chaque rôle peut faire |
| Modules de l'établissement | activer uniquement ce qui sert (chapitre 1) |
| Utilisateurs et comptes | créer les comptes du personnel ; un compte supprimé est **anonymisé**, son historique est conservé |
| Enseignants | fiches, affectations, disponibilités (créneaux où l'enseignant peut faire cours) |

## 3.11 Importer des listes
*Importer* : reprise des élèves ou d'autres listes depuis un fichier tableur. L'import est limité en taille par envoi, et les contenus dangereux pour un tableur (formules piégées) sont neutralisés.
