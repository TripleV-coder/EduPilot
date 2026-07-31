# Handoff — EduPilot

> Plateforme de gestion scolaire pour le Bénin (école maternelle → terminale)
> École privée + publique · multi-établissements · 5 rôles (Directeur, Enseignant, Parent, Élève, Super Admin)
> Conforme MEMP · système trimestres OU semestres · béninois A→G + CEP/BEPC/BAC

---

## 📋 À propos des fichiers de design

Les fichiers de ce dossier sont des **références de design en HTML/React** — des prototypes qui montrent le rendu visuel et le comportement attendus, **PAS du code de production à copier tel quel**.

L'objectif : **recréer ces designs dans la stack du projet cible** (Next.js, Nuxt, SwiftUI, Flutter, Django + HTMX, etc.) en suivant les patterns établis du codebase. Si aucune stack n'existe encore, choisir la plus adaptée :

- **Recommandé** : Next.js 14 (App Router) + React Server Components + Tailwind CSS + shadcn/ui + Prisma + PostgreSQL
- **Alternatif mobile-first** : React Native (Expo) + Supabase (les écoles béninoises sont fortement mobile-first)

Le design system EduPilot lui-même (tokens, composants atomiques) **doit être réimplémenté** dans le système choisi (Tailwind config + shadcn customisé, par exemple), pas copié-collé du JSX prototype.

---

## 🎯 Fidélité

**High-fidelity (hifi)** sur tout l'ensemble.
- Couleurs exactes, typographies définies, espacements précis, états interactifs spécifiés.
- 14 palettes (4 marques × 2 thèmes × 2 densités) supportées.
- Le développeur doit recréer pixel-perfect — les valeurs hex, échelles d'espacement, typographies et radii sont définis dans [`src/styles/edupilot-tokens.css`](../src/styles/edupilot-tokens.css) (source de vérité en production).

---

## 📂 Fichiers livrés

### Documents principaux
| Fichier | Rôle |
|---|---|
| `EduPilot Design System.html` | **Canvas complet** — 75+ écrans, 15 sections, pan/zoom à la Figma |
| `EduPilot — Nouveautés.html` | Preview légère des 6 nouvelles features + démo bascule trim/sem |

### Design tokens
| Fichier | Rôle |
|---|---|
| `src/styles/edupilot-tokens.css` | **Single source of truth** (production) — tous les tokens. Le fichier `tokens.css` local du handoff est obsolète ; ouvrir les HTML via un serveur local en important ce chemin si besoin. |

### Bibliothèques de composants (par couche)
| Fichier | Contenu |
|---|---|
| `components.jsx` | Atomes : Icon (28 icônes Lucide-style), Button, Badge, Card, Input, Avatar, Progress, RingProgress, Toast, MetricCard, NotifItem, NavItem, Sparkline |
| `showcase.jsx` | Demo du design system + Logo |
| `dashboards.jsx` | **Shell d'application** : DashShell (sidebar + topbar), SidebarNav, TopBar, PageHeader, BarChart. Plus les 5 dashboards par rôle |
| `landing.jsx` | Site marketing (hero, features, pricing, FAQ, CTA) |
| `auth.jsx` | Login, Register, MFA 2FA, Mot de passe oublié |
| `pages.jsx` | 8 modules métier : Notes, Présences, Finance, EDT, Santé, IA, Bibliothèque, Cantine. Plus PageTitle, Chip |
| `onboarding-notif.jsx` | Onboarding directeur 5 étapes + NotifCenter |
| `onboarding-roles.jsx` | Onboarding enseignant/parent/élève/super admin |
| `notif-roles-orientation.jsx` | Notif par rôle + Orientation béninoise A→G + CEP |
| `student-suite.jsx` | Profil élève 360° + Bulletin print-ready A4 + Conseil de classe + Inscription |
| `operations.jsx` | Discipline, Examens, Messagerie, LMS, Compétences, Gamification, Templates |
| `system-states.jsx` | Settings, RBAC, Audit MEMP, Import CSV, Analytics, Empty/Loading/Error states, ⌘K palette |
| `extras.jsx` | Calendrier, Cahier de liaison, Mon compte, Transport scolaire GPS |
| `value-add.jsx` | **Spécifique Bénin v1** : config trim/sem, WhatsApp Business, PWA offline, QR badge, BEPC prep, Bourses MEMP, Clubs, RH, Alumni |
| `value-add-v2.jsx` | **Spécifique Bénin v2** : Bien-être & cellule d'écoute, Vocal multilingue (Fon/Yoruba/Bariba/Dendi), Comptabilité OHADA, Benchmark national MEMP, Wallet MoMo, Cagnottes |
| `mobile.jsx` | Variantes mobile 375px (parent, élève, enseignant) |
| `app.jsx` | Point d'entrée : monte le DesignCanvas avec toutes les sections + le panneau Tweaks |
| `design-canvas.jsx` | Wrapper Figma-like (pan/zoom, artboards drag-reorder) — **NE PAS PORTER** en production, c'est juste pour la review |
| `tweaks-panel.jsx` | Panneau de tweaks live (palette, fonts, thème, densité, période) — **NE PAS PORTER** non plus |

