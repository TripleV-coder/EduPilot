# EduFlow — Brief Handoff pour Claude Design

**Date :** 2026-05-06
**Produit :** EduPilot (SaaS de gestion scolaire multi-tenant)
**Cible outil :** [claude.ai/design](https://claude.ai/design)
**Auteur :** Brief généré pour upload sur Claude Design (Anthropic Labs)

---

## 1. Contexte produit

EduPilot est un SaaS B2B/B2B2C de gestion scolaire utilisé par des écoles privées et publiques (Bénin et plus largement Afrique francophone). 6 personas distincts utilisent la même app avec des besoins très différents :

| Persona | Densité d'info | Fréquence | Device principal |
|---|---|---|---|
| **Super Admin** (Anthropic / opérateur) | Très haute | Quotidienne | Desktop |
| **School Admin / Director** | Haute | Quotidienne | Desktop |
| **Teacher** | Haute (saisie rapide) | Quotidienne | Desktop + tablette |
| **Accountant / Librarian** | Haute | Quotidienne | Desktop |
| **Student** | Moyenne | 2-3 fois/semaine | Mobile + Desktop |
| **Parent** | Basse (consultation) | Hebdomadaire | **Mobile-first** |

**Tension de design clé :** un même DS doit servir des **outils de production pro** (saisie de notes, comptabilité) ET des **interfaces grand public** (parent qui consulte les notes de son enfant le dimanche soir sur mobile). La réponse retenue : densité variable (`density-standard` vs `density-compact`) sans modifier les tokens.

**Stack technique cible :** Next.js 16 (App Router) + React 19 + Tailwind CSS 3.4 + shadcn/ui (Radix) + Recharts + Framer Motion + SWR.

**Existant :** ~95 pages dashboard, 41 composants shadcn/ui, sidebar v1 + v2 cohabitent, "Swiss Enterprise Design System" historique avec radius 2px partout. **EduFlow remplace** ce DS.

---

## 2. Aesthetic direction (à respecter)

**Tone :** *Refined, calme, généreux*. Pas brutaliste, pas glassmorphism criard, pas "AI-slop violet sur blanc". L'inspiration est plus proche de Linear, Notion, Stripe Dashboard, Pennylane — des outils pro où la donnée est centrale et où l'UI s'efface au profit du contenu, mais avec une **chaleur** (neutres légèrement chauds) qui rassure le contexte éducation/famille.

**Mots-clés à honorer :** lisible, hiérarchisé, généreux en respiration, accents bleus retenus, pas de gratuité visuelle.

**À éviter :**
- Inter en font display (trop générique pour un titre)
- Gradient violet → rose
- Glassmorphism partout
- Ombres bleues massives sur tout
- Iconographie 3D/clay
- Animations parallax au scroll

---

## 3. Design tokens (canon — à utiliser tel quel)

### 3.1 Palette — Brand (Sky → Indigo)

| Token | Valeur | Usage |
|---|---|---|
| `eduflow-brand-50` | `#EFF6FF` | Fonds de section, hover doux |
| `eduflow-brand-100` | `#DBEAFE` | Pills, badges, surfaces secondaires |
| `eduflow-brand-500` | `#3B82F6` | Liens, icônes actives |
| `eduflow-brand-600` | `#2563EB` | CTA primaire |
| `eduflow-brand-700` | `#1D4ED8` | CTA hover/pressed |
| `eduflow-accent-500` | `#6366F1` | Indigo, gradients, accent secondaire |
| `eduflow-gradient-cta` | `linear-gradient(90deg,#2563EB,#4F46E5)` | Bouton héro, célébrations |

### 3.2 Palette — Neutres (chauds, pas zinc froid)

| Token | Valeur | Usage |
|---|---|---|
| `eduflow-canvas` | `#F8FAFC` | Fond d'application |
| `eduflow-surface` | `#FFFFFF` | Cards, dialogs |
| `eduflow-surface-soft` | `#F1F5F9` | Cards secondaires, inputs |
| `eduflow-border` | `#E2E8F0` | Bordures fines |
| `eduflow-border-strong` | `#CBD5E1` | Inputs, séparations |
| `eduflow-ink` | `#0F172A` | Titres, texte principal |
| `eduflow-ink-soft` | `#475569` | Sous-titres, body |
| `eduflow-ink-muted` | `#94A3B8` | Métadonnées, placeholders |

### 3.3 Sémantique (transparente, discrète)

| État | Texte | Bordure | Fond |
|---|---|---|---|
| Success | `#047857` | `#10B981` @ 30% | `#ECFDF5` |
| Warning | `#B45309` | `#F59E0B` @ 30% | `#FFFBEB` |
| Danger | `#B91C1C` | `#EF4444` @ 30% | `#FEF2F2` |
| Info | `#1E40AF` | `#3B82F6` @ 30% | `#EFF6FF` |

### 3.4 Mode sombre (livré dès v1, pas en bonus)

| Token | Light | Dark |
|---|---|---|
| `eduflow-canvas` | `#F8FAFC` | `#0B1220` |
| `eduflow-surface` | `#FFFFFF` | `#111827` |
| `eduflow-ink` | `#0F172A` | `#F1F5F9` |
| `eduflow-brand-600` | `#2563EB` | `#3B82F6` (un cran plus clair) |

### 3.5 Géométrie — Radius

| Token | Valeur | Usage |
|---|---|---|
| `radius-pill` | `9999px` | Pills, badges, avatars |
| `radius-card` | `22px` | Cards principales (look A1) |
| `radius-soft` | `16px` | Modals, sheets, popovers |
| `radius-input` | `12px` | Inputs, selects, boutons |
| `radius-chip` | `8px` | Chips, tags, mini-éléments |

### 3.6 Espacement

Grille **4px** stricte : `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

- `density-standard` : padding cards 24px, line-height body 1.55, hauteur input 44px → rôles **user** (parent, élève)
- `density-compact` : padding cards 16px, line-height body 1.45, hauteur input 36px → rôles **pro** (prof, admin, comptable)

Le DS ne change pas, seules les surfaces appliquent le modificateur.

### 3.7 Ombres

| Token | Valeur | Usage |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.06)` | Cards standard |
| `shadow-card-brand` | `0 4px 16px rgba(37,99,235,.10)` | Cards mises en avant |
| `shadow-cta` | `0 6px 18px rgba(37,99,235,.25)` | Boutons héro |
| `shadow-overlay` | `0 24px 48px rgba(15,23,42,.18)` | Modals |

### 3.8 Typographie

| Style | Taille / poids | Usage |
|---|---|---|
| Display | 32 / semibold | Titre dashboard "Bonjour Aïchatou 👋" |
| Heading L | 22 / semibold | Titres de page |
| Heading M | 18 / semibold | Section headers |
| Heading S | 15 / semibold | Card titles |
| Body L | 15 / regular | Contenu principal |
| Body | 14 / regular | Body standard |
| Body S | 13 / regular | Sous-textes |
| Label | 12 / medium / uppercase / tracking 0.04em | Labels, en-têtes table |
| Mono | 13 / mono / tabular-nums | Montants, dates, IDs |

**Polices :** Inter (UI) + JetBrains Mono (chiffres financiers, IDs). `font-variant-numeric: tabular-nums` activé sur tous les montants et tableaux de notes.

### 3.9 Motion

| Token | Durée / easing | Usage |
|---|---|---|
| `motion-tap` | 80ms / ease-out | Boutons, items de liste |
| `motion-enter` | 200ms / ease-out | Apparition cards |
| `motion-page` | 280ms / ease-out | Transition page |
| `motion-celebrate` | 600ms / spring | Validation paiement, badge gagné |
| `motion-attention` | 1.2s / loop | Pulsation discrète sur "demande attention" |

**Règles :**
- Toute animation > 200ms doit être interruptible.
- `prefers-reduced-motion` désactive tout sauf transitions essentielles d'état.
- Pas de parallax, pas de scroll-jacking, pas de "wow effect" gratuit.

---

## 4. Principes directeurs (à appliquer sur chaque écran)

1. **La donnée d'abord.** Chaque écran a une "hero metric" évidente (ex : moyenne classe, solde dû, nb absents du jour). Tout le reste est subordonné.
2. **Hiérarchie par poids, pas par couleur.** On utilise size + weight + spacing avant de poser de la couleur.
3. **Couleur = signal, pas décoration.** Bleu brand = action interactive ; sémantique = statut. Jamais de couleur "pour faire joli".
4. **Tabular numbers partout** où il y a un nombre (notes, montants, effectifs, taux).
5. **Empty states informatifs**, pas juste un message gris. Toujours proposer l'action suivante.
6. **Mobile = première classe pour parent/élève**, deuxième classe pour prof/admin (mais pas inutilisable).
7. **Accessibilité AA minimum.** Tous les couples texte/fond doivent passer 4.5:1. États focus visibles (anneau brand-500 @ 40%).
8. **Densité opt-in.** Le mode compact se choisit, pas par défaut. Toggle dans le header.

---

## 5. Inventaire des écrans à designer

### Tier 1 — Critiques (à designer en priorité)

| # | Écran | Persona principal | Priorité |
|---|---|---|---|
| 1 | **Dashboard overview** (par rôle : admin / teacher / parent / student) | Tous | P0 |
| 2 | **Sidebar + Header** (chrome global) | Tous | P0 |
| 3 | **Login** | Tous | P0 |
| 4 | **Saisie de notes** (`grades/entry`) | Teacher | P0 |
| 5 | **Bulletin** (preview + impression) | Admin, Teacher, Parent | P0 |
| 6 | **Finance dashboard** + **Nouveau paiement** | Accountant, Admin | P0 |
| 7 | **Feuille d'appel** (`attendance`) | Teacher | P0 |

### Tier 2 — Importantes

| # | Écran | Persona | Priorité |
|---|---|---|---|
| 8 | Liste élèves (grille + table) | Admin | P1 |
| 9 | Détail classe (tabs) | Admin, Teacher | P1 |
| 10 | Analytics multi-tabs | Admin, Director | P1 |
| 11 | Vue parent (enfants, alertes, paiements) | Parent (mobile) | P1 |
| 12 | Liste / détail homework | Teacher, Student | P1 |

### Tier 3 — À aligner ensuite

Settings (profile, school, academic), import CSV, library, canteen, gamification, root-control (super admin), landing page publique, pages d'erreur.

---

## 6. Briefs détaillés par écran (Tier 1)

### 6.1 Dashboard overview

**État existant :** un wrapper qui charge des contenus différents selon le rôle ; vue admin dense (4 KPIs + 2-3 charts + activité récente + alertes) ; vue parent générique aujourd'hui.

**À produire (4 variantes) :**

#### a) Admin / Director
- Bandeau salutation avec **hero metric** (taux de présence du jour OU collecte du mois — à choisir selon période).
- 4 KPI cards (Effectif, Présence du jour, Collecte du mois, Risques actifs) avec mini-trend sparkline 30j.
- Section "Aujourd'hui" : événements + appel non fait + paiements à valider.
- Section "Cette semaine" : 2 charts (présence par classe + collecte cumulée).
- Liste "Demandes attention" : élèves en risque (décrochage, dette, échec) avec action rapide.

#### b) Teacher
- Hero metric = "Notes à saisir cette semaine" + "Cours du jour".
- Liste classes du jour (cards horizontales avec horaire, salle, nb élèves, état appel).
- Mes devoirs en attente de correction (compteur + accès direct).
- Mes derniers messages parents (3 max).

#### c) Parent (mobile-first impératif)
- Sélecteur enfant en haut (si plusieurs enfants).
- Hero card : moyenne période courante de l'enfant + delta vs période précédente.
- 3 cards verticales : Présence (taux + dernière absence), Devoirs (à rendre), Finance (solde dû avec CTA "Payer" si > 0).
- Timeline "Cette semaine" (notes reçues, absences, événements).
- Section "Messages école" (annonces non lues).

#### d) Student
- Hero : moyenne du moment + position (rang) anonymisé ("Top 30%").
- "À faire" : devoirs à rendre + examens cette semaine (cards avec deadline visible).
- "Cette semaine en cours" : emploi du temps du jour.
- Achievements récents (gamification, retenu mais discret).

**Spécificités :**
- Densité standard pour parent/student, compact pour admin/teacher.
- Skeletons explicites (pas de spinners centrés) pendant chargement.
- Empty states quand l'année académique n'est pas active : callout grand format avec CTA "Configurer l'année".

---

### 6.2 Sidebar + Header (chrome global)

**État existant :** Sidebar v2 en glassmorphism gradient sombre + framer-motion ; v1 plus basique. À unifier.

**À produire :**
- **Sidebar light par défaut** (surface blanche, 260px expanded / 64px collapsed). Le sombre est l'inverse, pas une variante par défaut.
- Sections pliables (Académique, Pédagogie, Finance, etc.) avec **count badges** discrets (chip neutre, pas rouge sauf urgence).
- Indicateur d'élément actif : pastille brand-600 4px à gauche + fond `eduflow-brand-50`. Pas de gradient.
- Footer sidebar : avatar + nom + rôle pill + menu (déconnexion, paramètres). Cliquable → drawer mobile, dropdown desktop.
- Tooltips collapsed (Radix tooltip, delay 300ms).

- **Header sticky 56px**. Contenu : breadcrumb (caché < md) | search globale (cmdk, ⌘K) | période active (chip cliquable → switcher) | densité toggle | notif bell | avatar.
- Scroll elevation : ombre `shadow-card` apparaît au scroll > 8px.

**Mobile :**
- Sidebar devient drawer (Radix Sheet) ouvert via hamburger.
- Header reste sticky, search devient icône-only.
- Bottom tab bar 4 onglets pour parent/student (Accueil, Notes, Devoirs, Plus).

---

### 6.3 Login

**État existant :** card centré 420px, logo + form basique.

**À produire :**
- Layout split desktop : 60% form (centré dans sa moitié) | 40% panneau brand (gradient `eduflow-gradient-cta` discret + illustration légère + témoignage école client). Sur mobile : full-width, pas de panneau brand.
- Form : email + password + "Se souvenir" (switch) + "Mot de passe oublié ?" + CTA primaire full-width.
- Lien secondaire "Configurer le système" si setup pas encore fait (cf. `/api/config/setup-status`).
- États : succès ✅ avec micro-celebrate (`motion-celebrate`), erreur (callout danger), 2FA required (transition vers écran TOTP).
- Pas de social login pour l'instant (NextAuth supporte Google/GitHub mais pas activé en prod actuellement).

---

### 6.4 Saisie de notes (`grades/entry`)

**État existant :** formulaire 4 étapes (sélecteur classe/matière → metadata éval → grille élèves → validation), focus mode, indicateur "X modifs non sauvées".

**À produire :**
- Layout 2-zones : **side-rail droite** persistant (sticky) avec metadata évaluation (titre, date, type, coef, max) + actions ; **zone principale** avec grille élèves.
- Grille élèves : table dense (`density-compact`) avec colonnes : avatar/nom, **input note** (mono, autofocus, navigation Tab/Shift+Tab/Entrée → cellule suivante), checkbox "Absent" / "Excusé", commentaire icon (popover).
- Saisie inspirée tableurs : navigation clavier obligatoire, validation inline (note > max → bordure danger), undo discret (toast "Note modifiée — Annuler").
- Indicateur global haut : "12 notes saisies / 28 élèves — Brouillon enregistré il y a 2s" (autosave).
- Bouton primaire "Valider" avec confirmation modal qui résume (moyenne classe, distribution).
- "Générer commentaires IA" : action secondaire avec icon Sparkles, génère bullet par élève avec preview avant insertion.

**Important :** **densité compact obligatoire** ici. Une saisie de notes pour 30 élèves doit tenir au-dessus de la ligne de flottaison.

---

### 6.5 Bulletin (preview + impression)

**État existant :** card filtres (classe/élève/période) + aperçu bulletin imprimable + actions (Imprimer, PDF).

**À produire :**
- **Vue split** : panneau gauche filtres + liste élèves (avec progress "Bulletin généré ✓ / À générer") ; panneau droite **canvas A4 fidèle** (proportions, marges 18mm).
- Bulletin lui-même (canvas) :
  - En-tête : logo école | infos établissement | période | photo + identité élève.
  - Tableau matières : matière | coef | note | moyenne classe | rang | appréciation prof. Tabular-nums obligatoire.
  - Bandeau synthèse : moyenne générale (gros, mono) | rang | mention | décision conseil de classe.
  - Pied de page : signatures (directeur, prof principal, parent) + cachet emplacement.
- Actions barre droite : Imprimer | Télécharger PDF | Envoyer aux parents (email).
- Mode "génération en lot" : sélection multi-élèves dans le panneau gauche → CTA "Générer 28 bulletins" avec progress bar.

---

### 6.6 Finance dashboard + Nouveau paiement

**Finance dashboard :**
- Hero KPI band : Total attendu | Collecté | Impayé | Taux collecte (% + delta période précédente). Mono sur les montants.
- Filtres période/année dans une chip-bar sous le hero.
- 2 charts côte-à-côte : bar paiements mensuels (12 derniers mois) + pie répartition par mode (cash, MTN, Moov, virement).
- Tableau "Derniers paiements" (10 dernières lignes, scrollable) : date | élève | frais | montant | mode | reçu n° | statut.
- Card "Alertes Impayés" : top 5 élèves dette > 30j, CTA "Voir tous" → liste filtrée.
- Card "Échéanciers actifs" : table avec progress bar par échéancier + bouton encaisser une échéance.

**Nouveau paiement :**
- Layout 3-colonnes desktop : recherche élève (autocomplete avec aperçu carte élève sélectionné) | détails frais & montant (auto-fill, mode de paiement, référence, observations) | preview reçu live avant validation.
- Modes : cash / MTN MoMo / Moov Money / virement / chèque. Chaque mode a un set de champs spécifiques (référence MoMo, n° chèque…).
- Sur mobile : 3 colonnes deviennent 3 étapes empilées (wizard sans tabs).
- Validation : modal résumé + impression reçu auto (option toggleable).
- Empty state recherche : "Tapez le nom ou matricule d'un élève pour commencer".

---

### 6.7 Feuille d'appel (`attendance`)

**État existant :** filtres classe + date, stats inline P/A/E, table radios par élève, bouton "Tous présents", floating save bottom.

**À produire :**
- Header : sélecteur classe (chip) + date (date picker) + cours/créneau si applicable.
- KPI inline mini : Présents 24 | Absents 3 | Excusés 1 | Non saisi 0. Couleurs sémantiques retenues (bordure + fond, texte sombre).
- Table dense : avatar + nom (sticky col gauche) | 3 boutons toggle group (P/A/E, scale 0.96 active, couleur sémantique), notes icon optionnelle.
- Mode rapide ("Focus") : full-screen, plus de notes, raccourcis clavier P/A/E + flèches.
- Floating bar bas : "X modifications non sauvées — Enregistrer". Auto-save soft toutes les 10s.
- Bouton secondaire "Tous présents" qui pré-coche P sur tous puis l'utilisateur ajuste.
- Mobile : table devient cards verticales empilées avec les 3 toggles en bas de chaque card.

---

## 7. Composants transverses à designer

Une fois les écrans Tier 1 posés, Claude Design doit produire la **bibliothèque shadcn-compatible** :

- **Button** : variants `primary` (brand-600), `secondary` (surface-soft + ink), `ghost`, `outline`, `destructive`, `link`. Sizes `sm` (32px), `md` (40px), `lg` (44px). Loading state avec spinner inline + texte conservé.
- **Input / Select / Textarea / Combobox** : hauteur 44px (standard) / 36px (compact), focus ring brand-500 @ 40%, états error (bordure danger + helper text).
- **Card** : 3 variants (`default`, `elevated` avec shadow-card, `brand` avec shadow-card-brand + bordure brand-100).
- **Badge / Chip / Pill** : 4 tons sémantiques + neutre + brand. Variant `dot` (pastille couleur + texte ink).
- **Tabs** : underline brand-600 sous l'onglet actif, pas de pill background.
- **Dialog / Sheet / Popover** : `radius-soft`, `shadow-overlay`, backdrop blur léger.
- **Toast** (sonner) : 4 tons sémantiques, durée 4s par défaut, action button possible.
- **DataTable** : header `Label` typo, row hover `eduflow-brand-50`, sticky col gauche optionnelle, sort icons discrets, pagination compacte.
- **StatCard / KPICard** : label / value (Display ou Heading L) / delta (semantic + icon trend).
- **PageCallout** : 4 tons + variant `empty` (illustration + titre + description + CTA).
- **EmptyState** : illustration linéaire (pas 3D) + titre + description + CTA.
- **Skeleton** : `eduflow-surface-soft` + animation shimmer 1.6s ease-in-out infinite.
- **Avatar** : 4 sizes (24/32/40/56), initiales sur fond brand-100 par défaut, bordure surface si overlap.
- **CommandPalette (cmdk)** : ⌘K, recherche entités cross-modules.

---

## 8. Contraintes techniques (à respecter par Claude Design pour faciliter le handoff Code)

- **Tailwind 3.4** + **shadcn/ui Radix-based**. Ne pas inventer un autre framework.
- Tous les tokens doivent être exposés en **CSS custom properties** (pour le dark mode) ET mappés en classes Tailwind via `tailwind.config.ts`.
- **Pas de styled-components**, pas de CSS Modules — on reste sur Tailwind + classes utilitaires.
- **Framer Motion** pour les animations React. Aucune lib alternative.
- **Recharts** pour les graphiques. Si Claude Design propose une autre lib (Visx, Nivo), je la rejette à l'intégration.
- Tous les écrans doivent être pensés **server-component-friendly** (Next 16) : pas d'interactivité gratuite, on isole les `"use client"` au minimum nécessaire.
- **Accessibilité** : focus visible obligatoire, ARIA labels sur icon-only buttons, contraste AA, navigation clavier complète sur table/saisie de notes.

---

## 9. Livrables attendus de Claude Design

Pour chaque écran Tier 1, je veux pouvoir récupérer :

1. **Mockup haute fidélité** desktop (1440px) + mobile (390px).
2. **Variantes** : light + dark, density-standard + density-compact (selon persona).
3. **Inline annotations** : tokens utilisés sur chaque élément clé.
4. **États** : default, loading, empty, error, success.
5. **Handoff bundle** prêt pour Claude Code (export → moi).

Pour la bibliothèque de composants : un fichier de référence par composant avec toutes les variantes, sizes, états.

---

## 10. Mode d'emploi pour l'équipe (étapes Claude Design)

1. **Onboarding du brand** : uploader ce brief + `tailwind.config.ts` actuel + 3-4 captures d'écran de l'app (dashboard admin, login, saisie de notes, vue parent mobile).
2. **Créer un design system EduFlow** dans Claude Design avec les tokens de la section 3 (palette, radius, typo, motion).
3. **Designer écran par écran** en partant du Tier 1, dans l'ordre : login → sidebar+header → dashboard overview admin → puis les autres rôles.
4. **Itérer via inline comments** : pour chaque mockup, on annote ce qui ne va pas et Claude reformule.
5. **Quand un écran est validé**, exporter le handoff bundle → coller dans Claude Code → "Implémente ce design dans la page X en respectant les tokens existants".
6. **Boucle qualité** : à chaque écran intégré, je lance un audit (Lighthouse + a11y + visual regression manuel).

---

## 11. Anti-patterns explicites à refuser

Si Claude Design propose un de ces éléments, je rejette et redemande :

- ❌ Inter en titre Display (utiliser un weight/size qui le différencie ou demander une font display)
- ❌ Gradient violet → rose → orange
- ❌ Cards avec `box-shadow` violet/rose
- ❌ Cartes "néon" (border + glow saturé)
- ❌ Glassmorphism sur >2 surfaces simultanées
- ❌ Iconographie 3D / Memphis / clay / pixel art
- ❌ Boutons full-width sur desktop sans raison
- ❌ Couleur sémantique sur du texte body (lecture confort)
- ❌ Animations de page > 400ms ou avec easing exotique
- ❌ Données factices type "Lorem ipsum" — toujours du texte FR métier crédible (élèves Aïchatou, Komi, classes 6ème A, frais inscription, etc.)

---

## 12. Sources d'inspiration recommandées

- **Linear** — densité, command palette, sidebar
- **Stripe Dashboard** — finance, KPIs, mono numbers
- **Notion** — sidebar, vue tableau dense
- **Pennylane** — finance B2B FR, chiffrage, tableaux
- **Posthog** — analytics multi-tabs, charts retenus
- **Cron / Linear** — micro-interactions ciblées

À NE PAS prendre comme inspiration : Vercel.com (trop "tech bro"), n'importe quel template Tailwind UI générique, sites IA de 2024-2025 violet/rose.

---

## 13. Données réelles à utiliser dans les mockups

Pour éviter le générique, voici un casting d'élèves/classes/montants à réutiliser :

**Élèves :** Aïchatou Boukari, Komi Adjovi, Mariama Diallo, Yannick Hounkpatin, Salamatou Tidjani, Kossi Houngbedji, Aminata Sangaré, Joël Adékambi.

**Classes :** 6ème A, 5ème B, 4ème C, 3ème A, 2nde S, 1ère D, Tle C.

**Matières :** Mathématiques, Français, Anglais, Histoire-Géo, SVT, Physique-Chimie, EPS, Philosophie.

**École type :** Collège Notre-Dame de l'Espérance (Cotonou) / Lycée Mathieu Bouké (Parakou).

**Montants :** XOF (FCFA) — frais inscription 75 000 XOF, mensualité 35 000 XOF, cantine 12 000 XOF/mois.

**Périodes :** Trimestre 1 / Trimestre 2 / Trimestre 3, ou Semestre 1 / Semestre 2 selon config école.

---

## 14. Critères d'acceptation par écran

Un écran est validé quand :
- ✅ Tous les tokens utilisés sont dans la liste section 3
- ✅ Light + dark testés
- ✅ États loading / empty / error présents
- ✅ Mobile (390px) lisible et utilisable
- ✅ Tabular-nums sur tous les nombres
- ✅ Hiérarchie typo respecte la grille section 3.8
- ✅ Densité cohérente avec le persona
- ✅ A11y AA verified (contraste, focus, ARIA)
- ✅ Aucun élément de la section 11 (anti-patterns)
- ✅ Données crédibles (section 13)

---

**Fin du brief.** Tout l'équivalent code (`tailwind.config.ts`, tokens CSS, composants shadcn) sera produit après validation des mockups dans Claude Design, dans une seconde phase.
