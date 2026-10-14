# Registre des décisions — notes, moyennes, bulletins

Ce registre consigne **les décisions prises avec l'établissement**, en langage courant. Le détail de chaque règle et son fonctionnement dans l'application sont expliqués dans le [Guide d'utilisation](guide-utilisateur/README.md), chapitres 4 à 7.

Décisions prises entre le 1ᵉʳ et le 3 octobre 2026.

**Principe général (3 octobre 2026)** : les règles de calcul et de décision sont **configurables par chaque école**, dans un cadre précis :
- des choix proposés, pas de formule libre ;
- les **règles officielles du Bénin** par défaut ;
- des règles **gelées au conseil de classe** pour la période concernée ;
- chaque changement de réglage **tracé**.

---

## A. Moyenne d'une matière

| N° | Question | Décision |
|---|---|---|
| A1 | Interrogation ou devoir ? | Chaque type d'évaluation est rangé **explicitement** par l'école dans « Interrogation » (interrogations écrites et orales, exposés, TP) ou « Devoir » (devoirs surveillés, devoirs de niveau, compositions, examens blancs). |
| A2 | Formule | **(MI + D1 + D2) ÷ 3**, soit (MI + somme des devoirs) ÷ (1 + nombre de devoirs). La composition compte comme un devoir. La formule « (moyenne de classe + composition) ÷ 2 » a été **écartée**. |
| A3 | Plus de deux devoirs | Tous comptent : (MI + D1 + D2 + D3) ÷ 4. |
| A4 | Interrogations retenues | Toutes, en moyenne simple. |
| A5 | Arrondi intermédiaire | Aucun ; la colonne « Moy. interro » est affichée sur le bulletin. |
| A6 | Coefficient d'une évaluation | Ne sert pas au calcul ; le champ est retiré de la saisie. |
| A7 | Barèmes différents | Toute note est ramenée sur 20. |
| A8 | Précision de saisie | Deux chiffres après la virgule, au plus. |

## B. Absences, dispenses, notes manquantes

| N° | Question | Décision |
|---|---|---|
| B1 | Absence justifiée à tous les devoirs | La matière est « NC » (non classé) pour la période et sort de la moyenne générale. |
| B2 | Aucune note comptée dans une matière | La matière et son coefficient sortent de la moyenne générale. |
| B3 | Dispense (EPS) | Traitée comme une absence justifiée : retirée du calcul. |
| B4 | Rattrapage | Possible jusqu'au conseil de classe ; ensuite, par réclamation seulement. |
| B5 | Qui justifie une absence | L'enseignant (après vérification) ; **motif obligatoire** (billet visé par le directeur des études). |
| B6 | Note manquante alors que les camarades sont notés | La note est marquée **« NC »** et **ne bloque rien** (ni impression, ni conseil). Le professeur tranche : absence justifiée → retirée (÷2 au lieu de ÷3…) ; sans justificatif → 0 ; recomposition → note saisie. **Tant qu'il n'a pas tranché, la note est retirée du calcul.** |
| B7 | Élève arrivé en cours de période | Les évaluations antérieures à son inscription dans la classe sont ignorées. |
| B8 | Changement de classe dans l'établissement | Les notes suivent l'élève dans les matières identiques. |
| B9 | Note supprimée | Elle redevient « NC » si les camarades sont notés. |
| — | Absence non justifiée | **Vaut 0**, modifiable si l'élève recompose avant le conseil. |

## C. Moyenne générale

| N° | Question | Décision |
|---|---|---|
| C1 | Note de conduite | **Pas** de note de conduite dans la moyenne générale. La conduite s'exprime par les avertissements du conseil. |
| C2 | Matières facultatives | Comptées normalement si l'élève y est inscrit. |
| C3 | Coefficient modifié en cours d'année | Les coefficients sont **figés** à la validation du conseil de chaque période. |
| C4 | Coefficients de référence | Ceux réglés pour chaque classe (coefficients nationaux par niveau et série). |

## D. Moyenne annuelle

| N° | Question | Décision |
|---|---|---|
| — | Découpage | L'école choisit **trimestres OU semestres, jamais les deux** dans une même année. |
| — | Formule | (T1 + T2 + T3) ÷ 3 ou (S1 + S2) ÷ 2 ; provisoire tant qu'une période manque. |
| D1 | Élève transféré en cours d'année | La moyenne de l'établissement d'origine (bulletin de transfert) est saisie pour la période non suivie. |
| D2 | Moyenne annuelle par matière | Moyenne simple des périodes. |
| D3 | Découpage « hybride » | Supprimé. |

## E. Arrondi, rangs, mentions, décisions

| N° | Question | Décision |
|---|---|---|
| E1 | Arrondi | Au centième, demi vers le haut, une seule fois à la fin. Rang, mention et décision se fondent sur la moyenne affichée. |
| E2–E5 | Rangs | Rang **par classe** : sur la moyenne de période en fin de période, sur la moyenne annuelle en fin d'année. Ex aequo = même rang. **Rang de promotion** (même niveau, toutes classes) en option, activable par l'école. |
| E3 | Effectif | Élèves **inscrits et actifs** ; un élève qui abandonne n'est plus compté. |
| E6 | Mention sous 10 | **« Échec »**. Barème : Passable 10, Assez bien 12, Bien 14, Très bien 16, Excellent 18. |
| E7 | Distinctions du conseil | Liste actuelle (tableau d'honneur, encouragements, avertissement travail, avertissement conduite), **seuils réglables** par l'école. |
| E8 | Moyenne de la classe | Moyenne simple des moyennes des élèves classés. |

## F. Passage, examens, orientation

| N° | Question | Décision |
|---|---|---|
| F1 | Passage | Moyenne annuelle de **10** ; **rachat** possible, uniquement après le conseil de classe (option). |
| F2–F3 | CEP / BEPC | Recherche faite ; seules les sources béninoises sont retenues (chapitre 7 du guide). Seuil des pronostics **réglable**, 10 par défaut. |
| F4 | Critères d'orientation | **Modifiables par l'école** ; critères de départ dans le chapitre 7 du guide. |
| — | Séries | Intitulés officiels, y compris les filières DT : EA, MIA, HR. |

## G. Verrouillage et traçabilité

| N° | Question | Décision |
|---|---|---|
| G1 | Verrouillage | Notes **figées après le conseil de classe**. Une correction passe par une **réclamation** : bouton qui prend rendez-vous, examen de la copie **en présentiel** avec l'enseignant et le censeur, correction saisie par l'enseignant, **approuvée par le directeur des études**. |
| G2 | Historique | Toute modification de note est enregistrée et visible par le personnel ayant les droits sur les notes. |
| G3–G4 | Qui saisit | **Seul l'enseignant de la matière** saisit et corrige ses notes et ses évaluations : tout passe par lui. |
| — | Rôle du censeur | C'est le **directeur des études** (rôle Direction dans l'application). |

## H. Vie scolaire

| N° | Question | Décision |
|---|---|---|
| H1 | Absences sur le bulletin | Comptées **en jours** (appel journalier). |
| H2 | Effet automatique des absences sur les distinctions | **Non tranché.** Aujourd'hui, aucun effet automatique : seuls les incidents comptent pour l'avertissement de conduite. |

---

## Questions encore ouvertes

| Sujet | Ce qu'il faut fournir ou décider |
|---|---|
| Coefficients officiels | La grille par matière, par niveau et par série, à saisir par l'école |
| Intitulés des classes et séries | La liste exacte utilisée par l'établissement |
| Seuil du CEP | À confirmer par l'établissement (10 par défaut) |
| Paie | Taux légaux des cotisations et de l'impôt sur salaire ; congés en jours calendaires ou ouvrés |
| Reçus | Numérotation continue des reçus (0001, 0002…) |
| Absences et distinctions (H2) | Les absences non justifiées doivent-elles peser sur les distinctions du conseil ? |
| Orientation post-BAC | Faut-il gérer les choix d'études supérieures (FAST, EPAC…) dans l'application ? |