---

## 🏗️ Architecture d'écran (vue d'ensemble)

L'app suit un layout standard "SaaS B2B" :

```
┌─────────────────────────────────────────────────────────┐
│ SidebarNav (240px, collapsible 64px)  │ TopBar (60px)   │
│ - Logo + nom école                     ├─────────────────┤
│ - Profil utilisateur                   │ PageHeader      │
│ - Groupes de nav (Pilotage,            │ (titre + actions│
│   Pédagogie, Finance, etc.)            │  + breadcrumb)  │
│ - Liens avec compteurs                 ├─────────────────┤
│ - Logout en bas                        │ Contenu page    │
│                                        │ (grilles de     │
│                                        │  Cards)         │
└─────────────────────────────────────────────────────────┘
```

Mobile (375px) : bottom nav 5 onglets, pas de sidebar.

---

## 🎨 Design Tokens

### Couleurs (palette par défaut "deepblue")

```css
/* Brand */
--brand-50:  #EFF6FF;  --brand-100: #DBEAFE;  --brand-200: #BFDBFE;
--brand-300: #93C5FD;  --brand-400: #60A5FA;  --brand-500: #3B82F6;
--brand-600: #2563EB;  /* CTA primary */
--brand-700: #1D4ED8;  /* CTA hover */
--brand-800: #1E40AF;
--brand-900: #172554;

--accent-500: #6366F1; /* indigo accent */

/* Sémantique */
--success-* : tons de #10B981 (vert émeraude)
--info-*    : identique à brand (bleu)
--warning-* : tons de #F59E0B (ambre)
--danger-*  : tons de #EF4444 (rouge)

/* Neutres (warm slate) */
--neutral-* : #F8FAFC → #0F172A
```

