# RAPPORT DE SYNCHRONISATION BACKEND → FRONTEND

Date: `2026-04-09`

Référence Phase 1: `docs/PHASE1-VERIFIED-AUDIT.md`

## 1. Routes API couvertes par le frontend

Snapshot global conservé depuis l'audit Phase 1 vérifié:

- `219` routes API recensées
- `152` routes `✅ Couvert`
- `53` routes `⚠️ Partiel`
- `14` routes `❌ Absent`

Routes remises en cohérence dans cette session:

- `PATCH /api/user/profile` → `✅ Couvert`
  - supporte maintenant les mises à jour partielles utilisées par `appearance`, `locale`, `rooms`, `notifications`
- `POST /api/auth/mfa/setup?action=generate` → `✅ Couvert`
- `POST /api/auth/mfa/setup?action=enable` → `✅ Couvert`
- `POST /api/auth/mfa/setup?action=disable` → `✅ Couvert`
- `POST /api/auth/forgot-password` → `✅ Couvert`
  - utilisé depuis `settings/security` comme vrai flux de changement de mot de passe disponible
- `GET /api/config-options` → `✅ Couvert`
- `POST /api/config-options` → `✅ Couvert`
- `GET /api/config-options/[id]` → `✅ Couvert`
- `PATCH /api/config-options/[id]` → `✅ Couvert`
- `DELETE /api/config-options/[id]` → `✅ Couvert`
- `GET /api/subject-categories` → `✅ Couvert`
- `POST /api/subject-categories` → `✅ Couvert`
- `GET /api/subject-categories/[id]` → `✅ Couvert`
- `PATCH /api/subject-categories/[id]` → `✅ Couvert`
- `DELETE /api/subject-categories/[id]` → `✅ Couvert`

Routes encore partiellement couvertes après cette passe:

- analytics avancés multi-contexte
- palette de commandes avec recherche universelle entités
- centre de notifications par préférences fines métier
- plusieurs vues risques/finance encore orientées cartes, pas DataTable complète

## 2. Pages frontend créées ou corrigées

Créations:

- `src/app/(dashboard)/dashboard/settings/config-options/page.tsx`
- `src/app/(dashboard)/dashboard/settings/subject-categories/page.tsx`

Corrections:

- `src/app/(dashboard)/dashboard/settings/security/page.tsx`
  - branchement réel MFA + reset password backend
- `src/app/(dashboard)/dashboard/settings/notifications/page.tsx`
  - persistance réelle via `user.preferences.notifications`
- `src/app/(dashboard)/dashboard/settings/appearance/page.tsx`
  - modes `comfort` / `dense` / `focus` + persistance serveur
- `src/components/dashboard/DashboardLayoutClient.tsx`
  - lecture et persistance des préférences d'apparence depuis `user.preferences.appearance`
- `src/app/(dashboard)/dashboard/settings/page.tsx`
  - exposition des nouvelles pages dans l'index des paramètres
- `src/app/(dashboard)/dashboard/settings/subjects/page.tsx`
  - remplacement des catégories hardcodées par `/api/subject-categories`

Correctifs backend nécessaires à la synchro:

- `src/app/api/user/profile/route.ts`
  - acceptation des PATCH partiels
- `src/app/api/config-options/route.ts`
- `src/app/api/config-options/[id]/route.ts`
  - alignement des champs JSON avec les types Prisma

## 3. Modèles Prisma et leur exposition UI

Modèles couverts ou étendus dans cette session:

- `User`
  - UI: `settings/profile`, `settings/security`, `settings/notifications`, `settings/appearance`
  - rôles: tous rôles authentifiés
- `ConfigOption`
  - UI: `settings/config-options`
  - rôles: `SUPER_ADMIN`, `SCHOOL_ADMIN`
- `SubjectCategory`
  - UI: `settings/subject-categories`, consommé aussi dans `settings/subjects`
  - rôles: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `DIRECTOR`

## 4. Vérification de l'isolation tenant

Constats confirmés:

- les nouvelles pages `config-options` et `subject-categories` s'appuient sur les routes tenant-aware existantes
- ces routes ne demandent pas de `schoolId` côté frontend, ce qui est cohérent avec le backend réel
  - l'établissement actif est résolu via la session et `getActiveSchoolId(session)`
- les préférences utilisateur sont stockées sur `User.preferences`
  - pas de fuite inter-tenant, car la route cible toujours `session.user.id`
- les pages nouvelles ou corrigées gardent les contraintes de rôles déjà définies côté API

## 5. Ce qui reste à faire

Priorité 1:

- finir le module Analytics pour couvrir le cahier des charges complet des 7 onglets
- introduire un `AnalyticsContextBar` partagé au lieu des filtres locaux actuels

Priorité 2:

- enrichir la palette de commandes avec recherche d'entités réelles (`élèves`, `enseignants`, `classes`, `pages`, `actions`)
- brancher les préférences de notifications sur des catégories métier plus fines et, si besoin, sur un service dédié

Priorité 3:

- standardiser les pages de settings encore semi-statiques (`levels`, `rooms`, autres écrans de configuration locale)
- convertir davantage de listes en pattern DataTable + Sheet homogène

## 6. Vérification technique

- `npm run type-check` exécuté via `./scripts/use-local-node.sh`
- résultat: `OK`
