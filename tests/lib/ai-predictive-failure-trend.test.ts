import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sens de la tendance dans predictFailureRisk : la requête renvoie les
 * analyses de la plus récente à la plus ancienne ; la régression doit
 * porter sur l'ordre chronologique. L'inversion se faisait par effet de
 * bord d'un calcul inutilisé — le retirer naïvement inversait le signe de
 * la tendance.
 */
// Paramètres de l'établissement : valeurs par défaut (pas de table de réglages dans le mock Prisma)
vi.mock("@/lib/schools/school-parameters-store", async () => {
    const { DEFAULT_SCHOOL_PARAMETERS } = await import("@/lib/schools/school-parameters");
    return {
        getSchoolParameters: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        getSchoolParametersForStudent: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        saveSchoolParameters: vi.fn(),
    };
});
vi.mock("@/lib/academic/grading-settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/academic/grading-settings")>()),
    getPassingGrade: vi.fn(async () => 10),
    passingGradeForStudent: vi.fn(async () => 10),
}));
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

describe("predictFailureRisk — une période sans moyenne n'est pas un 0", () => {
    it("ne lit que les périodes qui ont une moyenne (jamais de « moyenne critique 0/20 » à tort)", async () => {
        vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue(analyticsNewestFirst([14, 13]) as never);

        const result = await predictFailureRisk("s1");

        expect(vi.mocked(prisma.studentAnalytics.findMany).mock.calls.at(-1)![0]).toMatchObject({
            where: { studentId: "s1", generalAverage: { not: null } },
        });
        expect(result.factors.some((f) => f.startsWith("Moyenne critique"))).toBe(false);
    });
});
