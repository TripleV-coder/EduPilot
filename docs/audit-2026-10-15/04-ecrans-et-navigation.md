# Livrable 4 — Cartographie des écrans et de la navigation

> Inventaire complet : **annexe A2** (181 pages : chemin, fichier, gardes, appels API, référencement, accès depuis le menu) et **annexe A5** (menus par rôle).
> Méthode : extraction statique des URL littérales dans chaque page et ses composants propres, puis parcours de graphe depuis les menus de rôle (`role-nav.ts`), la barre supérieure, la palette et l'accueil.
> **Limite** : un lien construit dynamiquement autrement que par une URL littérale, ou un lien contenu dans une notification (`notification-links.ts`), n'est pas détecté. Les constats « inaccessible » sont donc à confirmer par une recette de navigation réelle.

## 1. Vue d'ensemble

| Indicateur | Valeur |
|---|---|
| Pages | 181 : 162 sous `/dashboard`, 19 publiques ou d'authentification (`/login`, `/setup`, `/first-login`, `/mfa-*`, `/ecoles`, `/ecole/[code]`, `/explorer`, `/privacy`, `/terms`, `/offline`, `/maintenance`, `/disabled`…) |
| Menus latéraux | 3 à 8 liens par rôle (annexe A5) ; la palette de commandes ajoute quelques actions rapides par rôle (`EduCommandPalette.tsx:27-49`) |
| Liens internes cassés | **0** détecté |
| Appels vers une API inexistante | **0** (les 4 cas signalés par l'outil sont des URL construites dynamiquement) |
| Pages `/dashboard` **sans aucune référence** dans le code | **50** (colonne « Réf. » = Non) |
| Pages `/dashboard` **non atteignables depuis les menus** par liens | **67** (colonne « Accès menu » = —), dont les 50 précédentes |
| Alias redirigés (fichier de page jamais servi) | 5 : `/dashboard/cafeteria`→`canteen`, `/dashboard/health`→`medical`, `/dashboard/schedules`→`schedule`, `/dashboard/ai-assistant`→`ai`, **`/dashboard/staff`→`/dashboard/users`** (`next.config.js:147-176`) |

## 2. Constats confirmés

### NAV-01 — Le module RH n'est pas accessible par la navigation
- **Preuve.**
  - `/dashboard/staff` est un **hub RH** : Personnel, Présence, Congés, Paie (`src/app/(dashboard)/dashboard/staff/page.tsx:10-30`).
  - `next.config.js` le redirige définitivement vers `/dashboard/users`, si bien que ce hub n'est jamais affiché.
  - Les pages `/dashboard/staff/attendance`, `/leaves` et `/payroll` ne sont liées **que** depuis ce hub (`grep`).
- **Impact.** Le chantier RH livré le 2026-07-05 (présence, congés, paie OHADA) n'est atteignable que par URL directe. La redirection permanente (308) est en outre mémorisée par les navigateurs.
- **Origine probable.** Un alias de compatibilité ancien (« staff » = liste du personnel) entre en collision avec le hub RH créé ensuite.

### NAV-02 — Modules activables sans entrée de menu
Ces pages ne sont **référencées nulle part** : cantine, transport, bibliothèque, clubs, contrôle d'accès, alumni, gamification, LMS, compétences, discipline, documents, santé (`/dashboard/medical`), orientation CEP / post-BEPC, préparation BEPC, notifications vocales, WhatsApp, risques (décrochage, dettes, journaux), performances, benchmark.

Pour plusieurs d'entre eux, l'école peut **activer le module** (`/dashboard/settings/modules`, `src/lib/modules/catalog.ts`). L'API s'ouvre alors (`moduleForApiPath`), mais aucun lien ne mène à l'écran.

Question Q-NAV-01 : quels modules doivent avoir une entrée de menu, pour quels rôles ?

### NAV-03 — Doublons d'écrans

| Écrans | Remarque |
|---|---|
| `/dashboard/audit-logs` (atteignable) et `/dashboard/admin/logs` (non référencé) | Deux écrans de journaux |
| `/dashboard/admin/*` (4 pages non référencées) et `/dashboard/settings/*` / `/dashboard/root-control/*` | Ancienne zone d'administration probable |
| `/dashboard/settings/levels` (non référencé) et `/dashboard/settings/class-levels` (atteignable), `/dashboard/settings/cycles` | À rapprocher |
| `/dashboard/settings/academic-config` + `/dashboard/settings/periods` (non atteignables) et `/dashboard/settings/academic` (atteignable) | À rapprocher |
| `/dashboard/students/new` (redirection) et `/dashboard/students/inscription` | La première redirige vers la seconde |
| `/dashboard/finance/export`, `/dashboard/finance/reports` (non référencés) et l'onglet « Rapports » des analyses | À rapprocher |

### NAV-04 — Pages techniques exposées par URL
`/dashboard/design-system` (vitrine de composants) et `/dashboard/system/{info,monitoring,backup,retention}` ne sont référencées nulle part. Leurs gardes figurent dans l'annexe A2 (colonne « Gardes ») ; leur contenu n'a pas été examiné dans ce lot.

## 3. Menu, page et serveur

| Niveau | Mécanisme | Écart constaté |
|---|---|---|
| Menu | `navGroupsForRole` + masquage par cycle et par module | Ne montre que 3 à 8 actions par rôle (choix documenté en tête de `role-nav.ts`) ; tout le reste dépend de l'accueil et des hubs |
| Page | `PageGuard` / `RoleGuard` / `CycleGuard` (annexe A2) et garde de module | 2FA et maintenance appliquées au layout (mémoire) |
| Serveur | `createApiHandler` | Fait foi. Une page peut s'afficher puis recevoir un 403 de l'API (ex. `User.roles[]`, livrable 2) |

## 4. Parcours d'écrans à étapes multiples (repérés)

- Inscription : assistant en étapes, avec brouillon local (MS-04).
- Saisie de notes : sélection classe → matière → évaluation → saisie (brouillon local).
- Finance parent : vue finance → payer → fournisseur → retour.

Le nombre d'étapes « inutiles » ne peut pas être évalué sans décision métier ; il sera traité au lot 2 avec la recette filmée (`e2e/recette/`).
