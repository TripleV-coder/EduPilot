# Profil établissement & feature-gating (Tranche 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une couche de gating par `enabledModules` (modules optionnels) à EduPilot, l'appliquer à la sidebar/nav mobile, et faire exister la famille « Préparation examens » (CEP/BEPC/BAC dérivés des cycles) — sans modifier aucune feature existante.

**Architecture:** Registre canonique de modules → champ Prisma `School.enabledModules` → exposé par le school-provider → primitif de gating étendu (`requiresModule`, parallèle au `requiresCycle` déjà présent) → appliqué nav + gardes de page + enforcement serveur. Additif et rétro-compatible : défaut sûr = rien n'est masqué tant qu'un module n'est pas explicitement configuré.

**Tech Stack:** Next.js (App Router), TypeScript strict, Prisma (PostgreSQL), Vitest, NextAuth, Radix UI, SWR.

## Global Constraints

- **AUCUNE feature actuelle ne change.** Le travail est strictement additif : ne jamais retirer ni modifier un lien, une route, un comportement existant. Toute modification d'un fichier existant se limite à ajouter un champ/paramètre optionnel.
- **Défaut sûr obligatoire.** Si `enabledModules` est absent/vide (donnée non migrée, provider non hydraté, mode global SUPER_ADMIN), **rien n'est masqué** — exactement comme `CycleGuard`/`visibleNavGroups` le font déjà pour `offeredLevels`.
- **Bénin uniquement.** Aucune logique multi-pays ici (cf. spec §5). Le registre modules reste agnostique du pays.
- **TypeScript strict**, pas de `any` non justifié. Suivre les patterns existants (`config/academic`, `CycleGuard`, `PageGuard`).
- **Migration Prisma additive** : nouveau champ avec `@default([])`, aucune donnée cassée.
- **Enforcement serveur non négociable** : masquer la nav ne protège pas les données.

---

## File Structure

**Créés :**
- `src/lib/establishment/modules.ts` — registre canonique des modules (source unique).
- `src/lib/establishment/modules.test.ts` — tests du registre.
- `src/components/edu-shell/role-nav.test.ts` — tests du gating de nav.
- `src/lib/api/assert-module.ts` — enforcement serveur `assertModuleEnabled`.
- `src/components/guard/module-guard.tsx` — garde de page cliente (miroir de `CycleGuard`).
- `src/app/(dashboard)/dashboard/exam-prep/[track]/page.tsx` — route prep unifiée.
- `src/app/api/config/modules/route.ts` — GET/PATCH des modules activés.
- `src/app/api/config/modules/route.test.ts` — tests de la route config.
- `src/app/(dashboard)/dashboard/settings/modules/page.tsx` — UI toggles admin.

**Modifiés (ajout seulement) :**
- `prisma/schema.prisma` — champ `School.enabledModules`.
- `src/app/api/schools/[id]/route.ts` — ajouter `enabledModules` au `select` GET.
- `src/components/providers/school-provider.tsx` — exposer `enabledModules`.
- `src/components/edu-shell/role-nav.ts` — `requiresModule`, `NavContext`, `visibleNavGroups`, `visibleNavLinks`, groupe exam prep.
- `src/components/edu-shell/EduSidebar.tsx` — passer `{ offeredLevels, enabledModules }`.
- `src/components/edu-shell/EduMobileNav.tsx` — idem via `visibleNavLinks`.
- `src/app/(dashboard)/dashboard/bepc-prep/page.tsx` — remplacer le corps par un redirect de compat.

---

## Task 1: Registre canonique des modules

**Files:**
- Create: `src/lib/establishment/modules.ts`
- Test: `src/lib/establishment/modules.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `type ModuleKey` (union de littéraux).
  - `interface ModuleDef { key: ModuleKey; label: string; core: boolean; description: string }`
  - `const MODULES: Record<ModuleKey, ModuleDef>`
  - `function isModuleEnabled(key: ModuleKey, enabled: readonly string[] | null | undefined): boolean`
  - `function optionalModuleKeys(): ModuleKey[]`
  - `function isValidOptionalModuleKey(key: string): key is ModuleKey`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/establishment/modules.test.ts
import { describe, it, expect } from "vitest";
import {
  MODULES,
  isModuleEnabled,
  optionalModuleKeys,
  isValidOptionalModuleKey,
} from "./modules";

describe("modules registry", () => {
  it("marks core modules as core and optional modules as optional", () => {
    expect(MODULES.STUDENTS.core).toBe(true);
    expect(MODULES.EXAM_PREP.core).toBe(false);
  });

  it("isModuleEnabled: safe default — undefined/empty never hides", () => {
    expect(isModuleEnabled("EXAM_PREP", undefined)).toBe(true);
    expect(isModuleEnabled("EXAM_PREP", null)).toBe(true);
    expect(isModuleEnabled("EXAM_PREP", [])).toBe(true);
  });

  it("isModuleEnabled: once configured, only listed optional modules pass", () => {
    expect(isModuleEnabled("EXAM_PREP", ["EXAM_PREP"])).toBe(true);
    expect(isModuleEnabled("LIBRARY", ["EXAM_PREP"])).toBe(false);
  });

  it("isModuleEnabled: core modules always pass, even when a config exists", () => {
    expect(isModuleEnabled("STUDENTS", ["EXAM_PREP"])).toBe(true);
  });

  it("optionalModuleKeys excludes core modules", () => {
    const keys = optionalModuleKeys();
    expect(keys).toContain("EXAM_PREP");
    expect(keys).not.toContain("STUDENTS");
  });

  it("isValidOptionalModuleKey rejects unknown and core keys", () => {
    expect(isValidOptionalModuleKey("EXAM_PREP")).toBe(true);
    expect(isValidOptionalModuleKey("STUDENTS")).toBe(false);
    expect(isValidOptionalModuleKey("NOPE")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/establishment/modules.test.ts`
