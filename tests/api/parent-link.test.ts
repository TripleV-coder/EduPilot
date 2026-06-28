import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";
import { hashLinkCode } from "@/lib/parents/link-code";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    default: {
        parentProfile: { findUnique: vi.fn() },
        studentProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
        parentStudent: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
        studentLinkCode: {
            findFirst: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
            create: vi.fn(),
        },
        auditLog: { create: vi.fn() },
        systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
        $transaction: vi.fn((ops: unknown) =>
            Array.isArray(ops) ? Promise.all(ops) : Promise.resolve()
        ),
    },
}));

import prisma from "@/lib/prisma";
import { POST as linkChild } from "@/app/api/parents/link-child/route";

const SCHOOL = FIXTURES.schoolA;
const STUDENT = FIXTURES.studentA;
const MATRICULE = "BJ-2026-A0142";
const CODE = "K7M2QPRX";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
});

function linkReq(body: Record<string, unknown>) {
    return linkChild(
        makeRequest("http://localhost:3000/api/parents/link-child", { method: "POST", body })
    );
}

function mockParentAndStudent() {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: cuid("parenta") } as never);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
        id: STUDENT,
        schoolId: SCHOOL,
        user: { firstName: "Awa", lastName: "Koné" },
        enrollments: [{ class: { name: "6e A" } }],
    } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.parentStudent.count).mockResolvedValue(0 as never);
}

describe("POST /api/parents/link-child — vérification du code", () => {
    it("refuse sans code de liaison (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: SCHOOL }) as never);
        const res = await linkReq({ matricule: MATRICULE });
        expect(res.status).toBe(400);
    });

    it("refuse si aucun code actif (403)", async () => {
        mockParentAndStudent();
        vi.mocked(prisma.studentLinkCode.findFirst).mockResolvedValue(null as never);
        const res = await linkReq({ matricule: MATRICULE, verificationCode: CODE });
        expect(res.status).toBe(403);
        expect(prisma.parentStudent.create).not.toHaveBeenCalled();
    });

    it("refuse un code erroné (403)", async () => {
        mockParentAndStudent();
        const codeHash = await hashLinkCode(CODE);
        vi.mocked(prisma.studentLinkCode.findFirst).mockResolvedValue({
            id: cuid("code1"), codeHash,
        } as never);
        const res = await linkReq({ matricule: MATRICULE, verificationCode: "WRONGGGG" });
        expect(res.status).toBe(403);
        expect(prisma.parentStudent.create).not.toHaveBeenCalled();
    });

    it("lie l'enfant et consomme le code avec un code valide (201)", async () => {
        mockParentAndStudent();
        const codeHash = await hashLinkCode(CODE);
        vi.mocked(prisma.studentLinkCode.findFirst).mockResolvedValue({
            id: cuid("code1"), codeHash,
        } as never);
        vi.mocked(prisma.parentStudent.create).mockResolvedValue({ id: cuid("link1") } as never);

        const res = await linkReq({ matricule: MATRICULE, verificationCode: `  ${CODE.toLowerCase()}  ` });
        expect(res.status).toBe(201);
        expect(prisma.parentStudent.create).toHaveBeenCalledOnce();
        expect(prisma.studentLinkCode.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ usedByUserId: expect.any(String) }) })
        );
    });

    it("idempotent : déjà lié, ne consomme pas de code (200)", async () => {
        mockParentAndStudent();
        vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue({ id: cuid("link0") } as never);
        const res = await linkReq({ matricule: MATRICULE, verificationCode: CODE });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.alreadyLinked).toBe(true);
        expect(prisma.studentLinkCode.update).not.toHaveBeenCalled();
    });
});

describe("POST /api/students/[id]/link-code — émission", () => {
    it("émet un code et invalide les précédents", async () => {
        const { POST: genCode } = await import("@/app/api/students/[id]/link-code/route");
        vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
        vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
            id: STUDENT, schoolId: SCHOOL, matricule: MATRICULE,
            user: { firstName: "Awa", lastName: "Koné" },
        } as never);
        vi.mocked(prisma.studentLinkCode.deleteMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.studentLinkCode.create).mockResolvedValue({ id: cuid("code2") } as never);

        const res = await genCode(
            makeRequest(`http://localhost:3000/api/students/${STUDENT}/link-code`, { method: "POST" }),
            { params: Promise.resolve({ id: STUDENT }) }
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.code).toMatch(/^[A-Z0-9]{8}$/);
        expect(body.matricule).toBe(MATRICULE);
        expect(prisma.studentLinkCode.deleteMany).toHaveBeenCalled();
    });

    it("refuse un rôle parent (403)", async () => {
        const { POST: genCode } = await import("@/app/api/students/[id]/link-code/route");
        vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: SCHOOL }) as never);
        const res = await genCode(
            makeRequest(`http://localhost:3000/api/students/${STUDENT}/link-code`, { method: "POST" }),
            { params: Promise.resolve({ id: STUDENT }) }
        );
        expect(res.status).toBe(403);
    });
});
