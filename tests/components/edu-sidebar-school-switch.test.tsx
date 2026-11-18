// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Audit UX/rôles (2026-10-19) — le personnel rattaché à plusieurs écoles
 * (responsable de réseau, enseignant multi-écoles) ne pouvait changer
 * d'établissement que depuis la page Analyses. La barre latérale le permet.
 */
vi.mock("next/navigation", async () => (await import("../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../pages/harness")).schoolMock);
const sidebar = vi.hoisted(() => ({ isOpen: true, isMobileOpen: false, toggle: () => {}, setIsOpen: vi.fn(), setIsMobileOpen: () => {} }));
vi.mock("@/components/dashboard/DashboardLayoutClient", () => ({
    useSidebar: () => sidebar,
    SIDEBAR_EXPANDED_WIDTH: 220,
    SIDEBAR_COLLAPSED_WIDTH: 56,
}));

import { asRole, mockApi, renderPage, resetHarness, school } from "../pages/harness";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";

const TWO_SCHOOLS = [
    { id: "school-a", name: "École A", code: "A", isActive: true },
    { id: "school-b", name: "École B", code: "B", isActive: true },
];

afterEach(() => {
    cleanup();
    resetHarness();
    school.setActiveSchoolId.mockClear();
    sidebar.isOpen = true;
    sidebar.setIsOpen.mockClear();
});

describe("Barre latérale : établissement actif", () => {
    it.each(["NETWORK_ADMIN", "TEACHER"])("%s à deux écoles : sélecteur, le choix change l'école active", (role) => {
        asRole(role as never);
        school.accessibleSchools = TWO_SCHOOLS;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        const select = screen.getByRole("combobox", { name: "Établissement actif" });
        expect(select).toHaveValue("school-a");
        fireEvent.change(select, { target: { value: "school-b" } });
        expect(school.setActiveSchoolId).toHaveBeenCalledWith("school-b");
    });

    it("parent avec des enfants dans deux écoles : pas de sélecteur (navigation par enfant)", () => {
        asRole("PARENT");
        school.accessibleSchools = TWO_SCHOOLS;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.queryByRole("combobox", { name: "Établissement actif" })).not.toBeInTheDocument();
    });

    it("une seule école : nom affiché, pas de sélecteur", () => {
        asRole("NETWORK_ADMIN");
        school.accessibleSchools = [TWO_SCHOOLS[0]];
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.queryByRole("combobox", { name: "Établissement actif" })).not.toBeInTheDocument();
        expect(screen.getByText("Collège Saint-Michel")).toBeInTheDocument();
    });

    it("barre repliée (défaut) : l'avatar de l'école ouvre la barre pour en changer", () => {
        asRole("NETWORK_ADMIN");
        sidebar.isOpen = false;
        school.accessibleSchools = TWO_SCHOOLS;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        fireEvent.click(screen.getByRole("button", { name: /Changer d'établissement/ }));
        expect(sidebar.setIsOpen).toHaveBeenCalledWith(true);
    });
});