Expected: FAIL — `Cannot find module './modules'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/establishment/modules.ts
/**
 * Registre canonique des modules EduPilot — source unique de vérité.
 *
 * `core: true`  → toujours visible (fonctions socle de gestion scolaire).
 * `core: false` → module OPTIONNEL, gaté par `School.enabledModules`.
 *
 * Défaut SÛR : tant que `enabledModules` n'est pas configuré (undefined/null/[]),
 * aucun module n'est masqué — cohérent avec le gating par cycle existant.
 * Agnostique du pays (localisation multi-pays = tranche future).
 */

export type ModuleKey =
  | "STUDENTS"
  | "CLASSES"
  | "GRADES"
  | "ATTENDANCE"
  | "MESSAGES"
  | "DOCUMENTS"
  | "FINANCE"
  | "LIBRARY"
  | "CANTEEN"
  | "TRANSPORT"
  | "LMS"
  | "HEALTH"
  | "ORIENTATION"
  | "ACCOUNTING"
  | "EXAM_PREP";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  core: boolean;
  description: string;
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  STUDENTS: { key: "STUDENTS", label: "Élèves", core: true, description: "Inscriptions, dossiers, suivi." },
  CLASSES: { key: "CLASSES", label: "Classes", core: true, description: "Classes et affectations." },
  GRADES: { key: "GRADES", label: "Notes & bulletins", core: true, description: "Évaluations et bulletins." },
  ATTENDANCE: { key: "ATTENDANCE", label: "Présences", core: true, description: "Appel et assiduité." },
  MESSAGES: { key: "MESSAGES", label: "Messagerie", core: true, description: "Communication interne." },
  DOCUMENTS: { key: "DOCUMENTS", label: "Documents", core: true, description: "Ressources et fichiers." },
  FINANCE: { key: "FINANCE", label: "Finance", core: false, description: "Frais, paiements, recettes." },
  LIBRARY: { key: "LIBRARY", label: "Bibliothèque", core: false, description: "Gestion des ouvrages et prêts." },
  CANTEEN: { key: "CANTEEN", label: "Cantine", core: false, description: "Menus et tickets repas." },
  TRANSPORT: { key: "TRANSPORT", label: "Transport", core: false, description: "Circuits et abonnements." },
  LMS: { key: "LMS", label: "Cours en ligne", core: false, description: "E-learning et leçons." },
  HEALTH: { key: "HEALTH", label: "Santé", core: false, description: "Infirmerie et suivi santé." },
  ORIENTATION: { key: "ORIENTATION", label: "Orientation", core: false, description: "Conseils et orientation." },
  ACCOUNTING: { key: "ACCOUNTING", label: "Comptabilité", core: false, description: "Comptabilité OHADA." },
  EXAM_PREP: { key: "EXAM_PREP", label: "Préparation examens", core: false, description: "CEP, BEPC, BAC selon les cycles offerts." },
};

export function isModuleEnabled(
  key: ModuleKey,
  enabled: readonly string[] | null | undefined
): boolean {
  if (MODULES[key]?.core) return true;
  // Défaut sûr : pas encore configuré → on n'occulte rien.
  if (!enabled || enabled.length === 0) return true;
  return enabled.includes(key);
}

export function optionalModuleKeys(): ModuleKey[] {
  return (Object.keys(MODULES) as ModuleKey[]).filter((k) => !MODULES[k].core);
}

export function isValidOptionalModuleKey(key: string): key is ModuleKey {
  return key in MODULES && !MODULES[key as ModuleKey].core;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/establishment/modules.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/establishment/modules.ts src/lib/establishment/modules.test.ts
git commit -m "feat(establishment): registre canonique des modules (core/optionnels)"
```

