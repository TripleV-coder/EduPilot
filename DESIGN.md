---
name: EduPilot
description: Gestion scolaire multi-établissements pour le Bénin — colorée, aérée et simple, dans l'esprit Google Classroom.
colors:
  ink-blue: "#2563EB"
  ink-blue-deep: "#1D4ED8"
  ink-blue-light: "#3B82F6"
  ink-blue-wash: "#EFF6FF"
  ink-blue-rule: "#BFDBFE"
  amber-mark: "#B7791F"
  module-blue: "#1A73E8"
  module-green: "#188038"
  module-orange: "#B45309"
  module-purple: "#7E3BD6"
  module-pink: "#C2185B"
  module-teal: "#0E7490"
  page: "#F8FAFC"
  card: "#FFFFFF"
  sunken: "#F1F5F9"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-tertiary: "#5B6776"
  border-subtle: "#E2E8F0"
  success: "#059669"
  success-wash: "#ECFDF5"
  success-rule: "#A7F3D0"
  warning: "#D97706"
  warning-wash: "#FFFBEB"
  warning-rule: "#FDE68A"
  danger: "#DC2626"
  danger-wash: "#FEF2F2"
  danger-rule: "#FECACA"
  dark-page: "#0B1220"
  dark-card: "#111827"
  dark-text-primary: "#F1F5F9"
  dark-text-secondary: "#CBD5E1"
  dark-text-tertiary: "#8794AA"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  chip: "8px"
  input: "12px"
  soft: "16px"
  card: "22px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.input}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.input}"
    height: "40px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.input}"
    height: "40px"
  callout-success:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success}"
    rounded: "{rounded.card}"
  callout-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
    rounded: "{rounded.card}"
  chip:
    backgroundColor: "{colors.ink-blue-wash}"
    textColor: "{colors.ink-blue-deep}"
    rounded: "{rounded.chip}"
---

<!-- Tokens source : src/styles/edupilot-tokens.css (préfixe --eduflow-*, rampe --brand-*) et
     src/app/globals.css (variables shadcn HSL). Ce fichier documente ; les CSS font foi. -->

## Overview

**Direction approuvée (2026-09-23) : « colorée et vivante », priorité vue d'ensemble** — références
Google Classroom (aéré, cartes de classes à bandeau coloré, navigation simple) et Notion/Linear
(typographie nette, clavier). Historique et captures : `docs/design/directions/direction-approved.md`.

EduPilot doit donner envie de s'en servir chaque jour : clair, aéré, coloré sans être criard, et
toujours honnête — chaque chiffre vient de l'API, jamais d'un exemple. Public : directions,
enseignants, parents et élèves béninois, souvent sur Android d'entrée de gamme et réseau lent — texte
≥ 11 px, pages vérifiées à 375 px, actions à 1 clic.

Anti-références : template SaaS générique (cartes de chiffres identiques avec dégradé, eyebrows en
capitales), glassmorphism et halos flous décoratifs, ERP scolaire daté (tableaux gris sans hiérarchie).

Espacement : grille de 4 px, blocs de 24 px d'écart et 24 px de marge interne ; contenu ≤ 1400 px.

## Colors

- **Bleu d'encre** (`#2563EB`, `--brand-600`) : l'unique couleur d'action. On le réserve aux CTA primaires, à la sélection courante et aux liens. Au survol ou à l'appui, il passe à `#1D4ED8`.
- **Marque ambre** (`--accent`, ambre sobre) : rare, pour un engagement secondaire. Jamais en fond de grande surface.
- **Neutres ardoise** (slate) : la page est en `#F8FAFC`, les cartes en blanc et les zones en retrait en `#F1F5F9`. Le texte suit trois niveaux : primaire `#0F172A`, secondaire `#475569`, tertiaire `#5B6776` (au moins 5,2:1 sur toutes les surfaces claires).
- **Sémantique** : succès, avertissement, danger et info disposent chacun d'une rampe de 50 à 900. Un statut se compose d'un fond `-50`, d'un filet `-200` et d'un texte `-700/-800`. Le statut n'est jamais porté par la couleur seule : on ajoute toujours une icône ou un libellé.
- **Mode sombre** (`.dark`) : page `#0B1220`, cartes `#111827`, texte tertiaire `#8794AA` (au moins 4,5:1, y compris sur `#1E293B`).
- **Couleurs de module** (`--edu-module-*`, texte blanc ≥ 4,5:1) : bleu = scolarité/présences,
  vert = notes, orange = finances, violet = communication, rose = bulletins/examens, sarcelle =
  inscriptions. Elles colorent les icônes d'action, les bandeaux de classe et les pastilles des chiffres —
  jamais de grands aplats de page.
- Les dégradés sont réservés à la seule variable `--gradient-cta`, et à des usages rares. Pas de texte en dégradé, pas de halos flous en fond.

