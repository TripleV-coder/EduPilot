import { describe, it, expect } from "vitest";
import { navGroupsForRole, navForRole, visibleNavGroups } from "@/components/edu-shell/role-nav";

const titles = (role: string, offered: string[] | null) =>
    visibleNavGroups(role, offered).map((g) => g.title ?? "(global)");

describe("role-nav — groupement global → spécifique au niveau", () => {
    it("navForRole aplatit les groupes (compat command palette)", () => {
        const groups = navGroupsForRole("SCHOOL_ADMIN");
        const flat = navForRole("SCHOOL_ADMIN");
        expect(flat.length).toBe(groups.reduce((n, g) => n + g.links.length, 0));
        expect(flat.some((l) => l.href === "/dashboard/finance")).toBe(true);
    });

    it("défaut sûr : offeredLevels vide → tous les groupes, cycles inclus", () => {
        const t = titles("SCHOOL_ADMIN", []);
        expect(t).toContain("Cycle Primaire");
        expect(t).toContain("Cycle Collège");
    });

    it("école Collège+Lycée : masque le groupe Primaire, garde Collège", () => {
        const t = titles("SCHOOL_ADMIN", ["SECONDARY_COLLEGE", "SECONDARY_LYCEE"]);
        expect(t).not.toContain("Cycle Primaire");
        expect(t).toContain("Cycle Collège");
        // les groupes globaux restent toujours présents
        expect(t).toContain("Scolarité");
        expect(t).toContain("Finance");
    });

    it("école Primaire seule : masque le groupe Collège, garde Primaire", () => {
        const t = titles("SCHOOL_ADMIN", ["PRIMARY"]);
        expect(t).toContain("Cycle Primaire");
        expect(t).not.toContain("Cycle Collège");
    });

    it("aucun groupe vide n'est renvoyé", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"]) {
            const groups = visibleNavGroups(role, ["PRIMARY"]);
            expect(groups.every((g) => g.links.length > 0)).toBe(true);
        }
    });
});