---

## Task 2: Champ Prisma `enabledModules` + exposition provider

**Files:**
- Modify: `prisma/schema.prisma` (model `School`, après `offeredLevels`)
- Modify: `src/app/api/schools/[id]/route.ts` (GET — ajouter au `select`)
- Modify: `src/components/providers/school-provider.tsx` (type + valeur du contexte)

**Interfaces:**
- Consumes: `MODULES` (Task 1) — indirectement.
- Produces: `useSchool().enabledModules: string[]` côté client ; `School.enabledModules: string[]` côté DB et API.

- [ ] **Step 1: Ajouter le champ Prisma**

Dans `prisma/schema.prisma`, `model School`, juste après la ligne `offeredLevels` :

```prisma
  offeredLevels          SchoolLevel[]             @default([])
  enabledModules         String[]                  @default([])
```

- [ ] **Step 2: Générer la migration**

Run: `npx prisma migrate dev --name school_enabled_modules`
Expected: migration créée, `enabledModules` ajouté avec `DEFAULT '{}'`, `prisma generate` OK, aucune donnée existante affectée.

- [ ] **Step 3: Exposer le champ dans l'API GET `/api/schools/[id]`**

Dans `src/app/api/schools/[id]/route.ts`, ajouter `enabledModules: true` au bloc `select` du `findUnique`/`findFirst` GET (celui qui contient déjà `offeredLevels: true`). Exemple :

```typescript
        select: {
          // ...champs existants inchangés...
          offeredLevels: true,
          enabledModules: true,
        },
```

- [ ] **Step 4: Exposer dans le school-provider**

Dans `src/components/providers/school-provider.tsx` :

Ajouter au type `SchoolContextType` (après `offeredLevels: string[];`) :

```typescript
    /** Modules optionnels activés pour l'école active (cf. School.enabledModules). */
    enabledModules: string[];
```

Puis dans l'objet `value` retourné (à côté de `offeredLevels: (schoolInfo?.offeredLevels ...) ?? []`) :

```typescript
        offeredLevels: (schoolInfo?.offeredLevels as string[] | undefined) ?? [],
        enabledModules: (schoolInfo?.enabledModules as string[] | undefined) ?? [],
```

- [ ] **Step 5: Vérifier la compilation**

Run: `npm run type-check`
Expected: PASS (aucune erreur de type).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations "src/app/api/schools/[id]/route.ts" src/components/providers/school-provider.tsx
git commit -m "feat(establishment): School.enabledModules + exposition provider/API"
```

---

## Task 3: Gating de nav par module + groupe « Préparation examens »

**Files:**
- Modify: `src/components/edu-shell/role-nav.ts`
- Test: `src/components/edu-shell/role-nav.test.ts`
- Modify: `src/components/edu-shell/EduSidebar.tsx`
- Modify: `src/components/edu-shell/EduMobileNav.tsx`

**Interfaces:**
- Consumes: `ModuleKey` (Task 1) ; `useSchool().enabledModules` (Task 2) ; `examForLevel` / `LEVEL_CYCLES` (`src/lib/benin/levels.ts`).
- Produces:
  - `interface NavContext { offeredLevels?: string[] | null; enabledModules?: string[] | null }`
  - `NavLink.requiresModule?: ModuleKey`, `NavGroup.requiresModule?: ModuleKey`
  - `visibleNavGroups(role, ctx: NavContext): NavGroup[]`
  - `visibleNavLinks(role, ctx: NavContext): NavLink[]`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/edu-shell/role-nav.test.ts
import { describe, it, expect } from "vitest";
import { visibleNavGroups, visibleNavLinks } from "./role-nav";

const ALL_CYCLES = ["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE"];

describe("visibleNavGroups — gating module + cycle (additif, défaut sûr)", () => {
  it("défaut sûr : sans offeredLevels ni enabledModules, rien n'est masqué", () => {
    const groups = visibleNavGroups("STUDENT", {});
    const labels = groups.flatMap((g) => g.links.map((l) => l.label));
    expect(labels).toContain("Préparation examens");
  });

  it("EXAM_PREP désactivé (config non vide) masque le groupe prep", () => {
    const groups = visibleNavGroups("STUDENT", {
      offeredLevels: ALL_CYCLES,
      enabledModules: ["LIBRARY"],
    });
    const titles = groups.map((g) => g.title);
    expect(titles).not.toContain("Préparation examens");
  });

  it("EXAM_PREP activé + lycée seul → seul BAC Prep visible", () => {
    const groups = visibleNavGroups("STUDENT", {
      offeredLevels: ["SECONDARY_LYCEE"],
      enabledModules: ["EXAM_PREP"],
    });
    const prep = groups.find((g) => g.title === "Préparation examens");
    const labels = prep?.links.map((l) => l.label) ?? [];
    expect(labels).toContain("BAC Prep");
    expect(labels).not.toContain("BEPC Prep");
    expect(labels).not.toContain("CEP Prep");
  });

  it("EXAM_PREP activé + primaire seul → seul CEP Prep visible", () => {
    const groups = visibleNavGroups("STUDENT", {
      offeredLevels: ["PRIMARY"],
      enabledModules: ["EXAM_PREP"],
    });
    const prep = groups.find((g) => g.title === "Préparation examens");
    const labels = prep?.links.map((l) => l.label) ?? [];
    expect(labels).toEqual(["CEP Prep"]);
  });

  it("visibleNavLinks aplatit et applique le même filtrage", () => {
    const links = visibleNavLinks("STUDENT", {
      offeredLevels: ALL_CYCLES,
      enabledModules: ["LIBRARY"],
    });
    expect(links.map((l) => l.label)).not.toContain("BAC Prep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/edu-shell/role-nav.test.ts`
