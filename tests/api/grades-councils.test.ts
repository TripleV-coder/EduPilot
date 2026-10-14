import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/grades/councils/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Paramètres de l'établissement : valeurs par défaut (pas de table de réglages dans le mock Prisma)
vi.mock("@/lib/schools/school-parameters-store", async () => {
    const { DEFAULT_SCHOOL_PARAMETERS } = await import("@/lib/schools/school-parameters");
    return {
        getSchoolParameters: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        getSchoolParametersForStudent: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        saveSchoolParameters: vi.fn(),
    };
});
vi.mock("@/lib/academic/grading-settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/academic/grading-settings")>()),
    getPassingGrade: vi.fn(async () => 10),
    passingGradeForStudent: vi.fn(async () => 10),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    // Calculs adaptés pour un élève : aucun par défaut
    studentFormula: { findMany: vi.fn().mockResolvedValue([]) },
    class: { findUnique: vi.fn() },
    period: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    schoolCalendarEvent: { findFirst: vi.fn() },
    // Aucun réglage enregistré par défaut : seuils par défaut (16 / 14 / 10 / 3).
    configOption: { findFirst: vi.fn().mockResolvedValue(null) },
    classCouncil: { findUnique: vi.fn() },
    grade: { findMany: vi.fn() },
    // Formules choisies par les enseignants (aucune : formule de l'école)
    classSubject: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "6A",
    schoolId: FIXTURES.schoolA,
    classLevel: { id: "l1", name: "Sixième" },
    mainTeacher: { id: "t1", user: { firstName: "Paul", lastName: "Biya" } },
    classSubjects: [
      {
        id: "cs1",
        coefficient: 3,
        subject: { id: "s1", name: "Maths" },
        teacher: { id: "t2", user: { firstName: "Awa", lastName: "Diallo" } },
      },
      {
        id: "cs2",
        coefficient: 2,
        subject: { id: "s2", name: "Français" },
        teacher: null,
      },
    ],
    ...overrides,
  } as never;
}

function makeEnrollment(studentId: string, name: string, grades: unknown[], incidents: unknown[] = []) {
  return {
    id: `enr_${studentId}`,
    student: {
      id: studentId,
      user: { firstName: name.split(" ")[0], lastName: name.split(" ")[1] },
      grades,
      behaviorIncidents: incidents,
    },
  };
}

type Enr = ReturnType<typeof makeEnrollment>;

/**
 * Effectif + notes : la route lit l'effectif (élèves, incidents) et le module
 * de calcul relit les inscriptions et les notes de la période ; les deux
 * lectures sont servies par le même jeu de données.
 */
function wireClass(enrollments: Enr[]) {
  vi.mocked(prisma.enrollment.findMany).mockImplementation((async (args: { select?: unknown }) =>
    args?.select ? enrollments.map((e) => ({ studentId: e.student.id, enrolledAt: null })) : enrollments) as never);
  vi.mocked(prisma.grade.findMany).mockResolvedValue(
    enrollments.flatMap((e) =>
      (e.student.grades as Array<{ id: string; value: number; isAbsent: boolean; isExcused: boolean; evaluation: { periodId: string; maxGrade: number; type: { code: string; name: string }; classSubjectId: string } }>).map((g) => ({
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

describe("GET /api/grades/councils", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("should return 400 when classId or periodId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/grades/councils"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when period not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it("should compute decisions, ranks, metrics and pending decisions", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: "p1",
      name: "Semestre 1",
      sequence: 1,
      academicYearId: "ay1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    } as never);
    wireClass([
      makeEnrollment("stu1", "Awa Diallo", [
        { id: "g1", value: 17, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 2, classSubjectId: "cs1" } },
        { id: "g2", value: 16, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 1, classSubjectId: "cs2" } },
      ]),
      makeEnrollment("stu2", "Jean Mensah", [
        { id: "g3", value: 8, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 2, classSubjectId: "cs1" } },
        { id: "g4", value: 9, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 1, classSubjectId: "cs2" } },
      ]),
      makeEnrollment("stu3", "Koffi Yao", [], [{ id: "inc1", severity: "MAJOR" }, { id: "inc2", severity: "MAJOR" }, { id: "inc3", severity: "MAJOR" }]),
    ]);
    vi.mocked(prisma.schoolCalendarEvent.findFirst).mockResolvedValue({
      id: "ev1",
      name: "Conseil de classe",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-01"),
      description: "Réunion",
    } as never);

    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.class.name).toBe("6A");
    expect(body.metrics.bulletinsTotal).toBe(3);
    expect(body.metrics.honors).toBe(1);
    expect(body.metrics.warnings).toBe(2);
    expect(body.participants).toHaveLength(2);

    const awa = body.students.find((s: { name: string }) => s.name === "Awa Diallo");
    expect(awa.generalAverage).toBe(16.6); // (17×3 + 16×2) / 5
    expect(awa.decision).toBe("Tableau d'honneur");
    expect(awa.rank).toBe(1);

    const jean = body.students.find((s: { name: string }) => s.name === "Jean Mensah");
    expect(jean.decision).toBe("Avertissement travail");
    expect(jean.rank).toBe(2);

    const koffi = body.students.find((s: { name: string }) => s.name === "Koffi Yao");
    expect(koffi.decision).toBe("Avertissement conduite");
    expect(koffi.generalAverage).toBeNull();
    expect(koffi.rank).toBeNull();

    expect(body.stats.average).toBe(12.5); // (16,6 + 8,4) / 2
    expect(body.pendingDecisions.length).toBeGreaterThan(0);
    expect(body.nextCouncilEvent.name).toBe("Conseil de classe");
  });

  it("should mark rows as 'À saisir' when no grades exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: "p1",
      name: "Semestre 1",
      sequence: 1,
      academicYearId: "ay1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    } as never);
    wireClass([makeEnrollment("stu1", "Awa Diallo", [])]);
    vi.mocked(prisma.schoolCalendarEvent.findFirst).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.students[0].status).toBe("À saisir");
    expect(body.students[0].decision).toBe("Aucune");
    expect(body.metrics.bulletinsReady).toBe(0);
  });

  it("applique les seuils réglés par l'école au lieu des valeurs par défaut", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: "p1", name: "Semestre 1", sequence: 1, academicYearId: "ay1",
      startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30"),
    } as never);
    vi.mocked(prisma.configOption.findFirst).mockResolvedValueOnce({
      metadata: { honorMin: 17, encouragementMin: 14, workWarningBelow: 10, conductIncidents: 3 },
    } as never);
    wireClass([
      makeEnrollment("stu1", "Awa Diallo", [
        { id: "g1", value: 17, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 2, classSubjectId: "cs1" } },
        { id: "g2", value: 16, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", maxGrade: 20, type: { code: "DS", name: "Devoir" }, coefficient: 1, classSubjectId: "cs2" } },
      ]),
    ]);
    vi.mocked(prisma.schoolCalendarEvent.findFirst).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.students.find((s: { name: string }) => s.name === "Awa Diallo").decision).toBe("Encouragements");
  });
});
