import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeacherProfile } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findFirst: vi.fn() },
    classSubject: { findUnique: vi.fn(), findMany: vi.fn() },
    evaluation: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    period: { findUnique: vi.fn() },
    evaluationType: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
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

// Audit C3 / N9 : les tests GET exigeaient une liste brute, non paginée,
// incluant les notes (tableau JSON), et un TEACHER résolu en deux requêtes.
// Le contrat est désormais { data, pagination } (format unique du projet),
// sans notes individuelles, avec un périmètre par rôle ; le comportement réel
// est prouvé sur vrai PostgreSQL par tests/integration-db/evaluations-list.test.ts.
function findManyArgs() {
  return vi.mocked(prisma.evaluation.findMany).mock.calls[0][0] as unknown as {
    where: { AND: [{ AND: unknown[] }, unknown] };
    select: Record<string, unknown>;
    take: number;
  };
}

describe("GET /api/evaluations", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(401);
  });

  it("renvoie une page { data, pagination } limitée à l'école d'un SCHOOL_ADMIN, sans notes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
      { ...evaluationFixture(), _count: { grades: 3 } },
    ] as never);
    vi.mocked(prisma.evaluation.count).mockResolvedValue(1 as never);

    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].gradeCount).toBe(3);
    expect(body.pagination).toMatchObject({ limit: 20, hasNextPage: false, nextCursor: null, total: 1 });
    const args = findManyArgs();
    expect(args.where.AND[0].AND).toContainEqual({ classSubject: { class: { schoolId: FIXTURES.schoolA } } });
    expect(args.select.grades).toBeUndefined();
    expect(args.take).toBe(21);
  });

  it("filtre par classSubjectId, periodId et classId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.evaluation.count).mockResolvedValue(0 as never);

    const res = await GET(
      makeRequest(
        `${evaluationRoute}?classSubjectId=${classSubjectId}&periodId=${periodId}&classId=${cuid("classe6b")}`
      )
    );
    expect(res.status).toBe(200);
    const filters = findManyArgs().where.AND[0].AND;
    expect(filters).toContainEqual({ classSubjectId });
    expect(filters).toContainEqual({ periodId });
    expect(filters).toContainEqual({ classSubject: { classId: cuid("classe6b") } });
  });

  it("restreint un TEACHER à ses propres matières en une seule requête", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.evaluation.count).mockResolvedValue(0 as never);

    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    expect(findManyArgs().where.AND[0].AND).toContainEqual({ classSubject: { teacher: { userId: teacherUserId } } });
    expect(prisma.teacherProfile.findFirst).not.toHaveBeenCalled();
  });

  it("renvoie une page vide à un PARENT sans enfant lié, sans lire les évaluations (N9)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(evaluationRoute));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], pagination: { limit: 20, nextCursor: null, hasNextPage: false, total: 0 } });
    expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
  });

  it("refuse un curseur invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest(`${evaluationRoute}?cursor=forge`));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CURSOR");
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findMany).mockRejectedValue(new Error("db down"));
    vi.mocked(prisma.evaluation.count).mockResolvedValue(0 as never);
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