## Typography

Une seule famille, **Figtree** (chargée une fois par `next/font`, variable `--font-body`), avec un léger resserrement global (−0,01 em). **JetBrains Mono** sert aux identifiants et aux données alignées. L'échelle est fixe, pas fluide, conformément au register produit :

| Rôle | Taille | Graisse | Usage |
|---|---|---|---|
| display | 22 px | 700 | titre de page |
| title | 18 px | 600 | titre de section ou de carte |
| body | 14 px | 400 | texte courant, cellules de tableau |
| body-sm | 13 px | 400 | descriptions, aides |
| label | 11 px | 500 | libellés, badges : **plancher absolu** |

Les chiffres (notes, montants FCFA, pourcentages) s'affichent en `tabular-nums`. Les titres restent droits, jamais en italique. Les capitales espacées sont réservées aux en-têtes de tableau et ne servent pas d'eyebrow au-dessus de chaque section. Les montants et nombres sont formatés en `fr-FR`.

## Elevation

Le système est à plat, avec de la profondeur tonale. La hiérarchie vient d'abord des surfaces (page, puis carte, puis zone en retrait) et des filets `--eduflow-border-*`. Les ombres restent douces et ambiantes :

- `--eduflow-shadow-sm` : cartes au repos (filet de 1 px et ombre de 2 px).
- `--eduflow-shadow-card` : cartes interactives au survol.
- `--eduflow-shadow-overlay` : dialogues, menus et popovers, sur fond `--eduflow-overlay`.

Pas de flou décoratif. `backdrop-filter` n'est admis que sur les voiles de dialogue et de tiroir.

Mouvement : 80 à 280 ms (`--eduflow-motion-*`), courbe `--eduflow-ease-out`. Le mouvement ne sert qu'à signaler un changement d'état. Pas de rebond. `prefers-reduced-motion` est neutralisé globalement.

## Components

Les primitives vivent dans `src/components/edu/` : Button, Card, Input, Badge, Chip, Spinner, Toast, MetricCard. `src/components/ui/` contient les composants shadcn, re-skinnés avec les mêmes tokens. On réutilise avant de créer.

- **Boutons** : 40 px de haut, rayon 12 px. Variante primaire en bleu d'encre, secondaire et outline sur blanc, destructive en danger. Chaque bouton gère ces états : défaut, survol, focus visible (anneau `--eduflow-focus-ring`), actif, désactivé, chargement (`<Spinner size={16} />` dans le bouton).
- **Cartes** : rayon 22 px, fond blanc, `shadow-sm`. Jamais de carte dans une carte.
- **Callouts** (succès, erreur) : fond `-50`, **bordure pleine de 1 px** en `-200`, icône et texte `-700/-800`. Pas de barre latérale colorée.
- **Champs** : rayon 12 px, libellé visible, erreur sous le champ.
- **États de page** : `PageLoading` et squelettes pour le chargement (pas de spinner au milieu du contenu). `PageError` avec « Réessayer ». `PageEmpty`, qui explique quoi faire. On n'affiche jamais de zéros ou de données inventées pendant un chargement ou après une erreur.
- **Confirmation** : `ConfirmActionDialog` pour les actions destructives, jamais `window.confirm`. Retour d'action par toast sonner, jamais `alert`.
- **Accueil direction** (`edu-homes/DirectorHome`) : Vue d'ensemble (4 chiffres cliquables à pastille de couleur, état vide qui guide si aucun élève), puis À surveiller + Actions rapides (tuiles à icône colorée), puis Mes classes (bandeaux pleins façon Classroom menant à la fiche).
- **Navigation** : `edu-shell` (barre latérale blanche façon Classroom : liens de 44 px collés au bord gauche, élément actif en pastille bleu doux arrondie à droite ; barre du haut, navigation mobile, palette de commandes). La configuration canonique est `role-nav.ts`, groupée par rôle puis par cycle.

## Do's and Don'ts

**À faire**
- Des chiffres réels, ou un état vide honnête. Chaque indicateur doit provenir de l'API.
- Vérifier chaque écran à 375 px et au clavier. Les actions masquées au survol restent visibles au focus et sur mobile (`md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100`).
- Vérifier `res.ok` sur chaque mutation et signaler l'échec. On n'affiche jamais « enregistré » sur une erreur.
- Utiliser les tokens `--eduflow-*` et `--brand-*` plutôt que des hex en ligne.

**À éviter**
- Métriques, tendances, logos clients ou témoignages inventés. C'était le cas de l'ancien « +12,5 % vs mois dernier » et des sigles du hero.
- Faux chrome : barres de navigateur ou cadres de téléphone redessinés.
- Texte sous 11 px, texte en dégradé, glassmorphism décoratif, easing à rebond.
- Barres latérales colorées sur les cartes et les callouts.
