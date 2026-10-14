# 7. Passage en classe supérieure, examens et orientation

---

## 7.1 Le passage en classe supérieure

On l'ouvre dans *Paramètres → Promotion & fin d'année*. Pour une classe, chaque élève apparaît avec sa **moyenne annuelle**.

### La règle
- **Passage avec une moyenne annuelle de 10 ou plus.**
- L'application **suggère** « Promouvoir » seulement si la moyenne annuelle est **complète** (toutes les périodes ont une moyenne) **et** au moins égale à 10. ✅
- Si la moyenne est **provisoire**, elle est affichée avec la mention « (provisoire) » et **aucune suggestion** n'est faite. ✅
- Dans tous les autres cas (moyenne sous 10, pas de note), l'élève reste « non décidé » : la direction doit choisir explicitement. **Rien n'est appliqué à l'aveugle.** ✅

### Les décisions possibles ✅
| Décision | Effet |
|---|---|
| **Promouvoir** | l'élève est inscrit dans la classe supérieure de l'année suivante ; s'il était en dernière année du cycle, il est diplômé |
| **Redoubler** | l'élève est réinscrit au même niveau l'année suivante |
| **Quitter l'établissement** | l'inscription est close |

L'ancienne inscription est conservée comme historique et ne compte plus dans les effectifs actifs. Une même décision appliquée deux fois ne crée pas de double inscription.

### Le rachat (option de l'école)
- Le **rachat** permet de promouvoir un élève **sous le seuil**, **uniquement après le conseil de classe** et sur sa décision.
- ✅ Le rachat s'active dans *Paramètres → Règles de l'établissement* (désactivé par défaut).
- ✅ Contrôle à l'enregistrement : promouvoir un élève dont la moyenne annuelle est **sous le seuil** est refusé si le rachat n'est pas activé, ou si le **conseil de classe de la dernière période** n'est pas validé. Le message cite les élèves concernés et leur moyenne.
- ✅ Sur l'écran de promotion, le bouton devient « Racheter » pour un élève sous le seuil, avec une explication ; chaque rachat est tracé.
- ✅ Le seuil de passage (10 par défaut) se règle dans la configuration académique ; l'écran de promotion l'utilise pour ses suggestions et ses couleurs.

---

## 7.2 Préparation aux examens nationaux

### Ce que disent les règles officielles
| Examen | Règle retenue | Source |
|---|---|---|
| **BEPC** | admissible avec une **moyenne d'au moins 10/20 aux épreuves écrites**, puis épreuve d'**EPS** pour les seuls admissibles. Depuis 2024 : physique-chimie-technologie obligatoire, choix entre allemand et espagnol, fin des séries « moderne court / long » | presse béninoise (Banouto, Le Matinal, Bénin Web TV) |
| **BAC** | admis avec une moyenne d'au moins 10/20 ; mentions Passable (10 à 11,99), Assez bien (12 à 13,99), Bien (14 à 15,99), Très bien (16 et plus) | encyclopédie publique |
| **CEP** | épreuves : mathématiques, compréhension de l'écrit, expression écrite, éducation scientifique et technologique, éducation sociale. **Aucune source publique fiable ne donne le seuil d'admission** | sites d'annales béninois |

Les règles ivoiriennes trouvées en ligne (repêchage sur 280 points, matière EDHC) **ne sont pas utilisées**.

### Pronostics dans l'application
- *Orientation → CEP* (classes de CM2) : pour chaque élève, moyenne annuelle (ou provisoire), moyennes en lecture, en calcul et en dictée, puis un **pronostic** et une recommandation.
- *Préparation BEPC* (classes de 3ᵉ) : préparation par matière d'examen, tendance (en hausse, stable, en baisse), points forts et points faibles.

| État | Détail |
|---|---|
| ✅ | Les moyennes utilisées suivent les règles du chapitre 4 (notes ramenées sur 20, année en cours seulement, vrais 0 comptés). |
| ✅ | Le pronostic CEP utilise le **barème des mentions de l'école** et la **moyenne visée pour le CEP** (10 par défaut, réglable). Les paliers de recommandation (14 / 12 / 10 / 8 au seuil de 10) se décalent avec ce seuil. La moyenne générale est exactement celle du bulletin. |
| ✅ | Le seuil de la « mention Bien projetée » au CEP se règle dans les paramètres de l'établissement (14 par défaut). L'indicateur « Inscriptions DEC envoyées », qui ne reposait sur aucune donnée, a été retiré. |
| ✅ | Préparation BEPC : la **chance d'admission estimée** est la probabilité d'atteindre la moyenne d'admission du BEPC (10 par défaut, réglable). Le calcul tient compte d'un écart habituel entre moyenne de l'année et note d'examen (2 points par défaut, réglable d'après les résultats passés de l'école). Exemple : 12/20 donne 84 %. Sans aucune note : « Pas encore de notes », jamais un faux pourcentage. La mention probable suit le barème des mentions de l'école. |

---

## 7.3 L'orientation en seconde

