import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/bulletins/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";
import { computeClassAnnual, computeClassPeriod } from "@/lib/academic/class-averages";
import { OFFICIAL_RULES, Rational, type CalculationOptions } from "@/lib/academic/average-engine";

/** Résultat de classe pour une période : élève A (Maths) et un camarade (10). */
function classPeriodResult(rules: CalculationOptions = OFFICIAL_RULES, mathsA = "15") {
  const student = (id: string, maths: string, general: number, rank: number) => ({
    studentId: id,
    enrolledAt: null,
    averages: {
      subjects: new Map([["cs1", Rational.from(maths)], ["cs2", null]]),
      interrogations: new Map([["cs1", null], ["cs2", null]]),
      general: Rational.from(maths),
      missing: [],
      complete: true,
    },
    general,
    rank,
  });
  return {
    students: new Map([
      [FIXTURES.studentA, student(FIXTURES.studentA, mathsA, 15, 1)],
      ["other", student("other", "10", 10, 2)],
    ]),
    classSize: 2,
    rankedCount: 2,
    classGeneralAverage: 12.5,
    subjectStats: new Map([["cs1", { average: 12.5, min: 10, max: 15 }]]),
    coefficients: new Map([["cs1", 3], ["cs2", 2]]),
    rules,
    councilValidated: false,
  };
}

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Calcul de la classe : prouvé contre l'oracle exact (tests/precision) ;
// ici, la route seule (mise en forme, droits, NC, arrondi de l'école)
vi.mock("@/lib/academic/class-averages", () => ({
  computeClassPeriod: vi.fn(),
  computeClassAnnual: vi.fn(),
  computePromotionRanks: vi.fn(),
}));
vi.mock("@/lib/academic/grading-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/academic/grading-settings")>();
  return { ...actual, getGradingSettings: vi.fn().mockResolvedValue(actual.DEFAULT_GRADING_SETTINGS) };
});
vi.mock("@/lib/prisma", () => ({
  default: {
    // Calculs adaptés pour un élève : aucun par défaut
    studentFormula: { findMany: vi.fn().mockResolvedValue([]) },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findUnique: vi.fn() },
    period: { findUnique: vi.fn(), findFirst: vi.fn() },
    school: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { count: vi.fn() },
    behaviorIncident: { count: vi.fn() },
  },
}));

const PERIOD = {
  id: cuid("p1"),
  name: "Semestre 1",
  sequence: 1,
  academicYearId: cuid("ay1"),
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-06-30"),
};

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.studentA,
    userId: "u_stu",
    schoolId: FIXTURES.schoolA,
    matricule: "202500123",
    dateOfBirth: new Date("2012-05-01"),
    user: { firstName: "Awa", lastName: "Diallo" },
    enrollments: [
      {
        classId: "cl1",
        academicYearId: cuid("ay1"),
        status: "ACTIVE",
        class: {
          id: "cl1",
          name: "6A",
          classLevel: { name: "Sixième" },
          classSubjects: [
            {
              id: "cs1",
              coefficient: 3,
              subject: { id: "s1", name: "Maths" },
              evaluations: [
                {
                  id: cuid("e1"),
                  title: "Contrôle 1",
                  date: new Date("2026-02-10"),
                  maxGrade: 20,
                  coefficient: 2,
                  type: { name: "Devoir" },
                  grades: [{ value: 15, isAbsent: false, isExcused: false, comment: "Très bon travail, rigoureux" }],
                },
              ],
            },
            {
              id: "cs2",
              coefficient: 2,
              subject: { id: "s2", name: "Français" },
              evaluations: [],
            },
          ],
        },
        academicYear: { name: "2025-2026" },
      },
    ],
    ...overrides,
  } as never;
}

