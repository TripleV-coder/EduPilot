# Profil établissement & feature-gating — Tranche 1

**Date:** 2026-07-02
**Statut:** design — en attente de validation
**Périmètre:** socle « profil établissement » (modules activables) + application à la sidebar/nav + famille « Préparation examens » (CEP/BEPC/BAC) comme premier consommateur.

## Problème

EduPilot expose aujourd'hui toutes les features à tout le monde, indépendamment de la
structure réelle de l'établissement. Conséquences :

- `/dashboard/bepc-prep` existe mais n'est pas dans la sidebar, et il n'existe pas de
  CEP Prep ni de BAC Prep — incohérence produit.
- Aucun moyen d'activer/désactiver des modules **optionnels** (cantine, transport,
  bibliothèque, LMS, comptabilité, orientation…) selon les besoins de l'école.
- Un établissement primaire voit des écrans collège/lycée sans objet, et inversement.

La bonne règle produit : **rien n'apparaît si ce n'est pas utile ; tout ce qui apparaît
est adapté au type d'établissement.**

## Ce qui existe déjà (réutilisé, pas réinventé)

- `School.offeredLevels: SchoolLevel[]` (Prisma) — cycles offerts (`PRIMARY` /
  `SECONDARY_COLLEGE` / `SECONDARY_LYCEE`).
- Primitif de gating par cycle dans `src/components/edu-shell/role-nav.ts` :
  `requiresCycle` sur `NavLink`/`NavGroup` + `visibleNavGroups(role, offeredLevels)`.
  Aujourd'hui **quasi inutilisé** (aucun lien n'a de `requiresCycle`).
- Référentiel Bénin dans `src/lib/benin/levels.ts` :
  `examForLevel()`, `examsForOfferedLevels()`, `LEVEL_CYCLES`. Les examens
  (CEP/BEPC/BAC) sont **dérivés des cycles** — pas besoin d'un champ config séparé.
- `SchoolProvider` (`src/components/providers/school-provider.tsx`) fetch
  `/api/schools/context` et expose déjà `offeredLevels` — point d'injection naturel.
- Pattern de config par école : `/api/config/academic/route.ts` (GET/PATCH,
  `WRITE_ROLES`, `AcademicConfig` upsert, `auditLog`) — servira de modèle.
- Gardes de page dures RBAC (cf. commit 8923c3e) — pattern à reproduire côté serveur.

## Décisions de scope (YAGNI)

- **`enabledModules`** (nouveau) : inclus dans cette tranche — c'est le manque réel.
- **`organizationType`** (`SINGLE_SCHOOL`/`SCHOOL_GROUP`/`NETWORK`) : **reporté** à une
  tranche ultérieure. Le multi-campus/réseau fonctionne déjà via les rôles
  (`SUPER_ADMIN`) et `parentSchoolId` ; pas nécessaire pour la sidebar + exam prep.
- **Surfaces branchées ici** : sidebar (`EduSidebar`) + nav mobile (`EduMobileNav`).
  **Reportées** : dashboard home, command palette, topbar shortcuts, cartes analytics,
  onboarding — chacune deviendra sa propre tranche spec→plan→impl.

## Architecture

### 1. Modèle de données (Prisma)

Ajouter à `model School` :

```prisma
enabledModules String[] @default([])  // clés de modules OPTIONNELS activés
```

Défaut `[]` = comportement sûr : voir §3 (les modules core restent visibles ; les
modules optionnels sont masqués tant que non explicitement activés — **sauf** phase de
migration, cf. « Défaut sûr » plus bas).

Migration Prisma additive (aucune donnée existante cassée).

### 2. Registre canonique des modules — `src/lib/establishment/modules.ts` (nouveau)

Source unique de vérité, typée :

