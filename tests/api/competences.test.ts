import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/competences/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
    evaluation: { findMany: vi.fn() },
  },
}));

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "CM2",
    schoolId: FIXTURES.schoolA,
    classLevel: { name: "Cours moyen 2" },
    classSubjects: [
      { id: "cs1", subject: { id: "s1", name: "Mathématiques" } },
      { id: "cs2", subject: { id: "s2", name: "Français" } },
    ],
    enrollments: [
      { studentId: "stu1" },
      { studentId: "stu2" },
      { studentId: "stu3" },
    ],
    ...overrides,
  } as never;
}

function makeEvaluation(id: string, title: string, grades: unknown[]) {
  return {
    id,
    title,
    maxGrade: 20,
    grades,
  };
}

function makeGrade(studentId: string, value: number, isAbsent = false) {
  return { value, studentId, isAbsent };
}

describe("GET /api/competences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/competences"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/competences"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when classId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/competences"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("classId est requis");
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/competences?classId=cl1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/competences?classId=cl1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should compute the competence matrix and insights", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
      makeEvaluation("ev1", "Résolution de problème", [
        makeGrade("stu1", 16),
        makeGrade("stu2", 8),
        makeGrade("stu3", 18),
      ]),
      makeEvaluation("ev2", "Opérations", [
        makeGrade("stu1", 9),
        makeGrade("stu2", 12),
        makeGrade("stu3", 15, true),
      ]),
      makeEvaluation("ev3", "Dictée", [
        makeGrade("stu1", 11),
        makeGrade("stu2", 13),
        makeGrade("stu3", 14),
      ]),
      makeEvaluation("ev4", "Évaluation orale", [
        makeGrade("stu1", 17),
        makeGrade("stu2", 17),
        makeGrade("stu3", 17),
      ]),
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/competences?classId=cl1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.class).toEqual({ id: "cl1", name: "CM2", level: "Cours moyen 2", size: 3 });
    expect(body.subject).toBeNull();
    expect(body.competences).toHaveLength(6);
    expect(body.matrix.C1).toEqual({ A: 2, EC: 0, NA: 1, NE: 0 });
    expect(body.matrix.C3).toEqual({ A: 1, EC: 2, NA: 0, NE: 0 });
    expect(body.matrix.C5).toEqual({ A: 0, EC: 1, NA: 1, NE: 1 });
    expect(body.matrix.C6).toEqual({ A: 3, EC: 0, NA: 0, NE: 0 });
    expect(body.matrix.C2).toEqual({ A: 0, EC: 0, NA: 0, NE: 3 });
    expect(body.matrix.C4).toEqual({ A: 0, EC: 0, NA: 0, NE: 3 });
    expect(body.insights.strong).toEqual(["C6"]);
    expect(body.insights.toReinforce).toEqual(["C1"]);
    expect(body.insights.critical).toEqual(["C2", "C3", "C4", "C5"]);
    expect(prisma.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classSubjectId: { in: ["cs1", "cs2"] } } })
    );
  });

  it("should filter by subject and expose the subject metadata", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/competences?classId=cl1&subjectId=s1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toEqual({ id: "s1", name: "Mathématiques" });
    expect(prisma.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classSubjectId: { in: ["cs1"] } } })
    );
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/competences?classId=cl1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du calcul des compétences");
  });
});