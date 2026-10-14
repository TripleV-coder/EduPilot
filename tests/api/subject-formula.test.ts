/**
 * Formule d'une matière choisie par son enseignant : seul l'enseignant de la
 * matière l'écrit, si l'école le permet ; la formule est vérifiée et tracée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
    syncAnalyticsForClassPeriod: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/prisma", () => {
    const prismaMock: Record<string, unknown> = {
        classSubject: { findUnique: vi.fn(), update: vi.fn() },
        configOption: { findFirst: vi.fn() },
        auditLog: { create: vi.fn() },
        period: { findFirst: vi.fn() },
    };
    prismaMock.$transaction = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg));
    return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { syncAnalyticsForClassPeriod } from "@/lib/services/analytics-sync";
import { GET, PUT } from "@/app/api/class-subjects/[id]/formula/route";

const csId = cuid("csmaths");
const teacherUserId = cuid("userteacher1");
const url = `http://localhost:3000/api/class-subjects/${csId}/formula`;
const params = { params: Promise.resolve({ id: csId }) };

function subject(averageFormula: string | null = null) {
    return {
        id: csId,
        classId: cuid("classe6a"),
        averageFormula,
        subject: { name: "Mathématiques" },
        class: { schoolId: FIXTURES.schoolA, name: "6e A" },
        teacher: { userId: teacherUserId },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(subject() as never);
});

describe("GET /api/class-subjects/[id]/formula", () => {
    it("montre la formule en vigueur et si l'enseignant peut la changer", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        const res = await GET(makeRequest(url), params);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toMatchObject({
            subjectFormula: null,
            effectiveFormula: "moyenne(MI ; DEVOIRS ; COMPOS)",
            teacherFormulasAllowed: true,
            canEdit: true,
        });
    });

    it("la formule de l'enseignant est ignorée si l'école l'a désactivée", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(subject("(MI + MD) / 2") as never);
        vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ metadata: { teacherFormulas: false } } as never);
        const body = await (await GET(makeRequest(url), params)).json();
        expect(body.effectiveFormula).toBe("moyenne(MI ; DEVOIRS ; COMPOS)");
        expect(body.canEdit).toBe(false);
    });
});

describe("PUT /api/class-subjects/[id]/formula", () => {
    it("refuse la direction : seul l'enseignant de la matière choisit (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "(MI + MD) / 2" } }), params);
        expect(res.status).toBe(403);
    });

    it("refuse un autre enseignant (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }));
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "(MI + MD) / 2" } }), params);
        expect(res.status).toBe(403);
        expect(prisma.classSubject.update).not.toHaveBeenCalled();
    });

    it("refuse quand l'école impose la même formule partout (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ metadata: { teacherFormulas: false } } as never);
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "(MI + MD) / 2" } }), params);
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("TEACHER_FORMULAS_DISABLED");
    });

    it("refuse une formule fausse avec l'explication (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "(MI + MD) / 3" } }), params);
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body.code).toBe("FORMULA_INVALID");
        expect(body.error).toContain("toutes les notes à 20");
        expect(prisma.classSubject.update).not.toHaveBeenCalled();
    });

    it("enregistre la formule, la trace et recalcule la période en cours", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.period.findFirst).mockResolvedValue({ id: cuid("periode2"), academicYearId: cuid("annee") } as never);
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "  (MI + MD + 2*MC) / 4 " } }), params);
        expect(res.status).toBe(200);
        expect((await res.json()).effectiveFormula).toBe("(MI + MD + 2*MC) / 4");
        expect(prisma.classSubject.update).toHaveBeenCalledWith({ where: { id: csId }, data: { averageFormula: "(MI + MD + 2*MC) / 4" } });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "SUBJECT_FORMULA_CHANGED",
                oldValues: expect.objectContaining({ formula: null }),
                newValues: expect.objectContaining({ formula: "(MI + MD + 2*MC) / 4" }),
            }),
        });
        expect(syncAnalyticsForClassPeriod).toHaveBeenCalledWith(cuid("classe6a"), cuid("periode2"), cuid("annee"));
    });

    it("revenir à la formule de l'école (null, ou formule identique à celle de l'école)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(subject("(MI + MD) / 2") as never);
        const res = await PUT(makeRequest(url, { method: "PUT", body: { formula: "moyenne(MI ; DEVOIRS ; COMPOS)" } }), params);
        expect((await res.json()).subjectFormula).toBeNull();
        expect(prisma.classSubject.update).toHaveBeenCalledWith({ where: { id: csId }, data: { averageFormula: null } });
    });
});
