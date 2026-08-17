import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_CLASS } from "@/app/api/analytics/class/[classId]/route";
import { GET as GET_SUBJECT } from "@/app/api/analytics/class/[classId]/subject/[subjectId]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn(), findMany: vi.fn() },
    classSubject: { findUnique: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn(), count: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    subjectPerformance: { findMany: vi.fn() },
    evaluation: { findMany: vi.fn() },
    period: { findMany: vi.fn() },
  },
}));

const CLASS_ID = cuid("class1");
const SUBJECT_ID = cuid("subj1");
const AY = cuid("ay1");
const S1 = cuid("p1");
const S2 = cuid("p2");

function makeAnalytics(overrides: Record<string, unknown>) {
  return {
    id: cuid("an1"),
    studentId: FIXTURES.studentA,
    academicYearId: AY,
    periodId: S2,
    generalAverage: 15,
    performanceLevel: "GOOD",
    riskLevel: "LOW",
    student: { user: { firstName: "Awa", lastName: "Diallo" } },
    period: { name: "S2", sequence: 2 },
    subjectPerformances: [
      { subjectId: SUBJECT_ID, average: 16, subject: { name: "Maths" } },
    ],
    ...overrides,
  } as never;
}

describe("GET /api/analytics/class/[classId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("PARENT"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès non autorisé");
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should forbid access to a class of another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6A",
      schoolId: FIXTURES.schoolB,
      classLevel: { name: "6ème" },
    } as never);
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès non autorisé");
  });

  it("should return 400 when no current academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6A",
      schoolId: FIXTURES.schoolA,
      classLevel: { name: "6ème" },
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Année académique requise");
  });

  it("should compute class analytics for a TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6A",
      schoolId: FIXTURES.schoolA,
      classLevel: { name: "6ème" },
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: FIXTURES.studentA },
      { studentId: FIXTURES.studentB },
    ] as never);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([
      makeAnalytics({ periodId: S1, period: { name: "S1", sequence: 1 } }),
      makeAnalytics({
        id: cuid("an2"),
        studentId: FIXTURES.studentB,
        generalAverage: 9,
        performanceLevel: "WEAK",
        riskLevel: "HIGH",
        student: { user: { firstName: "Jean", lastName: "Mensah" } },
        subjectPerformances: [
          { subjectId: SUBJECT_ID, average: 10, subject: { name: "Maths" } },
          { subjectId: "csubj2", average: 12, subject: { name: "Français" } },
        ],
      }),
    ]);
    vi.mocked(prisma.period.findMany).mockResolvedValue([
      { id: S1, name: "S1", sequence: 1 },
      { id: S2, name: "S2", sequence: 2 },
    ] as never);

    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("TEACHER"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.className).toBe("6A");
    expect(body.classLevel).toBe("6ème");
    expect(body.studentCount).toBe(2);
    expect(body.averageGrade).toBe(12);
    expect(body.performanceDistribution).toEqual({
      excellent: 0,
      veryGood: 0,
      good: 1,
      average: 0,
      insufficient: 0,
      weak: 1,
    });
    expect(body.riskDistribution).toEqual({ low: 1, medium: 0, high: 1, critical: 0 });

    expect(body.subjectSummary).toHaveLength(2);
    expect(body.subjectSummary[0]).toEqual({ subjectId: SUBJECT_ID, name: "Maths", average: 13 });
    expect(body.subjectSummary[1]).toEqual({ subjectId: "csubj2", name: "Français", average: 12 });

    expect(body.studentRanking).toEqual([
      { studentId: FIXTURES.studentA, name: "Awa Diallo", average: 15, rank: 1 },
      { studentId: FIXTURES.studentB, name: "Jean Mensah", average: 9, rank: 2 },
    ]);

    expect(body.monthlyTrend).toEqual([
      { name: "S1", value: 15 },
      { name: "S2", value: 9 },
    ]);
  });

  it("should allow SUPER_ADMIN without session school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6A",
      schoolId: FIXTURES.schoolA,
      classLevel: { name: "6ème" },
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.period.findMany).mockResolvedValue([] as never);
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("SUPER_ADMIN", { schoolId: null }),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: FIXTURES.schoolA }) })
    );
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockRejectedValue(new Error("boom"));
    const res = await GET_CLASS(makeRequest("http://localhost/api/analytics/class/6A"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des analytics de classe");
  });
});

