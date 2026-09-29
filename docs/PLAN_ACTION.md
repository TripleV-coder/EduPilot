# EduPilot — Plan d'action

_Établi le 29 septembre 2026, branche `feat/refonte-coloree-et-securite` (poussée sur GitHub, pas encore fusionnée dans `main`)._

Sources : recette filmée du 28/09/2026 (`recette-videos/RAPPORT.md` : 111 scénarios, 1 177 actions, **88 échecs**, **47 anomalies distinctes**) et mesure du code du 29/09/2026 (177 pages).

---

## 1. Ce que tu dois faire maintenant

Ces points dépendent de toi. Tant qu'ils ne sont pas tranchés, ils bloquent une partie du travail.

| # | Action | Pourquoi | Ce que ça débloque |
|---|---|---|---|
| 1 | **Valider l'approche « design homogène »** (section 2) | Chantier le plus large : toutes les pages sont touchées | Tout le chantier design |
| 2 | **Décider : fusionner la branche dans `main`** (via une PR, recommandé) | 20 commits, dont des correctifs de sécurité, ne sont que sur la branche : `main` (et donc ce qui est déployé depuis `main`) ne les a pas | Mise en production des correctifs |
| 3 | **Trancher le cas « parent avec des enfants dans deux établissements »** | Aujourd'hui la session ne porte qu'un établissement à la fois, et la base filtre les données par établissement (RLS). Il faut choisir : sélecteur d'établissement dans la session, ou compte parent par établissement | Parcours parents du réseau Les Cocotiers |
| 4 | **Trancher les règles métier en attente** | Je ne peux pas les inventer | Voir liste ci-dessous |
| 5 | **Relancer la recette complète** une fois les lots ci-dessous faits | Seule preuve que les correctifs tiennent de bout en bout | Clôture du plan |

Règles métier à trancher (point 4) :
- **Devoirs surveillés** : plafond de 2 par période ? Bloquant ou simple avertissement ? (la recette attendait un refus du 3ᵉ)
- **Bulletins retenus si impayé** : oui/non, et à partir de quel montant ?
- **Appel par créneau horaire** ou appel à la journée ?
- **Passage CM2 → 6ᵉ** : même établissement ou transfert vers un autre site ?
- **Transferts d'élèves entre sites** d'un même réseau.
- **Connexion par téléphone/SMS** (sans adresse e-mail).
- **Mode hors ligne** : quel périmètre (appel ? notes ?).
- **Paiement en ligne parent** : quelle passerelle activer en production (FedaPay, MTN MoMo, les deux) ? Sans passerelle configurée, le bouton « Payer » ne peut pas apparaître.

---

## 2. Chantier « design homogène, sans mélange »

**Objectif :** toutes les pages dans un seul langage visuel, celui de la référence Classroom (`docs/design/directions/live/`, `DESIGN.md`).

