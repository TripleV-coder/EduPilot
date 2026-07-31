import { describe, it, expect, vi, beforeEach } from "vitest";

// Prisma.sql : passthrough qui capture le texte du template pour router les
// réponses de $queryRaw selon le contenu de la requête.
vi.mock("@prisma/client", () => ({
    Prisma: {
        sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
            text: strings.join(" ? "),
            vals,
        }),
    },
}));

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        $queryRaw: vi.fn((q: { text: string }) => {
            if (q.text.includes("onboarding_event")) {
                return Promise.resolve([{ viewed: 8, checked: 5, completed: 3 }]);
            }
            if (q.text.includes("spans")) {
                return Promise.resolve([{ eligible: 10, retained: 6 }]);
            }
            return Promise.resolve([{ count: 12 }]);
        }),
        telemetryEvent: {
            count: vi.fn().mockResolvedValue(100),
            groupBy: vi
                .fn()
                .mockResolvedValue([{ event: "onboarding_event", _count: { event: 50 } }]),
        },
    },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { getUxAnalytics } from "@/lib/ux/analytics";

describe("getUxAnalytics", () => {
    beforeEach(() => {
        prismaMock.$queryRaw.mockClear();
        prismaMock.telemetryEvent.count.mockClear();
        prismaMock.telemetryEvent.groupBy.mockClear();
    });

    it("agrège totaux, activation, rétention et top événements", async () => {
        const result = await getUxAnalytics(30);

        expect(result.windowDays).toBe(30);
        expect(result.totalEvents).toBe(100);
        expect(result.distinctUsers).toBe(12);

        expect(result.activation).toEqual({
            viewed: 8,
            checkedStep: 5,
            completed: 3,
            completionRate: 0.375,
        });

        expect(result.retention).toHaveLength(3);
        expect(result.retention.map((r) => r.day)).toEqual([1, 7, 30]);
        expect(result.retention[0]).toMatchObject({ eligible: 10, retained: 6, rate: 0.6 });

        expect(result.topEvents[0]).toEqual({ event: "onboarding_event", count: 50 });
    });

    it("renvoie un taux de 0 quand le dénominateur est nul", async () => {
        prismaMock.$queryRaw.mockImplementation((q: { text: string }) => {
            if (q.text.includes("onboarding_event")) {
                return Promise.resolve([{ viewed: 0, checked: 0, completed: 0 }]);
            }
            if (q.text.includes("spans")) {
                return Promise.resolve([{ eligible: 0, retained: 0 }]);
            }
            return Promise.resolve([{ count: 0 }]);
        });

        const result = await getUxAnalytics(7);
        expect(result.activation.completionRate).toBe(0);
        expect(result.retention[0].rate).toBe(0);
    });
});
