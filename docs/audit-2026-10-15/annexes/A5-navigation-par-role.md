# Annexe A5 — Menus latéraux par rôle

> Généré le 2026-10-15 par extraction automatique du code (AST TypeScript / analyse du schéma Prisma), branche `feat/enseignant-multi-ecoles`, commit `0d57d9c`. Source : `navGroupsForRole()` de `src/components/edu-shell/role-nav.ts` (barre latérale, menu mobile et palette de commandes). Les conditions cycle/module masquent l'entrée côté interface ; le module est aussi appliqué côté API par `createApiHandler` (`moduleForApiPath`).

## SUPER_ADMIN

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Vue réseau | `/dashboard` |  |
| (global) | Établissements | `/dashboard/root-control/schools` |  |
| (global) | Utilisateurs | `/dashboard/users` |  |
| (global) | Finance consolidée | `/dashboard/finance` |  |
| (global) | Analyses réseau | `/dashboard/analytics` |  |
| (global) | Alertes | `/dashboard/notifications` |  |
| (global) | Assistant IA | `/dashboard/ai` | module ai |
| (global) | Configuration | `/dashboard/settings` |  |

## NETWORK_ADMIN

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Accueil | `/dashboard` |  |
| (global) | Vie scolaire | `/dashboard/calendar` | module schedule |
| (global) | Assistant IA | `/dashboard/ai` | module ai |
| (global) | Paramètres | `/dashboard/settings` |  |

## SCHOOL_ADMIN

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Vue d'ensemble | `/dashboard` |  |
| (global) | Élèves | `/dashboard/students` | module students |
| (global) | Notes & bulletins | `/dashboard/grades` | module grades |
| (global) | Appel | `/dashboard/attendance` | module attendance |
| (global) | Finance | `/dashboard/finance` | module finance |
| (global) | Messages | `/dashboard/messages` | module messaging |
| (global) | Assistant IA | `/dashboard/ai` | module ai |
| (global) | Paramètres | `/dashboard/settings` |  |

## DIRECTOR

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Vue d'ensemble | `/dashboard` |  |
| (global) | Élèves | `/dashboard/students` | module students |
| (global) | Notes & bulletins | `/dashboard/grades` | module grades |
| (global) | Appel | `/dashboard/attendance` | module attendance |
| (global) | Finance | `/dashboard/finance` | module finance |
| (global) | Messages | `/dashboard/messages` | module messaging |
| (global) | Assistant IA | `/dashboard/ai` | module ai |
| (global) | Paramètres | `/dashboard/settings` |  |

## TEACHER

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Mes classes | `/dashboard` |  |
| (global) | Mes élèves | `/dashboard/students` | module students |
| (global) | Saisie de notes | `/dashboard/grades/entry` | module grades |
| (global) | Cahier de textes | `/dashboard/grades/cahier` | module grades |
| (global) | Appel du jour | `/dashboard/attendance` | module attendance |
| (global) | Emploi du temps | `/dashboard/schedule` | module schedule |
| (global) | Messages | `/dashboard/messages` | module messaging |
| (global) | Assistant IA | `/dashboard/ai` | module ai |

## STAFF

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Accueil | `/dashboard` |  |
| (global) | Vie scolaire | `/dashboard/calendar` | module schedule |
| (global) | Paramètres | `/dashboard/settings` |  |

## ACCOUNTANT

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Vue d'ensemble | `/dashboard` |  |
| (global) | Élèves | `/dashboard/students` | module students |
| (global) | Finance | `/dashboard/finance` | module finance |
| (global) | Portefeuille | `/dashboard/wallet` | module finance |
| (global) | Comptabilité OHADA | `/dashboard/accounting` | module finance |
| (global) | Paramètres | `/dashboard/settings` |  |

## PARENT

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Accueil | `/dashboard` |  |
| (global) | Mes enfants | `/dashboard/students` | module students |
| (global) | Cahier de liaison | `/dashboard/liaison` | module messaging |
| (global) | Assiduité | `/dashboard/attendance` | module attendance |
| (global) | Paiements | `/dashboard/finance` | module finance |
| (global) | Emploi du temps | `/dashboard/schedule` | module schedule |
| (global) | Assistant IA | `/dashboard/ai` | module ai |
| (global) | Mon compte | `/dashboard/settings` |  |

## STUDENT

| Groupe | Libellé | Lien | Condition |
|---|---|---|---|
| (global) | Mon tableau | `/dashboard` |  |
| (global) | Mes notes | `/dashboard/grades` | module grades |
| (global) | Devoirs | `/dashboard/homework` | module schedule |
| (global) | Emploi du temps | `/dashboard/schedule` | module schedule |
| (global) | Mon assiduité | `/dashboard/attendance` | module attendance |
| (global) | Mon orientation | `/dashboard/orientation/me` |  |
| (global) | Messagerie | `/dashboard/messages` | module messaging |
| (global) | Assistant IA | `/dashboard/ai` | module ai |

