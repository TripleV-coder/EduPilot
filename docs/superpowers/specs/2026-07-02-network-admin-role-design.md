# Rôle NETWORK_ADMIN & recentrage des rôles — Tranche A

**Date:** 2026-07-02
**Statut:** design — en attente de validation
**Périmètre:** création du rôle `NETWORK_ADMIN` (patron d'un groupe d'écoles) + migration
automatique des comptes + ouverture des écrans réseau à ce rôle avec cloisonnement strict.
Première tranche de la réorganisation des rôles (tranches B et C listées en fin de document).

## Problème

`SUPER_ADMIN` cumule aujourd'hui deux casquettes incompatibles :

1. **Opérateur de la plateforme** (l'éditeur EduPilot) — gère les écoles clientes et
   les souscriptions.
2. **Patron d'un réseau d'écoles** (multi-campus via `parentSchoolId` / `Organization`)
   — pilote SES établissements : finance consolidée, analytics réseau, utilisateurs.

Conséquence : l'opérateur de la plateforme voit les élèves (PII), les notes et les
finances de toutes les écoles clientes — un problème de confidentialité (minimisation
RGPD) et une surface d'exposition énorme si un compte SUPER_ADMIN est compromis.

## Cible validée (vue d'ensemble des rôles)

Trois niveaux. Cette tranche crée le niveau Réseau ; le rétrécissement du niveau
Plateforme est la tranche B.

| Niveau | Rôle | Mission | Ne voit pas |
|---|---|---|---|
| Plateforme | `SUPER_ADMIN` | Écoles/réseaux (cycle de vie), plans & souscriptions (MRR, impayés, churn), analytics **agrégées anonymes**, config plateforme, mode assistance audité | Élèves, notes, finances des écoles, messagerie interne *(effectif en tranche B)* |
| Réseau | `NETWORK_ADMIN` *(nouveau)* | Tout ce que fait un SCHOOL_ADMIN, sur **toutes les écoles de son réseau** : vue consolidée, finance consolidée de SES écoles, analytics inter-écoles, création des admins de ses établissements, bascule d'école | Tout ce qui est hors de son réseau ; les données plateforme (souscriptions des autres, config globale, root-control) |
| École | `SCHOOL_ADMIN` | Gestion complète de son école ; seul rôle école avec les suppressions | Hors de son école |
| École | `DIRECTOR` | Même périmètre que SCHOOL_ADMIN **sans suppressions** ; pilotage pédagogique | Suppressions ; hors école |
| École | `ACCOUNTANT` | Frais, encaissements, écritures, OHADA ; lit les élèves pour facturer | Notes, pédagogie |
| École | `STAFF` | Vie scolaire : appel, incidents, santé (lecture), cantine, bibliothèque | Écritures hors `allowedRoles` (a `SCHOOL_READ`, pas `SCHOOL_UPDATE`) |
| École | `TEACHER` / `PARENT` / `STUDENT` | Inchangés : ses classes / ses enfants / ses propres données | — |

### Décisions actées (dialogue 2026-07-02)

- **Scinder maintenant** : NETWORK_ADMIN naît dans cette tranche ; SUPER_ADMIN
  **garde temporairement son accès global** (le retirer = tranche B). Aucune
  régression possible pendant la transition.
- **NETWORK_ADMIN = SCHOOL_ADMIN multi-écoles** : accès complet aux données de ses
  écoles (il est le responsable de traitement de son groupe). La restriction de
  confidentialité ne vise que l'opérateur plateforme.
- **Migration automatique par rattachement** : tout `SUPER_ADMIN` avec un
  `schoolId` non nul devient `NETWORK_ADMIN` ; les comptes sans rattachement
  (opérateur plateforme) restent `SUPER_ADMIN`.
- **Tranche B** (hors périmètre ici) : réduction du SUPER_ADMIN + écrans
  souscriptions (MRR/impayés/churn, modèle `SubscriptionInvoice` à créer) +
  analytics plateforme agrégées.
- **Tranche C** (hors périmètre ici) : mode assistance break-glass audité
  (accès temporaire d'un SUPER_ADMIN à une école, AuditLog, bannière, expiration).

## Ce qui existe déjà (réutilisé, pas réinventé)

- `enum UserRole` (Prisma) + `rolePermissions` / `roleHierarchy` /
  `roleCreationMatrix` (`src/lib/rbac/permissions.ts`).
- **Accès multi-écoles déjà câblé** : `getAccessibleSchoolIdsForUser`
  (`src/lib/auth/school-access.ts`) calcule déjà site MAIN + `childSchools` +
  organisations (`OrganizationMembership`) pour SCHOOL_ADMIN/DIRECTOR ;
  `session.user.accessibleSchoolIds` transite déjà par le JWT (`src/lib/auth/edge.ts`).
- **Bascule d'école active existante** : `resolveActiveSchoolId` +
  `/api/schools/context` (chemin non-SUPER_ADMIN générique) + sélecteur UI
  (`setActiveSchoolId` consommé par `src/components/dashboard/Header.tsx` et
  `AnalyticsContextBar`).
- **Nav réseau existante** : le case SUPER_ADMIN de
  `src/components/edu-shell/role-nav.ts` (Vue réseau, Établissements, Utilisateurs,
  Finance consolidée, Analyses réseau, Alertes, Configuration) — c'est exactement la
  nav cible du NETWORK_ADMIN.
- **Points de contrôle centralisés** : `createApiHandler`/`authorizeRole`
  (`src/lib/api/api-helpers.ts`), `useRBAC().canAccess` (PageGuard),
  `RoleActionGuard` — trois goulots par lesquels passent les checks de rôle.
- Cloisonnement : `tenant-isolation.ts` (`getSchoolFilter`, `canAccessSchool`,
  `getAccessibleSchoolIds`).

## Architecture

### 1. Prisma — enum + migration de données

- `enum UserRole` += `NETWORK_ADMIN`.
- Migration en deux temps dans le même fichier SQL (pattern `prisma migrate diff`
  hors-ligne déjà utilisé) :
  1. `ALTER TYPE` — ajout de la valeur d'enum.
  2. Bascule des comptes : `UPDATE` des utilisateurs `SUPER_ADMIN` dont le
     `schoolId` est non nul → `NETWORK_ADMIN`.
- ⚠️ PostgreSQL interdit d'utiliser une valeur d'enum ajoutée dans la même
  transaction : la migration de données doit être un fichier de migration **séparé**
  (deux migrations successives).
- Les JWT existants portent l'ancien rôle : les comptes migrés doivent se
  reconnecter (durée de vie du token) ; à noter dans le CHANGELOG de release.

### 2. RBAC — `permissions.ts`

- `rolePermissions.NETWORK_ADMIN` = même ensemble que `SCHOOL_ADMIN`
  (`SCHOOL_LEVEL_BASE_PERMISSIONS` + les DELETE) **+ `SCHOOL_CREATE`** (il peut
  ouvrir une annexe dans son réseau) — c'est la seule différence de permissions.
- `roleHierarchy.NETWORK_ADMIN = 90` (entre SUPER_ADMIN 100 et SCHOOL_ADMIN 80).
- `roleCreationMatrix.NETWORK_ADMIN = [SCHOOL_ADMIN, DIRECTOR, TEACHER, ACCOUNTANT,
  STAFF, STUDENT, PARENT]` ; `SUPER_ADMIN` gagne `NETWORK_ADMIN` dans sa liste
  (sa réduction = tranche B).
- L'ajout à l'enum casse tous les `Record<UserRole, …>` exhaustifs : **le typecheck
  pilote le balayage** (labels, hiérarchie, matrices, i18n).

### 3. Expansion centralisée — `roleSatisfies`

Nouveau helper dans `src/lib/rbac/permissions.ts` :

```
roleSatisfies(role, allowedRoles): boolean
// true si allowedRoles contient role,
// OU si role === "NETWORK_ADMIN" et allowedRoles contient "SCHOOL_ADMIN".
```

- Appliqué aux **trois goulots** : `authorizeRole` + le check `allowedRoles` de
  `createApiHandler` (serveur), `useRBAC().canAccess` (pages), `RoleActionGuard`
  (actions). On ne touche **pas** aux centaines de littéraux `allowedRoles` existants.
- **Jamais d'expansion vers SUPER_ADMIN** : un écran/route qui n'autorise que
  `SUPER_ADMIN` (root-control, RGPD global, sécurité plateforme) reste fermé au
  NETWORK_ADMIN.
- Audit complémentaire : grep des comparaisons directes
  (`role === "SCHOOL_ADMIN"`, `role !== …`) hors goulots ; chaque occurrence est
  soit routée par `roleSatisfies`, soit documentée comme volontairement stricte.

### 4. Périmètre de données (cloisonnement)

- `getAccessibleSchoolIdsForUser` : la branche `SCHOOL_ADMIN || DIRECTOR`
  (site MAIN + `childSchools` + organisations) s'étend à `NETWORK_ADMIN`.
- **Aucun bypass** : NETWORK_ADMIN passe par le chemin utilisateur normal de
  `tenant-isolation.ts` (`getSchoolFilter` = école active ; `canAccessSchool` via
  `accessibleSchoolIds`). Il travaille école par école via le sélecteur existant.
- **Écrans consolidés réseau** (ceux de la nav réseau : vue réseau, finance
  consolidée, analyses réseau, liste utilisateurs, établissements) : leurs routes
  API ajoutent `NETWORK_ADMIN` aux rôles autorisés et, quand le rôle est
  NETWORK_ADMIN, **scoppent chaque requête par `getAccessibleSchoolIds(session)`**
  (`schoolId: { in: … }`) au lieu du scope global SUPER_ADMIN. Services concernés :
  `root-system-map`, `analytics-dashboard/admin`, la route finance consolidée,
  `/api/users` (liste réseau), `/api/root/schools` (restreint à ses écoles).
- `/api/schools/context` : rien à faire — le chemin non-SUPER_ADMIN est générique
  et couvrira NETWORK_ADMIN dès que `getAccessibleSchoolIdsForUser` le connaît.

### 5. Nav & libellés

- `role-nav.ts` : case `NETWORK_ADMIN` = copie de la nav réseau actuelle du
  SUPER_ADMIN (qui la conserve aussi jusqu'à la tranche B). Libellé rôle :
  « Admin réseau ».
- i18n (`fr.json`) et tout map de labels par rôle : complétés (poussés par le
  typecheck, cf. §2).

### 6. Gardes de pages réseau

Les pages du dashboard réseau actuellement durcies `SUPER_ADMIN` seul
(cf. commit 8923c3e) qui correspondent à la nav réseau ajoutent `NETWORK_ADMIN`
à leurs `roles`. Les pages **plateforme** (root-control création/suppression
d'écoles hors réseau, admin sécurité, RGPD global) restent SUPER_ADMIN seul.
La liste exacte est établie par grep lors de l'implémentation, page par page,
avec le critère : « un patron de réseau en a-t-il besoin pour SES écoles ? ».

## Gestion des états

Les écrans réseau existent déjà (états loading/empty/error/success gérés). Seul
ajout : l'empty state « réseau d'une seule école » reste fonctionnel (un
NETWORK_ADMIN mono-école voit sa seule école partout — pas d'écran cassé).

## Sécurité

- NETWORK_ADMIN n'a **jamais** de scope global : toute requête réseau est bornée
  par `accessibleSchoolIds` côté serveur (pas seulement côté nav).
- `roleSatisfies` n'étend jamais vers SUPER_ADMIN (pas d'escalade).
- La migration de rôle est un événement d'audit : la migration SQL insère une
  ligne `AuditLog` par compte basculé (action `UPDATE`, entity `User.role`,
  `oldValues`/`newValues`).
- Tests de non-escalade explicites (voir Tests).

## Tests

- **Unit `roleSatisfies`** : NETWORK_ADMIN passe où SCHOOL_ADMIN est listé ; ne
  passe pas où seul SUPER_ADMIN est listé ; les autres rôles inchangés.
- **Unit `rolePermissions`** : NETWORK_ADMIN = SCHOOL_ADMIN + `SCHOOL_CREATE` ;
  matrice de création ; hiérarchie.
- **Unit `getAccessibleSchoolIdsForUser`** : NETWORK_ADMIN sur site MAIN avec
  annexes → toutes ses écoles ; mono-école → sa seule école ; jamais d'écoles
  hors réseau.
- **Guard API** : route à `allowedRoles: ["SUPER_ADMIN"]` → 403 pour
  NETWORK_ADMIN ; route à `allowedRoles: ["SCHOOL_ADMIN", …]` → 200 ; requête
  réseau scoppée (le `where` contient `schoolId: { in: … }`).
- **Nav** : `visibleNavGroups("NETWORK_ADMIN", …)` = nav réseau ; celle du
  SUPER_ADMIN inchangée.
- **Régression** : aucun test existant des 8 rôles actuels ne change de résultat.

## Hors périmètre (tranches suivantes)

1. **Tranche B — SUPER_ADMIN opérateur** : retrait du god mode (permissions +
   bypass `tenant-isolation`), nouveau dashboard opérateur (établissements,
   souscriptions MRR/impayés/churn — nécessite `SubscriptionInvoice`), analytics
   plateforme agrégées anonymes, réduction de `roleCreationMatrix.SUPER_ADMIN` à
   `[NETWORK_ADMIN, SCHOOL_ADMIN]`.
2. **Tranche C — mode assistance (break-glass)** : accès temporaire audité d'un
   SUPER_ADMIN à une école (grant explicite, AuditLog, bannière UI, expiration).
3. `organizationType` et refonte du modèle Organisation (spec feature-gating §5).
4. La spec « Profil établissement & feature-gating » du 2026-07-02 reste valable
   et indépendante (aucun chevauchement RBAC).

## Ordre d'implémentation

1. Enum Prisma + migration d'ajout (sans bascule de données).
2. RBAC : permissions, hiérarchie, matrices + `roleSatisfies` + tests.
3. Balayage typecheck (labels, i18n, maps exhaustifs).
4. `getAccessibleSchoolIdsForUser` + tests cloisonnement.
5. Goulots (`createApiHandler`/`authorizeRole`, `useRBAC`, `RoleActionGuard`) +
   audit grep des comparaisons directes.
6. Routes/services réseau : `NETWORK_ADMIN` autorisé + scoping `{ in: … }` + tests.
7. Nav + gardes de pages réseau.
8. Migration de bascule des comptes (fichier séparé) + AuditLog.
