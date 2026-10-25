// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Balayage UI 2026-10-25 : un administrateur d'école ouvrant directement
 * /dashboard/orientation/me (élève) ou /dashboard/system/monitoring
 * (super-admin) déclenchait l'appel d'API avant que PageGuard n'affiche son
 * refus (403 en console). Le chargement vit désormais sous la garde.
 */
const session = vi.hoisted(() => ({ role: "SCHOOL_ADMIN" }));
vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: { id: "u", role: session.role, roles: [] } }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard" }));

import OrientationMePage from "@/app/(dashboard)/dashboard/orientation/me/page";
import RootMonitoringPage from "@/app/(dashboard)/dashboard/root-control/monitoring/page";

const calls = (fetchMock: ReturnType<typeof vi.fn>, path: string) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes(path)).length;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    // 503 : les pages autorisées passent par leur état d'erreur (le test ne
    // porte que sur le déclenchement de l'appel, pas sur le rendu des données)
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "indisponible" }), { status: 503, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    session.role = "SCHOOL_ADMIN";
});

describe("Garde avant chargement", () => {
    it("orientation/me : un administrateur voit le refus, sans appel à /api/orientation/me", async () => {
        render(<OrientationMePage />);
        expect(await screen.findByText("Accès refusé")).toBeInTheDocument();
        expect(calls(fetchMock, "/api/orientation/me")).toBe(0);
    });

    it("orientation/me : un élève déclenche le chargement", async () => {
        session.role = "STUDENT";
        render(<OrientationMePage />);
        await waitFor(() => expect(calls(fetchMock, "/api/orientation/me")).toBe(1));
    });

    it("supervision : un administrateur d'école voit le refus, sans appel à /api/root/monitoring", async () => {
        render(<RootMonitoringPage />);
        expect(await screen.findByText("Accès refusé")).toBeInTheDocument();
        expect(calls(fetchMock, "/api/root/monitoring")).toBe(0);
    });

    it("supervision : le super-admin déclenche le chargement", async () => {
        session.role = "SUPER_ADMIN";
        render(<RootMonitoringPage />);
        await waitFor(() => expect(calls(fetchMock, "/api/root/monitoring")).toBeGreaterThanOrEqual(1));
    });
});