Expected: FAIL — `visibleNavLinks` not exported / groupe prep absent.

- [ ] **Step 3: Étendre `role-nav.ts`**

1. En haut du fichier, après l'import existant :

```typescript
import type { ModuleKey } from "@/lib/establishment/modules";
import { isModuleEnabled } from "@/lib/establishment/modules";
```

2. Ajouter `requiresModule` aux interfaces (champ optionnel, n'affecte pas l'existant) :

```typescript
export interface NavLink {
    icon: IconName;
    label: string;
    href: string;
    countKey?: keyof NavCounts;
    matchPrefix?: boolean;
    /** Masqué si l'école n'offre pas ce cycle (cf. School.offeredLevels). */
    requiresCycle?: Cycle;
    /** Masqué si ce module optionnel n'est pas activé (cf. School.enabledModules). */
    requiresModule?: ModuleKey;
}

export interface NavGroup {
    title?: string;
    requiresCycle?: Cycle;
    /** Groupe entier masqué si ce module optionnel n'est pas activé. */
    requiresModule?: ModuleKey;
    links: NavLink[];
}

export interface NavContext {
    offeredLevels?: string[] | null;
    enabledModules?: string[] | null;
}
```

3. Ajouter le **groupe « Préparation examens »** comme constante réutilisable, et l'injecter pour les rôles concernés. Après la définition de `AI_ASSISTANT_NAV_LINK` :

```typescript
/** Groupe famille examens — CEP/BEPC/BAC gatés par cycle, groupe gaté par module. */
export const EXAM_PREP_NAV_GROUP: NavGroup = {
    title: "Préparation examens",
    requiresModule: "EXAM_PREP",
    links: [
        { icon: "book", label: "CEP Prep", href: "/dashboard/exam-prep/cep", matchPrefix: true, requiresCycle: "PRIMARY" },
        { icon: "book", label: "BEPC Prep", href: "/dashboard/exam-prep/bepc", matchPrefix: true, requiresCycle: "SECONDARY_COLLEGE" },
        { icon: "book", label: "BAC Prep", href: "/dashboard/exam-prep/bac", matchPrefix: true, requiresCycle: "SECONDARY_LYCEE" },
    ],
};

/** Rôles pour qui la famille examens est pertinente. */
const EXAM_PREP_ROLES = new Set(["DIRECTOR", "SCHOOL_ADMIN", "TEACHER", "STUDENT"]);
```