### Les séries officielles ✅
| Enseignement général | Enseignement technique et professionnel |
|---|---|
| **A1** Lettres - Langues | **E** Mathématiques et Techniques |
| **A2** Lettres - Sciences Humaines | **F1** Construction / Fabrication Mécanique |
| **B** Lettres - Sciences Sociales | **F2** Électronique · **F3** Électrotechnique |
| **C** Sciences et Techniques (mathématiques, sciences exactes) | **F4** Génie Civil (bâtiments et travaux publics) |
| **D** Biologie - Géologie (sciences expérimentales) | **G1** Techniques Administratives (secrétariat) · **G2** Techniques Quantitatives de Gestion · **G3** Techniques Commerciales |
| | Filières du **Diplôme de Technicien** (équivalent du BAC) : **EA** Eau et Assainissement · **MIA** Maintenance et Informatique Appliquée · **HR** Hôtellerie Restauration |

### Comment l'application propose une série ✅
1. Elle calcule les moyennes de l'élève **discipline par discipline** : mathématiques, physique-chimie, SVT, français, philosophie, histoire-géographie, langues, économie/gestion, technologie.
2. Pour chaque série, elle compare ces moyennes aux **disciplines clés** de la série :
   - les disciplines **indispensables** : une absence de note réduit le score ;
   - les disciplines **d'appoint** : comptées si elles sont évaluées, sans pénalité sinon. Exemple : la philosophie, qui n'est pas enseignée au collège.
3. Elle donne un **score d'adéquation de 0 à 100**. Le score baisse de 15 points si la moyenne générale est sous le niveau conseillé pour la série.
4. Elle affiche les trois séries les mieux placées, avec les **atouts** (disciplines à 12 et plus) et les **points de vigilance** (disciplines sous 10, disciplines non évaluées, moyenne générale insuffisante).

L'EPS et les arts **ne départagent pas** les séries. « Éducation physique » n'est jamais confondue avec la physique, ni « sciences économiques » avec les sciences.

### Critères actuels (à valider par l'établissement)
| Série | Disciplines indispensables (poids) | D'appoint | Moyenne conseillée |
|---|---|---|---|
| A1 | Français 3, Langues 3 | Philosophie 1, Histoire-Géo 1 | 10 |
| A2 | Français 3, Histoire-Géo 3 | Philosophie 2, Langues 1 | 10 |
| B | Histoire-Géo 3, Français 2, Maths 1 | Économie 3 | 10 |
| C | Maths 4, Physique-Chimie 3 | SVT 1 | 12 |
| D | SVT 4, Physique-Chimie 2, Maths 2 | — | 11 |
| E | Maths 3, Physique-Chimie 2, Technologie 3 | — | 11 |
| F1 à F4 | Technologie 3, Maths 2, Physique-Chimie 2 | — | 10 |
| G1 | Français 3, Langues 2, Économie 1 | — | 9 |
| G2 | Maths 3, Économie 2 | Français 1 | 10 |
| G3 | Langues 2, Français 2, Économie 2 | Maths 1 | 9 |
| EA | Physique-Chimie 2, SVT 2, Technologie 1 | Maths 1 | 9 |
| MIA | Technologie 3, Maths 2 | Physique-Chimie 1 | 9 |
| HR | Langues 3, Français 2, Économie 1 | — | 8 |

✅ Ces critères sont **modifiables par chaque école** dans *Paramètres → Règles de l'établissement* : pour chaque série, les disciplines indispensables ou d'appoint, leur poids et la moyenne conseillée. Le tableau ci-dessus reste la valeur par défaut. Les moyennes utilisées pour l'orientation (aperçu de l'élève, dossier du conseil) sont exactement celles du bulletin.

### Sans notes, pas de proposition ✅
Si l'élève n'a aucune moyenne dans une discipline déterminante, l'application **refuse** de proposer une série et explique pourquoi. Avant, elle proposait la série D « par défaut ».

### Le dossier d'orientation en conseil ✅
Pour chaque élève de la classe, le conseil voit :
- la série proposée par l'application ;
- le **vœu de la famille** ;
- la **décision du conseil**.

L'état de chaque dossier :

| État | Signification |
|---|---|
| **D'accord** | les avis concordent |
| **Arbitrage** | pas encore de décision du conseil |
| **Conflit** | l'application et la famille, ou le conseil et les deux autres, divergent |

Une répartition par famille de séries (A, B, C, D, E, F, G, DT) aide à préparer les effectifs de seconde.

### L'élève : « Mon orientation » ✅
L'élève voit ses moyennes par matière de l'année et, tant que le conseil n'a pas statué, un **aperçu indicatif** des séries qui lui correspondent. En cours d'année, cet aperçu s'appuie sur la moyenne provisoire.

### Problème connu 🔧
Sur la page d'orientation, les choix **post-BAC** (FAST, EPAC, ENS…) ne peuvent pas être enregistrés : ils ne font pas partie de la liste des séries. À corriger.
