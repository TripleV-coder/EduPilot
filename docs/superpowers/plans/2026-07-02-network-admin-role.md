# Rôle NETWORK_ADMIN (Tranche A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le rôle `NETWORK_ADMIN` (patron d'un groupe d'écoles), migrer les comptes SUPER_ADMIN rattachés à une école, et lui donner accès aux écrans réseau — le tout cloisonné à son réseau, sans modifier aucune feature existante.

**Architecture:** Nouvelle valeur d'enum `UserRole` → helper d'expansion `roleSatisfies` appliqué aux 3 goulots de vérification de rôle (serveur `createApiHandler`, client `useRBAC`, `RoleActionGuard`) pour que NETWORK_ADMIN passe partout où SCHOOL_ADMIN est listé (jamais où seul SUPER_ADMIN l'est) → périmètre de données via `getAccessibleSchoolIdsForUser` (déjà multi-écoles) → nav curatée + migration de bascule des comptes. Strictement additif et rétro-compatible.

**Tech Stack:** Next.js (App Router), TypeScript strict, Prisma (PostgreSQL), Vitest, NextAuth, SWR.

## Global Constraints

- **AUCUNE feature actuelle ne change.** Travail strictement additif : on ajoute une valeur d'enum, des entrées dans des `Record<UserRole, …>`, des branches de code — on ne retire ni ne modifie aucun comportement des 8 rôles existants.
- **Jamais d'escalade vers SUPER_ADMIN.** `roleSatisfies` étend uniquement NETWORK_ADMIN → SCHOOL_ADMIN. Un écran/route réservé `["SUPER_ADMIN"]` reste fermé au NETWORK_ADMIN.
- **NETWORK_ADMIN n'a jamais de scope global.** Toute requête réseau est bornée côté serveur par `getAccessibleSchoolIds(session)` (`schoolId: { in: … }`), jamais par l'absence de filtre.
- **Migration Prisma additive.** L'ajout de valeur d'enum et la bascule des données sont **deux fichiers de migration séparés** (PostgreSQL interdit d'utiliser une valeur d'enum ajoutée dans la même transaction).
- **TypeScript strict**, pas de `any` non justifié. Le typecheck (`npm run type-check`) pilote le balayage des `Record<UserRole, …>` exhaustifs.
- Les comptes migrés portent l'ancien rôle dans leur JWT → ils doivent se reconnecter. À noter au CHANGELOG.

---

## File Structure

**Créés :**
- `prisma/migrations/<ts>_add_network_admin_role/migration.sql` — `ALTER TYPE "UserRole" ADD VALUE`.
- `prisma/migrations/<ts>_migrate_super_admin_to_network_admin/migration.sql` — bascule des comptes + AuditLog (fichier séparé).
- `src/lib/rbac/role-satisfies.test.ts` — tests du helper d'expansion.
- `src/lib/rbac/network-admin.test.ts` — tests des Records RBAC pour NETWORK_ADMIN.
- `src/lib/auth/school-access.test.ts` (si absent) — tests du périmètre multi-écoles.
- `src/lib/api/network-scope.test.ts` — tests du helper de scoping réseau.

**Modifiés (ajout seulement) :**
- `prisma/schema.prisma` — `enum UserRole` += `NETWORK_ADMIN`.
- `src/lib/rbac/permissions.ts` — `rolePermissions`, `roleHierarchy`, `roleCreationMatrix`, `getRoleName`, `ROLE_LABELS` (déplacé ? non : reste dans role-nav.ts), `roleSatisfies` (nouveau), `authorizeRoles`.
- `src/lib/api/api-helpers.ts` — check `allowedRoles` inline via `roleSatisfies`.
- `src/lib/hooks/use-rbac.ts` — `canAccess` via `roleSatisfies`.
- `src/components/guard/role-action-guard.tsx` — check `allowedRoles` via `roleSatisfies`.
- `src/lib/auth/school-access.ts` — branche `NETWORK_ADMIN` dans `getAccessibleSchoolIdsForUser`.
- `src/lib/api/tenant-isolation.ts` — helper `getNetworkScopeFilter`.
- `src/app/api/users/route.ts` — branche NETWORK_ADMIN (scope réseau) dans le GET.
- `src/components/edu-shell/role-nav.ts` — case `NETWORK_ADMIN` + `ROLE_LABELS`.

**Hors périmètre (inchangés, volontairement fermés au NETWORK_ADMIN) :** tout `src/app/(dashboard)/dashboard/root-control/*` (protégé par `requireRoot`, plateforme uniquement).

---

## Task 1: Enum Prisma `NETWORK_ADMIN` + migration d'ajout

**Files:**
- Modify: `prisma/schema.prisma` (enum `UserRole`, après `SUPER_ADMIN`)
- Create: `prisma/migrations/<timestamp>_add_network_admin_role/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: valeur d'enum `UserRole.NETWORK_ADMIN` disponible côté Prisma Client et DB.

- [ ] **Step 1: Ajouter la valeur d'enum au schéma**

Dans `prisma/schema.prisma`, `enum UserRole`, insérer `NETWORK_ADMIN` juste après `SUPER_ADMIN` :

```prisma
enum UserRole {
  SUPER_ADMIN
  NETWORK_ADMIN
  SCHOOL_ADMIN
  DIRECTOR
  TEACHER
  STUDENT
  PARENT
  ACCOUNTANT
  STAFF
}
```

- [ ] **Step 2: Créer le fichier de migration d'ajout d'enum**

Créer `prisma/migrations/20260702000001_add_network_admin_role/migration.sql` (adapter le timestamp au format `YYYYMMDDHHMMSS` courant) :

```sql
-- Ajout de la valeur d'enum NETWORK_ADMIN.
-- Fichier SÉPARÉ de la migration de données : PostgreSQL interdit d'utiliser
-- une valeur d'enum nouvellement ajoutée dans la même transaction.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'NETWORK_ADMIN';
```

- [ ] **Step 3: Régénérer le client Prisma**

Run: `npx prisma generate`
Expected: succès ; `UserRole` du client inclut `NETWORK_ADMIN`. (Ne PAS lancer `migrate dev` ici — la génération suffit pour le typecheck ; la migration s'appliquera en base au déploiement.)

- [ ] **Step 4: Vérifier que le typecheck révèle les Records à compléter**

Run: `npm run type-check`
Expected: ÉCHEC attendu — erreurs « Property 'NETWORK_ADMIN' is missing in type » sur les `Record<UserRole, …>` de `permissions.ts` (`rolePermissions`, `roleHierarchy`, `roleCreationMatrix`, `getRoleName`). C'est le signal qui pilote la Task 3.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(rbac): valeur d'enum UserRole.NETWORK_ADMIN + migration d'ajout"
```

---

## Task 2: Helper `roleSatisfies`

**Files:**
- Modify: `src/lib/rbac/permissions.ts` (ajouter la fonction, après `getRolePermissions`)
- Test: `src/lib/rbac/role-satisfies.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `function roleSatisfies(role: string | undefined | null, allowedRoles: readonly string[]): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/rbac/role-satisfies.test.ts
import { describe, it, expect } from "vitest";
import { roleSatisfies } from "./permissions";

describe("roleSatisfies", () => {
  it("match direct : le rôle est dans la liste", () => {
    expect(roleSatisfies("SCHOOL_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"])).toBe(true);
  });

  it("NETWORK_ADMIN hérite des autorisations SCHOOL_ADMIN", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"])).toBe(true);
  });

  it("NETWORK_ADMIN passe aussi s'il est listé explicitement", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["NETWORK_ADMIN"])).toBe(true);
  });

  it("NETWORK_ADMIN n'escalade JAMAIS vers un écran SUPER_ADMIN seul", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["SUPER_ADMIN"])).toBe(false);
  });

  it("un rôle non listé est refusé", () => {
    expect(roleSatisfies("TEACHER", ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("role absent (undefined/null) est refusé", () => {
    expect(roleSatisfies(undefined, ["SCHOOL_ADMIN"])).toBe(false);
    expect(roleSatisfies(null, ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("SCHOOL_ADMIN ne gagne PAS les droits NETWORK_ADMIN (pas de sens inverse)", () => {
    expect(roleSatisfies("SCHOOL_ADMIN", ["NETWORK_ADMIN"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/role-satisfies.test.ts`
Expected: FAIL — `roleSatisfies` non exporté.

- [ ] **Step 3: Write minimal implementation**

Dans `src/lib/rbac/permissions.ts`, après la fonction `getRolePermissions` :

```typescript
/**
 * Expansion centralisée des rôles pour les vérifications `allowedRoles`.
 *
 * Un NETWORK_ADMIN (patron d'un groupe d'écoles) est autorisé partout où un
 * SCHOOL_ADMIN l'est — mais son périmètre de DONNÉES reste borné à son réseau
 * par le cloisonnement (getAccessibleSchoolIds). Ne JAMAIS étendre vers
 * SUPER_ADMIN : un écran plateforme réservé ["SUPER_ADMIN"] reste fermé.
 */
export function roleSatisfies(
  role: string | undefined | null,
  allowedRoles: readonly string[]
): boolean {
  if (!role) return false;
  if (allowedRoles.includes(role)) return true;
  if (role === "NETWORK_ADMIN" && allowedRoles.includes("SCHOOL_ADMIN")) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rbac/role-satisfies.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/permissions.ts src/lib/rbac/role-satisfies.test.ts
git commit -m "feat(rbac): helper roleSatisfies (NETWORK_ADMIN hérite de SCHOOL_ADMIN)"
```

---

## Task 3: Compléter les Records RBAC pour NETWORK_ADMIN

**Files:**
- Modify: `src/lib/rbac/permissions.ts` (`rolePermissions`, `roleHierarchy`, `roleCreationMatrix`, `getRoleName`)
- Modify: `src/components/edu-shell/role-nav.ts` (`ROLE_LABELS`)
- Test: `src/lib/rbac/network-admin.test.ts`

**Interfaces:**
- Consumes: `roleSatisfies` (Task 2) — non, indépendant ; `SCHOOL_LEVEL_BASE_PERMISSIONS`, `Permission`, `rolePermissions` existants.
- Produces: `rolePermissions.NETWORK_ADMIN`, `roleHierarchy.NETWORK_ADMIN = 90`, `roleCreationMatrix.NETWORK_ADMIN`, `getRoleName("NETWORK_ADMIN")`, `ROLE_LABELS.NETWORK_ADMIN`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/rbac/network-admin.test.ts
import { describe, it, expect } from "vitest";
import {
  rolePermissions,
  roleHierarchy,
  roleCreationMatrix,
  getRoleName,
  Permission,
} from "./permissions";

describe("NETWORK_ADMIN — Records RBAC", () => {
  it("a exactement les permissions SCHOOL_ADMIN + SCHOOL_CREATE", () => {
    const na = new Set(rolePermissions.NETWORK_ADMIN);
    for (const p of rolePermissions.SCHOOL_ADMIN) {
      expect(na.has(p)).toBe(true);
    }
    expect(na.has(Permission.SCHOOL_CREATE)).toBe(true);
  });

  it("se situe entre SUPER_ADMIN et SCHOOL_ADMIN dans la hiérarchie", () => {
    expect(roleHierarchy.NETWORK_ADMIN).toBe(90);
    expect(roleHierarchy.NETWORK_ADMIN).toBeLessThan(roleHierarchy.SUPER_ADMIN);
    expect(roleHierarchy.NETWORK_ADMIN).toBeGreaterThan(roleHierarchy.SCHOOL_ADMIN);
  });

  it("peut créer les rôles école mais pas SUPER_ADMIN ni NETWORK_ADMIN", () => {
    const created = roleCreationMatrix.NETWORK_ADMIN;
    expect(created).toContain("SCHOOL_ADMIN");
    expect(created).toContain("DIRECTOR");
    expect(created).not.toContain("SUPER_ADMIN");
    expect(created).not.toContain("NETWORK_ADMIN");
  });

  it("SUPER_ADMIN peut créer un NETWORK_ADMIN", () => {
    expect(roleCreationMatrix.SUPER_ADMIN).toContain("NETWORK_ADMIN");
  });

  it("a un libellé humain", () => {
    expect(getRoleName("NETWORK_ADMIN")).toBe("Administrateur de Réseau");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/network-admin.test.ts`
Expected: FAIL — `rolePermissions.NETWORK_ADMIN` undefined.

- [ ] **Step 3: Ajouter `rolePermissions.NETWORK_ADMIN`**

Dans `src/lib/rbac/permissions.ts`, dans l'objet `rolePermissions`, juste après le bloc `SCHOOL_ADMIN` :

```typescript
  NETWORK_ADMIN: [
    // Patron d'un groupe d'écoles : mêmes droits qu'un SCHOOL_ADMIN, appliqués
    // à toutes les écoles de son réseau (cloisonnement via getAccessibleSchoolIds).
    // Seul ajout : SCHOOL_CREATE (ouvrir une annexe dans son réseau).
    ...SCHOOL_LEVEL_BASE_PERMISSIONS,
    Permission.USER_DELETE,
    Permission.FEE_DELETE,
    Permission.FINANCE_DELETE,
    Permission.PAYMENT_DELETE,
    Permission.NOTIFICATION_DELETE,
    Permission.ORIENTATION_DELETE,
    Permission.SCHOOL_CREATE,
  ],
```

- [ ] **Step 4: Ajouter `roleHierarchy.NETWORK_ADMIN`**

Dans l'objet `roleHierarchy`, entre `SUPER_ADMIN: 100,` et `SCHOOL_ADMIN: 80,` :

```typescript
  SUPER_ADMIN: 100,
  NETWORK_ADMIN: 90,
  SCHOOL_ADMIN: 80,
```

- [ ] **Step 5: Ajouter/mettre à jour `roleCreationMatrix`**

Dans `roleCreationMatrix`, ajouter la ligne `NETWORK_ADMIN` et étendre `SUPER_ADMIN` :

```typescript
  SUPER_ADMIN: ["NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "STUDENT", "PARENT"],
  NETWORK_ADMIN: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "STUDENT", "PARENT"],
```

- [ ] **Step 6: Ajouter le libellé dans `getRoleName`**

Dans `getRoleName`, dans le `roleNames`, après `SUPER_ADMIN` :

```typescript
    SUPER_ADMIN: "Super Administrateur",
    NETWORK_ADMIN: "Administrateur de Réseau",
```

- [ ] **Step 7: Ajouter `ROLE_LABELS.NETWORK_ADMIN`**

Dans `src/components/edu-shell/role-nav.ts`, dans `ROLE_LABELS`, après `SUPER_ADMIN` :

```typescript
    SUPER_ADMIN: "Super Admin",
    NETWORK_ADMIN: "Admin réseau",
```

- [ ] **Step 8: Run test + typecheck**

Run: `npx vitest run src/lib/rbac/network-admin.test.ts && npm run type-check`
Expected: tests PASS (5) ; typecheck PASS (les `Record<UserRole,…>` sont désormais exhaustifs). Si le typecheck signale un autre `Record<UserRole,…>` (ex. dans un fichier de mapping non prévu), l'ajouter avec la valeur cohérente et le noter.

- [ ] **Step 9: Commit**

```bash
git add src/lib/rbac/permissions.ts src/components/edu-shell/role-nav.ts src/lib/rbac/network-admin.test.ts
git commit -m "feat(rbac): permissions, hiérarchie, matrice création et libellés NETWORK_ADMIN"
```

---

## Task 4: Périmètre multi-écoles pour NETWORK_ADMIN

**Files:**
- Modify: `src/lib/auth/school-access.ts` (`getAccessibleSchoolIdsForUser`, branche SCHOOL_ADMIN/DIRECTOR)
- Test: `src/lib/auth/school-access.test.ts`

**Interfaces:**
- Consumes: `getAccessibleSchoolIdsForUser` existant ; `prisma.school` (mock).
- Produces: `getAccessibleSchoolIdsForUser` renvoie, pour NETWORK_ADMIN sur un site MAIN, `[primarySchoolId, ...childSchoolIds]` (+ écoles d'organisation).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/school-access.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: { school: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/lib/auth/organization-access", () => ({
  getOrganizationAccessForUser: async () => ({ accessibleSchoolIds: [] }),
}));
vi.mock("@/lib/teachers/school-assignments", () => ({
  getTeacherSchoolIdsForUser: async () => [],
}));

import { getAccessibleSchoolIdsForUser } from "./school-access";

describe("getAccessibleSchoolIdsForUser — NETWORK_ADMIN", () => {
  beforeEach(() => findUnique.mockReset());

  it("site MAIN avec annexes → toutes ses écoles", async () => {
    findUnique.mockResolvedValue({
      siteType: "MAIN",
      childSchools: [{ id: "annex-1" }, { id: "annex-2" }],
    });
    const ids = await getAccessibleSchoolIdsForUser({
      userId: "u1",
      role: "NETWORK_ADMIN",
      primarySchoolId: "main-1",
    });
    expect(new Set(ids)).toEqual(new Set(["main-1", "annex-1", "annex-2"]));
  });

  it("mono-école (pas d'annexe) → sa seule école", async () => {
    findUnique.mockResolvedValue({ siteType: "MAIN", childSchools: [] });
    const ids = await getAccessibleSchoolIdsForUser({
      userId: "u1",
      role: "NETWORK_ADMIN",
      primarySchoolId: "solo-1",
    });
    expect(ids).toEqual(["solo-1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/school-access.test.ts`
Expected: FAIL — NETWORK_ADMIN tombe dans le `return` générique (ne consulte pas `childSchools`), donc `["solo-1"]` passe mais le cas annexes renvoie seulement `["main-1"]`.

- [ ] **Step 3: Étendre la branche multi-écoles**

Dans `src/lib/auth/school-access.ts`, remplacer la condition de la branche annexes :

```typescript
  if (role === "SCHOOL_ADMIN" || role === "DIRECTOR") {
```

par :

```typescript
  if (role === "SCHOOL_ADMIN" || role === "DIRECTOR" || role === "NETWORK_ADMIN") {
```

(Le corps de la branche — lecture `siteType` + `childSchools` — reste identique.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/school-access.test.ts`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/school-access.ts src/lib/auth/school-access.test.ts
git commit -m "feat(rbac): périmètre réseau (site MAIN + annexes) pour NETWORK_ADMIN"
```

---

## Task 5: Câbler `roleSatisfies` dans les 3 goulots

**Files:**
- Modify: `src/lib/api/api-helpers.ts` (`authorizeRoles` + check inline `allowedRoles`)
- Modify: `src/lib/hooks/use-rbac.ts` (`canAccess`)
- Modify: `src/components/guard/role-action-guard.tsx`
- Test: `src/lib/api/authorize-roles.test.ts`

**Interfaces:**
- Consumes: `roleSatisfies` (Task 2).
- Produces: les 3 goulots acceptent NETWORK_ADMIN partout où SCHOOL_ADMIN est listé.

- [ ] **Step 1: Write the failing test (goulot serveur)**

```typescript
// src/lib/api/authorize-roles.test.ts
import { describe, it, expect } from "vitest";
import { authorizeRoles } from "./api-helpers";

describe("authorizeRoles — expansion NETWORK_ADMIN", () => {
  it("autorise NETWORK_ADMIN là où SCHOOL_ADMIN est listé", () => {
    expect(authorizeRoles("NETWORK_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"]).authorized).toBe(true);
  });

  it("refuse NETWORK_ADMIN sur un écran SUPER_ADMIN seul", () => {
    const res = authorizeRoles("NETWORK_ADMIN", ["SUPER_ADMIN"]);
    expect(res.authorized).toBe(false);
    expect(res.response?.status).toBe(403);
  });

  it("comportement inchangé pour un match direct", () => {
    expect(authorizeRoles("TEACHER", ["TEACHER"]).authorized).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/authorize-roles.test.ts`
Expected: FAIL — `authorizeRoles` utilise `allowedRoles.includes(role)`, donc NETWORK_ADMIN sur `["SCHOOL_ADMIN"]` renvoie `authorized: false`.

- [ ] **Step 3: Router `authorizeRoles` par `roleSatisfies`**

Dans `src/lib/api/api-helpers.ts`, ajouter l'import (à côté des imports RBAC existants, ex. `hasPermission`) :

```typescript
import { hasPermission, roleSatisfies } from "@/lib/rbac/permissions";
```

(Si `hasPermission` est déjà importé, ajouter seulement `roleSatisfies` à l'import existant.)

Remplacer le corps de `authorizeRoles` :

```typescript
export function authorizeRoles(
    role: string,
    allowedRoles: string[]
): { authorized: boolean; response?: NextResponse } {
    if (roleSatisfies(role, allowedRoles)) return { authorized: true };
    return { authorized: false, response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
}
```

- [ ] **Step 4: Router le check inline de `createApiHandler`**

Dans le même fichier, remplacer le bloc (≈ lignes 340-344) :

```typescript
            if (options.allowedRoles && options.allowedRoles.length > 0 && session?.user) {
                if (!options.allowedRoles.includes(session.user.role)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }
```

par :

```typescript
            if (options.allowedRoles && options.allowedRoles.length > 0 && session?.user) {
                if (!roleSatisfies(session.user.role, options.allowedRoles)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }
```

- [ ] **Step 5: Router le goulot client `useRBAC.canAccess`**

Dans `src/lib/hooks/use-rbac.ts`, ajouter l'import :

```typescript
import { getRolePermissions, roleSatisfies } from "@/lib/rbac/permissions";
```

Remplacer le bloc de vérification de rôle :

```typescript
            // Check role-based access: user must have AT LEAST ONE of the required roles
            if (roles && roles.length > 0) {
                const hasMatchingRole = roles.some(r => userRoles.includes(r as UserRole));
                if (!hasMatchingRole) return false;
            }
```

par :

```typescript
            // Check role-based access: NETWORK_ADMIN hérite de SCHOOL_ADMIN via roleSatisfies.
            if (roles && roles.length > 0) {
                const hasMatchingRole = userRoles.some((ur) => roleSatisfies(ur, roles));
                if (!hasMatchingRole) return false;
            }
```

(Le bypass `isSuperAdmin` existant reste inchangé au-dessus.)

- [ ] **Step 6: Router `RoleActionGuard`**

Dans `src/components/guard/role-action-guard.tsx`, ajouter `roleSatisfies` à l'import RBAC :

```typescript
import { Permission, hasPermission, roleSatisfies } from "@/lib/rbac/permissions";
```

Remplacer le bloc :

```typescript
    // Check roles if provided
    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(userRole)) {
            return <>{fallback}</>;
        }
    }
```

par :

```typescript
    // Check roles if provided (NETWORK_ADMIN hérite de SCHOOL_ADMIN via roleSatisfies).
    if (allowedRoles && allowedRoles.length > 0) {
        if (!roleSatisfies(userRole, allowedRoles)) {
            return <>{fallback}</>;
        }
    }
```

- [ ] **Step 7: Run test + typecheck**

Run: `npx vitest run src/lib/api/authorize-roles.test.ts && npm run type-check`
Expected: PASS (3) ; typecheck vert.

- [ ] **Step 8: Audit des comparaisons directes hors goulots**

Run: `grep -rn 'role === "SCHOOL_ADMIN"\|role !== "SCHOOL_ADMIN"\|=== .SCHOOL_ADMIN.' src/app src/lib src/components --include=*.ts --include=*.tsx | grep -v test`
Pour chaque occurrence hors des 3 goulots : décider si un NETWORK_ADMIN doit être inclus (alors router par `roleSatisfies`) ou si la restriction est volontairement stricte (laisser + commentaire `// NETWORK_ADMIN volontairement exclu : …`). Documenter les décisions dans le message de commit. Ne PAS toucher les comparaisons `=== "SUPER_ADMIN"` (périmètre tranche B).

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/api-helpers.ts src/lib/hooks/use-rbac.ts src/components/guard/role-action-guard.tsx src/lib/api/authorize-roles.test.ts
git commit -m "feat(rbac): NETWORK_ADMIN hérite de SCHOOL_ADMIN aux 3 goulots (API, pages, actions)"
```

---

## Task 6: Scoping réseau des listes consolidées

**Files:**
- Modify: `src/lib/api/tenant-isolation.ts` (helper `getNetworkScopeFilter`)
- Modify: `src/app/api/users/route.ts` (GET — branche NETWORK_ADMIN)
- Test: `src/lib/api/network-scope.test.ts`

**Interfaces:**
- Consumes: `getAccessibleSchoolIds` (existant, `tenant-isolation.ts`).
- Produces: `function getNetworkScopeFilter(session): { schoolId?: { in: string[] } | string }` — fragment `where` Prisma borné au réseau.

**Contexte :** la plupart des écrans réseau (finance/stats, analytics admin) travaillent déjà école-par-école via le sélecteur d'école et `ensureRequestedSchoolAccess` — `roleSatisfies` (Task 5) les autorise automatiquement, et le cloisonnement existant les borne. Seules les **listes qui branchaient explicitement sur `SUPER_ADMIN` pour "aucun filtre"** doivent gagner une branche NETWORK_ADMIN pour couvrir tout le réseau au lieu de la seule école active. `/api/users` GET est ce cas.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/network-scope.test.ts
import { describe, it, expect } from "vitest";
import { getNetworkScopeFilter } from "./tenant-isolation";

function sess(role: string, schoolId: string, accessible: string[]) {
  return { user: { id: "u", role, schoolId, accessibleSchoolIds: accessible } } as never;
}

describe("getNetworkScopeFilter", () => {
  it("SUPER_ADMIN → aucun filtre (scope global)", () => {
    expect(getNetworkScopeFilter(sess("SUPER_ADMIN", "s1", []))).toEqual({});
  });

  it("NETWORK_ADMIN → filtre borné à ses écoles", () => {
    expect(getNetworkScopeFilter(sess("NETWORK_ADMIN", "s1", ["s1", "s2"]))).toEqual({
      schoolId: { in: ["s1", "s2"] },
    });
  });

  it("SCHOOL_ADMIN → filtre sur l'école active seule", () => {
    expect(getNetworkScopeFilter(sess("SCHOOL_ADMIN", "s1", ["s1"]))).toEqual({
      schoolId: "s1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/network-scope.test.ts`
Expected: FAIL — `getNetworkScopeFilter` non exporté.

- [ ] **Step 3: Ajouter le helper**

Dans `src/lib/api/tenant-isolation.ts`, à la fin du fichier :

```typescript
/**
 * Fragment `where` Prisma pour les listes CONSOLIDÉES :
 * - SUPER_ADMIN → {} (scope global plateforme — inchangé, tranche A).
 * - NETWORK_ADMIN → { schoolId: { in: <ses écoles> } } (borné à son réseau).
 * - autres → { schoolId: <école active> }.
 * Ne PAS confondre avec getSchoolFilter (toujours mono-école).
 */
export function getNetworkScopeFilter(
  session: Session | null
): { schoolId?: { in: string[] } | string } {
  if (!session?.user) return { schoolId: "NO_ACCESS" };
  const user = session.user as AuthUser;

  if (user.role === "SUPER_ADMIN") return {};

  if (user.role === "NETWORK_ADMIN") {
    const ids = getAccessibleSchoolIds(session);
    return { schoolId: { in: ids.length > 0 ? ids : ["NO_ACCESS"] } };
  }

  const activeSchoolId = getActiveSchoolId(session);
  return { schoolId: activeSchoolId ?? "NO_ACCESS" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/network-scope.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Appliquer à `/api/users` GET**

Dans `src/app/api/users/route.ts`, remplacer le bloc de construction du `where` (≈ lignes 50-59) :

```typescript
    const where: UserWhereFilter = {};

    if (callerRole === "SUPER_ADMIN") {
      if (schoolId) where.schoolId = schoolId;
      if (role) where.role = role as UserRole;
    } else {
      // Non-super admins can only see users from their school
      where.schoolId = getActiveSchoolId(session);
      if (role) where.role = role as UserRole;
    }
```

par :

```typescript
    const where: UserWhereFilter = {};

    if (callerRole === "SUPER_ADMIN") {
      if (schoolId) where.schoolId = schoolId;
    } else if (callerRole === "NETWORK_ADMIN") {
      // Réseau : toutes les écoles du groupe (borné par accessibleSchoolIds).
      const scope = getNetworkScopeFilter(session);
      if (scope.schoolId) where.schoolId = scope.schoolId;
    } else {
      // Autres : uniquement leur école active.
      where.schoolId = getActiveSchoolId(session);
    }
    if (role) where.role = role as UserRole;
```

Ajouter `getNetworkScopeFilter` à l'import depuis `@/lib/api/tenant-isolation` en tête de fichier (à côté de `getActiveSchoolId`).

- [ ] **Step 6: Vérifier typecheck**

Run: `npm run type-check`
Expected: PASS. (`UserWhereFilter.schoolId` accepte string ou filtre — vérifier ; si le type est `string` strict, élargir le type local à `string | { in: string[] }` dans ce fichier.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/tenant-isolation.ts "src/app/api/users/route.ts" src/lib/api/network-scope.test.ts
git commit -m "feat(rbac): scoping réseau des listes consolidées (getNetworkScopeFilter + /api/users)"
```

---

## Task 7: Navigation NETWORK_ADMIN (curatée, écrans données-école)

**Files:**
- Modify: `src/components/edu-shell/role-nav.ts` (`navGroupsForRole`, nouveau case)
- Test: `src/components/edu-shell/network-admin-nav.test.ts`

**Interfaces:**
- Consumes: `navGroupsForRole` existant, `AI_ASSISTANT_NAV_LINK`.
- Produces: `navGroupsForRole("NETWORK_ADMIN")` = liste curatée d'écrans données-école (jamais de lien `/dashboard/root-control/*`).

**Décision de conception :** la nav SUPER_ADMIN pointe vers `root-control/*` (plateforme, protégé par `requireRoot` — inaccessible au NETWORK_ADMIN). Le case NETWORK_ADMIN pointe donc vers les écrans **données-école** qui fonctionnent par école active via le sélecteur d'école existant (header). Pas de lien « Établissements » vers root-control : le changement d'école se fait par le switcher.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/edu-shell/network-admin-nav.test.ts
import { describe, it, expect } from "vitest";
import { navGroupsForRole } from "./role-nav";

describe("navGroupsForRole — NETWORK_ADMIN", () => {
  it("expose une nav non vide", () => {
    const groups = navGroupsForRole("NETWORK_ADMIN");
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.links).length).toBeGreaterThan(0);
  });

  it("ne pointe JAMAIS vers root-control (plateforme)", () => {
    const hrefs = navGroupsForRole("NETWORK_ADMIN").flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs.some((h) => h.includes("/root-control"))).toBe(false);
  });

  it("inclut finance et analytics (pilotage réseau)", () => {
    const hrefs = navGroupsForRole("NETWORK_ADMIN").flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs).toContain("/dashboard/finance");
    expect(hrefs).toContain("/dashboard/analytics");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/edu-shell/network-admin-nav.test.ts`
Expected: FAIL — `navGroupsForRole("NETWORK_ADMIN")` tombe dans le `default` (probablement vide ou fallback).

- [ ] **Step 3: Ajouter le case `NETWORK_ADMIN`**

Dans `src/components/edu-shell/role-nav.ts`, dans `navGroupsForRole`, juste après le `case "SUPER_ADMIN":` (avant `case "DIRECTOR":`) :

```typescript
        case "NETWORK_ADMIN":
            return [
                {
                    links: [
                        { icon: "grid", label: "Vue réseau", href: "/dashboard" },
                        { icon: "users", label: "Utilisateurs", href: "/dashboard/users", countKey: "networkUsers", matchPrefix: true },
                        { icon: "money", label: "Finance", href: "/dashboard/finance", matchPrefix: true },
                        { icon: "chart", label: "Analyses réseau", href: "/dashboard/analytics", matchPrefix: true },
                        { icon: "bell", label: "Alertes", href: "/dashboard/alerts", countKey: "networkAlerts", matchPrefix: true },
                        AI_ASSISTANT_NAV_LINK,
                        { icon: "settings", label: "Paramètres", href: "/dashboard/settings", matchPrefix: true },
                    ],
                },
            ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/edu-shell/network-admin-nav.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Vérifier les gardes de pages ciblées**

Les pages de la nav ci-dessus doivent laisser passer NETWORK_ADMIN. Vérifier chacune :

Run: `grep -n "roles={\[" "src/app/(dashboard)/dashboard/users/page.tsx" "src/app/(dashboard)/dashboard/finance/page.tsx" "src/app/(dashboard)/dashboard/analytics/page.tsx" "src/app/(dashboard)/dashboard/alerts/page.tsx" 2>/dev/null`

Pour chaque page dont le `PageGuard` liste `roles={["SUPER_ADMIN", "SCHOOL_ADMIN", …]}` : `roleSatisfies` (via `useRBAC`, Task 5) couvre déjà NETWORK_ADMIN — **aucune modification**. Pour toute page listant `["SUPER_ADMIN"]` **seul** parmi les 4 ci-dessus (ex. si `/dashboard/alerts` est root-only), ajouter `"NETWORK_ADMIN"` à son `roles` (c'est un écran réseau légitime). Ne PAS toucher les pages hors de cette nav.

- [ ] **Step 6: Commit**

```bash
git add src/components/edu-shell/role-nav.ts src/components/edu-shell/network-admin-nav.test.ts "src/app/(dashboard)/dashboard"
git commit -m "feat(nav): navigation NETWORK_ADMIN curatée (écrans données-école, sans root-control)"
```

---

## Task 8: Migration de bascule des comptes + vérification finale

**Files:**
- Create: `prisma/migrations/<timestamp>_migrate_super_admin_to_network_admin/migration.sql`

**Interfaces:**
- Consumes: valeur d'enum `NETWORK_ADMIN` (Task 1, migration appliquée avant).
- Produces: les comptes SUPER_ADMIN rattachés à une école deviennent NETWORK_ADMIN + trace AuditLog.

- [ ] **Step 1: Créer le fichier de migration de données (SÉPARÉ)**

Créer `prisma/migrations/20260702000002_migrate_super_admin_to_network_admin/migration.sql` (timestamp postérieur à celui de la Task 1) :

```sql
-- Bascule des comptes : tout SUPER_ADMIN RATTACHÉ à une école (schoolId non nul)
-- devient NETWORK_ADMIN. Les comptes opérateur plateforme (schoolId NULL) restent
-- SUPER_ADMIN. Fichier séparé de l'ajout d'enum (contrainte PostgreSQL).
-- Les comptes migrés doivent se reconnecter (le JWT porte l'ancien rôle).

-- 1) Trace d'audit AVANT bascule (une ligne par compte migré).
INSERT INTO "audit_logs" ("id", "userId", "schoolId", "action", "entity", "entityId", "oldValues", "newValues", "createdAt")
SELECT
  gen_random_uuid(),
  u."id",
  u."schoolId",
  'UPDATE',
  'User.role',
  u."id",
  jsonb_build_object('role', 'SUPER_ADMIN'),
  jsonb_build_object('role', 'NETWORK_ADMIN'),
  now()
FROM "users" u
WHERE u."role" = 'SUPER_ADMIN' AND u."schoolId" IS NOT NULL;

-- 2) Bascule.
UPDATE "users"
SET "role" = 'NETWORK_ADMIN'
WHERE "role" = 'SUPER_ADMIN' AND "schoolId" IS NOT NULL;
```

**Note :** vérifier les noms exacts de table/colonnes AuditLog dans `prisma/schema.prisma` (`@@map`) avant d'écrire le SQL — ajuster `"audit_logs"` et les colonnes (`userId`, `schoolId`, `action`, `entity`, `entityId`, `oldValues`, `newValues`, `createdAt`) aux mappings réels. Si `AuditLog` a des colonnes NOT NULL supplémentaires sans défaut, les inclure.

- [ ] **Step 2: Vérifier le mapping AuditLog**

Run: `grep -n "model AuditLog" -A 25 prisma/schema.prisma`
Expected: confirmer `@@map`, les noms de colonnes et leur nullabilité ; ajuster le SQL de l'étape 1 en conséquence. Si une colonne requise manque dans l'INSERT, l'ajouter.

- [ ] **Step 3: Vérification complète du projet**

Run: `npm run type-check && npx vitest run && npm run lint`
Expected: typecheck vert ; **tous** les tests verts (les nouveaux + les ~1015 existants, aucune régression sur les 8 rôles) ; lint OK.

- [ ] **Step 4: Vérification manuelle du build**

Run: `npm run build`
Expected: build de production réussi.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations
git commit -m "feat(rbac): migration de bascule SUPER_ADMIN rattaché → NETWORK_ADMIN (audité)"
```

---

## Self-Review

**Spec coverage :**
- §Architecture 1 (enum + migration bascule) → Task 1 + Task 8 ✅
- §Architecture 2 (permissions, hiérarchie 90, matrices, SCHOOL_CREATE) → Task 3 ✅
- §Architecture 3 (`roleSatisfies` aux 3 goulots + audit grep) → Task 2 + Task 5 ✅
- §Architecture 4 (périmètre données : `getAccessibleSchoolIdsForUser` + scoping consolidé) → Task 4 + Task 6 ✅
- §Architecture 5 (nav & libellés) → Task 3 (labels) + Task 7 (nav) ✅
- §Architecture 6 (gardes de pages réseau) → Task 7 step 5 ✅
- §Sécurité (jamais de scope global, jamais d'escalade SUPER_ADMIN, AuditLog migration) → Task 2, 5, 6, 8 ✅
- §Tests (roleSatisfies, permissions, accessibleSchoolIds, guards, nav, régression) → Tasks 2,3,4,5,6,7 + Task 8 step 3 ✅

**Placeholder scan :** aucun TODO/TBD ; tout le code est fourni. Les deux notes de vérification (Task 6 step 6 sur le type `UserWhereFilter`, Task 8 sur le mapping AuditLog) référencent du code existant à confirmer, pas du code à inventer.

**Type consistency :** `roleSatisfies(role, allowedRoles)`, `getNetworkScopeFilter(session)`, `getAccessibleSchoolIdsForUser({ userId, role, primarySchoolId })`, `roleHierarchy.NETWORK_ADMIN = 90`, libellés (`getRoleName` → "Administrateur de Réseau", `ROLE_LABELS` → "Admin réseau") — cohérents entre tasks et entre eux.

**Écart connu :** la réduction du SUPER_ADMIN (retrait god mode, écrans souscriptions, analytics agrégées) est explicitement la **tranche B**, hors de ce plan. En tranche A, SUPER_ADMIN garde son accès global — aucune régression, transition sûre.