**Constat mesuré (29/09) :**
- environ 30 pages suivent la mise en page Classroom (bandeaux colorés, listes « Personnes », blocs « Vue d'ensemble », menus ⋮) ;
- **108 pages** utilisent encore les anciens composants génériques (`src/components/ui/*`, repeints aux couleurs mais avec leur mise en page d'origine) et les icônes Lucide ;
- 46 pages n'utilisent ni l'un ni l'autre et restent à vérifier à l'œil (connexion, pages publiques, IA, RH, transport…).
- Cause : le kit Classroom (`src/components/edu/`, `src/components/edu-homes/`) n'a ni formulaires, ni fenêtres de dialogue, ni tableaux, ni onglets, ni listes déroulantes. Chaque page qui en a besoin retombe sur l'ancien kit.

**Plan en 3 étapes :**

1. **Une seule bibliothèque.**
   - Compléter le kit Classroom : en-tête de page en bandeau, champs de formulaire, liste déroulante, fenêtre de dialogue / panneau, liste-tableau, onglets, menu ⋮, états vide / chargement / erreur.
   - Réécrire `src/components/ui/*` pour qu'ils rendent exactement ce style (un seul rendu possible).
   - Remplacer les icônes Lucide par le jeu d'icônes maison (`src/components/edu/icon.tsx`, à compléter).
2. **Quatre modèles de page**, et chaque page rangée dans l'un d'eux : **liste**, **fiche détail avec bandeau**, **formulaire**, **vue d'ensemble**. Par lots, un commit par lot :
   - Lot 1 : assiduité, notes, examens, devoirs, fiche élève
   - Lot 2 : finance (frais, encaissement, rapprochement, rapports, bourses)
   - Lot 3 : incidents, santé/infirmerie, orientation, cours, bibliothèque, cantine, transport
   - Lot 4 : réglages (≈ 20 pages)
   - Lot 5 : console super-admin (≈ 15 pages), connexion / mot de passe / 2FA, pages publiques
3. **Verrou anti-retour.**
   - Règle ESLint : interdire `lucide-react` et les imports directs hors kit dans `src/app/**`.
   - Planches de captures de toutes les pages (ordinateur + mobile 375 px, clair + sombre) à comparer à `live/`.

**Vérification à chaque lot :** typecheck, lint, tests, build, captures avant/après.

---

## 3. Problèmes trouvés en recette — quoi faire

Légende du statut :
- ✅ **Corrigé dans le code**, à reconfirmer par la prochaine recette.
- 🔧 **À corriger** : l'action à mener est décrite.
- ❓ **À diagnostiquer** : la cause n'est pas encore établie.
- 🟡 **Attend ta décision** (section 1).

### 3.1 Sécurité (priorité absolue)

| Problème | Étape | Statut | Quoi faire |
|---|---|---|---|
| Établissement suspendu : la direction continuait à travailler | 13/10 | ✅ 85be333 | Rejouer 13/10 |
| Case « chef d'organisation » pré-cochée pour une annexe → la direction de l'annexe lisait les élèves du site principal (HTTP 200) | 14/08 | ✅ 85be333 | Rejouer 14/08 (attendu : 403/404) |
| 2FA : QR jamais affiché, et tout code aurait été accepté une fois réparé | 13/07 | ✅ 5562313 | Rejouer 13/07 |
| L'enseignante de français se voit proposer « Mathématiques » en saisie de notes | 08/02 | 🔧 | Ne proposer que les matières où `ClassSubject.teacherId` = l'enseignant, **et** refuser côté API une note sur une matière qui n'est pas la sienne |

### 3.2 Boutons morts / fonctions absentes

| Problème | Étape | Statut | Quoi faire |
|---|---|---|---|
| « Ajouter un cycle » / « Ajouter un niveau » sans effet | 02 | ✅ 998d849 | — |
| Panneau « Créer une option » : bouton « Créer » hors écran à 720 px | 02/06 | ✅ 998d849 | — |
| Pas de rôle « Personnel administratif » à la création d'un compte | 03/01 | ✅ 998d849 | — |
| Disponibilités enseignant : `/api/teachers/undefined/...` | 03/07 | ✅ 998d849 | — |
| Frais non modifiable | 05/01 | ✅ 998d849 | — |
| « Nouvelle bourse », « Rapport MEMP » sans effet | 05/01 | ✅ 998d849 | — |
| Assistant d'inscription : on passe l'étape Identité sans champs obligatoires ; matricule en double accepté | 06/01 | ✅ 998d849 | — |
| Appel « Tous présents » impossible à enregistrer | 07/01 | ❓ | Vérifier que le bouton Enregistrer s'active quand aucun statut n'a changé (un appel « tous présents » est un appel valide) ; ajouter un test |
| Courriel d'absence non reçu par le parent | 07/01 | ✅ 755e930 | — |
| Enseignant : formulaire d'incident sans liste d'élèves ni bouton d'envoi | 07/05 | 🔧 | Autoriser l'enseignant sur `incidents/new` pour les élèves de ses classes (liste d'élèves filtrée + API) |
| Infirmerie : dossier médical introuvable, pas de champ groupe sanguin, pas de « passage » | 07/06 | ✅ plantage (5fe2bb5) · ❓ reste | Rejouer : si toujours absents, ajouter la saisie du dossier (groupe sanguin, allergies) et l'enregistrement d'un passage |
| Contrôle d'accès : « Imprimer » inactif ; badge valable jusqu'en 2026 au lieu de 2027 | 07/07 | ✅ 755e930 | — |
| Cellule d'écoute : choix « Enseignant » / « Anonyme » introuvables | 07/08 | ✅ 755e930 | — |
| Parent : pas de demande de rendez-vous | 07/08 | ✅ 755e930 | — |
| Parent : pas de « Justifier » une absence ; direction : rien à valider | 07/03-04 | ✅ 755e930 | — |
| Élève : impossible de rendre un devoir | 08/01 | 🔧 | Bouton « Rendre » sur le devoir (texte + fichier), statut « rendu » visible par l'enseignant |
| Note 25/20 acceptée | 08/02 | 🔧 | Refuser toute note > barème, à l'écran **et** dans l'API |
| 3ᵉ devoir surveillé accepté dans la période | 08/02 | 🟡 | Dépend de la règle DS (section 1) |
| Compétences (primaire) : « Évaluer » sans effet | 08/03 | 🔧 | Brancher « Évaluer » sur la grille de compétences de l'élève |
| Examens : pas d'ajout de questions ; quiz élève planté | 08/06 | ✅ 5fe2bb5 | — |
| « Convocations PDF » sans effet | 08/06 | 🔧 | Générer le PDF des convocations (élève, épreuve, date, salle) |
| Nouveau cours : pas de navigation après publication ; « Ajouter une ressource » n'ouvre rien ; cours introuvable ensuite | 08/07 | 🔧 | Rediriger vers la fiche du cours après création ; brancher le formulaire de ressource ; lister le cours créé |
| Encaissement Mobile Money au guichet (500) | 09/02 | ✅ 5fe2bb5 | — |
| Parent : le « reste dû » compte les frais facultatifs (cantine, tenue) | 09/03 | 🔧 | Ne compter comme dus que les frais obligatoires + les facultatifs souscrits |
| Parent : pas de bouton « Payer en ligne » | 09/03 | 🟡 | Dépend de la passerelle choisie (section 1) ; sans passerelle, afficher une explication plutôt que rien |
| Impayés : échéance passée (examen blanc BEPC) non listée ; pas de « Relancer » | 09/04 | 🔧 | Inclure toute échéance dépassée non soldée ; ajouter l'action « Relancer » (notification + courriel + SMS) |
| « Export comptable standard », « Liste de relance (PDF) » sans effet | 09/04 | 🔧 | Brancher les deux exports (CSV/PDF réels) |
| Rapprochement : pas de champ de dépôt du relevé CSV | 09/05 | 🔧 | Ajouter l'import du relevé (champ fichier + aperçu + rapprochement) |
| Comptabilité OHADA : aucun exercice ouvrable ; compte 60 absent | 09/05 | 🔧 | Permettre d'ouvrir un exercice ; charger le plan de comptes OHADA (classes 1 à 8) |
| Cagnotte : pas de « message groupé » aux familles | 09/06 | ❓ | Le bouton existe dans le code (2026-06-13) : vérifier s'il est masqué par un droit ou un état |
| Annonce : courriel non reçu par le parent | 10/01 | ❓ | Vérifier que la publication d'une annonce ciblée envoie bien le courriel (même piste que l'absence, corrigée en 755e930) |
| Messagerie : pas de « Nouvelle conversation » (et donc ni réponse, ni réception) | 10/02 | 🔧 | Ajouter « Nouveau message » avec choix du destinataire dans le périmètre du rôle |
| « Mot au professeur » (liaison) | 10/02 | ✅ 5fe2bb5 | — |
| WhatsApp : « Démarrer la vérification » sans effet | 10/03 | ❓ | Vérifier la configuration requise ; si non configuré, le dire au lieu d'un bouton inerte |
| Calendrier : la kermesse n'apparaît pas en décembre | 10/04 | ❓ | Vérifier que les événements saisis alimentent la vue mois |
| Cantine : menu du jour saisi non affiché | 10/05 | ❓ | Vérifier enregistrement vs affichage du menu (date / fuseau) |
| Transport : « Nouvelle ligne » et « Liste passagers PDF » sans effet | 10/05 | 🔧 | Brancher le formulaire de ligne et l'export PDF |
| Bibliothèque : pas d'« Emprunter » ni de « Retour » | 10/05 | 🔧 | Ajouter les actions sur la fiche d'un livre (modèles `Book`/`BorrowingRecord` déjà présents) |
| Clubs : pas de « S'inscrire » | 10/05 | 🔧 | Ajouter l'inscription d'un élève à un club (`club_memberships`) |
| Orientation : module non activé mais pas de message ; « Inscrire au CEP » absent | 10/06 | 🔧 | Afficher « module non activé » ; ajouter l'inscription au CEP |
| Import CSV : pas de champ fichier (étapes suivantes impossibles) | 10/07 | 🔧 | Rétablir le dépôt de fichier, la correspondance des colonnes et le rejet de ligne invalide |
| Bulletin : l'appréciation de l'enseignant n'y figure pas | 11/02 | 🔧 | Reporter les appréciations saisies dans le bulletin |
| Familles : aucun accès au bulletin publié | 11/04 | 🔧 | Lien « Bulletin » dans l'espace parent/élève une fois publié |
| RGPD : la demande du parent n'est pas listée côté direction | 15/04 | 🔧 | Lister les demandes RGPD de l'établissement |

### 3.3 Configurations transverses

| Problème | Étape | Statut | Quoi faire |
|---|---|---|---|
| Interface anglaise : textes restés en français (accueil, notes, devoirs, emploi du temps, réglages) | 13/03 | 🔧 | Passer ces écrans par `t()` et compléter `src/lib/i18n/locales/en.json` |
| Module Finance coupé mais encore au menu | 13/04 | ✅ 85be333 | — |
| Cycle lycée retiré : Seconde/Première/Terminale encore proposés | 13/05 | ❓ | 85be333 corrige l'affichage des cycles ; vérifier le filtre des niveaux à la création de classe |
| Maintenance : l'enseignant ne voit pas le message personnalisé | 13/06 | 🔧 | Afficher le message saisi par le super-admin sur l'écran de maintenance |

### 3.4 Erreurs techniques (API en erreur, console)

| Anomalie | Où | Statut | Quoi faire |
|---|---|---|---|
| 60 × 403 `GET /api/schools/context` à la première connexion | 01, 03, 06 | ✅ 998d849 | — |
| 403 signatures / prédictions IA sur la fiche élève | 06 | ✅ 998d849 | — |
| 404 `POST /api/parents/link-child` (enfant de l'annexe) | 06/08 | ✅ 998d849 | — |
| 404 `/dashboard/onboarding` | 06/08 | 🔧 | Retirer ou rediriger le lien vers cette page inexistante |
| 403 `GET /api/classes` pour le parent (assiduité) | 07/03 | ✅ 755e930 (écran famille dédié) | — |
| 500 `GET /api/appointments?status=CANCELLED` | 07/08 | ✅ 5fe2bb5 | — |
| Plantage infirmerie `toLowerCase` | 07/06 | ✅ 5fe2bb5 | — |
| Plantage quiz `reading 'question'` | 08/06 | ✅ 5fe2bb5 | — |
| 500 `POST /api/payments/initiate` | 09/02 | ✅ 5fe2bb5 (503 explicite) | — |
| 400 `POST /api/messages` | 10/02 | ✅ 5fe2bb5 | — |
| 500 `POST /api/auth/mfa/setup` | 13/07 | ✅ 5562313 | — |
| 400 analytics super-admin : `school/overview`, `bi`, `period-comparison` (`academicYearId=ALL`) | 12/01 | 🔧 | Accepter « toutes les années » / « tous les établissements » pour le super-admin, ou ne pas appeler ces routes sans établissement |
| 400 `GET /api/benchmark/latest` | 01/05 | 🔧 | Idem : paramètre manquant en vue plateforme |
| 403 `GET /api/system/backup`, `GET /api/compliance/retention` pour le super-admin | 01/05 | 🔧 | Ouvrir ces routes au super-admin (ou retirer les écrans de sa console) |
| 403 `GET /api/admin/curriculum-config` pour la direction | 04 | 🔧 | Autoriser la direction en lecture, ou masquer l'écran |
| 403 `GET /api/ai/v2/chat` (enseignant et directions primaire / lycée technique) | 12 | ❓ | Module IA non souscrit ? Si oui, masquer l'entrée IA du menu au lieu d'un 403 |
| 403 `GET /api/students` sur la page gamification | 08/08 | 🔧 | Ne pas appeler la liste des élèves pour un rôle qui n'y a pas droit |
| 403 `GET /api/alumni` | 10/06 | ❓ | Vérifier rôle/module ; masquer l'entrée si non autorisé |
| 409 `PATCH /api/schools/:id/levels` (retrait d'un cycle qui a des classes) | 13/05 | ✅ refus voulu, affichage corrigé (85be333) | — |
| 409 `PATCH /api/academic-years/:id/status` à la clôture | 15/02 | ❓ | Vérifier si c'est le garde-fou voulu (conditions de clôture non remplies) et, si oui, afficher la raison à l'écran |

---

## 4. Ordre de travail proposé

1. **Sécurité restante** : matières de l'enseignant en saisie de notes (3.1).
2. **Parcours quotidiens cassés** : appel « tous présents », incident par l'enseignant, rendu de devoir, note > barème, messagerie, bulletins pour les familles.
3. **Finance** : reste dû, impayés/relances, exports, rapprochement, OHADA.
4. **Services** : cours/ressources, bibliothèque, clubs, transport, cantine, calendrier, import CSV, orientation, RGPD.
5. **Erreurs techniques** 3.4 et anglais / maintenance (3.3).
6. **Design homogène** (section 2) : peut démarrer en parallèle dès ta validation ; les lots réécrivent les mêmes pages, donc les correctifs fonctionnels d'une page sont faits dans le même lot quand c'est possible.
7. **Recette complète** depuis une base vide (`e2e/recette/README.md`), puis PR vers `main`.
