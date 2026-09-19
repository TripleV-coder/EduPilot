import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/analytics/school/overview/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn(), findUnique: vi.fn() },
    studentProfile: { count: vi.fn(), findMany: vi.fn() },
    enrollment: { count: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    subjectPerformance: { groupBy: vi.fn() },
    subject: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    period: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

const AY = cuid("ay1");

// Audit C3 : la route ne charge plus l'élève ni ses performances par matière
// avec chaque analyse (champs minimaux) ; noms/classes viennent de
// studentProfile.findMany pour les seuls élèves affichés, et le résumé par
// matière de subjectPerformance.groupBy. Le calcul réel est vérifié sur
// PostgreSQL : tests/integration-db/analytics-school-overview.test.ts.
function makeAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("an1"),
    studentId: FIXTURES.studentA,
    periodId: cuid("p2"),
    academicYearId: AY,
    riskLevel: "LOW",
    performanceLevel: "GOOD",
    generalAverage: 15.5,
    period: { id: cuid("p2"), name: "Semestre 2", sequence: 2 },
    ...overrides,
  } as never;
}

describe("GET /api/analytics/school/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.subjectPerformance.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.subject.findMany).mockResolvedValue([] as never);
  });

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/school/overview"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/analytics/school/overview"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should forbid access to another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest(`http://localhost/api/analytics/school/overview?schoolId=${FIXTURES.schoolB}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when no school available", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/analytics/school/overview"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(400);
  });

  it("should return 400 when no academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/school/overview"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should compute the full overview", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
    } as never);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(120);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(115);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([
      makeAnalytics({ id: cuid("an1"), riskLevel: "LOW", performanceLevel: "EXCELLENT", generalAverage: 17 }),
      makeAnalytics({ id: cuid("an2"), studentId: FIXTURES.studentB, riskLevel: "HIGH", performanceLevel: "WEAK", generalAverage: 7 }),
    ]);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
      { id: FIXTURES.studentA, user: { firstName: "Awa", lastName: "Diallo" }, enrollments: [{ class: { name: "6A" } }] },
      { id: FIXTURES.studentB, user: { firstName: "Jean", lastName: "Mensah" }, enrollments: [{ class: { name: "5A" } }] },
    ] as never);
    // Maths : performances 16 et 6 → moyenne 11, une réussite sur deux
    vi.mocked(prisma.subjectPerformance.groupBy)
      .mockResolvedValueOnce([{ subjectId: "s1", _avg: { average: 11 }, _count: { _all: 2 } }] as never)
      .mockResolvedValueOnce([{ subjectId: "s1", _count: { _all: 1 } }] as never);
    vi.mocked(prisma.subject.findMany).mockResolvedValue([{ id: "s1", name: "Maths" }] as never);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
      { status: "PRESENT", _count: 800 },
      { status: "ABSENT", _count: 50 },
      { status: "LATE", _count: 20 },
    ] as never);
    vi.mocked(prisma.period.findMany).mockResolvedValue([
      { id: cuid("p1"), name: "Semestre 1", sequence: 1 },
      { id: cuid("p2"), name: "Semestre 2", sequence: 2 },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/analytics/school/overview"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.overview.totalStudents).toBe(120);
    expect(body.overview.activeStudents).toBe(115);
    expect(body.overview.totalAnalytics).toBe(2);
    expect(body.overview.averageGrade).toBe("12.00");
    expect(body.overview.failureRate).toBe(50);
    expect(body.overview.atRiskCount).toBe(1);
    expect(body.overview.dropoutRiskCount).toBe(0);

    expect(body.performanceDistribution.excellent).toBe(1);
    expect(body.performanceDistribution.weak).toBe(1);
    expect(body.riskDistribution.high).toBe(1);

    expect(body.topStudents).toHaveLength(1);
    expect(body.topStudents[0].student.user.firstName).toBe("Awa");
    expect(body.topStudents[0].student.class.name).toBe("6A");
    expect(body.atRiskStudents).toHaveLength(1);
    expect(body.atRiskStudents[0].student.id).toBe(FIXTURES.studentB);
    expect(body.atRiskStudents[0].student.class.name).toBe("5A");
    // Noms chargés pour les seuls élèves affichés
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [FIXTURES.studentA, FIXTURES.studentB] } } })
    );

    expect(body.subjectSummary).toHaveLength(1);
    expect(body.subjectSummary[0].subject).toBe("Maths");
    expect(body.subjectSummary[0].grade).toBe(11);
    expect(body.subjectSummary[0].passRate).toBe(50);
    expect(body.subjectSummary[0].studentsCount).toBe(2);

    expect(body.attendanceDistribution.present).toBe(800);
    expect(body.attendanceDistribution.absent).toBe(50);
    expect(body.attendanceDistribution.late).toBe(20);
    expect(body.attendanceDistribution.excused).toBe(0);

    expect(body.academicYearId).toBe(AY);
    expect(body.periods).toHaveLength(2);
    expect(body.periodComparison).toBeNull();
  });

  it("should compute period comparison when periodId provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(1);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(1);
    vi.mocked(prisma.studentAnalytics.findMany)
      .mockResolvedValueOnce([
        makeAnalytics({ id: cuid("an1"), periodId: cuid("p2"), period: { id: cuid("p2"), name: "Semestre 2", sequence: 2 } }),
      ])
      .mockResolvedValueOnce([
        { studentId: FIXTURES.studentA, generalAverage: 12, periodId: cuid("p1") },
      ] as never);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({ sequence: 2 } as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({ id: cuid("p1"), name: "Semestre 1" } as never);
    vi.mocked(prisma.period.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest(`http://localhost/api/analytics/school/overview?periodId=${cuid("p2")}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.periodComparison).not.toBeNull();
    expect(body.periodComparison.previousPeriod).toBe("Semestre 1");
    expect(body.periodComparison.currentAverage).toBeCloseTo(15.5, 1);
    expect(body.periodComparison.previousAverage).toBeCloseTo(12, 1);
    expect(body.periodComparison.improvement).toBeCloseTo(3.5, 1);
    expect(body.periodComparison.studentsImproved).toBe(1);
  });
});