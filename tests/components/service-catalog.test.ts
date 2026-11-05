import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SERVICE_CATALOG, filterServices } from "@/lib/navigation/service-catalog";
import { Permission } from "@/lib/rbac/permissions";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";

/**
 * L'annuaire « Tous les services » ne mène jamais à « Accès refusé » : pour
 * chaque entrée, les rôles et la permission sont ceux de la garde PageGuard de
 * la page cible (lue dans le fichier), et le cycle celui de son CycleGuard.
 */
const pageFile = (href: string) => path.join(process.cwd(), "src/app/(dashboard)", href, "page.tsx");
// Pages gardées côté serveur (redirection), sans PageGuard
const SERVER_GUARDED: Record<string, string[]> = { "/dashboard/system/info": ["SUPER_ADMIN"] };

function guardOf(source: string) {
    const tag = source.match(/<PageGuard([^>]*)>/)?.[1] ?? "";
    const rolesExpr = tag.match(/roles=\{([^}]*)\}/)?.[1] ?? null;
    const roles = rolesExpr === null
        ? null
        : rolesExpr.includes("STAFF_MEMBER_ROLES")
            ? [...STAFF_MEMBER_ROLES]
            : [...rolesExpr.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    const permExpr = tag.match(/permission=\{([^}]*)\}/)?.[1] ?? "";
    const permissions = [...permExpr.matchAll(/Permission\.([A-Z_]+)/g)].map((m) => (Permission as Record<string, string>)[m[1]]);
    const cycle = source.match(/<CycleGuard requires="([A-Z_]+)"/)?.[1] ?? null;
    return { roles, permissions, cycle };
}

describe("annuaire des services ↔ gardes de page", () => {
    it.each(SERVICE_CATALOG.map((s) => [s.href, s] as const))("%s", (href, entry) => {
        const file = pageFile(href);
        expect(existsSync(file), `page absente : ${href}`).toBe(true);
        const source = readFileSync(file, "utf8");
        if (SERVER_GUARDED[href]) {
            expect([...(entry.roles ?? [])].sort()).toEqual([...SERVER_GUARDED[href]].sort());
            return;
        }
        const guard = guardOf(source);
        if (guard.roles) expect([...(entry.roles ?? [])].sort(), `rôles de ${href}`).toEqual([...guard.roles].sort());
        else expect(entry.roles, `${href} : pas de rôles dans la garde`).toBeUndefined();
        const entryPermissions = entry.permission === undefined ? [] : Array.isArray(entry.permission) ? [...entry.permission] : [entry.permission];
        expect(entryPermissions.sort(), `permission de ${href}`).toEqual(guard.permissions.sort());
        expect(entry.cycle ?? null, `cycle de ${href}`).toBe(guard.cycle);
    });

    it("aucun doublon, aucune page du menu principal en double inutile", () => {
        const hrefs = SERVICE_CATALOG.map((s) => s.href);
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it("filtre : rôle, modules activés et cycles offerts", () => {
        const allowAll = { canAccess: () => true, isPageAllowedByModules: () => true };
        const all = filterServices(SERVICE_CATALOG, { ...allowAll, enabledModules: [], offeredLevels: [] });
        expect(all.length).toBe(SERVICE_CATALOG.length);
        // École primaire seule : pas de BEPC ni d'orientation post-BEPC, CEP présent
        const primary = filterServices(SERVICE_CATALOG, { ...allowAll, enabledModules: [], offeredLevels: ["PRIMARY"] }).map((s) => s.href);
        expect(primary).toContain("/dashboard/orientation/cep");
        expect(primary).not.toContain("/dashboard/bepc-prep");
        // Module désactivé : sa page disparaît
        const noLibrary = filterServices(SERVICE_CATALOG, {
            canAccess: () => true,
            enabledModules: ["students"],
            offeredLevels: [],
            isPageAllowedByModules: (href) => href !== "/dashboard/library",
        }).map((s) => s.href);
        expect(noLibrary).not.toContain("/dashboard/library");
    });
});
