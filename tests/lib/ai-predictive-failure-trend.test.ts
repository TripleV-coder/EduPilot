import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sens de la tendance dans predictFailureRisk : la requête renvoie les
 * analyses de la plus récente à la plus ancienne ; la régression doit
 * porter sur l'ordre chronologique. L'inversion se faisait par effet de
 * bord d'un calcul inutilisé — le retirer naïvement inversait le signe de
 * la tendance.
 */
vi.mock("@/lib/prisma", () => ({
    default: {
        studentAnalytics: { findMany: vi.fn() },
        attendance: { findMany: vi.fn() },
        behaviorIncident: { findMany: vi.fn() },
        homeworkSubmission: { findMany: vi.fn() },
        homework: { count: vi.fn() },
    },
}));

import prisma from "@/lib/prisma";
import { predictFailureRisk } from "@/lib/services/ai-predictive/predict-failure";

/** Analyses dans l'ordre de la requête (createdAt décroissant). */
function analyticsNewestFirst(averages: number[]) {
    return averages.map((generalAverage, i) => ({
        id: `sa${i}`,
        generalAverage,
        period: null,
        subjectPerformances: [],
    }));
}

beforeEach(() => {
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([]);
    vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue([]);
    vi.mocked(prisma.homework.count).mockResolvedValue(0);
});

describe("predictFailureRisk — sens de la tendance", () => {
    it("signale une baisse quand les moyennes chutent au fil du temps", async () => {
        // Chronologiquement : 16 → 14 → 12 (baisse de 2 points par période)
        vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue(
            analyticsNewestFirst([12, 14, 16]) as never,
        );

        const result = await predictFailureRisk("s1");

        expect(result.causalFactors.map((f) => f.factor)).toContain("tendance_baisse");
        expect(result.factors.some((f) => f.startsWith("Tendance à la baisse: -2.00"))).toBe(true);
    });

    it("ne signale pas de baisse quand les moyennes progressent", async () => {
        // Chronologiquement : 12 → 14 → 16
        vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue(
            analyticsNewestFirst([16, 14, 12]) as never,
        );

        const result = await predictFailureRisk("s1");

        expect(result.causalFactors.map((f) => f.factor)).not.toContain("tendance_baisse");
    });
});