4. Ajouter les fonctions `visibleNavGroups` (remplaçant l'ancienne signature) et `visibleNavLinks`. Remplacer la fonction `visibleNavGroups` existante par :

```typescript
/**
 * Groupes visibles pour un rôle, filtrés par cycles offerts ET modules activés.
 * Additif : injecte la famille examens pour les rôles concernés.
 * Défaut sûr : offeredLevels/enabledModules vides → aucun masquage.
 */
export function visibleNavGroups(
    role: string | undefined | null,
    ctx: NavContext = {}
): NavGroup[] {
    const base = navGroupsForRole(role);
    const groups = EXAM_PREP_ROLES.has(role ?? "")
        ? [...base, EXAM_PREP_NAV_GROUP]
        : base;

    const offered = ctx.offeredLevels;
    const enabled = ctx.enabledModules;

    return groups
        .filter((g) => !g.requiresModule || isModuleEnabled(g.requiresModule, enabled))
        .filter((g) => !g.requiresCycle || !offered || offered.length === 0 || offered.includes(g.requiresCycle))
        .map((g) => ({
            ...g,
            links: g.links.filter(
                (l) =>
                    (!l.requiresModule || isModuleEnabled(l.requiresModule, enabled)) &&
                    (!l.requiresCycle || !offered || offered.length === 0 || offered.includes(l.requiresCycle))
            ),
        }))
        .filter((g) => g.links.length > 0);
}

/** Liste à plat des liens visibles (nav mobile, palette de commandes). */
export function visibleNavLinks(
    role: string | undefined | null,
    ctx: NavContext = {}
): NavLink[] {
    return visibleNavGroups(role, ctx).flatMap((g) => g.links);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/edu-shell/role-nav.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Mettre à jour les appelants (build vert, additif)**

Dans `src/components/edu-shell/EduSidebar.tsx`, remplacer :

```typescript
    const offeredLevels = schoolCtx.offeredLevels;
    const groups = React.useMemo(
        () => visibleNavGroups(role, offeredLevels),
        [role, offeredLevels]
    );
```

par :

```typescript
    const offeredLevels = schoolCtx.offeredLevels;
    const enabledModules = schoolCtx.enabledModules;
    const groups = React.useMemo(
        () => visibleNavGroups(role, { offeredLevels, enabledModules }),
        [role, offeredLevels, enabledModules]
    );
```

Dans `src/components/edu-shell/EduMobileNav.tsx` : si le fichier utilise `navForRole(role)`, ajouter `const { offeredLevels, enabledModules } = useSchool();` (importer `useSchool` depuis `@/components/providers/school-provider` s'il ne l'est pas déjà) et remplacer l'appel `navForRole(role)` par `visibleNavLinks(role, { offeredLevels, enabledModules })` (mettre à jour l'import depuis `./role-nav`).

- [ ] **Step 6: Vérifier compilation + tests**

Run: `npm run type-check && npx vitest run src/components/edu-shell/role-nav.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/edu-shell/role-nav.ts src/components/edu-shell/role-nav.test.ts src/components/edu-shell/EduSidebar.tsx src/components/edu-shell/EduMobileNav.tsx
git commit -m "feat(nav): gating par module + groupe Préparation examens (additif)"
```

---

## Task 4: Enforcement serveur `assertModuleEnabled`

**Files:**
- Create: `src/lib/api/assert-module.ts`
- Test: `src/lib/api/assert-module.test.ts`

**Interfaces:**
- Consumes: `MODULES`/`isModuleEnabled` (Task 1) ; `getActiveSchoolId` (`@/lib/api/tenant-isolation`) ; `prisma` (`@/lib/prisma`).
- Produces: `async function assertModuleEnabled(session: Session | null, key: ModuleKey): Promise<NextResponse | null>` — retourne une réponse 403 si le module est désactivé pour l'école active, sinon `null`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/assert-module.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ default: { school: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock("@/lib/api/tenant-isolation", () => ({ getActiveSchoolId: () => "school-1" }));

import { assertModuleEnabled } from "./assert-module";

const session = { user: { id: "u1", role: "SCHOOL_ADMIN", schoolId: "school-1" } } as never;

describe("assertModuleEnabled", () => {
  beforeEach(() => findUnique.mockReset());

  it("laisse passer (null) quand le module est activé", async () => {
    findUnique.mockResolvedValue({ enabledModules: ["EXAM_PREP"] });
    expect(await assertModuleEnabled(session, "EXAM_PREP")).toBeNull();
  });

  it("laisse passer (défaut sûr) quand enabledModules est vide", async () => {
    findUnique.mockResolvedValue({ enabledModules: [] });
    expect(await assertModuleEnabled(session, "EXAM_PREP")).toBeNull();
  });

  it("renvoie 403 quand le module est désactivé (config non vide)", async () => {
    findUnique.mockResolvedValue({ enabledModules: ["LIBRARY"] });
    const res = await assertModuleEnabled(session, "EXAM_PREP");
    expect(res?.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/assert-module.test.ts`
Expected: FAIL — `Cannot find module './assert-module'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/api/assert-module.ts
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isModuleEnabled, type ModuleKey } from "@/lib/establishment/modules";

/**
 * Enforcement serveur : renvoie une 403 si `key` n'est pas activé pour l'école
 * active, sinon `null`. Masquer la nav ne suffit pas — toute route de module
 * optionnel doit appeler ceci. Défaut sûr : enabledModules vide → autorisé.
 */
export async function assertModuleEnabled(
  session: Session | null,
  key: ModuleKey
): Promise<NextResponse | null> {
  const schoolId = getActiveSchoolId(session);
  if (!schoolId) return null; // pas d'école active (ex. mode global) → pas de gating ici

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { enabledModules: true },
  });

  if (isModuleEnabled(key, school?.enabledModules)) return null;

  return NextResponse.json(
    { error: "Module non activé pour cet établissement" },
    { status: 403 }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/assert-module.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/assert-module.ts src/lib/api/assert-module.test.ts
git commit -m "feat(security): assertModuleEnabled — enforcement serveur des modules"
```

---

## Task 5: Garde de page `ModuleGuard` + route prep unifiée `/exam-prep/[track]`

**Files:**
- Create: `src/components/guard/module-guard.tsx`
- Create: `src/app/(dashboard)/dashboard/exam-prep/[track]/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/bepc-prep/page.tsx` (redirect de compat)

**Interfaces:**
- Consumes: `useSchool().enabledModules` (Task 2) ; `CycleGuard` (`@/components/guard/cycle-guard`) ; `LEVEL_CYCLES`/`RealCycle` (`@/lib/benin/levels.ts`) ; `isModuleEnabled` (Task 1).
- Produces: `ModuleGuard({ requires: ModuleKey, children })`.

- [ ] **Step 1: Créer `ModuleGuard` (miroir de `CycleGuard`)**

```tsx
// src/components/guard/module-guard.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSchool } from "@/components/providers/school-provider";
import { Button, Card, Icon } from "@/components/edu";
import { MODULES, isModuleEnabled, type ModuleKey } from "@/lib/establishment/modules";

/**
 * Restreint un écran à un module optionnel activé (School.enabledModules).
 * Défaut SÛR : tant que enabledModules est vide, on affiche le contenu.
 */
export function ModuleGuard({
  requires,
  children,
}: {
  requires: ModuleKey;
  children: React.ReactNode;
}) {
  const { enabledModules } = useSchool();

  if (isModuleEnabled(requires, enabledModules)) return <>{children}</>;

  return (
    <div className="eduflow-scope mx-auto flex max-w-3xl flex-col gap-4 pb-12">
      <Card padding={40} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minHeight: 320, justifyContent: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--eduflow-surface-sunken)", display: "grid", placeItems: "center" }}>
          <Icon name="settings" size={32} color="var(--eduflow-text-tertiary)" />
        </div>
        <h3 className="eduflow-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Module « {MODULES[requires].label} » non activé
        </h3>
        <p style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)", maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
          Cette fonctionnalité fait partie d&apos;un module optionnel qui n&apos;est pas
          activé pour votre établissement.
        </p>
        <Link href="/dashboard/settings/modules" style={{ textDecoration: "none" }}>
          <Button variant="secondary" icon="settings">Gérer les modules</Button>
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Créer la route prep unifiée**

Cette page mappe `track` → cycle, enveloppe le contenu existant du prep dans `ModuleGuard` + `CycleGuard`. Le corps réutilise la logique déjà présente dans `bepc-prep/page.tsx` (readiness, stats) — pour le BEPC, réutiliser tel quel ; CEP/BAC affichent le même écran paramétré par l'examen.

```tsx
// src/app/(dashboard)/dashboard/exam-prep/[track]/page.tsx
"use client";

import { notFound, useParams } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { CycleGuard } from "@/components/guard/cycle-guard";
import { ModuleGuard } from "@/components/guard/module-guard";
import { Permission } from "@/lib/rbac/permissions";
import type { RealCycle } from "@/lib/benin/levels";
import { ExamPrepScreen } from "@/components/exam-prep/ExamPrepScreen";

const TRACK_TO_CYCLE: Record<string, { cycle: RealCycle; exam: "CEP" | "BEPC" | "BAC" }> = {
  cep: { cycle: "PRIMARY", exam: "CEP" },
  bepc: { cycle: "SECONDARY_COLLEGE", exam: "BEPC" },
  bac: { cycle: "SECONDARY_LYCEE", exam: "BAC" },
};

export default function ExamPrepPage() {
  const params = useParams();
  const track = String(params.track ?? "").toLowerCase();
  const mapping = TRACK_TO_CYCLE[track];
  if (!mapping) return notFound();

  return (
    <PageGuard permission={Permission.SCHOOL_READ}>
      <ModuleGuard requires="EXAM_PREP">
        <CycleGuard requires={mapping.cycle}>
          <ExamPrepScreen exam={mapping.exam} />
        </CycleGuard>
      </ModuleGuard>
    </PageGuard>
  );
}
```

**Note d'extraction (additif, ne change pas la feature) :** déplacer le corps rendu actuel de `bepc-prep/page.tsx` dans un nouveau composant `src/components/exam-prep/ExamPrepScreen.tsx` acceptant `exam: "CEP" | "BEPC" | "BAC"`, en paramétrant les libellés/endpoints par `exam`. Le comportement BEPC reste identique ; CEP/BAC réutilisent le même écran. Conserver `Permission.SCHOOL_READ` (lecture) — ne pas durcir au-delà de l'existant.

- [ ] **Step 3: Redirect de compat depuis l'ancienne route**

Remplacer le contenu de `src/app/(dashboard)/dashboard/bepc-prep/page.tsx` par une redirection (aucune URL existante ne casse) :

```tsx
// src/app/(dashboard)/dashboard/bepc-prep/page.tsx
import { redirect } from "next/navigation";

export default function BepcPrepRedirect() {
  redirect("/dashboard/exam-prep/bepc");
}
```

- [ ] **Step 4: Vérifier compilation + navigation manuelle**

Run: `npm run type-check`
Expected: PASS.
Vérif manuelle : `/dashboard/bepc-prep` redirige vers `/dashboard/exam-prep/bepc` ; `/dashboard/exam-prep/xyz` → 404.

- [ ] **Step 5: Commit**

```bash
git add src/components/guard/module-guard.tsx "src/app/(dashboard)/dashboard/exam-prep" src/components/exam-prep/ExamPrepScreen.tsx "src/app/(dashboard)/dashboard/bepc-prep/page.tsx"
git commit -m "feat(exam-prep): route unifiée /exam-prep/[track] + ModuleGuard + redirect compat"
```

---

## Task 6: API config des modules `/api/config/modules`

**Files:**
- Create: `src/app/api/config/modules/route.ts`
- Test: `src/app/api/config/modules/route.test.ts`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`) ; `prisma` ; `getActiveSchoolId` ; `optionalModuleKeys`/`isValidOptionalModuleKey` (Task 1).
- Produces: `GET` → `{ enabledModules: string[]; available: {key,label,description}[] }` ; `PATCH` (body `{ enabledModules: string[] }`) → `{ enabledModules: string[] }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/config/modules/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
const update = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { update: (...a: unknown[]) => update(...a) },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/api/tenant-isolation", () => ({ getActiveSchoolId: () => "school-1" }));

import { PATCH } from "./route";

function req(body: unknown) {
  return { json: async () => body } as never;
}

describe("PATCH /api/config/modules", () => {
  beforeEach(() => { auth.mockReset(); update.mockReset(); });

  it("403 si rôle non autorisé", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "STUDENT" } });
    const res = await PATCH(req({ enabledModules: ["EXAM_PREP"] }));
    expect(res.status).toBe(403);
  });

  it("400 si une clé est inconnue ou core", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "SCHOOL_ADMIN", schoolId: "school-1" } });
    const res = await PATCH(req({ enabledModules: ["STUDENTS"] }));
    expect(res.status).toBe(400);
  });

  it("200 et persiste les clés optionnelles valides", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "SCHOOL_ADMIN", schoolId: "school-1" } });
    update.mockResolvedValue({ enabledModules: ["EXAM_PREP", "LIBRARY"] });
    const res = await PATCH(req({ enabledModules: ["EXAM_PREP", "LIBRARY"] }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/config/modules/route.test.ts`
