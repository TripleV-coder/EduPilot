# Paramètres de l'établissement — inventaire complet

*Inventaire du 3 octobre 2026.*

Toutes les valeurs « métier » de l'application ont été recherchées une à une : seuils, délais, poids, niveaux. Chacune est maintenant :

- **réglable par l'école**, à un seul endroit ;
- **ou volontairement fixée**, avec la raison écrite ci-dessous.

## Où régler quoi

| Quoi | Où | Qui modifie |
|---|---|---|
| Seuil de passage (moyenne de réussite) | Paramètres › Années académiques › configuration académique | Direction |
| Formule des matières, moyenne annuelle, absences, arrondi, mentions, moyennes d'admission CEP / BEPC, critères d'orientation | Paramètres › **Règles de l'établissement** | Direction (et chaque professeur pour la formule de sa matière) |
| Tableau d'honneur, encouragements, avertissement | Conseils de classe › règles du conseil | Direction |
| **Tout le reste** : niveaux, alertes, analyses, examens, compétences, finance, délais | Paramètres › **Paramètres de l'établissement** | Direction ; lecture pour toute l'équipe |

Sur la page **Paramètres de l'établissement** :

- chaque valeur montre ses bornes et sa valeur d'origine, avec un bouton « Revenir à … » ;
- une recherche permet de trouver un réglage par son nom.

**Garde-fous, identiques sur l'écran et sur le serveur :**

1. **Bornes** : une valeur absurde est refusée, par exemple une assiduité de 150 % ou un délai de 0 jour.
2. **Cohérences** : un réglage contradictoire est refusé, avec un message qui dit quoi corriger. Les cohérences vérifiées :
   - un seuil critique doit rester sous le seuil d'alerte ;
   - les poids des analyses doivent totaliser 100 % ;
   - un incident grave ne peut pas peser moins qu'un incident léger ;
   - une compétence enregistrée « En cours » doit être relue « En cours » ;
   - et ainsi de suite pour chaque section.
3. **Journal** : chaque changement est enregistré avec la valeur avant et après, et la personne qui l'a fait.
4. **Recalcul automatique** : si un seuil de risque ou de niveau change, les analyses de l'année en cours sont recalculées. Un délai ou un réglage d'affichage ne déclenche aucun recalcul.
5. **Repli sûr** : une valeur enregistrée devenue invalide revient à sa valeur d'origine. Une section devenue incohérente revient entière à l'origine, plutôt que de produire des alertes contradictoires.

**Les valeurs d'origine sont exactement l'ancien comportement.** Une école qui ne touche à rien ne voit aucune différence.

## Les paramètres, section par section

*Tableaux générés depuis la liste unique du code (`src/lib/schools/school-parameters.ts`) : ils ne peuvent pas diverger de l'application.*

### Niveaux de performance

Tranches utilisées par les graphiques et les niveaux affichés (excellent, très bien…). Le seuil de réussite est celui de la configuration académique.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Excellent à partir de | **16** | 0 à 20 | /20 |
| Très bien à partir de | **14** | 0 à 20 | /20 |
| Bien à partir de | **12** | 0 à 20 | /20 |
| Faible en dessous de — *Sous ce niveau, la moyenne est « faible » ; entre ce niveau et le seuil de réussite, « insuffisante ».* | **8** | 0 à 20 | /20 |
| Élèves remarquables à partir de — *Liste des meilleurs élèves des tableaux de bord.* | **15** | 0 à 20 | /20 |
| Forte évolution à partir de — *Hausse ou baisse d'une période à l'autre jugée forte.* | **15** | 1 à 100 | % |
| Évolution à partir de — *En dessous : moyenne « stable ».* | **5** | 1 à 100 | % |

### Suivi des élèves et alertes

Quand un élève est signalé à surveiller, et à quel niveau de risque.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Assiduité faible en dessous de | **85** | 1 à 100 | % |
| Assiduité critique en dessous de | **70** | 1 à 100 | % |
| Moyenne critique en dessous de | **8** | 0 à 20 | /20 |
| Moyenne très faible en dessous de | **6** | 0 à 20 | /20 |
| Plusieurs incidents à partir de | **3** | 1 à 50 | incidents |
| Nombreux incidents à partir de | **5** | 1 à 50 | incidents |
| Risque moyen à partir de — *Score de risque (notes + assiduité + comportement).* | **20** | 1 à 100 | points |
| Risque élevé à partir de | **40** | 1 à 100 | points |
| Risque critique à partir de | **60** | 1 à 100 | points |
| Alerte « classe absente » au-delà de — *La direction est prévenue quand une classe dépasse ce taux d'absences.* | **15** | 1 à 100 | % d'absences |
| Climat de l'école « excellent » sous — *Page Discipline : nombre d'incidents de la semaine pour tout l'établissement.* | **10** | 1 à 500 | incidents par semaine |
| Climat de l'école « à surveiller » à partir de | **20** | 1 à 500 | incidents par semaine |

### Alertes précoces

