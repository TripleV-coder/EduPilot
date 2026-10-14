import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/orientation/council/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    // Calculs adaptés pour un élève : aucun par défaut
    studentFormula: { findMany: vi.fn().mockResolvedValue([]) },
    // Une seule période dans les jeux de test (semestre p1)
    period: { findMany: vi.fn().mockResolvedValue([{ id: "p1" }]) },
    class: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    classCouncil: { findMany: vi.fn().mockResolvedValue([]) },
    externalPeriodAverage: { findMany: vi.fn().mockResolvedValue([]) },
    configOption: { findFirst: vi.fn().mockResolvedValue(null) },
    grade: { findMany: vi.fn() },
    // Formules choisies par les enseignants (aucune : formule de l'école)
    classSubject: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "3ème A",
    schoolId: FIXTURES.schoolA,
    classLevel: { name: "Troisième" },
    classSubjects: [
      { id: "cs1", coefficient: 3, subject: { id: "s1", name: "Maths" } },
      { id: "cs2", coefficient: 2, subject: { id: "s2", name: "Français" } },
    ],
    ...overrides,
  } as never;
}

function makeEnrollment(
  studentId: string,
  name: string,
  grades: unknown[],
  orientations: unknown[] = []
) {
  return {
    id: `enr_${studentId}`,
    student: {
      id: studentId,
      user: { firstName: name.split(" ")[0], lastName: name.split(" ")[1] },
      grades,
      studentOrientations: orientations,
    },
  };
}

type Enr = ReturnType<typeof makeEnrollment>;

/** Même jeu de données pour l'effectif de la route et le calcul annuel de la classe. */
function wireClass(enrollments: Enr[]) {
  vi.mocked(prisma.enrollment.findMany).mockImplementation((async (args: { select?: unknown }) =>
    args?.select ? enrollments.map((e) => ({ studentId: e.student.id, enrolledAt: null })) : enrollments) as never);
  vi.mocked(prisma.grade.findMany).mockResolvedValue(
    enrollments.flatMap((e) =>
      (e.student.grades as Array<{ id: string; value: number; isAbsent: boolean; isExcused: boolean; evaluation: Record<string, unknown> }>).map((g) => ({
        studentId: e.student.id,
        evaluationId: g.id,
        value: g.value,
        isAbsent: g.isAbsent,
        isExcused: g.isExcused,
        evaluation: { ...g.evaluation, date: new Date("2026-02-01"), classSubject: { subjectId: null } },
      }))
    ) as never
  );
}

describe("GET /api/orientation/council", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/council"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/orientation/council?classId=cl1&academicYearId=ay1"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when params missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/orientation/council"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/council?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/orientation/council?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should compute council rows, metrics and distribution", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    wireClass([
      makeEnrollment("stu1", "Awa Diallo", [
        { id: "g1", value: 17, isAbsent: false, isExcused: false, evaluation: { maxGrade: 20, periodId: "p1", type: { code: "IE", name: "Interrogation écrite" }, classSubjectId: "cs1", coefficient: 1 } },
        { id: "g2", value: 16, isAbsent: false, isExcused: false, evaluation: { maxGrade: 20, periodId: "p1", type: { code: "DS", name: "Devoir surveillé" }, classSubjectId: "cs1", coefficient: 1 } },
        { id: "g3", value: 15, isAbsent: false, isExcused: false, evaluation: { maxGrade: 20, periodId: "p1", type: { code: "DS", name: "Devoir surveillé" }, classSubjectId: "cs2", coefficient: 1 } },
      ], [
        {
          id: "o1",
          recommendations: [
            { id: "r1", rank: 1, recommendedSeries: "SERIE_A1", isValidated: false },
            { id: "r2", rank: 2, recommendedSeries: "SERIE_A2", isValidated: false },
          ],
        },
      ]),
      makeEnrollment("stu2", "Jean Mensah", [
        { id: "g4", value: 8, isAbsent: false, isExcused: false, evaluation: { maxGrade: 20, periodId: "p1", type: { code: "DS", name: "Devoir surveillé" }, classSubjectId: "cs1", coefficient: 1 } },
        { id: "g5", value: 10, isAbsent: false, isExcused: false, evaluation: { maxGrade: 20, periodId: "p1", classSubjectId: "cs1", coefficient: 1, type: { code: "BEPC", name: "BEPC blanc" } } },
      ]),
      makeEnrollment("stu3", "Koffi Yao", [], [
        {
          id: "o3",
          recommendations: [
            { id: "r6", rank: 1, recommendedSeries: "SERIE_C", isValidated: true },
            { id: "r7", rank: 2, recommendedSeries: "SERIE_D", isValidated: false },
          ],
        },
      ]),
    ]);

    const res = await GET(makeRequest("http://localhost/api/orientation/council?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.class.name).toBe("3ème A");
    expect(body.class.level).toBe("Troisième");
    expect(body.class.size).toBe(3);
    expect(body.metrics).toEqual({ totalToOrient: 3, decisionsSaved: 1, inArbitration: 1, conflicts: 1, aiReady: 2 });

    const awa = body.students[0];
    expect(awa.name).toBe("Awa Diallo");
    // Maths : (MI 17 + D 16) / 2 = 16,5 ; Français : 15 → (16,5×3 + 15×2) / 5 = 15,9
    expect(awa.generalAverage).toBe(15.9);
    expect(awa.bepcAverage).toBeNull();
    expect(awa.aiSeries).toBe("A1");
    expect(awa.familyWish).toBe("A2");
    expect(awa.councilDecision).toBeNull();
    expect(awa.state).toBe("conflict");
    expect(awa.orientationId).toBe("o1");
    expect(awa.hasAi).toBe(true);

    const jean = body.students[1];
    // Maths : (MI 10 [BEPC blanc] + D 8) / 2 = 9
    expect(jean.generalAverage).toBe(9);
    expect(jean.bepcAverage).toBe(10);
    expect(jean.state).toBe("arbitrage");
    expect(jean.hasAi).toBe(false);

    const koffi = body.students[2];
    expect(koffi.generalAverage).toBeNull();
    expect(koffi.aiSeries).toBe("C");
    expect(koffi.familyWish).toBe("D");
    expect(koffi.councilDecision).toBe("C");
    expect(koffi.state).toBe("ok");

    const familyA = body.distribution.find((d: { family: string }) => d.family === "A");
    expect(familyA.count).toBe(1);
    expect(familyA.pct).toBe(33);
    const familyC = body.distribution.find((d: { family: string }) => d.family === "C");
    expect(familyC.count).toBe(1);
    expect(familyC.pct).toBe(33);

    expect(body.topConflict.studentId).toBe("stu1");
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/orientation/council?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du calcul du conseil d'orientation");
  });
});