Expected: FAIL — module route introuvable.

- [ ] **Step 3: Write minimal implementation** (calqué sur `config/academic/route.ts`)

```typescript
// src/app/api/config/modules/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { MODULES, optionalModuleKeys, isValidOptionalModuleKey } from "@/lib/establishment/modules";

const WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

const patchSchema = z.object({
  enabledModules: z.array(z.string()),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { enabledModules: true },
    });

    return NextResponse.json({
      enabledModules: school?.enabledModules ?? [],
      available: optionalModuleKeys().map((k) => ({
        key: k,
        label: MODULES[k].label,
        description: MODULES[k].description,
      })),
    });
  } catch (error) {
    logger.error("config/modules GET:", error as Error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!WRITE_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });

    const { enabledModules } = patchSchema.parse(await request.json());

    const invalid = enabledModules.filter((k) => !isValidOptionalModuleKey(k));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Clés de module invalides", details: invalid },
        { status: 400 }
      );
    }
    const unique = Array.from(new Set(enabledModules));

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { enabledModules: unique },
      select: { id: true, enabledModules: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        schoolId,
        action: "UPDATE",
        entity: "School.enabledModules",
        entityId: school.id,
        newValues: { enabledModules: unique },
      },
    });

    return NextResponse.json({ enabledModules: school.enabledModules });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error("config/modules PATCH:", error as Error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/config/modules/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/config/modules
git commit -m "feat(config): API GET/PATCH des modules activés (validation + audit)"
```

