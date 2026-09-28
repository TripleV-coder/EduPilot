import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({ assertModelAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => {
    const client = {
        examTemplate: { findUnique: vi.fn(), update: vi.fn() },
        question: { create: vi.fn(), delete: vi.fn() },
        $transaction: vi.fn(),
    };
    client.$transaction.mockImplementation(async (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: typeof client) => unknown)(client) : Promise.all(arg as unknown[]),
    );
    return { default: client };
});

import prisma from "@/lib/prisma";
import { POST as POST_QUESTION } from "@/app/api/exams/[id]/questions/route";
import { DELETE as DELETE_QUESTION } from "@/app/api/exams/[id]/questions/[questionId]/route";
import { PATCH as PATCH_EXAM } from "@/app/api/exams/[id]/route";

const examId = cuid("examen1");
const questionId = cuid("question1");
const authorId = cuid("prof");
const params = { params: Promise.resolve({ id: examId }) };
const url = `http://localhost:3000/api/exams/${examId}/questions`;
const mcq = { type: "MCQ", question: "2 + 2 ?", points: 2, options: ["3", "4"], correctAnswer: "4" };

function exam(overrides: Record<string, unknown> = {}) {
    return {
        isPublished: false,
        createdById: authorId,
        classSubject: { teacher: { userId: authorId } },
        questions: [{ id: questionId, points: 3, order: 1 }],
        _count: { examSessions: 0, questions: 1 },
        ...overrides,
    } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: authorId }));
});

describe("POST /api/exams/[id]/questions", () => {
    it("ajoute la question à la suite et recalcule le barème", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam());
        vi.mocked(prisma.question.create).mockResolvedValue({ id: cuid("q2") } as never);

        const res = await POST_QUESTION(makeRequest(url, { method: "POST", body: mcq }), params);
        expect(res.status).toBe(201);
        expect(vi.mocked(prisma.question.create).mock.calls[0][0].data).toMatchObject({ examTemplateId: examId, order: 2, correctAnswer: "4" });
        expect(vi.mocked(prisma.examTemplate.update).mock.calls[0][0].data).toEqual({ totalPoints: 5, passingScore: 3 });
    });

    it("refuse un autre enseignant", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autre") }));
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam());
        const res = await POST_QUESTION(makeRequest(url, { method: "POST", body: mcq }), params);
        expect(res.status).toBe(403);
        expect(prisma.question.create).not.toHaveBeenCalled();
    });

    it("refuse toute modification une fois des copies rendues", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam({ _count: { examSessions: 2 } }));
        const res = await POST_QUESTION(makeRequest(url, { method: "POST", body: mcq }), params);
        expect(res.status).toBe(409);
    });

    it("refuse une question invalide en 400 avec le motif", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam());
        const res = await POST_QUESTION(makeRequest(url, { method: "POST", body: { ...mcq, correctAnswer: "5" } }), params);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/bonne réponse/i);
    });

    it("interdit l'ajout de questions à un élève", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
        const res = await POST_QUESTION(makeRequest(url, { method: "POST", body: mcq }), params);
        expect(res.status).toBe(403);
    });
});

describe("DELETE /api/exams/[id]/questions/[questionId]", () => {
    const delParams = { params: Promise.resolve({ id: examId, questionId }) };

    it("un examen publié ne perd pas sa dernière question", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam({ isPublished: true }));
        const res = await DELETE_QUESTION(makeRequest(`${url}/${questionId}`, { method: "DELETE" }), delParams);
        expect(res.status).toBe(409);
        expect(prisma.question.delete).not.toHaveBeenCalled();
    });

    it("retire la question d'un brouillon et remet le barème à zéro", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam());
        const res = await DELETE_QUESTION(makeRequest(`${url}/${questionId}`, { method: "DELETE" }), delParams);
        expect(res.status).toBe(200);
        expect(vi.mocked(prisma.examTemplate.update).mock.calls[0][0].data).toEqual({ totalPoints: 0, passingScore: 0 });
    });
});

describe("PATCH /api/exams/[id] (publication)", () => {
    const patchUrl = `http://localhost:3000/api/exams/${examId}`;

    it("refuse de publier un examen sans question (recette : écran planté chez l'élève)", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam({ _count: { questions: 0 } }));
        const res = await PATCH_EXAM(makeRequest(patchUrl, { method: "PATCH", body: { isPublished: true } }), params);
        expect(res.status).toBe(409);
        expect(prisma.examTemplate.update).not.toHaveBeenCalled();
    });

    it("publie un examen garni", async () => {
        vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam());
        vi.mocked(prisma.examTemplate.update).mockResolvedValue({ id: examId, isPublished: true } as never);
        const res = await PATCH_EXAM(makeRequest(patchUrl, { method: "PATCH", body: { isPublished: true } }), params);
        expect(res.status).toBe(200);
        expect(vi.mocked(prisma.examTemplate.update).mock.calls[0][0].data).toEqual({ isPublished: true });
    });
});