- `type ModuleKey` (const enum-like) : modules **core** (toujours visibles) vs
  **optionnels** (gatés par `enabledModules`).
  - Core (exemples, à confirmer sur l'existant) : `STUDENTS`, `CLASSES`, `GRADES`,
    `ATTENDANCE`, `MESSAGES`, `DOCUMENTS`.
  - Optionnels : `FINANCE`, `LIBRARY`, `CANTEEN`, `TRANSPORT`, `LMS`, `HEALTH`,
    `ORIENTATION`, `ACCOUNTING`, `EXAM_PREP`.
- Registre `MODULES: Record<ModuleKey, { label; core: boolean; description }>`.
- Helpers : `isModuleEnabled(key, enabledModules)`, `optionalModules()`,
  `coreModules()`.
- La famille examens (`EXAM_PREP`) est un module optionnel unique ; ses **sous-modules
  CEP/BEPC/BAC sont dérivés de `offeredLevels`** via `examsForOfferedLevels()` — pas de
  clés séparées.

### 3. Extension du primitif de gating — `role-nav.ts`

- Ajouter `requiresModule?: ModuleKey` à `NavLink` et `NavGroup` (parallèle à
  `requiresCycle`).
- Signature enrichie :
  `visibleNavGroups(role, ctx: { offeredLevels?: string[]; enabledModules?: string[] })`.
  Filtre par `requiresCycle` **et** `requiresModule`.
- **Défaut sûr / rétro-compat** : si `enabledModules` est `undefined` (donnée pas encore
  migrée / provider pas encore mis à jour) → ne pas masquer les modules optionnels
  (comme aujourd'hui pour `offeredLevels` vide). Une fois la migration passée, un tableau
  vide `[]` masque bien les optionnels.
- Ajouter le groupe **« Préparation examens »** (`requiresModule: EXAM_PREP`), rendu pour
  les rôles concernés (DIRECTOR/SCHOOL_ADMIN, TEACHER, STUDENT) avec 3 sous-liens gatés
  par cycle :
  - CEP Prep → `requiresCycle: PRIMARY`
  - BEPC Prep → `requiresCycle: SECONDARY_COLLEGE`
  - BAC Prep → `requiresCycle: SECONDARY_LYCEE`

### 4. Route unifiée exam prep

Remplacer la page isolée `/dashboard/bepc-prep` par une route paramétrique :
`/dashboard/exam-prep/[track]` où `track ∈ {cep, bepc, bac}`.

- Redirection de compat : `/dashboard/bepc-prep` → `/dashboard/exam-prep/bepc`.
- La page lit `track`, vérifie que le cycle correspondant est dans `offeredLevels` et que
  `EXAM_PREP` est activé, sinon **404/redirect** (garde dure, pas seulement masquage nav).

### 5. Câblage provider / API

- `/api/schools/context` : ajouter `enabledModules` à la réponse.
- `SchoolProvider` : exposer `enabledModules: string[]` dans le contexte.
- `EduSidebar` + `EduMobileNav` : passer `{ offeredLevels, enabledModules }` à
  `visibleNavGroups`.

### 6. Administration des modules

- `/api/config/modules/route.ts` (nouveau) : GET (profil courant) + PATCH (activer/
  désactiver), calqué sur `config/academic` — `WRITE_ROLES = [SUPER_ADMIN, SCHOOL_ADMIN,
  DIRECTOR]`, upsert sur `School.enabledModules`, `auditLog`. Valide les clés contre le
  registre (rejette toute clé inconnue ou core).
- `/dashboard/settings/modules/page.tsx` (nouveau) : liste des modules optionnels avec
  toggles (switch Radix déjà dans les deps), état loading/empty/error/success.

### 7. Enforcement serveur (sécurité — non négociable)

Masquer la nav ne protège pas les données. Ajouter :

- Helper `assertModuleEnabled(session|schoolId, moduleKey)` dans
  `src/lib/api/` (à côté de `tenant-isolation.ts`) → 403 si module désactivé.
- Appliqué aux routes API `exams/prep` et à la garde de page `exam-prep/[track]`.

## Gestion des états

Chaque surface gère : loading (skeleton nav), empty (aucun module optionnel activé →
sidebar core only), error (fetch context échoue → défaut sûr = tout core visible,
optionnels masqués), success, offline (le provider a déjà un fallback cookie).

## Tests

- **Unit** `visibleNavGroups` : matrice rôle × cycle × module (ex. primaire + EXAM_PREP →
  seul CEP visible ; lycée sans EXAM_PREP → aucun prep).
- **Unit** registre modules : intégrité clés core/optionnelles, rejet clé inconnue.
- **Unit** dérivation exam tracks depuis `offeredLevels` (réutilise `levels.ts`).
- **Guard** : route `exam-prep/[track]` et `/api/config/modules` → 403/404 selon module/
  cycle/rôle.
- **Régression** : `offeredLevels`/`enabledModules` absents → aucun masquage (rétro-compat).

## Contexte produit — héritage EduNet

EduPilot est la refonte aboutie d'**EduNet** (v1 PHP en prod, `edunet.star-kin.com`).
EduNet sert la RDC et propose un onboarding multi-pays (23 pays / 20+ devises / type
Privé-Public-**Confessionnel**). EduPilot, lui, est aujourd'hui **codé spécifiquement
Bénin** (`src/lib/benin/levels.ts`, examens CEP/BEPC/BAC, séries A/B/C/D). L'onboarding
self-service d'EduNet valide le besoin d'un profil établissement « structure-aware » ;
sa dimension multi-pays impose, **à terme**, une localisation du système d'examens.
Cette tranche 1 reste volontairement Bénin (voir hors périmètre §5).

## Hors périmètre (tranches suivantes)

1. `organizationType` + options structurelles (multi-campus avancé, réformes, pilotage).
2. Branchement dashboard home / command palette / topbar shortcuts / cartes analytics.
3. Onboarding « structure-aware » (assistant de configuration établissement, inspiré du
   wizard 6 étapes d'EduNet).
4. Familles Prep additionnelles (Concours / Université) si besoin métier confirmé.
5. **Localisation multi-pays** : dimension `country` / système d'examens sur le profil
   établissement (héritage EduNet RDC + 23 pays). Le registre modules et le primitif de
   gating de cette tranche doivent rester **agnostiques du pays** pour ne pas bloquer
   cette évolution — mais aucune logique multi-pays n'est implémentée ici.

## Ordre d'implémentation

1. Registre modules (`lib/establishment/modules.ts`) + tests.
2. Migration Prisma `enabledModules` + `/api/schools/context` + provider.
3. Extension `role-nav.ts` (`requiresModule`, `visibleNavGroups` enrichie) + groupe
   exam prep + tests.
4. Route unifiée `exam-prep/[track]` + redirect compat + garde dure.
5. Enforcement serveur (`assertModuleEnabled`) sur routes prep.
6. `/api/config/modules` + page settings toggles.
7. Branchement `EduSidebar` + `EduMobileNav`.