---

## Task 7: Page admin de gestion des modules

**Files:**
- Create: `src/app/(dashboard)/dashboard/settings/modules/page.tsx`

**Interfaces:**
- Consumes: `/api/config/modules` (Task 6) ; `PageGuard`/`Permission` ; `useSchool` ; composants `@/components/edu` + `@radix-ui/react-switch` (déjà en deps).
- Produces: écran de toggles (loading/empty/error/success).

- [ ] **Step 1: Créer la page (suivre le pattern des pages settings existantes)**

```tsx
// src/app/(dashboard)/dashboard/settings/modules/page.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import * as Switch from "@radix-ui/react-switch";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";

type ModulesResponse = {
  enabledModules: string[];
  available: { key: string; label: string; description: string }[];
};

export default function ModulesSettingsPage() {
  return (
    <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <ModulesSettingsContent />
    </PageGuard>
  );
}

function ModulesSettingsContent() {
  const { data, error, isLoading, mutate } = useSWR<ModulesResponse>("/api/config/modules", fetcher);
  const [saving, setSaving] = React.useState<string | null>(null);

  if (isLoading) return <PageLoading />;
  if (error || !data) return <PageError message="Impossible de charger les modules." />;

  const enabled = new Set(data.enabledModules);

  async function toggle(key: string, next: boolean) {
    setSaving(key);
    const nextList = next
      ? [...data!.enabledModules, key]
      : data!.enabledModules.filter((k) => k !== key);
    // Optimiste
    mutate({ ...data!, enabledModules: nextList }, false);
    try {
      const res = await fetch("/api/config/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledModules: nextList }),
      });
      if (!res.ok) throw new Error("PATCH failed");
      const json = (await res.json()) as { enabledModules: string[] };
      mutate({ ...data!, enabledModules: json.enabledModules }, false);
    } catch {
      mutate(); // rollback via revalidation
    } finally {
      setSaving(null);
    }
  }

  return (
    <PageShell>
      <PageHeader title="Modules" subtitle="Activez uniquement les modules utiles à votre établissement." />
      {data.available.length === 0 ? (
        <Card padding={32}><p style={{ margin: 0, fontSize: 13 }}>Aucun module optionnel disponible.</p></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.available.map((m) => (
            <Card key={m.key} padding={20} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>{m.description}</div>
              </div>
              <Switch.Root
                checked={enabled.has(m.key)}
                disabled={saving === m.key}
                onCheckedChange={(v) => toggle(m.key, v)}
                className="eduflow-switch"
                aria-label={`Activer ${m.label}`}
              >
                <Switch.Thumb className="eduflow-switch-thumb" />
              </Switch.Root>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

**Note :** si les classes `eduflow-switch` n'existent pas, réutiliser le composant switch déjà employé ailleurs (chercher `@radix-ui/react-switch` dans `src/components` et copier le style). Ne pas introduire de nouveau design.

- [ ] **Step 2: Vérifier compilation + rendu**

Run: `npm run type-check`
Expected: PASS. Vérif manuelle : `/dashboard/settings/modules` liste les modules optionnels, toggle persiste (recharger la page confirme l'état).

- [ ] **Step 3: Full test + lint**

Run: `npx vitest run && npm run lint`
Expected: tous les tests verts, lint OK.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/settings/modules/page.tsx"
git commit -m "feat(settings): page de gestion des modules activés (toggles)"
```

