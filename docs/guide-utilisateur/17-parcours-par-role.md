# 17. Le parcours complet de chaque rôle

Ce chapitre suit **chaque personne, du jour où son compte est créé jusqu'à ses tâches de tous les jours** : comment elle obtient son accès, ce qu'elle voit en arrivant, ce que contient chaque entrée de son menu, comment elle réalise ses tâches pas à pas, et ce qu'elle ne peut pas faire.

Les chapitres précédents expliquent les **règles** (calcul des moyennes, conseil de classe, paiements…). Celui-ci explique les **parcours** et renvoie vers ces chapitres pour le détail des règles.

Rappel des marques : ✅ en place · 🔧 en cours de finalisation (ce qui manque est précisé).

---

## 17.1 Ce qui est pareil pour tout le monde

### Personne ne s'inscrit seul ✅
Il n'y a **pas d'inscription libre** sur EduPilot. Chaque compte est créé par quelqu'un qui en a le droit :

| Qui crée | Peut créer des comptes… |
|---|---|
| Administrateur de la plateforme | de tous les rôles |
| Responsable de réseau | administrateur d'école, direction, enseignant, comptable, personnel, élève, parent |
| Administrateur de l'école | direction, enseignant, comptable, personnel, élève, parent |
| Direction | enseignant, personnel, élève, parent (**pas** de comptable) |
| Personnel (vie scolaire) | élève, parent |
| Enseignant | parent |
| Comptable, élève, parent | aucun |

### Le mot de passe provisoire ✅
1. À la création du compte, l'application fabrique un **mot de passe provisoire**. Il s'affiche **une seule fois**, à la personne qui crée le compte. Lors d'un import de liste, un fichier des identifiants provisoires peut être téléchargé.
2. La personne qui a créé le compte remet ces identifiants à l'intéressé (en main propre, par message…).
3. À la **première connexion**, l'application bloque tout le reste : il faut d'abord **choisir son propre mot de passe**. Après ce changement, on se reconnecte avec le nouveau mot de passe.
4. On accepte ensuite les **conditions d'utilisation et la politique de confidentialité** (une seule fois par version de ces textes).
5. On arrive enfin sur son écran d'accueil.

### Sécurité de la connexion ✅
- Les essais répétés de mot de passe sur un même compte sont freinés : après 10 échecs en un quart d'heure depuis un même endroit, ce compte est temporairement bloqué. Une école entière qui se connecte depuis le même routeur n'est pas bloquée pour autant.
- La **double vérification** (code à 6 chiffres sur le téléphone) peut être activée dans *Paramètres → Sécurité* ; tant que le code n'est pas saisi, rien n'est accessible (chapitre 2).
- *Mot de passe oublié* envoie un e-mail de réinitialisation.

### Une école à la fois ✅
Chaque compte travaille dans une **école active**. Tout ce qui s'affiche (classes, élèves, notes, paiements, messages) concerne cette école seulement. La séparation est faite à deux niveaux : par l'application, et par la base de données elle-même, qui refuse de renvoyer les informations d'une autre école.

### Un menu qui s'adapte à l'école ✅
- Les **cycles** proposés par l'école (primaire, collège, lycée) : les rubriques d'un cycle que l'école n'a pas sont masquées.
- Les **modules** activés (finance, cantine, transport, messagerie…) : un module désactivé disparaît du menu et ses pages sont bloquées.

