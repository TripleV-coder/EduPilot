/**
 * Réponses de l'assistant : chaque lecture reste dans l'école et le périmètre
 * de la personne, les calculs officiels sont réutilisés, et une absence de
 * données est dite comme telle (jamais de chiffre inventé).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantScope } from "@/lib/ai/assistant/scope";

vi.mock("@/lib/prisma", () => ({
    default: {
        attendance: { findMany: vi.fn() },
        grade: { findMany: vi.fn() },
        schedule: { findMany: vi.fn() },
        homework: { findMany: vi.fn() },
        homeworkSubmission: { findMany: vi.fn() },
        enrollment: { findFirst: vi.fn() },
        academicYear: { findFirst: vi.fn() },
    },
}));
vi.mock("@/lib/academic/grading-settings", () => ({ getPassingGrade: vi.fn(async () => 10) }));
vi.mock("@/lib/ai/governance-service", () => ({ governanceService: { execute: vi.fn() } }));
vi.mock("@/lib/finance/expected-fees", () => ({ computeYearFeeRecovery: vi.fn() }));
vi.mock("@/lib/finance/family-finance", () => ({ getChildFinance: vi.fn() }));

import prisma from "@/lib/prisma";
import { governanceService } from "@/lib/ai/governance-service";
import { AIServiceError } from "@/lib/ai/ai-service";
import { computeYearFeeRecovery } from "@/lib/finance/expected-fees";
import { getChildFinance } from "@/lib/finance/family-finance";
import * as skills from "@/lib/ai/assistant/skills";
import type { Entities } from "@/lib/ai/assistant/types";

const NOW = new Date("2026-11-04T09:00:00Z");
const m = <T>(fn: T) => vi.mocked(fn as unknown as (...args: unknown[]) => unknown);
const none: Entities = { anaphora: false };

function scope(kind: AssistantScope["kind"], role: string): AssistantScope {
    return {
        user: { id: `u-${role}`, role, schoolId: "school-a" },
        schoolId: "school-a",
        kind,
        classes: [
            { id: "c-3b", name: "3e B" },
            { id: "c-4a", name: "4e A" },
        ],
        students: [
            { id: "s-koffi", name: "Koffi Adjovi", className: "3e B" },
            { id: "s-awa", name: "Awa Dossou", className: "4e A" },
        ],
        subjects: [],
    };
}

const absence = (studentId: string, status: string, name: string) => ({
    status,
    date: new Date("2026-11-03T00:00:00Z"),
    reason: null,
    studentId,
    class: { name: "3e B" },
    student: { user: { firstName: name, lastName: "X" } },
});

beforeEach(() => {
    vi.clearAllMocks();
    m(prisma.attendance.findMany).mockResolvedValue([]);
    m(prisma.homeworkSubmission.findMany).mockResolvedValue([]);
});

describe("appel", () => {
    it("direction : toute l'école, jamais au-delà", async () => {
        m(prisma.attendance.findMany).mockResolvedValueOnce([absence("s-1", "ABSENT", "Ali"), absence("s-1", "LATE", "Ali"), absence("s-2", "EXCUSED", "Béa")]);
        const out = await skills.attendanceSummary({ scope: scope("direction", "DIRECTOR"), entities: none, message: "", now: NOW });
        const where = m(prisma.attendance.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
        expect(where.where.class).toEqual({ schoolId: "school-a" });
        expect(where.where.classId).toBeUndefined();
        expect(out.text).toContain("1 absence non justifiée");
        expect(out.text).toContain("1 absence justifiée et 1 retard");
        expect(out.blocks?.[0]).toMatchObject({ type: "table", rows: [expect.objectContaining({ cells: ["Ali X", "3e B", "1", "1"] }), expect.anything()] });
    });

    it("enseignant : seulement ses classes", async () => {
        await skills.attendanceSummary({ scope: scope("teacher", "TEACHER"), entities: none, message: "", now: NOW });
        const where = m(prisma.attendance.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
        expect(where.where.classId).toEqual({ in: ["c-3b", "c-4a"] });
    });

    it("famille : seulement ses enfants, et le dit quand il n'y a rien", async () => {
        const out = await skills.attendanceSummary({ scope: scope("family", "PARENT"), entities: none, message: "", now: NOW });
        const where = m(prisma.attendance.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
        expect(where.where.studentId).toEqual({ in: ["s-koffi", "s-awa"] });
        expect(out.text).toMatch(/Aucune absence ni aucun retard/);
        expect(out.text).toContain("vos enfants");
        expect(out.text).toContain("cette semaine");
    });
});

describe("élèves à risque", () => {
    it("enseignant : une détection par classe, résultats fusionnés et triés par priorité", async () => {
        m(governanceService.execute)
            .mockResolvedValueOnce({ data: { totalStudents: 30, atRiskStudents: [{ id: "s-1", name: "Ali", className: "3e B", riskLevel: "MEDIUM", averageGrade: 9 }] } })
            .mockResolvedValueOnce({ data: { totalStudents: 25, atRiskStudents: [{ id: "s-2", name: "Béa", className: "4e A", riskLevel: "CRITICAL", averageGrade: 6 }] } });
        const out = await skills.riskList({ scope: scope("teacher", "TEACHER"), entities: none, message: "", now: NOW });
        expect(m(governanceService.execute).mock.calls.map((c) => (c[0] as { classId: string }).classId)).toEqual(["c-3b", "c-4a"]);
        expect(m(governanceService.execute).mock.calls[0][0]).toMatchObject({ userId: "u-TEACHER", userRole: "TEACHER", schoolId: "school-a", action: "detect-at-risk" });
        expect(out.text).toMatch(/2(\*\*)? (élèves à suivre|demandent un suivi)/);
        expect(out.text).toContain("55 élèves analysés");
        const table = out.blocks?.[0] as { rows: Array<{ cells: string[]; href?: string }> };
        expect(table.rows[0].cells[0]).toBe("Béa");
        expect(table.rows[0].href).toBe("/dashboard/students/s-2");
    });

    it("sans moyennes calculées : explique quoi faire au lieu d'afficher zéro", async () => {
        m(governanceService.execute).mockResolvedValue({ data: { totalStudents: 0, atRiskStudents: [] } });
        const out = await skills.riskList({ scope: scope("direction", "DIRECTOR"), entities: none, message: "", now: NOW });
        expect(out.text).toContain("Aucune analyse n'est encore disponible");
    });

    it("relaie le refus de la gouvernance (périmètre)", async () => {
        m(governanceService.execute).mockRejectedValue(new AIServiceError("Accès refusé: cette classe n'est pas rattachée à cet enseignant", 403, "FORBIDDEN"));
        const out = await skills.riskList({ scope: scope("teacher", "TEACHER"), entities: none, message: "", now: NOW, klass: { id: "c-x", name: "6e" } });
        expect(out.text).toContain("Accès refusé");
    });
});

describe("notes et finance", () => {
    it("notes : bornées à l'école, absences et barèmes respectés", async () => {
        m(prisma.grade.findMany).mockResolvedValueOnce([
            { value: 8, isAbsent: false, isExcused: false, evaluation: { title: null, date: new Date("2026-10-20"), maxGrade: 10, type: { name: "Interrogation" }, classSubject: { subject: { name: "Maths" } } } },
            { value: null, isAbsent: true, isExcused: false, evaluation: { title: "DS 1", date: new Date("2026-10-10"), maxGrade: 20, type: { name: "Devoir" }, classSubject: { subject: { name: "SVT" } } } },
        ]);
        const student = { id: "s-koffi", name: "Koffi Adjovi", className: "3e B" };
        const out = await skills.studentGrades({ scope: scope("family", "PARENT"), entities: none, message: "", now: NOW, student });
        const where = m(prisma.grade.findMany).mock.calls[0][0] as { where: { evaluation: { classSubject: { class: unknown } } } };
        expect(where.where.evaluation.classSubject.class).toEqual({ schoolId: "school-a" });
        expect(out.text).toContain("moyenne simple de ces notes : **16,00/20**");
        const rows = (out.blocks?.[0] as { rows: Array<{ cells: string[] }> }).rows;
        expect(rows[0].cells[3]).toBe("8,00/10");
        expect(rows[1].cells[3]).toBe("Absent");
    });

    it("famille : reste à payer de chaque enfant, sans cumul avec d'autres familles", async () => {
        m(getChildFinance).mockImplementation(async (_db: unknown, id: unknown) => ({
            child: { firstName: id === "s-koffi" ? "Koffi" : "Awa", lastName: "X" },
            totals: { billed: 100000, settled: id === "s-koffi" ? 40000 : 100000, remaining: id === "s-koffi" ? 60000 : 0, reserved: 0, available: 0 },
            fees: [],
            payments: [],
        }));
        const out = await skills.financeBalance({ scope: scope("family", "PARENT"), entities: none, message: "", now: NOW });
        expect(m(getChildFinance).mock.calls.map((c) => c[1])).toEqual(["s-koffi", "s-awa"]);
        expect(out.text).toMatch(/\*\*60\s000 FCFA\*\*/);
        expect(out.text).toMatch(/2 enfants/);
    });

    it("direction : recouvrement de l'année en cours, ou rien d'inventé sans frais attendus", async () => {
        m(prisma.academicYear.findFirst).mockResolvedValue({ id: "y-1", name: "2026-2027" });
        m(computeYearFeeRecovery).mockResolvedValueOnce({ expected: 1000000, collected: 650000, rate: 65 }).mockResolvedValueOnce(null);
        const out = await skills.financeBalance({ scope: scope("direction", "DIRECTOR"), entities: none, message: "", now: NOW });
        expect(computeYearFeeRecovery).toHaveBeenCalledWith("school-a", "y-1");
        expect(out.text).toMatch(/65 %/);
        expect(out.text).toMatch(/Reste à encaisser : \*\*350\s000 FCFA\*\*/);
        const empty = await skills.financeBalance({ scope: scope("direction", "DIRECTOR"), entities: none, message: "", now: NOW });
        expect(empty.text).toContain("impossible de calculer un recouvrement");
    });

    it("enseignant : pas de finance", async () => {
        const out = await skills.financeBalance({ scope: scope("teacher", "TEACHER"), entities: none, message: "", now: NOW });
        expect(out.text).toContain("réservée à la direction et aux familles");
    });
});