---

## Self-Review

**Spec coverage :**
- §1 modèle `enabledModules` → Task 2 ✅
- §2 registre modules → Task 1 ✅
- §3 extension `role-nav` (`requiresModule`, `visibleNavGroups`) + groupe exam prep → Task 3 ✅
- §4 route unifiée `exam-prep/[track]` + redirect → Task 5 ✅
- §5 câblage provider/API + EduSidebar/EduMobileNav → Task 2 + Task 3 ✅
- §6 admin modules (`/api/config/modules` + settings page) → Task 6 + Task 7 ✅
- §7 enforcement serveur `assertModuleEnabled` → Task 4 ✅ (à appliquer aux routes `exams/prep` lors de leur prochaine évolution ; la garde de page + la route unifiée couvrent l'accès UI)
- Défaut sûr / rétro-compat → testé Task 1, 3, 4 ✅
- Gestion des états (loading/empty/error) → Task 7 ✅

**Placeholder scan :** aucun TODO/TBD ; tout le code est fourni. La seule instruction d'extraction (Task 5, `ExamPrepScreen`) référence du code existant à déplacer sans le changer.

**Type consistency :** `ModuleKey`, `isModuleEnabled`, `NavContext`, `visibleNavGroups(role, ctx)`, `visibleNavLinks(role, ctx)`, `assertModuleEnabled(session, key)`, `ModuleGuard({ requires })` — signatures cohérentes entre tasks.

**Écart connu :** l'application de `assertModuleEnabled` aux routes API `exams/prep` existantes n'est pas un step (ce serait modifier une feature actuelle, exclu par la contrainte globale). À faire dans une tranche « durcissement » dédiée. La sécurité d'accès UI est assurée par `ModuleGuard` + `CycleGuard`.