Signaux soudains repérés sur une courte période.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Période observée | **14** | 3 à 90 | jours |
| Chute de moyenne signalée à partir de — *Au double, l'alerte est critique.* | **3** | 0,5 à 20 | points |
| Absences non justifiées d'affilée | **3** | 1 à 30 | absences |
| Devoirs non rendus (minimum) — *Au double, l'alerte est critique.* | **2** | 1 à 30 | devoirs |
| Incidents graves sur la période | **2** | 1 à 30 | incidents |

### Analyses prédictives

Données prises en compte et poids de chaque facteur. Les poids d'un même modèle doivent totaliser 100 %.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Assiduité observée sur | **90** | 7 à 365 | jours |
| Comportement observé sur | **180** | 7 à 365 | jours |
| Devoirs observés sur | **90** | 7 à 365 | jours |
| Périodes minimum pour une prévision | **3** | 2 à 10 | périodes |
| Baisse inquiétante à partir de | **1** | 0,25 à 10 | points par période |
| Devoirs rendus : critique en dessous de | **50** | 1 à 100 | % |
| Devoirs rendus : faible en dessous de | **70** | 1 à 100 | % |
| Alerte à partir de | **3** | 1 à 20 | matières faibles |
| Décrochage : période récente comparée à la précédente | **30** | 7 à 120 | jours |
| Décrochage : signal « fort » à partir de | **70** | 1 à 100 | points sur 100 |
| Décrochage : signal « moyen » à partir de | **40** | 1 à 100 | points sur 100 |
| Décrochage : inactivité inquiétante après | **7** | 1 à 60 | jours |
| Classe : intervention urgente au-delà de | **30** | 1 à 100 | % d'élèves à risque |
| Classe : surveillance au-delà de | **15** | 1 à 100 | % d'élèves à risque |
| Comportement : incidents pris en compte sur — *Un incident pèse moins à mesure qu'il vieillit, jusqu'à 20 % de son poids.* | **90** | 7 à 365 | jours |
| Comportement : poids d'un incident critique | **30** | 0 à 100 | points |
| Comportement : poids d'un incident grave | **15** | 0 à 100 | points |
| Comportement : poids d'un incident moyen | **6** | 0 à 100 | points |
| Comportement : poids d'un incident léger | **2** | 0 à 100 | points |
| Comportement : risque élevé à partir de | **70** | 1 à 100 | % |
| Comportement : risque modéré à partir de | **40** | 1 à 100 | % |
| Comportement : risque faible à partir de | **20** | 1 à 100 | % |
| Risque d'échec — poids des résultats | **35** | 0 à 100 | % |
| Risque d'échec — poids de l'assiduité | **25** | 0 à 100 | % |
| Risque d'échec — poids du comportement | **20** | 0 à 100 | % |
| Risque d'échec — poids des devoirs | **15** | 0 à 100 | % |
| Risque d'échec — poids des matières faibles | **5** | 0 à 100 | % |
| Décrochage — évolution de l'assiduité | **30** | 0 à 100 | % |
| Décrochage — absences consécutives | **20** | 0 à 100 | % |
| Décrochage — abandon des devoirs | **20** | 0 à 100 | % |
| Décrochage — effondrement des notes | **15** | 0 à 100 | % |
| Décrochage — hausse des incidents | **10** | 0 à 100 | % |
| Décrochage — activité récente | **5** | 0 à 100 | % |
| Niveau « très élevé » à partir de | **75** | 1 à 100 | % |
| Niveau « élevé » à partir de | **55** | 1 à 100 | % |
| Niveau « modéré » à partir de | **35** | 1 à 100 | % |
| Niveau « faible » à partir de | **15** | 1 à 100 | % |

### Examens et orientation

Lecture des résultats pour le CEP, le BEPC et l'orientation.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Écart habituel entre moyenne de classe et note d'examen — *Plus il est grand, plus l'estimation des chances est prudente. À ajuster d'après les résultats passés de l'école.* | **2** | 0,5 à 6 | points |
| Matière forte à partir de — *Préparation aux examens.* | **14** | 0 à 20 | /20 |
| CEP : « mention Bien » projetée à partir de | **14** | 0 à 20 | /20 |
| Candidat à risque en dessous de | **50** | 1 à 100 | % de réussite estimée |
| Candidat confiant à partir de | **70** | 1 à 100 | % de réussite estimée |
| Orientation : point fort à partir de | **12** | 0 à 20 | /20 |
| Orientation : point de vigilance en dessous de | **10** | 0 à 20 | /20 |
| Orientation : retrait si la moyenne générale est sous le niveau conseillé | **15** | 0 à 50 | points sur 100 |

### Compétences

Lecture des notes en niveaux de compétence, et valeur de chaque niveau.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Acquis à partir de | **14** | 0 à 20 | /20 |
| En cours à partir de | **10** | 0 à 20 | /20 |
| Valeur d'un « Acquis » | **16** | 0 à 20 | /20 |
| Valeur d'un « En cours » | **12** | 0 à 20 | /20 |
| Valeur d'un « Non acquis » | **8** | 0 à 20 | /20 |

