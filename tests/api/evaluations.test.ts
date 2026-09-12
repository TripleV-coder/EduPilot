import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeacherProfile } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findFirst: vi.fn() },
    classSubject: { findUnique: vi.fn(), findMany: vi.fn() },
    evaluation: { findMany: vi.fn(), create: vi.fn() },
    period: { findUnique: vi.fn() },
    evaluationType: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/evaluations/route";

const evaluationId = cuid("evaluation1");
const classSubjectId = cuid("classsubj1");
const periodId = cuid("periode1");
const typeId = cuid("type1");
const teacherProfileId = cuid("teacher1");
const teacherUserId = cuid("userteacher");
const evaluationRoute = "http://localhost:3000/api/evaluations";

function evaluationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: evaluationId,
    title: "Devoir surveillé n°1",
    date: new Date(),
    maxGrade: 20,
    coefficient: 1,
    classSubjectId,
    periodId,
    typeId,
    classSubject: {
      id: classSubjectId,
      class: { id: cuid("classe6a"), schoolId: FIXTURES.schoolA },
      subject: { id: cuid("subject1"), name: "Mathématiques" },
    },
    period: { id: periodId, name: "Trimestre 1" },
    type: { id: typeId, name: "Devoir" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/evaluations", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(401);
  });

  it("liste les évaluations d'un SCHOOL_ADMIN filtrées par école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([evaluationFixture()] as never);

    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    const args = vi.mocked(prisma.evaluation.findMany).mock.calls[0][0];
    expect(args.where.classSubject).toEqual({ class: { schoolId: FIXTURES.schoolA } });
  });

  it("filtre par classSubjectId, periodId et classId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([] as never);

    const res = await GET(
      makeRequest(
        `${evaluationRoute}?classSubjectId=${classSubjectId}&periodId=${periodId}&classId=${cuid("classe6b")}`
      )
    );
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.evaluation.findMany).mock.calls[0][0];
    expect(args.where.classSubjectId).toBe(classSubjectId);
    expect(args.where.periodId).toBe(periodId);
    expect(args.where.classSubject.classId).toBe(cuid("classe6b"));
  });

  it("ne renvoie que les évaluations des matières d'un TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.teacherProfile.findFirst).mockResolvedValue({
      id: teacherProfileId,
    } as unknown as TeacherProfile);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
      { id: classSubjectId },
      { id: cuid("classsubj2") },
    ] as never);
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([evaluationFixture()] as never);

    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.evaluation.findMany).mock.calls[0][0];
    expect(args.where.classSubjectId).toEqual({ in: [classSubjectId, cuid("classsubj2")] });
  });

  it("renvoie [] pour un TEACHER sans profil ni matière", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.teacherProfile.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/evaluations", () => {
  const validBody = {
    classSubjectId,
    periodId,
    typeId,
    title: "Devoir surveillé n°2",
    date: "2026-03-10T08:00:00.000Z",
    maxGrade: 20,
    coefficient: 1,
  };

  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la matière n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeDefined();
  });

  it("refuse une matière d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolB },
      teacher: { userId: teacherUserId },
    } as never);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("refuse un TEACHER qui évalue la matière d'un autre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: cuid("autreprof") },
    } as never);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la période n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeDefined();
  });

  it("refuse une période d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: periodId,
      academicYear: { schoolId: FIXTURES.schoolB },
    } as never);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le type d'évaluation n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: periodId,
      academicYear: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
  });

  it("refuse un type d'évaluation d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: periodId,
      academicYear: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue({
      id: typeId,
      schoolId: FIXTURES.schoolB,
    } as never);
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("crée l'évaluation (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: periodId,
      academicYear: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue({
      id: typeId,
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(prisma.evaluation.create).mockResolvedValue(evaluationFixture() as never);

    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(evaluationId);
    const createArgs = vi.mocked(prisma.evaluation.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      classSubjectId,
      periodId,
      typeId,
      title: "Devoir surveillé n°2",
    });
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("convertit une erreur de validation non interceptée en 400 VALIDATION_ERROR (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(
      makeRequest(evaluationRoute, {
        method: "POST",
        body: { classSubjectId: "bad-id", periodId, typeId, date: "pas-une-date" },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: periodId,
      academicYear: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue({
      id: typeId,
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(prisma.evaluation.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(evaluationRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
  });
});