describe("GET /api/bulletins", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/bulletins"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when params missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/bulletins"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should forbid a student viewing another's bulletin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_other" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("STUDENT", { id: "u_other" }) });
    expect(res.status).toBe(403);
  });

  it("should forbid a parent not linked to the student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: cuid("pp1") } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("PARENT", { id: "u_parent" }) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when student has no active enrollment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ enrollments: [] }));
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should generate the full bulletin for a linked parent", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: cuid("pp1") } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue({ id: cuid("ps1") } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue(PERIOD as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({
      id: cuid("p0"),
      name: "Trimestre 2",
      sequence: 0,
    } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({
      name: "École A",
      address: "Cotonou",
      city: "Cotonou",
      phone: "0102030405",
      email: "contact@a.bj",
      logo: "logo.png",
      motto: "Savoir",
      mempCode: "MEMP-1",
      code: "A-01",
    } as never);
    // Période en cours, puis période précédente (aucune note : pas de moyenne)
    vi.mocked(computeClassPeriod)
      .mockResolvedValueOnce(classPeriodResult() as never)
      .mockResolvedValueOnce({ ...classPeriodResult(), students: new Map() } as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendance.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(1);

    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=${PERIOD.id}`), { session: makeSession("PARENT", { id: "u_parent" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student.matricule).toBe("202500123");
    expect(body.class.name).toBe("6A");
    expect(body.academicYear).toBe("2025-2026");
    expect(body.periodSequence).toBe(1);
    expect(body.previousPeriod.name).toBe("Trimestre 2");

    const maths = body.subjects.find((s: { subjectName: string }) => s.subjectName === "Maths");
    expect(maths.average).toBe(15);
    expect(maths.evaluationsCount).toBe(1);
    expect(maths.grades[0].value).toBe(15);
    expect(maths.appreciation).toContain("rigoureux");

    expect(body.generalAverage).toBe(15);
    expect(body.previousGeneralAverage).toBeNull();
    expect(body.classGeneralAverage).toBeCloseTo(12.5, 1);
    expect(body.rank).toBe(1);
    expect(body.classSize).toBe(2);
    expect(body.appreciation).toBeDefined();

    expect(body.vieScolaire.absences).toBe(2);
    expect(body.vieScolaire.lates).toBe(1);
    expect(body.vieScolaire.excused).toBe(3);
    expect(body.vieScolaire.incidents).toBe(1);

    expect(body.referenceNumber).toContain("BJ-2025-T1-00123");
    expect(body.generatedAt).toBeDefined();
  });

  it("should allow a teacher and handle period without sequence", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({
      enrollments: [{
        classId: "cl1",
        academicYearId: cuid("ay1"),
        status: "ACTIVE",
        class: {
          id: "cl1",
          name: "6A",
          classLevel: { name: "Sixième" },
          classSubjects: [
            {
              id: "cs1",
              coefficient: 3,
              subject: { id: "s1", name: "Maths" },
              evaluations: [],
            },
          ],
        },
        academicYear: { name: "2025-2026" },
      }],
    }));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    vi.mocked(computeClassPeriod).mockResolvedValue({
      ...classPeriodResult(),
      students: new Map(),
      classSize: 0,
      classGeneralAverage: null,
    } as never);
    vi.mocked(computeClassAnnual).mockResolvedValue({ students: new Map(), classSize: 0, periods: [] } as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendance.count).mockResolvedValue(0);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);

    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("TEACHER") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe("Période");
    expect(body.periodSequence).toBeNull();
    expect(body.previousPeriod).toBeNull();
    expect(body.generalAverage).toBeNull();
    expect(body.school).toBeNull();
    expect(body.referenceNumber).toContain("BJ-2025-00123");
    expect(body.vieScolaire.absences).toBe(0);
  });

  it("arrondit les moyennes de matière selon la règle de l'école (troncature)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.period.findUnique).mockResolvedValue(PERIOD as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    vi.mocked(computeClassPeriod).mockResolvedValue(
      classPeriodResult({ ...OFFICIAL_RULES, rounding: "TRUNCATE" }, "12.349") as never
    );
    vi.mocked(computeClassAnnual).mockResolvedValue({ students: new Map(), classSize: 2, periods: [] } as never);
    vi.mocked(prisma.attendance.count).mockResolvedValue(0);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);

    const res = await GET(
      makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=${PERIOD.id}`),
      { session: makeSession("DIRECTOR") }
    );
    const body = await res.json();
    const maths = body.subjects.find((x: { subjectName: string }) => x.subjectName === "Maths");
    expect(maths.average).toBe(12.34);
  });
});
