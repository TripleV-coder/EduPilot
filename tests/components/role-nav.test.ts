import { describe, it, expect } from "vitest";
import { navGroupsForRole, navForRole, visibleNavGroups } from "@/components/edu-shell/role-nav";

const linkCount = (role: string, offered: string[] | null = null) =>
    visibleNavGroups(role, offered).reduce((n, g) => n + g.links.length, 0);

describe("role-nav — parcours 5–8 actions par rôle", () => {
    it("navForRole aplatit les groupes (compat palette de commandes)", () => {
        const groups = navGroupsForRole("SCHOOL_ADMIN");
        const flat = navForRole("SCHOOL_ADMIN");
        expect(flat.length).toBe(groups.reduce((n, g) => n + g.links.length, 0));
        expect(flat.some((l) => l.href === "/dashboard/finance")).toBe(true);
    });

    it("chaque rôle expose entre 5 et 8 actions clés", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"]) {
            const count = linkCount(role);
            expect(count).toBeGreaterThanOrEqual(5);
            expect(count).toBeLessThanOrEqual(8);
        }
    });

    it("défaut sûr : offeredLevels vide → navigation complète du rôle", () => {
        const empty = linkCount("SCHOOL_ADMIN", []);
        const withLevels = linkCount("SCHOOL_ADMIN", ["PRIMARY"]);
        expect(empty).toBe(withLevels);
        expect(empty).toBe(8);
    });

    it("aucun groupe vide n'est renvoyé", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"]) {
            const groups = visibleNavGroups(role, ["PRIMARY"]);
            expect(groups.every((g) => g.links.length > 0)).toBe(true);
        }
    });

    it("tous les rôles ont accès à l'Assistant IA dans la nav", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"]) {
            const flat = navForRole(role);
            expect(flat.some((l) => l.href === "/dashboard/ai-assistant")).toBe(true);
        }
    });
});