describe("GET /api/analytics/class/[classId]/subject/[subjectId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("PARENT"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès non autorisé");
  });

  it("should return 404 when classSubject not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Matière de classe introuvable");
  });

  it("should forbid access to a subject of another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: "cclasssub1",
      classId: CLASS_ID,
      subjectId: SUBJECT_ID,
      class: { name: "6A", schoolId: FIXTURES.schoolB },
      subject: { name: "Maths" },
      teacher: null,
    } as never);
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès non autorisé");
  });

  it("should return 400 when no current academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: "cclasssub1",
      classId: CLASS_ID,
      subjectId: SUBJECT_ID,
      class: { name: "6A", schoolId: FIXTURES.schoolA },
      subject: { name: "Maths" },
      teacher: null,
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Année académique requise");
  });

  it("should compute subject analytics", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: "cclasssub1",
      classId: CLASS_ID,
      subjectId: SUBJECT_ID,
      class: { name: "6A", schoolId: FIXTURES.schoolA },
      subject: { name: "Maths" },
      teacher: { user: { firstName: "Paul", lastName: "Biya" } },
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: FIXTURES.studentA },
      { studentId: FIXTURES.studentB },
    ] as never);
    vi.mocked(prisma.subjectPerformance.findMany).mockResolvedValue([
      {
        average: 16,
        analytics: {
          studentId: FIXTURES.studentA,
          period: { sequence: 2 },
          student: { user: { firstName: "Awa", lastName: "Diallo" } },
        },
      },
      {
        average: 10,
        analytics: {
          studentId: FIXTURES.studentB,
          period: { sequence: 2 },
          student: { user: { firstName: "Jean", lastName: "Mensah" } },
        },
      },
    ] as never);
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
      {
        title: "Devoir 1",
        date: new Date("2026-02-01"),
        grades: [{ value: 14, isAbsent: false }, { value: null, isAbsent: false }, { value: 8, isAbsent: true }],
      },
    ] as never);

    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.subjectName).toBe("Maths");
    expect(body.className).toBe("6A");
    expect(body.teacherName).toBe("Paul Biya");
    expect(body.average).toBe(13);
    expect(body.highest).toBe(16);
    expect(body.lowest).toBe(10);
    expect(body.median).toBe(13);
    expect(body.gradeDistribution).toEqual({
      excellent: 1,
      veryGood: 0,
      good: 0,
      average: 1,
      insufficient: 0,
      weak: 0,
    });
    expect(body.studentGrades).toEqual([
      { studentId: FIXTURES.studentA, studentName: "Awa Diallo", average: 16, rank: 1 },
      { studentId: FIXTURES.studentB, studentName: "Jean Mensah", average: 10, rank: 2 },
    ]);
    expect(body.evaluations).toEqual([
      { name: "Devoir 1", date: new Date("2026-02-01"), classAverage: 14 },
    ]);
  });

  it("should fall back to 'Indisponible' teacher name and keep latest snapshot per student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: "cclasssub1",
      classId: CLASS_ID,
      subjectId: SUBJECT_ID,
      class: { name: "6A", schoolId: FIXTURES.schoolA },
      subject: { name: "Maths" },
      teacher: null,
    } as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: FIXTURES.studentA },
    ] as never);
    vi.mocked(prisma.subjectPerformance.findMany).mockResolvedValue([
      {
        average: 12,
        analytics: {
          studentId: FIXTURES.studentA,
          period: { sequence: 1 },
          student: { user: { firstName: "Awa", lastName: "Diallo" } },
        },
      },
      {
        average: 15,
        analytics: {
          studentId: FIXTURES.studentA,
          period: { sequence: 2 },
          student: { user: { firstName: "Awa", lastName: "Diallo" } },
        },
      },
      {
        average: null,
        analytics: {
          studentId: FIXTURES.studentA,
          period: { sequence: 2 },
          student: { user: { firstName: "Awa", lastName: "Diallo" } },
        },
      },
    ] as never);
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([] as never);

    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("TEACHER"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.teacherName).toBe("Indisponible");
    expect(body.average).toBe(15);
    expect(body.studentGrades).toHaveLength(1);
    expect(body.studentGrades[0].average).toBe(15);
    expect(body.evaluations).toEqual([]);
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.classSubject.findUnique).mockRejectedValue(new Error("boom"));
    const res = await GET_SUBJECT(makeRequest("http://localhost/api/analytics/class/6A/subject/maths"), {
      session: makeSession("DIRECTOR"),
      params: Promise.resolve({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des analytics de matière");
  });
});