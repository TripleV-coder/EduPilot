# Spec commune — Refonte premium EduPilot (3 directions huashu)

> Entrée unique des trois directions. Chaque prototype ne lit que ce fichier.

## Produit
EduPilot : plateforme SaaS multi-établissements de gestion scolaire pour le Bénin (primaire, collège, lycée ;
examens CEP, BEPC, BAC). Modules réels : scolarité, notes et bulletins, présences, finances (MTN MoMo, Moov,
FedaPay), RH, messagerie parents, cantine, analytics et IA de détection du décrochage.

## Écran témoin
**Accueil du directeur / de la directrice** (`/dashboard`, rôle SCHOOL_ADMIN ou DIRECTOR). C'est l'écran le
plus ouvert de l'app : il pose le ton pour tout le reste. Blocs RÉELS de l'écran actuel (à conserver, pas
d'invention de section) :
1. Salutation + actions « Exporter le rapport », « Nouvelle annonce ».
2. Quatre indicateurs : élèves actifs (+ évolution vs mois dernier), taux de recouvrement (+ FCFA encaissés),
   taux de présence (+ évolution), élèves à risque (+ % en échec).
3. Recouvrement : encaissé / en attente / collecté (FCFA).
4. Élèves à risque : liste nominative, niveau de risque, raison principale, action « voir le plan ».
5. Top classes de la période (moyenne /20).
6. Équipe pédagogique (enseignants, présence du jour).
7. Cantine de la semaine.
Plus la coque : navigation latérale groupée (Pilotage, Scolarité, Finances, Vie scolaire, Communication,
Réglages), barre du haut avec recherche, sélecteur d'établissement, notifications, profil.

## Contenu d'illustration (identique dans les 3 versions)
Établissement « CEG Les Cocotiers — Cotonou » (fictif). Directrice : Mme Adjovi Houngbédji. Année 2025-2026,
2ᵉ trimestre. 1 248 élèves actifs (+3,2 %), recouvrement 82 % (18 450 000 FCFA encaissés sur 22 500 000),
en attente 4 050 000, présence 92,4 % (+1,1 pt), 37 élèves à risque (6,8 % en échec).
Élèves à risque : Koffi Mensah (3ᵉ B, élevé, 9 absences en 3 semaines), Aïcha Sanni (4ᵉ A, élevé, moyenne
math 6,5 → 4,2), Rodrigue Agossou (Tle D, modéré, retard de paiement + baisse de notes), Mariam Bio Tchané
(5ᵉ C, modéré, 4 retards cette semaine). Top classes : Tle C 14,6 ; 3ᵉ A 13,9 ; 1ʳᵉ D 13,2 ; 4ᵉ B 12,8.
Équipe : 64 enseignants, 61 présents. Cantine : 812 repas servis, menu du jour « riz au poisson, sauce
tomate ». **Chaque prototype affiche la mention visible « Données d'illustration ».**

## Utilisateurs et contexte
Direction d'un collège/lycée béninois : pilote l'établissement entre deux réunions, souvent sur un portable
d'entrée/milieu de gamme ou un Android, réseau parfois lent. Français. Doit comprendre en 5 secondes ce qui
demande son attention aujourd'hui et agir en 1 clic.

## Ce que demande le propriétaire (verbatim)
« super beau et interactif et moderne et propre et soigné … premium de niveau entreprise avec la facilité et
la possibilité de faire des trucs en moins de clic possible une accessibilité exceptionnelle … visuellement
attrayant beau et dynamique et facile d'utilisation … qui facilite l'engagement utilisateur ».

## Exigences communes (non négociables, toutes directions)
- **Moins de clics** : palette de commandes (Ctrl/⌘ K) fonctionnelle dans le prototype ; chaque carte
  d'alerte porte son action directe (appeler/écrire au parent, voir le plan) ; actions rapides visibles.
- **Accessibilité exceptionnelle (WCAG 2.2 AA minimum)** : texte courant ≥ 14 px, libellés ≥ 12 px,
  contraste ≥ 4,5:1, focus visible sur tout élément interactif, navigation clavier complète, lien
  d'évitement, landmarks, statuts jamais portés par la seule couleur, cibles ≥ 44 px sur mobile,
  `prefers-reduced-motion` respecté.
- **Dynamique mais utile** : le mouvement signale un état (entrée des données, survol, ouverture de la
  palette, progression) ; 150–300 ms ; aucune animation décorative en boucle.
- **Engagement** : la page doit donner envie d'agir (prochaine action claire, progrès visible, ton humain),
  sans ludification infantile ni fausses métriques.
- Chiffres en `tabular-nums`, format fr-FR, FCFA.
- Responsive : doit rester propre à 390 px (mobile) — la navigation latérale se replie.

## Format de sortie
Un fichier HTML autonome par direction (CSS + JS inline, aucune dépendance obligatoire hormis une Google
Font optionnelle avec repli système). Capture de référence : **1440 × 900** (bureau) et **390 × 844**
(mobile). Pas d'images externes : icônes en SVG inline. Données d'illustration identiques.

## Images
Outil de pilotage : aucune image de contenu nécessaire (décision Phase 3.5). Pas de photos de stock.

## Contraintes de marque
Logo existant (`public/logo.png`), marque « EduPilot ». La palette actuelle (bleu encre #2563EB, ardoise)
peut être conservée, réinterprétée ou remplacée selon la direction — la direction retenue deviendra le
nouveau DESIGN.md. Interdits : texte en dégradé, glassmorphism décoratif, barres latérales colorées sur
cartes, faux chrome de navigateur, émojis comme icônes, métriques inventées présentées comme réelles.

## Hypothèse de motif visuel (form ← contenu)
Le rythme d'une école : la journée (appel du matin, cours, cantine), la semaine, le trimestre ; le
registre et le bulletin comme objets familiers ; l'élève comme personne (prénom, classe, histoire), pas
comme une ligne. Chaque direction doit dire en une phrase d'où vient sa forme.