### La recherche rapide ✅
La barre en haut de l'écran (ou **Ctrl + K**, **⌘ K** sur Mac) ouvre une recherche : on tape le nom d'une page, d'un élève ou d'une action. Elle propose les entrées du menu, *Mon compte*, *Aide & support*, *Se déconnecter*, et des **actions rapides** selon le rôle (par exemple « Faire l'appel » pour un enseignant, « Payer les frais » pour un parent).

### L'assistant ✅
Selon le rôle, un **assistant** répond avec les chiffres de l'établissement, aide à rédiger une appréciation ou à préparer un plan d'action. Il calcule tout dans EduPilot, sans service extérieur (chapitre 2).

---

## 17.2 Une année scolaire, tous rôles confondus

Pour comprendre comment les rôles s'enchaînent, voici le déroulé d'une année, de l'ouverture de l'école à la clôture.

| Moment | Qui | Ce qui se passe | Chapitre |
|---|---|---|---|
| Ouverture | Administrateur de la plateforme | crée l'établissement et son premier administrateur | 17.3 |
| Avant la rentrée | Administrateur de l'école | profil de l'école, cycles, année et périodes (trimestres ou semestres), niveaux, classes, matières et coefficients, types d'évaluation, **règles de calcul**, frais | 3, 9 |
| Avant la rentrée | Administration, direction | crée les comptes du personnel et des enseignants ; attribue à chaque enseignant ses classes et ses matières | 17.5, 17.7 |
| Inscriptions | Administration, direction, personnel | inscrit les élèves (un par un ou par import), crée les comptes élèves et parents | 3.11, 13.9 |
| Inscriptions | Administration | remet à chaque famille le **code de liaison** pour rattacher son enfant | 17.10 |
| Toute l'année | Enseignants | font l'appel, créent les évaluations, saisissent les notes, tiennent le cahier de textes, donnent des devoirs | 17.7 |
| Toute l'année | Comptable | encaisse, valide, relance, tient la comptabilité | 17.8 |
| Toute l'année | Familles | suivent notes, absences, paiements ; justifient les absences ; paient en ligne | 17.10, 17.11 |
| Fin de période | Direction | tient le **conseil de classe** et le **valide** : les notes de la période sont figées | 5.4 |
| Fin de période | Direction | imprime les **bulletins** | 5.1 |
| Après le conseil | Familles → enseignant → censeur | **réclamation** : rendez-vous, examen de la copie, correction proposée, approbation | 6 |
| Fin d'année | Direction | passage en classe supérieure, orientation, examens nationaux | 7 |
| Fin d'année | Administration | **clôture de l'année** : les notes, présences et évaluations de l'année ne peuvent plus être modifiées | 3.3 |

---

## 17.3 Administrateur de la plateforme

### Comment il obtient son compte ✅
Le tout premier compte est créé à l'installation d'EduPilot, sur la page d'installation. Cette page ne fonctionne **que tant qu'aucun utilisateur n'existe** : dès le premier compte créé, elle refuse toute nouvelle installation.

> 🔧 Point d'attention : sur une installation toute neuve, la première personne qui atteint cette page devient administrateur de la plateforme. L'installation doit donc être faite avant d'ouvrir le service au public.

### Son écran d'accueil ✅
- **Chiffres clés** : nombre d'établissements, élèves du réseau, utilisateurs, sites en alerte.
- **Établissements** : la liste des écoles clientes.
- **Activité récente**.
- **Actions rapides** : Établissements, Plans & tarifs, Supervision, Utilisateurs, Journaux, Maintenance.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Vue réseau | l'écran d'accueil ci-dessus |
| Établissements | ouvrir une école, la suspendre, la consulter |
| Utilisateurs | tous les comptes de toutes les écoles |
| Finance consolidée | les finances de toutes les écoles |
| Analyses réseau | comparer les écoles ; un sélecteur permet de choisir l'école étudiée |
| Alertes | les notifications importantes |
| Configuration | les réglages de son compte et les écrans de gestion |

### Ses tâches, pas à pas
**Ouvrir une nouvelle école** ✅
1. *Établissements* → ajouter un établissement (nom, code, coordonnées).
2. Créer son **administrateur d'école** : le mot de passe provisoire s'affiche une fois ; le remettre à la personne.
3. L'administrateur de l'école prend le relais (17.5).

**Suspendre une école** ✅ : une école suspendue est réellement bloquée ; ses utilisateurs ne peuvent plus travailler.

**Mettre le service en maintenance** ✅ : *Maintenance* → activer avec un message personnalisé. Les utilisateurs voient le message ; rien n'est perdu.

**Rattacher un enseignant à plusieurs écoles** ✅ : depuis la fiche de l'enseignant, rubrique *Établissements*. Les écoles peuvent aussi le faire elles-mêmes, par code d'invitation (17.7).

### Ce qu'il ne fait pas ✅
Il **ne saisit pas de notes** : c'est réservé à l'enseignant de la matière.

---

## 17.4 Responsable de réseau

Pour un groupe d'écoles (une école principale et ses annexes).

### Comment il obtient son compte ✅
Créé par l'administrateur de la plateforme. Mot de passe provisoire, puis premier changement obligatoire (17.1).

### Ce qu'il peut faire ✅
- Les **mêmes droits qu'un administrateur d'école**, sur **toutes les écoles de son réseau**.
- Ouvrir une nouvelle **annexe**.
- Comparer les écoles du réseau dans les analyses, en passant de l'une à l'autre avec le sélecteur d'école de la page *Analyses*.
- Créer des comptes de tous les rôles d'école (17.1).

### Son menu ✅
Celui de la direction (élèves, notes et bulletins, appel, finance, messages, paramètres), appliqué à l'école ouverte. Le **sélecteur d'école** du menu le fait passer d'une école de son réseau à l'autre.

---

## 17.5 Administrateur de l'école

C'est la personne qui **met l'école en place** et qui la **gère de bout en bout**.

### Comment il obtient son compte ✅
Créé par l'administrateur de la plateforme (ou le responsable de réseau). Mot de passe provisoire, puis premier changement obligatoire.

### Son écran d'accueil ✅
- **Chiffres clés** : élèves, présence du jour, frais réglés, alertes ouvertes.
- **Actions rapides** : Faire l'appel, Saisir des notes, Encaisser un paiement, Nouvelle annonce, Inscrire un élève, Bulletins.
- **À surveiller** : les points qui demandent une action (alertes, paiements à valider…).
- **Mes classes** : les classes de l'école, avec un lien vers chacune et vers la liste complète.
- **Analyses** : tendances de l'école.
- Tant que l'école n'est pas installée, une **liste de démarrage** guide les premières étapes (*Ajouter un enseignant*, *Créer une classe*…), et deux boutons permettent de commencer : **Inscrire le premier élève** et **Importer un fichier**.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Vue d'ensemble | l'écran d'accueil |
| Élèves | liste des élèves (filtres par classe et par statut, vue liste ou tableau), **Inscrire un élève**, **Importer**, ouvrir un dossier, encaisser un paiement pour un élève |
| Notes & bulletins | liste des évaluations, saisie, **bulletins**, **conseils de classe**, **réclamations**, statistiques |
| Appel | l'appel du jour et les **justifications** d'absence |
| Finance | tableau de bord des frais (attendu, encaissé, reste à recouvrer, taux de recouvrement), encaissement, avis de paiement |
| Messages | messagerie avec les familles et l'équipe |
| Paramètres | tous les réglages (voir ci-dessous) |

> 🔧 Les pages **Enseignants**, **Classes** et **Emploi du temps** n'ont pas d'entrée dans ce menu. *Classes* s'ouvre depuis la rubrique « Mes classes » de l'accueil ; *Enseignants* n'est proposé que par la liste de démarrage. Une fois l'école installée, la page *Enseignants* n'est plus atteignable que par son adresse (`/dashboard/teachers`). Le menu de l'administration est à compléter.

**Les rubriques de *Paramètres*** ✅

| Rubrique | Contenu |
|---|---|
| Profil, Notifications, Sécurité, Apparence, Langue & région, Mes données | son propre compte (chapitre 2) |
| Profil établissement | nom, adresse, contacts, devise, logo (repris sur les bulletins) |
| Années académiques | l'année et son découpage en périodes |
| Cycles de l'établissement | primaire, collège, lycée |
| Modules de l'établissement | activer ou désactiver les modules |
| Règles de l'établissement | **formules de calcul**, mentions, options de rang, critères d'orientation (chapitre 3.8) |
| Paramètres de l'établissement | tous les seuils et délais réglables (chapitre 3.9) |
| Niveaux d'étude | 6ᵉ, 5ᵉ… CP, CE1… |
| Matières & évaluations | matières, coefficients, **types d'évaluation** (interrogation, devoir, composition, compétence) |
| Catégories de matières | regroupements des matières |
| Options de configuration | listes de choix propres à l'école |
| Salles & espaces | les salles, pour l'emploi du temps |
| RGPD & conformité | demandes liées aux données personnelles, durées de conservation |
| Rôles & permissions | ce que chaque rôle peut faire |

### Ses tâches, pas à pas

**A. Mettre l'école en place avant la rentrée** ✅
1. *Paramètres → Profil établissement* : nom, coordonnées, logo, devise.
2. *Cycles de l'établissement* : cocher les cycles proposés. Le menu de tout le monde s'adapte.
3. *Années académiques* : créer l'année, choisir **trimestres** (3 périodes) ou **semestres** (2), fixer les dates. Une année ne mélange pas trimestres et semestres, et ses périodes ne se chevauchent pas.
4. *Niveaux d'étude*, puis les **classes** de chaque niveau. Une classe ne peut être créée que pour un cycle que l'école propose.
5. *Matières & évaluations* : les matières de chaque classe et leurs **coefficients** ; les **types d'évaluation** et leur rôle dans la moyenne.
6. *Règles de l'établissement* : la **formule de la moyenne** de matière et de la moyenne annuelle (la règle officielle du Bénin est proposée par défaut), les mentions, le rang de promotion, et si les enseignants peuvent écrire leur propre formule (chapitre 3.8).
7. *Modules* : activer ce que l'école utilise (finance, cantine, transport…).
8. *Finance → Configuration des frais* : scolarité, inscription… (chapitre 9.1).

**B. Créer les comptes de l'équipe** ✅
1. *Enseignants → Nouvel enseignant* (ou import d'une liste d'enseignants) : nom, e-mail, matière.
2. Le mot de passe provisoire s'affiche une seule fois : le remettre à l'enseignant.
3. Dans les **classes**, attribuer à chaque matière son enseignant. C'est ce qui donne à l'enseignant l'accès à cette classe et à cette matière.
4. Créer de la même façon la direction, le comptable et le personnel.

**C. Inscrire les élèves et relier les familles** ✅
1. *Élèves → Inscrire un élève*, ou *Importer* une liste (élèves, parents, classes : jusqu'à 500 lignes par import ; un import est enregistré en entier ou pas du tout).
2. Les comptes élèves et parents sont créés avec des mots de passe provisoires ; un fichier des identifiants peut être téléchargé lors d'un import.
3. Pour qu'un parent voie son enfant, il faut un **lien vérifié** : depuis la fiche de l'élève, générer un **code de liaison** (8 caractères, usage unique, valable 14 jours) et le remettre au parent, qui le saisit avec le matricule de l'enfant (17.10).

**D. Pendant l'année** ✅
- Suivre l'accueil : présence, paiements à valider, alertes.
- Publier des **annonces** (*Nouvelle annonce* sur l'accueil).
- Consulter les **analyses** et les élèves à risque (chapitre 14).

**E. En fin de période** ✅
1. *Notes & bulletins → Conseils de classe* : choisir la classe et la période, examiner rangs, moyennes, incidents et décisions proposées.
2. **Valider le conseil** : confirmation demandée, puis « Conseil validé · notes figées ». Les notes, les coefficients et les règles de calcul de cette période sont figés (chapitre 5.4).
3. *Bulletins* : choisir classe, période, élève ou toute la classe, **Imprimer ou enregistrer en PDF**.

**F. En fin d'année** ✅
- Passage en classe supérieure et orientation (chapitre 7).
- **Clôturer l'année** : plus aucune note, présence ou évaluation ne peut être écrite sur cette année. Seule l'administration peut rouvrir une année clôturée.

### Ce qui lui est réservé ✅
Avec le responsable de réseau, c'est le seul à pouvoir **supprimer** des comptes, des frais, des opérations financières, des paiements, des notifications et des dossiers d'orientation.

### Ce qu'il ne fait pas ✅
Il **ne saisit pas de notes** et n'écrit pas la formule d'une matière à la place de son enseignant.

---

## 17.6 Direction (directeur, directeur des études, censeur)

### Comment elle obtient son compte ✅
Créée par l'administrateur de l'école (ou de la plateforme, ou du réseau).

### Son écran et son menu ✅
**Identiques à ceux de l'administrateur de l'école** (17.5) : même accueil, même menu, mêmes manques 🔧.

### Ce qui la distingue de l'administrateur ✅
- Mêmes droits de consultation et de gestion, **sans les suppressions** (17.5).
- Peut créer des comptes enseignant, personnel, élève et parent, mais **pas de comptable**.
- C'est elle qui **valide le conseil de classe**.
- Le **directeur des études (censeur)** **approuve ou refuse les corrections de notes** après une réclamation.

### Ses tâches propres, pas à pas

**Approuver une correction de note** ✅ (chapitre 6)
1. *Notes & bulletins → Réclamations* : la liste des corrections en attente (ancienne note → note proposée, raison donnée par l'enseignant).
2. **Approuver** : la note est modifiée, les moyennes, rangs et bulletins sont recalculés.
3. Ou **Refuser** : une raison est obligatoire ; la note ne change pas.
4. Une correction ne se traite qu'une fois, et celui qui la propose ne peut pas l'approuver lui-même.

**Régler le calcul des moyennes** ✅
*Paramètres → Règles de l'établissement* : formule de matière, formule annuelle, mentions, autorisation donnée ou non aux enseignants d'écrire leur propre formule. Un changement de règle relance le recalcul de toute l'école en arrière-plan ; les périodes déjà validées en conseil gardent leurs règles gelées.

---

## 17.7 Enseignant

### Comment il obtient son compte ✅
1. Sa **première école** le crée (*Enseignants → Nouvel enseignant*) : cette école devient son **école principale**.
2. Le mot de passe provisoire lui est remis.
3. Première connexion : il choisit son mot de passe et accepte les conditions.
4. Il ne voit rien tant que l'école ne lui a pas **attribué de classes** : c'est l'attribution d'une matière dans une classe qui lui en donne l'accès.

### Son écran d'accueil ✅
- **Chiffres clés** : mes classes, mes élèves, moyenne, élèves à suivre.
- **Ma journée** : les cours du jour (matière · classe), chacun avec deux boutons, **Appel** et **Notes**.
- **Moyennes de mes classes**.
- **À surveiller** : élèves en difficulté ou en baisse, avec accès à leur dossier.
- **Actions rapides** : Faire l'appel, Saisir des notes, Cahier de textes, Mes élèves, Emploi du temps, Messages.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Mes classes | l'écran d'accueil |
| Mes élèves | les élèves de ses classes, leur dossier |
| Saisie de notes | créer une évaluation et saisir les notes |
| Cahier de textes | le contenu des cours, classe par classe |
| Appel du jour | faire l'appel |
| Emploi du temps | ses cours de la semaine |
| Messages | messagerie avec les familles et l'équipe |

Par la recherche rapide : *Faire l'appel*, *Saisir des notes*, *Signaler à la cellule d'écoute*.

### Ses tâches, pas à pas

**A. Faire l'appel** ✅ (chapitre 8.1)
1. *Appel du jour* (ou le bouton **Appel** d'un cours dans *Ma journée*).
2. Choisir la classe et la date.
3. Marquer chaque élève : **P** présent, **R** en retard, **E** excusé, **A** absent. Un appel « tous présents » s'enregistre tel quel.
4. Enregistrer. Les familles d'un élève **qui devient** absent ou en retard sont prévenues une seule fois (notification et e-mail, ou SMS si la famille n'a pas de compte et si l'école l'a configuré).

**B. Créer une évaluation et saisir les notes** ✅ (chapitre 4)
1. *Saisie de notes* : choisir la **classe**, la **matière** (seulement les siennes) et la **période**.
2. **Créer une évaluation** : titre (facultatif), date, **barème** (sur 20, 10, 40…), **type** (interrogation, devoir, composition…).
3. Saisir la note de chaque élève : entre 0 et le barème, au plus deux chiffres après la virgule, et au pas choisi par l'école (par exemple au quart de point).
4. Pour un élève qui n'a pas de note : le marquer **absent** (compte 0 si l'absence n'est pas justifiée) ou **absent justifié** avec un **motif** (la note est retirée du calcul).
5. **Enregistrer**. Pendant la saisie, le travail est gardé comme **brouillon** sur l'appareil : s'il est interrompu, il est proposé à la reprise.
6. Les moyennes, les tableaux de bord et l'espace des familles sont mis à jour.

**C. Choisir la formule de sa matière** ✅ (si l'école le permet, chapitre 3.8)
1. Dans *Saisie de notes*, la carte **« Formule de ma matière »** montre la formule en vigueur et un exemple chiffré.
2. Écrire sa formule (par exemple « composition comptée deux fois »). Elle est vérifiée avant d'être acceptée : une formule qui ne donne pas 20 quand toutes les notes valent 20, ou qui sort de 0 à 20, est refusée.
3. Elle s'applique à **sa matière dans cette classe**, pour tous ses élèves. Les moyennes de la période en cours sont recalculées ; les périodes validées en conseil gardent la formule de l'époque.
4. Revenir à la formule de l'école à tout moment.

**D. Adapter le calcul pour un élève** ✅ (si l'école le permet, chapitre 4.3)
Pour un élève précis, dans une matière et une période : ne pas compter une note, ou appliquer une formule particulière. Un **motif est obligatoire**, et c'est possible seulement **avant** le conseil de classe. Le bulletin le signale par un astérisque.

**E. Corriger une note**
- **Avant le conseil** ✅ : il corrige directement dans *Saisie de notes*. Chaque changement est enregistré dans l'historique (ancienne et nouvelle valeur, date).
- **Après le conseil** ✅ : la période est figée. Après le rendez-vous avec l'élève et l'examen de la copie, il ouvre *Notes → Réclamations*, choisit la classe, l'évaluation et l'élève, saisit la correction et sa raison. Le directeur des études l'approuve ou la refuse (chapitre 6).

**F. Cahier de textes, devoirs, ressources** ✅ (chapitre 12)
- *Cahier de textes* : ce qui a été fait en cours.
- *Devoirs* : consignes et date de remise ; les élèves les voient et rendent leur travail.

### Ce qu'il ne peut pas faire ✅
- Voir ou noter une classe ou une matière qui ne lui est pas attribuée.
- Modifier une note après le conseil autrement que par une réclamation approuvée.
- Approuver lui-même une correction.
- Changer les règles de calcul de l'école.

### S'il enseigne dans plusieurs écoles ✅
1. Son compte est créé par sa première école : c'est son **école principale**.
2. Une deuxième école qui l'embauche **ne recrée pas** de compte. Sa direction ouvre *Enseignants* → *Enseignants d'autres établissements* → **Créer un code** : un code de 10 caractères (ex. K7M2Q-PRXA9), à usage unique, valable 7 jours, **affiché une seule fois**. Elle le remet à l'enseignant.
3. L'enseignant, connecté, ouvre *Mon profil* → **Mes établissements**, saisit le code → **Rejoindre**. L'école s'ajoute à ses écoles. Les essais de code sont limités (10 par quart d'heure).
4. Le **sélecteur d'école** du menu lui permet de passer d'une école à l'autre (bouton **Ouvrir** dans *Mes établissements*). Dans chaque école, il ne voit que les classes que cette école lui a attribuées.
5. Il peut **quitter** une école (sauf son école principale) ; la direction peut le **retirer** (*Retirer* dans la même rubrique). Ses cours dans cette école lui sont alors retirés ; l'historique des notes reste intact. Chaque arrivée et chaque départ sont tracés.
6. La direction de B ne voit que ce qui concerne son école. Si elle tente de créer un compte avec l'e-mail d'un enseignant déjà inscrit ailleurs, un message neutre l'oriente vers le code d'invitation.
7. L'enseignant tient lui-même ses **disponibilités** (*Mon profil* → *Mes disponibilités*) : une seule grille pour toutes ses écoles, sans nommer d'école. Chaque école la voit pour construire son emploi du temps.
8. Un code non utilisé peut être **révoqué** ; au plus 20 codes circulent en même temps par école.

---

## 17.8 Comptable

### Comment il obtient son compte ✅
Créé par l'administrateur de l'école (la direction ne peut pas créer de comptable).

### Son écran d'accueil ✅
L'accueil de l'établissement, **orienté finance** : chiffres clés, et actions rapides **Encaisser un paiement**, **Valider les paiements**, **Avis de paiement**, **Suivi des impayés**, **Comptabilité**.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Vue d'ensemble | l'accueil orienté finance |
| Élèves | retrouver un élève et sa famille |
| Finance | frais, encaissements, plans de paiement, bourses, relances, rapprochement, exports |
| Portefeuille | comptes déclarés par l'école (banque, Mobile Money, caisse) et soldes calculés sur les encaissements validés |
| Comptabilité OHADA | les écritures en partie double |
| Paramètres | son compte |

Par la recherche rapide : *Saisie comptable OHADA*.

### Ses tâches, pas à pas (chapitre 9)

**Encaisser un paiement au guichet** ✅
1. *Finance → Nouvel encaissement* (ou *Encaisser* depuis la fiche de l'élève).
2. Choisir l'élève, le frais, le montant et le mode : espèces, MTN Mobile Money, Moov Money, virement, chèque, autre.
3. Le montant ne peut pas dépasser le **reste à payer** du frais.
4. Enregistrer : le paiement reçoit une référence ; un **reçu** PDF peut être téléchargé.

**Valider et rapprocher** ✅
- Les paiements en ligne arrivent d'abord **en attente**, puis passent **validés** quand le fournisseur confirme.
- *Rapprochement* : faire correspondre les paiements aux relevés bancaires (« rapproché »).

**Mettre en place un échéancier** ✅ : 2 à 12 mensualités en francs entiers dont la somme tombe juste ; les bourses sont déduites avant le découpage.

**Relancer et informer** ✅ : avis de paiement par lot, relances automatiques des retards.

**Tenir la comptabilité** ✅ : *Comptabilité OHADA*, chaque écriture équilibrée (total des débits = total des crédits), montants en francs entiers.

### Ce qu'il ne fait pas ✅
Il ne voit **pas les notes** ni les dossiers scolaires détaillés ; il consulte les élèves seulement pour retrouver une famille.

🔧 Points sensibles encore ouverts : voir chapitre 9.12 (numérotation continue des reçus, conservation des pièces après suppression d'un compte, contrôle du montant et de la devise de certaines confirmations en ligne).

---

## 17.9 Personnel (secrétariat, surveillance, vie scolaire)

### Comment il obtient son compte ✅
Créé par l'administration ou la direction.

### Ce qu'il peut faire ✅ (selon les modules activés)
Consulter les élèves et les comptes ; intervenir sur la vie scolaire et la discipline, les badges et le contrôle d'accès, le transport, les clubs, les imports de listes ; créer des comptes **élève** et **parent**.

### Son écran et son menu
- ✅ Accueil de l'établissement (comme la direction).
- ✅ Menu : *Accueil*, *Vie scolaire* (qui ouvre le **calendrier**), *Paramètres*.

### 🔧 Ce qui manque
Ses écrans de travail (discipline et incidents, badges, transport, clubs, imports) **ne figurent ni dans son menu ni dans les actions de la recherche rapide**. Il doit y accéder par leur adresse ou par des liens d'autres pages. Le menu du personnel est à compléter.

---

## 17.10 Parent

### Comment il obtient son compte ✅
1. L'école crée son compte : à l'inscription de l'enfant ou par un **import** de liste de parents.
2. Il reçoit ses identifiants provisoires, puis à la première connexion choisit son mot de passe et accepte les conditions.

### Relier son enfant : le code de liaison ✅
Un compte parent **ne voit aucun enfant** tant que le lien n'est pas vérifié.
1. L'école génère un **code de liaison** depuis la fiche de l'élève et le remet au parent. Le code compte 8 caractères, sans lettres ni chiffres qui se confondent ; il est à usage unique et valable 14 jours.
2. Le parent, connecté, saisit le **matricule** de l'enfant et ce **code**.
3. Si le code est juste, non expiré et pas encore utilisé, l'enfant apparaît dans *Mes enfants*. Le code est alors consommé.
4. Sans code valable, aucun rattachement n'est possible, même en connaissant le matricule.

### Son écran d'accueil ✅
- **Chiffres clés** : enfants suivis, **reste à payer**, **prochaine échéance**, présence.
- **Mes enfants** : une carte par enfant, avec **Voir le détail**.
- **À surveiller** : ce qui demande son attention.
- **Actions rapides** : Payer en ligne, Mes enfants, Cahier de liaison, Emploi du temps, Notifications, Assistant.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Accueil | l'écran ci-dessus |
| Mes enfants | les notes et moyennes de chaque enfant (comme au bulletin), ses bulletins, ses devoirs, son dossier |
| Cahier de liaison | les échanges avec l'école, enfant par enfant |
| Assiduité | les absences et retards ; **justifier** une absence |
| Paiements | ce qui est dû, ce qui est payé, **payer en ligne** |
| Emploi du temps | les cours de ses enfants |
| Mon compte | son profil et ses préférences |

Par la recherche rapide : *Payer les frais*, *Justifier une absence*, *Signaler à la cellule d'écoute*.

### Ses tâches, pas à pas

**Suivre les notes** ✅
1. *Mes enfants* → choisir l'enfant (s'il en a plusieurs).
2. Les notes par matière, la moyenne de chaque matière et la moyenne générale, **exactement celles du bulletin**, pour « Toute l'année » ou une période.
3. Ouvrir le bulletin officiel quand il est publié.

**Contester une note** ✅ (chapitre 6)
1. À côté de la note, **Réclamation · prendre rendez-vous**.
2. Choisir la date et l'heure. L'enseignant de la matière est retrouvé automatiquement ; un créneau passé ou déjà pris est refusé. Le rendez-vous rappelle d'apporter la copie.
3. La copie est examinée en présentiel. Si une erreur est confirmée, l'enseignant propose la correction et le directeur des études la valide.

**Justifier une absence** ✅
*Assiduité* → l'absence → **Justifier** : un motif et, s'il le souhaite, une pièce (certificat…). L'école la retrouve dans ses justifications.

**Payer en ligne** ✅ (chapitre 9.3)
1. *Paiements* (ou **Payer en ligne** sur l'accueil).
2. Choisir le frais : le montant est plafonné au reste à payer.
3. Payer par MTN Mobile Money ou FedaPay (MTN, Moov, Celtiis), si l'école l'a configuré. Le paiement reste « en attente » jusqu'à la confirmation du fournisseur, puis devient « validé ».
4. Si le paiement en ligne n'est pas configuré, l'application le dit clairement : on paie alors au guichet.

### Ce qu'il ne peut pas faire ✅
Voir un enfant qui n'est pas relié à son compte par un code ; voir les notes d'autres élèves ; voir le classement nominatif de la classe (il voit le **rang** de son enfant, sans aucun autre nom).

### Enfants dans plusieurs écoles
- ✅ Un parent peut être relié à des enfants inscrits dans des écoles différentes.
- 🔧 Il n'a pas encore de sélecteur d'école à portée de main : celui prévu pour les enseignants (17.7) servira aussi aux parents.

---

## 17.11 Élève

### Comment il obtient son compte ✅
Créé par l'école à l'inscription (un par un ou par import), avec un mot de passe provisoire remis à l'élève ou à sa famille. Première connexion : nouveau mot de passe, conditions acceptées.

### Son écran d'accueil ✅
- **Chiffres clés** : **ma moyenne**, **mon rang**, présence, matières notées.
- **Mes moyennes par période**.
- **Mes matières**.
- **Actions rapides** : Mes notes, Devoirs, Emploi du temps, Mon orientation, Messagerie, Assistant.

### Son menu ✅
| Entrée | Ce qu'on y fait |
|---|---|
| Mon tableau | l'écran d'accueil |
| Mes notes | ses notes et moyennes, exactement celles du bulletin ; « Toute l'année » ou une période ; meilleure matière |
| Devoirs | les devoirs à faire, avec la date de remise ; **rendre son travail** |
| Emploi du temps | ses cours |
| Mon assiduité | ses absences et retards |
| Mon orientation | la série proposée au vu de ses moyennes (lycée), ou ses repères pour le CEP et le BEPC (chapitre 7) |
| Messagerie | ses messages |

Par la recherche rapide : *Signaler à la cellule d'écoute* (signalement qui peut être **anonyme**, sans aucun lien avec son compte).

### Ses tâches, pas à pas

**Consulter ses notes** ✅
1. *Mes notes* : la moyenne générale (pondérée par les coefficients), le nombre de notes, la meilleure matière, puis une ligne par matière.
2. Choisir une période pour la détailler.

**Contester une note** ✅ : **Réclamation · prendre rendez-vous** à côté de la note (comme le parent, 17.10). Le rendez-vous associe sa famille.

**Rendre un devoir** ✅ : *Devoirs* → le devoir → déposer son travail avant la date de remise.

**Passer un examen en ligne** ✅ (si l'école en propose, chapitre 12.4).

### Ce qu'il ne peut pas faire ✅
Voir les notes ou le dossier d'un autre élève ; voir le classement nominatif de sa classe (il voit son propre rang).

---

## 17.12 Changer d'école : où en est-on ?

| Qui | Plusieurs écoles possibles ? | Comment il passe de l'une à l'autre |
|---|---|---|
| Administrateur de la plateforme | toutes les écoles | ✅ choisit l'école étudiée dans *Analyses* et dans les écrans de gestion |
| Responsable de réseau | les écoles de son réseau | ✅ sélecteur d'école du menu et de la page *Analyses* |
| Enseignant | oui (rattachements, code d'invitation) | ✅ sélecteur d'école et *Mes établissements* (17.7) |
| Parent | oui (enfants dans plusieurs écoles) | ✅ il navigue **par enfant** : chaque enfant ouvre sa propre école, sans école active à choisir |
| Autres rôles | une seule école | — |

Garanties déjà en place ✅ :
- en changeant d'école, **aucune donnée de l'école précédente** ne reste affichée : l'écran et les informations gardées en mémoire sont rechargés pour la nouvelle école ;
- un enseignant rattaché à deux écoles ne voit, en base de données comme à l'écran, **que l'école ouverte** ;
- la liste des écoles d'un compte est recalculée à chaque changement : on ne peut ouvrir qu'une école à laquelle on est réellement rattaché.

---

## 17.13 Récapitulatif des manques relevés 🔧

| Rôle | Manque | Effet |
|---|---|---|
| Personnel | badges, transport, clubs et imports absents du menu | atteignables par leur adresse ou les modules ; son menu offre accueil, appel, élèves, annonces, incidents, vie scolaire, paramètres |
| Plateforme | installation sans jeton | à faire avant l'ouverture au public (17.3) |