describe("emploi du temps et devoirs", () => {
    it("enseignant : seulement SES cours du jour demandé", async () => {
        m(prisma.schedule.findMany).mockResolvedValueOnce([
            { startTime: "08:00", endTime: "10:00", room: "B2", class: { name: "3e B" }, classSubject: { subject: { name: "Maths" } } },
        ]);
        const out = await skills.scheduleDay({ scope: scope("teacher", "TEACHER"), entities: { anaphora: false, day: { dayOfWeek: 4, label: "demain" } }, message: "", now: NOW });
        const where = m(prisma.schedule.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
        expect(where.where).toMatchObject({ dayOfWeek: 4, class: { schoolId: "school-a" }, classSubject: { teacher: { userId: "u-TEACHER" } } });
        expect(out.text).toContain("demain (jeudi)");
        expect((out.blocks?.[0] as { rows: Array<{ cells: string[] }> }).rows[0].cells).toEqual(["08:00 – 10:00", "Maths", "3e B", "B2"]);
    });

    it("élève : devoirs des 14 prochains jours avec leur état de remise", async () => {
        const one = { ...scope("family", "STUDENT"), students: [{ id: "s-koffi", name: "Koffi Adjovi", className: "3e B" }], classes: [{ id: "c-3b", name: "3e B" }] };
        m(prisma.homework.findMany).mockResolvedValueOnce([
            { id: "h1", title: "Exercices 1 à 5", dueDate: new Date("2026-11-06"), classSubject: { class: { name: "3e B" }, subject: { name: "Maths" } } },
            { id: "h2", title: "Exposé", dueDate: new Date("2026-11-10"), classSubject: { class: { name: "3e B" }, subject: { name: "SVT" } } },
        ]);
        m(prisma.homeworkSubmission.findMany).mockResolvedValueOnce([{ homeworkId: "h1" }]);
        const out = await skills.homeworkUpcoming({ scope: one, entities: none, message: "", now: NOW });
        const where = m(prisma.homework.findMany).mock.calls[0][0] as { where: { classSubject: Record<string, unknown> } };
        expect(where.where.classSubject).toMatchObject({ classId: { in: ["c-3b"] }, class: { schoolId: "school-a" } });
        expect(m(prisma.homeworkSubmission.findMany).mock.calls[0][0]).toMatchObject({ where: { studentId: "s-koffi" } });
        expect(out.text).toContain("dont **1** pas encore rendu");
    });
});

describe("navigation", () => {
    it("ne montre que les pages ouvertes au rôle", () => {
        const parent = skills.navigate({ scope: scope("family", "PARENT"), entities: none, message: "où trouver les exports comptables ?", now: NOW });
        expect(JSON.stringify(parent)).not.toContain("/dashboard/finance/export");
        const director = skills.navigate({ scope: scope("direction", "DIRECTOR"), entities: none, message: "où trouver les exports comptables ?", now: NOW });
        expect(JSON.stringify(director)).toContain("/dashboard/finance/export");
    });
});
