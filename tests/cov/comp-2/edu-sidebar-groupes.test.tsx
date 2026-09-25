// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("../../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../../pages/harness")).schoolMock);

const sidebar = vi.hoisted(() => ({ isOpen: true, isMobileOpen: false, toggle: () => {}, setIsMobileOpen: () => {} }));
vi.mock("@/components/dashboard/DashboardLayoutClient", () => ({
    useSidebar: () => sidebar,
    SIDEBAR_EXPANDED_WIDTH: 220,
    SIDEBAR_COLLAPSED_WIDTH: 56,
}));

// Aucun rôle n'a aujourd'hui de groupe titré : on simule une navigation
// groupée (champ `title` du contrat NavGroup) pour vérifier son rendu.
vi.mock("@/components/edu-shell/role-nav", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/components/edu-shell/role-nav")>();
    return {
        ...real,
        visibleNavGroups: () => [
            { title: "Pédagogie", links: [{ icon: "pencil", label: "Notes", href: "/dashboard/grades" }] },
            { links: [{ icon: "home", label: "Accueil", href: "/dashboard" }] },
        ],
    };
});

import { asRole, mockApi, renderPage, resetHarness } from "../../pages/harness";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";

afterEach(() => {
    cleanup();
    resetHarness();
    sidebar.isOpen = true;
});

describe("Barre latérale : groupes titrés", () => {
    it("affiche le titre du groupe quand la barre est déployée", () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.getByText("Pédagogie")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute("href", "/dashboard/grades");
    });

    it("masque le titre quand la barre est repliée", () => {
        asRole("DIRECTOR");
        sidebar.isOpen = false;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.queryByText("Pédagogie")).not.toBeInTheDocument();
        expect(screen.getByTitle("Notes")).toBeInTheDocument();
    });
});
