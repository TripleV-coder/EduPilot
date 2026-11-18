import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { getParentDashboardData as computeParent } from "@/lib/services/analytics-dashboard/family";

/**
 * Accueil parent mémoïsé 30 s : la clé porte la liste des enfants rattachés.
 * Régression vue par l'E2E d'installation à vide (2026-11-12) : le parent
 * qui venait de rattacher son enfant voyait encore « aucun enfant ».
 * Le cache est désactivé sous NODE_ENV=test : on le réactive ici.
 */
vi.mock("@/lib/prisma", () => ({ default: { parentStudent: { findMany: vi.fn() } } }));
vi.mock("@/lib/services/analytics-dashboard/family", () => ({
    getParentDashboardData: vi.fn(),
    getStudentDashboardData: vi.fn(),
}));

beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    vi.mocked(computeParent).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("getParentDashboardData — cache par enfants rattachés", () => {
    it("même liste d'enfants : servi par le cache ; enfant rattaché : recalcul immédiat", async () => {
        const { getParentDashboardData } = await import("@/lib/services/analytics-dashboard");
        vi.mocked(computeParent)
            .mockResolvedValueOnce({ children: [] } as never)
            .mockResolvedValueOnce({ children: [{ id: "s1" }] } as never);

        vi.mocked(prisma.parentStudent.findMany).mockResolvedValue([] as never);
        expect(await getParentDashboardData("u1", "y1")).toEqual({ children: [] });
        expect(await getParentDashboardData("u1", "y1")).toEqual({ children: [] });
        expect(computeParent).toHaveBeenCalledTimes(1);

        // Le parent rattache son enfant : la vue suivante est fraîche
        vi.mocked(prisma.parentStudent.findMany).mockResolvedValue([{ studentId: "s1" }] as never);
        expect(await getParentDashboardData("u1", "y1")).toEqual({ children: [{ id: "s1" }] });
        expect(computeParent).toHaveBeenCalledTimes(2);
        expect(computeParent).toHaveBeenLastCalledWith("u1", "y1");
        expect(prisma.parentStudent.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: { parent: { userId: "u1" } } }),
        );
    });
});
