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
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "SUPER_ADMIN"]) {
            const count = linkCount(role);
            expect(count).toBeGreaterThanOrEqual(5);
            expect(count).toBeLessThanOrEqual(8);
        }
        // Personnel : vie scolaire + consultation des élèves et des annonces (TD-022), sans IA.
        expect(linkCount("STAFF")).toBe(7); // Accueil, Appel, Élèves, Annonces, Incidents, Vie scolaire, Paramètres
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

    it("l'Assistant IA n'apparaît qu'aux rôles admis par la page et la gouvernance IA", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "SUPER_ADMIN"]) {
            expect(navForRole(role).some((l) => l.href === "/dashboard/ai")).toBe(true);
        }
        for (const role of ["ACCOUNTANT", "STAFF"]) {
            expect(navForRole(role).some((l) => l.href === "/dashboard/ai")).toBe(false);
        }
    });

    it("le responsable de réseau a la navigation de la direction, pas celle du personnel", () => {
        const hrefs = (role: string) => navGroupsForRole(role).flatMap((g) => g.links.map((l) => l.href));
        expect(hrefs("NETWORK_ADMIN")).toEqual(hrefs("SCHOOL_ADMIN"));
        expect(hrefs("NETWORK_ADMIN")).toContain("/dashboard/finance");
    });
});
