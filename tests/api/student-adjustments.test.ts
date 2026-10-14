/**
 * Calcul adapté pour un élève : note non comptée (motif) et formule
 * particulière. Réservé à l'enseignant de la matière, si l'école le permet,
 * avant le conseil de classe ; tout est vérifié et tracé.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Grade } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({ assertModelAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/services/analytics-sync", () => ({
    syncAnalyticsAfterGradeChange: vi.fn().mockResolvedValue(undefined),
    syncAnalyticsForClassPeriod: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
    return { ...actual, invalidateByPath: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/lib/prisma", () => {
    const prismaMock: Record<string, unknown> = {
        grade: { findUnique: vi.fn(), update: vi.fn() },
        classSubject: { findUnique: vi.fn() },
        classCouncil: { findUnique: vi.fn() },
        configOption: { findFirst: vi.fn() },
        period: { findUnique: vi.fn() },
        enrollment: { findFirst: vi.fn() },
        studentFormula: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
        auditLog: { create: vi.fn(), createMany: vi.fn() },
    };
    prismaMock.$transaction = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg));
    return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { PATCH } from "@/app/api/grades/[id]/route";
import { PUT as PUT_FORMULA } from "@/app/api/student-formulas/route";

const teacherUserId = cuid("userteacher1");
const gradeId = cuid("grade0001");
const csId = cuid("csmaths");
const periodId = cuid("periode1");
const classId = cuid("classe6a");

function existingGrade(overrides: Record<string, unknown> = {}) {
    return {
        id: gradeId,
        studentId: FIXTURES.studentA,
        evaluationId: cuid("eval1"),
        value: 8,
        isAbsent: false,
        isExcused: false,
        excuseReason: null,
        excludedReason: null,
        comment: null,
        evaluation: {
            periodId,
            maxGrade: 20,
            classSubject: { classId, teacher: { userId: teacherUserId }, class: { schoolId: FIXTURES.schoolA } },
        },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue(null);
});

describe("Ne pas compter une note pour un élève (PATCH /api/grades/[id])", () => {
    const params = { params: Promise.resolve({ id: gradeId }) };
    const patch = (body: Record<string, unknown>) =>
        PATCH(makeRequest(`http://localhost:3000/api/grades/${gradeId}`, { method: "PATCH", body }), params);

    it("exige un motif (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
        const res = await patch({ excluded: true });
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("EXCLUSION_REASON_REQUIRED");
        expect(prisma.grade.update).not.toHaveBeenCalled();
    });

    it("enregistre la note comme non comptée, sans toucher à sa valeur, et la trace", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
        vi.mocked(prisma.grade.update).mockResolvedValue(existingGrade({ excludedReason: "Copie perdue par l'école" }) as unknown as Grade);
        const res = await patch({ excluded: true, excludedReason: "  Copie perdue par l'école " });
        expect(res.status).toBe(200);
        const data = vi.mocked(prisma.grade.update).mock.calls[0][0].data as Record<string, unknown>;
        expect(data.excludedReason).toBe("Copie perdue par l'école");
        expect(data).not.toHaveProperty("value");
        expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ newValues: expect.objectContaining({ excludedReason: "Copie perdue par l'école" }) })],
        });
    });

    it("compter de nouveau retire le motif", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade({ excludedReason: "Copie perdue" }) as unknown as Grade);
        vi.mocked(prisma.grade.update).mockResolvedValue(existingGrade() as unknown as Grade);
        await patch({ excluded: false });
        expect((vi.mocked(prisma.grade.update).mock.calls[0][0].data as Record<string, unknown>).excludedReason).toBeNull();
    });

    it("refusé si l'école ne permet pas d'adapter le calcul (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
        vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ metadata: { studentAdjustments: false } } as never);
        const res = await patch({ excluded: true, excludedReason: "x" });
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("STUDENT_ADJUSTMENTS_DISABLED");
    });

    it("refusé après la validation du conseil (409)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
        vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);
        const res = await patch({ excluded: true, excludedReason: "x" });
        expect(res.status).toBe(409);
    });
});

describe("Formule particulière pour un élève (PUT /api/student-formulas)", () => {
    const url = "http://localhost:3000/api/student-formulas";
    const body = { classSubjectId: csId, periodId, studentId: FIXTURES.studentA, formula: "(MI + D1) / 2", reason: "Devoir 2 annulé (malade)" };
    const put = (b: Record<string, unknown>) => PUT_FORMULA(makeRequest(url, { method: "PUT", body: b }));

    beforeEach(() => {
        vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
            id: csId,
            classId,
            subject: { name: "Mathématiques" },
            class: { schoolId: FIXTURES.schoolA, name: "6e A" },
            teacher: { userId: teacherUserId },
        } as never);
        vi.mocked(prisma.period.findUnique).mockResolvedValue({
            id: periodId,
            academicYearId: cuid("annee"),
            academicYear: { schoolId: FIXTURES.schoolA },
        } as never);
        vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "enr" } as never);
        vi.mocked(prisma.studentFormula.findUnique).mockResolvedValue(null);
    });

    it("refuse la direction et un autre enseignant (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        expect((await put(body)).status).toBe(403);
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }));
        expect((await put(body)).status).toBe(403);
        expect(prisma.studentFormula.upsert).not.toHaveBeenCalled();
    });

    it("exige un motif et une formule valable (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        expect((await (await put({ ...body, reason: "" })).json()).code).toBe("REASON_REQUIRED");
        const wrong = await (await put({ ...body, formula: "(MI + D1) / 3" })).json();
        expect(wrong.code).toBe("FORMULA_INVALID");
        expect(wrong.error).toContain("toutes les notes à 20");
    });

    it("refusée après la validation du conseil (409)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);
        expect((await put(body)).status).toBe(409);
    });

    it("enregistre la formule pour cet élève et trace le changement", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        const res = await put(body);
        expect(res.status).toBe(200);
        expect(prisma.studentFormula.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ formula: "(MI + D1) / 2", reason: "Devoir 2 annulé (malade)", studentId: FIXTURES.studentA }),
            }),
        );
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "STUDENT_FORMULA_CHANGED",
                oldValues: expect.objectContaining({ formula: null }),
                newValues: expect.objectContaining({ formula: "(MI + D1) / 2" }),
            }),
        });
    });

    it("revenir au calcul normal supprime la formule particulière", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
        vi.mocked(prisma.studentFormula.findUnique).mockResolvedValue({ formula: "(MI + D1) / 2", reason: "x" } as never);
        const res = await put({ ...body, formula: null });
        expect(res.status).toBe(200);
        expect(prisma.studentFormula.deleteMany).toHaveBeenCalledWith({
            where: { classSubjectId: csId, periodId, studentId: FIXTURES.studentA },
        });
    });
});