3 autres palettes disponibles via `data-palette` sur `<html>` :
- `emerald` (#059669 primary)
- `terracotta` (#B94A23 primary) — pour écoles privées Sud BJ
- `indigo` (#7C3AED primary)

### Surfaces (light → dark)

```css
--surface-page:    #FFFFFF    (dark: #0B1220)
--surface-card:    #FFFFFF    (dark: #111827)
--surface-sunken:  #F8FAFC    (dark: #1F2937)
--surface-canvas:  #F5F5F4    (dark: #0F172A) — fond du canvas
```

### Texte

```css
--text-primary:   #0F172A  (dark: #F1F5F9)
--text-secondary: #475569  (dark: #94A3B8)
--text-tertiary:  #94A3B8  (dark: #64748B)
```

### Bordures

```css
--border-subtle:  rgba(15,23,42,0.06)
--border-default: rgba(15,23,42,0.12)
--border-strong:  rgba(15,23,42,0.24)
```

### Typographie

```
--font-display: 'Inter', system-ui, sans-serif
--font-body:    'Inter', system-ui, sans-serif
--font-mono:    ui-monospace, 'SF Mono', Menlo, monospace
```

Tailles utilisées (extraites du JSX) :
- Mega : 56-72px / weight 800 / letter-spacing -0.04em (gros chiffres KPI, hero)
- H1 display : 28-32px / weight 700 / letter-spacing -0.02em
- H2 : 20-22px / weight 700
- H3 / Section header : 16-18px / weight 700
- Body : 13-14px / weight 400-500
- Small : 11-12px / weight 500
- Micro : 9-10px / weight 600-700 / uppercase / letter-spacing 0.06-0.14em (labels, badges)

**Tabular nums** : `font-variant-numeric: tabular-nums` partout où il y a des chiffres (montants FCFA, notes /20, pourcentages, dates). Classe `.tabular`.

### Spacing scale

8-point base : 4, 8, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 80px.

### Radii

```
--radius-sm:   6px   (badges, chips, inputs sm)
--radius-md:   8-10px (boutons)
--radius-lg:   12-14px (cards)
--radius-xl:   16-22px (gros cards hero, modals)
--radius-pill: 999px  (chips actives, badges arrondis, badges live)
```

### Shadows

```
--shadow-sm:  0 1px 2px rgba(15,23,42,0.05)
--shadow-md:  0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06)
--shadow-cta: 0 6px 18px rgba(37,99,235,0.25)  (gradient CTAs)
```

### Densité

`data-density="compact"` réduit les paddings de ~25% (utilisé par les écoles avec beaucoup d'élèves).

---

## 🌍 Internationalisation

- **Langue principale** : français (Bénin officiel)
- **Devises** : FCFA (XOF). Format : `125 000` (espace fine pour milliers, pas de virgule)
- **Dates** : format français long (`02 sept. 2025`) ou court (`14/05`)
- **Langues locales pour vocal** (feature value-add v2) :
  - Fɔngbè (Fon, sud BJ — 32% des parents)
  - Yorùbá (plateau d'Abomey — 8%)
  - Bariba (nord — 4%)
  - Dendi (Borgou — 2%)

---

## 🔑 Système de découpage de l'année — **fonctionnalité centrale**

L'établissement choisit son système au setup, puis tout l'app s'adapte :

| Système | Découpage | Bulletins/an | Cible |
|---|---|---|---|
| **Trimestres** (défaut MEMP) | T1 (oct-déc) · T2 (jan-mars) · T3 (avr-juil) | 3 | Public + privé "classique" |
| **Semestres** | S1 (sep-jan) · S2 (fév-juin) | 2 | Lycées techniques, universitaire |

**Implémentation côté design** :
- Attribut global sur `<html data-period="trimestre|semestre">`
- CSS swap automatique : `[data-period="trimestre"] [data-period="semestre"] { display: none }` et inverse (voir `tokens.css` ligne ~291)
- Usage dans les composants :
  ```jsx
  <span data-period="trimestre">Trim. 2 — semaine 8/12</span>
  <span data-period="semestre">Sem. 1 — semaine 8/22</span>
  ```

**Implémentation côté production (recommandé)** :
- Stocker `period_system: 'trimestre' | 'semestre'` sur le modèle `School`
- Tous les composants qui parlent de période lisent ce champ
- Service `periodLabel(periodIndex, system)` qui retourne "Trim. 2" ou "Sem. 1"
- Service `currentPeriod(school, date)` qui retourne le N° de période active
- Migrations à prévoir : bulletins, moyennes, conseils de classe, échéances de paiement, calendriers

---

## 👤 Rôles & permissions (RBAC)

5 rôles, chacun avec son propre dashboard et nav :

### 1. Directeur / Directrice
- **Nav** : Pilotage (Vue d'ensemble, Élèves, Classes) · Pédagogie · Finance (badge count en retard) · Vie scolaire · Analytics · Communication · Paramètres
- **KPIs principaux** : Élèves actifs, Recouvrement, Présence semaine, Élèves à risque
- **Actions clés** : Validation conseils de classe, Diffusion annonces, Décaissements wallet, Recrutement enseignants
- **Voir** : `dashboards.jsx → DirectorDash`

### 2. Enseignant
- **Nav** : Mes classes · Saisie notes · Appel · EDT · Devoirs · Messagerie · Notifications
- **Mode offline-first** (zones rurales) — saisies notes/présences en local, sync auto au retour réseau
- **Voir** : `dashboards.jsx → TeacherDash`, `value-add.jsx → OfflinePage`

### 3. Parent
- **Nav** : Accueil · Mes enfants · Paiements · Cagnottes · Messagerie
- **Lien matricule** : un parent peut être lié à plusieurs enfants
- **Paiement Mobile Money** : MTN, Moov, Celtiis + carte Flutterwave
- **Voir** : `dashboards.jsx → ParentDash`, `mobile.jsx → ParentMobile`

### 4. Élève
- **Gamifié** : badges, points, leaderboard de classe (opt-in)
- **Nav** : Accueil · Notes · Devoirs · EDT · Préparation examens · Clubs · Messagerie
- **Bouton SOS** permanent (cellule d'écoute, ancré dans l'app)
- **Voir** : `dashboards.jsx → StudentDash`, `mobile.jsx → StudentMobile`

### 5. Super Admin (réseau multi-sites)
- Vue consolidée plusieurs écoles d'un même groupe
- KPIs comparatifs entre établissements
- **Voir** : `dashboards.jsx → SuperAdminDash`

Détails permissions : `system-states.jsx → RBACPage`.

---

## 📑 Inventaire des écrans (75+)

### 01 · Marketing
- **Landing edupilot.bj** (`landing.jsx → Landing`) — Hero + features + pricing + témoignages + FAQ + CTA, single scroll

### 02 · Auth & onboarding
- Login, Register établissement, MFA, Mot de passe oublié (`auth.jsx`)

### 03 · Dashboards par rôle
- 5 dashboards : Directeur · Enseignant · Parent · Élève · Super Admin (`dashboards.jsx`)

### 04 · Modules métier (8)
| Module | Composant | Description |
|---|---|---|
| Notes | `GradesPage` | Carnet 26 élèves × 10 devoirs · saisie inline · moyennes auto |
| Présences | `AttendancePage` | Appel quotidien tactile · justifs |
| Finance | `FinancePage` | Recouvrement trimestre · relances bulk SMS |
| EDT | `SchedulePage` | Drag & drop des cours, gestion conflits salles/profs |
| Santé | `HealthPage` | Infirmerie · vaccinations · incidents |
| Assistant IA | `AIPage` | Chat + insights pédago · génération bulletins |
| Bibliothèque | `LibraryPage` | Catalogue · prêts · retards · manuels MEMP |
| Cantine | `CafeteriaPage` | Menus · allergies · paiements |

### 05 · Onboarding par rôle (9 écrans)
- Directeur : 5 étapes (identité école → cycles & classes → import CSV → équipe & rôles → paiement & lancement) (`onboarding-notif.jsx`)
- Enseignant : 1ère saisie de note (`onboarding-roles.jsx`)
- Parent : lier mon enfant via matricule
- Élève : choisir mon objectif trimestre
- Super Admin : réseau multi-sites

### 06 · Notifications par rôle
4 centres de notif filtrés par rôle (`notif-roles-orientation.jsx`).

### 07 · Orientation béninoise
- Conseil post-BEPC · 7 séries A→G + DT (`OrientationPage`)
- Élève · 3 vœux + mentions bac (`OrientationStudent`)
- Primaire · CEP · passage CM2 → 6ᵉ (`OrientationCEP`)

### 08 · Dossier élève
- Profil 360°, Bulletin imprimable A4, Conseil de classe, Inscription 5 étapes (`student-suite.jsx`)

### 09 · Opérations & pédagogie
- Discipline, Examens, Messagerie 3-pannels Slack-like, LMS devoirs, Évaluations par compétences MEMP, Gamification badges, Templates SMS/Email (`operations.jsx`)

### 10 · Système & conformité
- Settings, RBAC, Audit MEMP, Import CSV, Analytics BI builder, States (empty/loading/error), Modals, ⌘K palette (`system-states.jsx`)

### 11 · Outils complémentaires
- Calendrier, Cahier de liaison digital, Mon compte, Transport scolaire GPS, Sidebar collapsée mode rail 64px (`extras.jsx`)

### 12 · Valeur ajoutée v1 (spécifique Bénin)
- **Année académique** : config trimestre / semestre (`AcademicConfig`)
- **WhatsApp Business** : 12 modèles, 98% lecture, 12 FCFA/msg
- **PWA offline-first**
- **QR badge** : contrôle d'accès cantine/portail/bibliothèque
- **Préparation BEPC** : annales corrigées IA, planning révisions, pronostic mention
- **Bourses & aides** : MEMP, fondations, alumni — 42 boursiers, 8,4M FCFA distribués
- **Clubs & vie associative** : robotique, théâtre, sport, échecs, journal scolaire
- **RH enseignants** : contrats, congés, paie, remplacements
- **Alumni** : 3 248 anciens, mentorat, dons promo

### 13 · Valeur ajoutée v2 (nouveautés du sprint final)
- **Cellule d'écoute & bien-être** (`WellbeingPage`) : signalement anonyme (P0/P1/P2), bouton SOS élève, pulse climat hebdo, agenda psy, détection IA des signaux faibles
- **Notifications vocales multilingues** (`VoiceNotifsPage`) : compose en français, traduction + synthèse vocale en Fɔn/Yorùbá/Bariba/Dendi, +24 pts de portée vs SMS
- **Comptabilité OHADA** (`AccountingPage`) : plan SYSCOHADA, journal débit/crédit auto-équilibré, soldes multi-comptes, export DGI iTAS, échéances CNSS
- **Benchmark national MEMP** (`BenchmarkPage`) : rang national / département / groupe pair, 8 indicateurs, plan d'action IA
- **Wallet école Mobile Money** (`WalletPage`) : MTN/Moov/Celtiis + Ecobank/BoA, rapprochement webhook temps réel, décaissements programmés
- **Cagnottes & pots communs** (`CagnottePage`) : sorties scolaires, cadeaux profs, 100% transparent, vue parent

### 14 · Mobile (375px)
- Parent · accueil
- Élève · accueil gamifié
- Enseignant · appel tactile offline-first

---

## 🎬 Interactions & comportements clés

### Navigation
- **Sidebar collapsible** (240px ↔ 64px rail) — chevron en haut + raccourci clavier `[`
- **⌘K command palette** — recherche globale (élèves, classes, actions) — voir `system-states.jsx`
- **Breadcrumbs** sur toutes les pages internes

### Saisie de notes (UX critique)
- Inline edit dans tableau · saisie d'une note suivante automatique au Tab/Enter
- Validation : `0 ≤ note ≤ 20`, virgule auto-conversion (`16.5` ↔ `16,5`)
- Mode offline : badge "sync-pending" sur chaque ligne modifiée
- Sync auto au retour réseau, résolution conflits = serveur gagne sauf si plus récent côté client

### Paiement Mobile Money (UX critique)
- Lien court envoyé par WhatsApp/SMS : `edupilot.bj/p/A0142`
- Page de paiement responsive (90% du trafic est mobile)
- 3 boutons : MTN MoMo, Moov Money, Celtiis Cash
- Confirmation push parent + reçu WhatsApp auto

### Bascule trim/sem
- Toggle dans Settings → Année académique
- Application immédiate sans rechargement
- Recalcule moyennes, regénère calendrier conseils, met à jour échéances
- Backup automatique avant changement

### Bouton SOS élève
- Permanent, accessible depuis n'importe quel écran de l'app élève
- Ouvre un canal chiffré vers la psychologue
- Anonyme par défaut, l'élève choisit de se nommer

### Animations & transitions
- Durée standard : 150-200ms
- Easing : `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard)
- Hover sur cards : translateY(-2px) + shadow boost
- Skeleton loaders pour les listes/tables
- Toast notifications : slide-in depuis le haut, auto-dismiss 4s

### Notifications
- Push web (Service Worker) pour PWA
- WhatsApp Business API (préféré, 98% lecture)
- SMS fallback (94% lecture)
- Email fallback (32%)
- **Vocal multilingue** pour parents non-alphabétisés (94% compréhension, +24 pts vs SMS)
- Regroupement intelligent par contexte (ex: "14 paiements en retard · 4ᵉ B" vs 14 notifs séparées)

---

## 🔢 Modèle de données suggéré

```typescript
// Core
School        { id, name, logo, period_system: 'trimestre'|'semestre', founded, address, ... }
Cycle         { id, school_id, name, level: 'maternelle'|'primaire'|'college'|'lycee', ... }
Class         { id, cycle_id, name, level, teacher_main, room, ... }
Student       { id, matricule, first_name, last_name, dob, gender, photo, class_id, parents[], ... }
Parent        { id, first_name, last_name, phone, whatsapp, lang_pref: 'fr'|'fon'|'yor'|'bar'|'din', children[], ... }
Teacher       { id, ..., contracts[], subjects[], classes[], ... }

// Périodes (clé)
AcademicYear  { id, school_id, start_date, end_date, period_system, ... }
Period        { id, year_id, index: 1|2|3, label, start, end, conseil_dates, bulletin_date, ... }

// Évaluations
Grade         { id, student_id, subject_id, period_id, value: 0-20, coef, type: 'devoir'|'compo'|'oral', date, ... }
Bulletin      { id, student_id, period_id, generated_at, total_avg, rank, council_comment, ... }

// Finance
SchoolFee     { id, student_id, period_id, amount, due_date, ... }
Payment       { id, fee_id, amount, source: 'mtn'|'moov'|'celtiis'|'cash'|'ecobank'|'boa', ref, status, paid_at, ... }
Wallet        { id, school_id, source, balance, ... }
Cagnotte      { id, class_id, title, target, raised, deadline, organizer_id, transparent_journal[], ... }

// Communication
Notification  { id, recipient_id, channel: 'push'|'whatsapp'|'sms'|'email'|'voice', template_id, lang, status, ... }
VoiceMessage  { id, text_fr, translations: { fon, yor, bar, din }, audio_urls: { ... }, ... }
WhatsAppTemplate { id, name, content, language, status: 'pending'|'approved'|'rejected', meta_template_id, ... }

// Bien-être
WellbeingReport { id, anonymous: bool, reporter_id?, category, content, severity: 'P0'|'P1'|'P2', status, ... }
PsyAppointment  { id, psy_id, student_id?, anonymous_session?, date, duration, kind, ... }

// Comptabilité OHADA
JournalEntry  { id, date, piece_ref, account_syscohada, label, debit?, credit?, ... }
Account       { id, syscohada_code, label, type: 'asset'|'liability'|'income'|'expense', balance, ... }
```

---

## 🔌 Intégrations tierces requises

| Service | Usage | Notes |
|---|---|---|
| **WhatsApp Business API** (via Meta ou aggregator) | Notifications préférées | Templates à valider chez META |
| **MTN MoMo** API | Paiements scolarité | Le plus utilisé au BJ |
| **Moov Africa** Money API | Paiements scolarité | 2ème opérateur |
| **Celtiis Cash** | Paiements scolarité | 3ème opérateur |
| **Flutterwave** | Cartes bancaires + agrégation MoMo | KYC BCEAO requis |
| **Ecobank** / **BoA** | Comptes bancaires | API ou virement manuel |
| **Twilio** ou **Africa's Talking** | SMS fallback | Africa's Talking moins cher au BJ |
| **MEMP open data** | Benchmark national | Pas d'API officielle — scraping mensuel ou partenariat |
| **OpenAI** / **Anthropic** (Claude) | Assistant IA pédago, traductions vocales, génération bulletins | Préférer Claude pour la nuance pédagogique en français |
| **Service de synthèse vocale en langues locales** | Fon, Yoruba, Bariba, Dendi | Pas d'offre off-the-shelf — partenariat universitaire (UAC linguistique appliquée) ou TTS custom |
| **Service Worker / IndexedDB** | Mode offline-first (saisie notes, appel) | Indispensable pour zones rurales |

---

## ⚠️ Spécificités béninoises à NE PAS rater

1. **Mobile-first** absolu : 90% des parents accèdent à l'app via smartphone basique Android < $100. Optimiser les bundles, lazy-load les routes, support 2G/3G.
2. **Multilinguisme** : 38% des parents lisent mal le français. La feature vocale en Fon/Yoruba/Bariba est un différenciateur majeur.
3. **Mobile Money > carte bancaire** : 92% des paiements scolarité se font en MoMo. Mettre MoMo en premier dans tous les flows de paiement.
4. **Conformité MEMP** : système A→G pour l'orientation post-BEPC. CEP en fin CM2. BEPC en fin 3ᵉ. BAC en fin Terminale. Système de notes /20 partout.
5. **Réseau intermittent** : enseignants doivent pouvoir faire l'appel et saisir notes hors connexion. Sync différée.
6. **Calendrier MEMP** : trimestres standardisés (T1 oct-déc, T2 jan-mars, T3 avr-juil). Vacances : Toussaint, Noël, Carnaval/Pâques, Grandes vacances.
7. **Tabaski variable** : Aïd-el-Kébir mobile chaque année. Prévoir gestion calendrier.
8. **OHADA / SYSCOHADA révisé** : plan comptable obligatoire pour la compta. Export DGI obligatoire annuel.
9. **WhatsApp = canal #1** : plus utilisé que Facebook ou Instagram. Numéro WhatsApp Business vérifié META = trust signal.

---

## 🚀 Priorités d'implémentation suggérées

### Phase 1 — MVP (3-4 mois)
1. Auth + onboarding directeur 5 étapes
2. Modèles élèves / classes / parents
3. Saisie notes + génération bulletins
4. Présences (appel quotidien) — **offline-first dès Phase 1**
5. Paiement Mobile Money (MTN minimum)
6. Notifications WhatsApp (rappels paiement + absences)
7. Dashboard directeur + parent + élève + enseignant
8. PWA installable

### Phase 2 — Conformité MEMP (2-3 mois)
9. Orientation A→G + CEP + BEPC
10. Évaluations par compétences MEMP
11. Audit log
12. Import CSV
13. Bourses MEMP

### Phase 3 — Différenciation (3-4 mois)
14. Bascule trim/sem complète
15. Vocal multilingue (le killer feature)
16. Bien-être & cellule d'écoute
17. Benchmark national
18. Comptabilité OHADA
19. Wallet + rapprochement bancaire

### Phase 4 — Communauté (2 mois)
20. Alumni
21. Clubs
22. Cagnottes
23. RH enseignants
24. Marketing site + acquisition

---

## 📐 Conventions de code à respecter

- **Naming** : composants en `PascalCase`, helpers en `camelCase`, constantes en `UPPER_SNAKE_CASE`
- **Tokens** : ne JAMAIS hardcoder de couleur ou de taille dans un composant — toujours via les tokens CSS / Tailwind config
- **Tabular nums** : OBLIGATOIRE sur tout chiffre (notes, montants, dates, pourcentages, durées)
- **Format FCFA** : `125 000` avec espace fine, jamais `125,000` ni `125000`
- **A11y** : focus ring `2px solid var(--brand-500)` sur tous les éléments interactifs, contrast AA minimum (badges respectent ratio 4.5:1)
- **i18n** : aucune chaîne hardcodée — tout dans des fichiers de traduction
- **Skeleton loaders** sur toute liste/table qui charge async
- **Empty states** : illustration + titre + sous-titre + CTA (voir `system-states.jsx → StatesPage`)

---

## 🎯 Démarrage rapide pour le dev

1. **Ouvrir** `EduPilot Design System.html` dans un navigateur (canvas complet, pan/zoom)
2. **Ouvrir** `EduPilot — Nouveautés.html` pour voir la démo de la bascule trim/sem en action
3. **Lire** `tokens.css` — c'est le contrat. Porter ces valeurs en `tailwind.config.ts` (recommandé) ou en variables CSS du système choisi
4. **Étudier** `components.jsx` puis `dashboards.jsx` (DashShell) — ce sont les fondations
5. **Étudier** `value-add-v2.jsx` (VoiceNotifsPage notamment) — c'est le différenciateur business

Pour toute question sur l'intention design : se reporter aux commentaires en tête de chaque fichier JSX.

---

## 📞 Contact design

Ce dossier a été généré via Claude. Pour toute clarification sur l'intention design, ouvrir une discussion avec le PO/designer en référençant explicitement le fichier et la ligne du JSX.
