import { describe, it, expect } from "vitest";
import { navGroupsForRole, navForRole, visibleNavGroups } from "@/components/edu-shell/role-nav";
import { SERVICE_CATALOG } from "@/lib/navigation/service-catalog";

const linkCount = (role: string, offered: string[] | null = null) =>
    visibleNavGroups(role, offered).reduce((n, g) => n + g.links.length, 0);

describe("role-nav — 5 à 8 actions clés + « Tous les services »", () => {
    it("navForRole aplatit les groupes (compat palette de commandes)", () => {
        const groups = navGroupsForRole("SCHOOL_ADMIN");
        const flat = navForRole("SCHOOL_ADMIN");
        expect(flat.length).toBe(groups.reduce((n, g) => n + g.links.length, 0));
        expect(flat.some((l) => l.href === "/dashboard/finance")).toBe(true);
    });

    it("chaque rôle expose 5 à 8 actions clés, plus « Tous les services »", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "SUPER_ADMIN", "STAFF"]) {
            const count = linkCount(role);
            expect(count).toBeGreaterThanOrEqual(6);
            expect(count).toBeLessThanOrEqual(9);
            // Aucune page sans point d'entrée : l'annuaire est dans chaque menu
            expect(navForRole(role).some((l) => l.href === "/dashboard/services")).toBe(true);
        }
        // Personnel : vie scolaire + consultation des élèves et des annonces (TD-022), sans IA.
        expect(linkCount("STAFF")).toBe(8); // Accueil, Appel, Élèves, Annonces, Incidents, Vie scolaire, Services, Paramètres
    });

    it("le parent a ses notes, son bulletin et les devoirs dans le menu", () => {
        const hrefs = navForRole("PARENT").map((l) => l.href);
        expect(hrefs).toContain("/dashboard/grades");
        expect(hrefs).toContain("/dashboard/homework");
    });

    it("défaut sûr : offeredLevels vide → navigation complète du rôle", () => {
        const empty = linkCount("SCHOOL_ADMIN", []);
        const withLevels = linkCount("SCHOOL_ADMIN", ["PRIMARY"]);
        expect(empty).toBe(withLevels);
        expect(empty).toBe(9);
    });

    it("aucun groupe vide n'est renvoyé", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"]) {
            const groups = visibleNavGroups(role, ["PRIMARY"]);
            expect(groups.every((g) => g.links.length > 0)).toBe(true);
        }
    });

    it("l'Assistant IA n'apparaît qu'aux rôles admis par la page et la gouvernance IA", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "SUPER_ADMIN"]) {
            expect(navForRole(role).some((l) => l.href === "/dashboard/ai")).toBe(true);
        }
        // Parent : l'assistant reste dans « Tous les services », l'accueil et la barre du haut
        expect(SERVICE_CATALOG.find((s) => s.href === "/dashboard/ai")?.roles).toContain("PARENT");
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