### Finances

Relances de paiement et échéanciers.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Rappel avant l'échéance | **7** | 0 à 60 | jours |
| Retard critique après | **30** | 1 à 365 | jours |
| Montant minimum d'une échéance | **10** | 1 à 10000000 | FCFA |

### Communication et services

Délais du cahier de liaison, des codes parents, de la cantine et de la bibliothèque.

| Paramètre | Valeur d'origine | Bornes | Unité |
|---|---|---|---|
| Délai de signature d'un mot du cahier de liaison | **14** | 1 à 90 | jours |
| Validité d'un code de rattachement parent | **14** | 1 à 90 | jours |
| Validité d'un ticket de cantine | **30** | 1 à 365 | jours |
| Durée d'un prêt de bibliothèque (proposée) | **14** | 1 à 120 | jours |


## Où ces paramètres agissent

- **Niveaux de performance**
  - niveaux enregistrés pour chaque élève ;
  - graphiques de répartition des notes ;
  - statistiques des notes (part « excellent », « bon »…) ;
  - analyses par matière ;
  - couleurs des moyennes à l'écran : bulletins, notes, conseils, orientation, fiche élève, carte de chaleur, espace famille ;
  - appréciations rédigées automatiquement ;
  - liste des « élèves remarquables ».
- **Suivi des élèves**
  - niveau de risque officiel de chaque élève ;
  - alertes du tableau de bord des parents ;
  - écrans « Risques », dont la matrice ;
  - recommandations de l'assistant ;
  - alerte « classe absente » envoyée à la direction ;
  - climat de l'école sur la page Discipline.
- **Alertes précoces, analyses prédictives** : risque d'échec, risque de décrochage, prévision de comportement, prédictions de classe.
- **Examens et orientation**
  - préparation CEP / BEPC : matières faibles et fortes, chances d'admission, candidats à risque ou confiants ;
  - mention « Bien » projetée au CEP ;
  - points forts et de vigilance de l'orientation ;
  - retrait quand la moyenne générale est sous le niveau conseillé.
- **Compétences** : lecture Acquis / En cours / Non acquis, et valeur enregistrée pour chaque niveau.
- **Finance** : rappels d'échéance, retard critique, montant minimum d'une échéance.
- **Communication et services** :
  - délai de signature du carnet de liaison ;
  - validité du code parent ;
  - validité des tickets de cantine ;
  - durée d'un prêt de bibliothèque. La date de retour est désormais fixée par le serveur : avant, le navigateur l'envoyait et un élève pouvait la repousser à volonté.

Le **seuil de passage** de l'école s'applique désormais partout : taux de réussite des tableaux de bord, comparaisons de classes et de périodes, réseau d'écoles, statistiques, conseils, alertes, gabarits de l'assistant. Avant, 10/20 était écrit en dur à plus de vingt endroits.

## Ce qui reste volontairement fixe, et pourquoi

| Valeur | Réglage actuel | Pourquoi l'école ne la règle pas |
|---|---|---|
| Verrouillage d'un compte après échecs de connexion | 5 essais, 30 minutes | **Sécurité** : un réglage faible exposerait tous les comptes. Fixé par l'hébergeur. |
| Limites de requêtes (anti-abus), codes à usage unique (2FA), chiffrement des mots de passe | voir `src/lib/rate-limit.ts`, `src/lib/auth/` | **Sécurité**, même raison. |
| Taille maximale d'un fichier envoyé | 5 Mo | **Exploitation** : protège l'espace disque et le serveur. |
| Import en masse | 500 lignes, délai de 2 minutes | **Exploitation** : protège la base de données. |
| Durées de conservation des données | réglées dans Système › Conservation | Déjà réglables par l'administrateur de la plateforme, dans le **cadre légal** : elles ne relèvent pas d'une école seule. |
| Méthode de prévision de la moyenne (lissage 0,6, fourchette calibrée) | voir `algorithms/forecast.ts` | **Précision** : ces constantes sont *mesurées* sur 20 000 trajectoires pour que « 95 % » veuille dire 95 %. Les changer à la main casserait la calibration. |
| Seuils internes d'émission d'un signal de décrochage (un signal n'est montré qu'au-delà de 20 ou 30 points sur 100) | voir `predict-dropout.ts` | **Lisibilité** : évite d'afficher des signaux insignifiants. Le *niveau* des signaux (fort / moyen) est, lui, réglable. |
| Périodes d'affichage des tableaux de bord (« 7 derniers jours », « 30 derniers jours », échéances des 60 prochains jours côté famille) | — | **Affichage** : ce sont des fenêtres de lecture, pas des règles. Les fenêtres qui *décident* d'une alerte sont réglables (section « Analyses prédictives »). |
| Dégradés de couleur purement visuels (carte des absences, score de conformité, couleur du taux de réussite d'une classe) | — | **Affichage** : aucune décision n'en dépend. |
| Barème national des examens (matières et coefficients du CEP, du BEPC, du BAC) | référentiel national | **Officiel** : défini par l'État, identique pour toutes les écoles. |
