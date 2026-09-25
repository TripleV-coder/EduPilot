# Product

## Register

product

## Users
Établissements scolaires béninois (primaire, collège, lycée), en français. Rôles : direction et administration d'école (SCHOOL_ADMIN, DIRECTOR), administrateurs réseau (NETWORK_ADMIN), enseignants, personnel (vie scolaire, comptabilité, cantine), parents et élèves. Usage quotidien : saisie de notes, appel, suivi des paiements, bulletins, messagerie. Une part importante des parents et des enseignants utilise un Android d'entrée de gamme, sur un réseau lent ou intermittent.

## Product Purpose
EduPilot est une plateforme SaaS multi-établissements de gestion scolaire : scolarité, notes et bulletins (CEP/BEPC/BAC), présences, finances (MoMo/FedaPay), RH, communication et analytics. Un écran est réussi quand la tâche principale est évidente, rapide et sûre, et qu'aucune donnée n'est ambiguë.

## Brand Personality
Fiable, clair, sobre. Le ton d'un outil de travail sérieux, qui inspire confiance aux directions comme aux parents. L'accent ambre reste rare ; la hiérarchie repose sur la typographie et l'espacement, pas sur la décoration.

## Anti-references
- Template SaaS générique : grilles de cartes identiques, gros chiffres avec dégradé, eyebrows en capitales au-dessus de chaque section.
- Glassmorphism décoratif : flous et cartes en verre sans fonction.
- ERP scolaire daté : tableaux gris denses, formulaires bruts sans hiérarchie.

## Design Principles
1. La tâche d'abord : chaque écran met en avant une action principale ; le reste s'efface.
2. Des états honnêtes : chargement, vide, erreur et hors-ligne sont toujours explicites, jamais une page blanche ni une fausse donnée.
3. La sobriété inspire confiance : couleur et mouvement ne servent qu'à signifier (statut, alerte, retour d'action).
4. Léger par défaut : chaque octet et chaque rendu compte sur mobile d'entrée de gamme.
5. Cohérence avant nouveauté : réutiliser les primitives `edu/` et les tokens EduFlow plutôt qu'inventer.

## Accessibility & Inclusion
WCAG 2.2 AA. Toutes les pages sont utilisables à 375 px et au clavier. Une alternative `prefers-reduced-motion` est prévue pour chaque animation. Le contraste du texte est d'au moins 4,5:1, placeholders compris. Le statut n'est jamais porté par la couleur seule.
