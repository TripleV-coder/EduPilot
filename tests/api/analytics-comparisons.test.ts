import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_PERIOD_COMPARISON } from "@/app/api/analytics/period-comparison/route";
import { GET as GET_CLASS_COMPARISON } from "@/app/api/analytics/class-comparison/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findFirst: vi.fn(), findMany: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    period: { findUnique: vi.fn() },
    enrollment: { count: vi.fn() },
  },
}));

const AY = cuid("ay1");
const CLASS_ID = cuid("class1");
const P1 = cuid("p1");
const P2 = cuid("p2");

describe("GET /api/analytics/period-comparison", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_PERIOD_COMPARISON(makeRequest("http://localhost/api/analytics/period-comparison"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when params are missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET_PERIOD_COMPARISON(makeRequest("http://localhost/api/analytics/period-comparison"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Paramètres manquants");
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findFirst).mockResolvedValue(null);
    const res = await GET_PERIOD_COMPARISON(makeRequest(`http://localhost/api/analytics/period-comparison?academicYearId=${AY}&classId=${CLASS_ID}&periodIds=${P1}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should forbid access to another school's class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findFirst).mockResolvedValue({
      id: CLASS_ID,
      schoolId: FIXTURES.schoolB,
      name: "6A",
    } as never);
    const res = await GET_PERIOD_COMPARISON(makeRequest(`http://localhost/api/analytics/period-comparison?academicYearId=${AY}&classId=${CLASS_ID}&periodIds=${P1}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé à cette classe");
  });

  it("should compare multiple periods", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findFirst).mockResolvedValue({
      id: CLASS_ID,
      schoolId: FIXTURES.schoolA,
      name: "6A",
    } as never);
    vi.mocked(prisma.studentAnalytics.findMany)
      .mockResolvedValueOnce([
        { generalAverage: 12, performanceLevel: "GOOD" },
      ] as never)
      .mockResolvedValueOnce([
        { generalAverage: 16, performanceLevel: "EXCELLENT" },
        { generalAverage: 10, performanceLevel: "AVERAGE" },
      ] as never);
    vi.mocked(prisma.period.findUnique)
      .mockResolvedValueOnce({ name: "Semestre 1" } as never)
      .mockResolvedValueOnce({ name: "Semestre 2" } as never);

    const res = await GET_PERIOD_COMPARISON(makeRequest(`http://localhost/api/analytics/period-comparison?academicYearId=${AY}&classId=${CLASS_ID}&periodIds=${P1}&periodIds=${P2}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      periodId: P1,
      periodName: "Semestre 1",
      className: "6A",
      schoolId: FIXTURES.schoolA,
      studentCount: 1,
      averageGrade: 12,
      passRate: 100,
      performanceDistribution: { good: 1 },
    });
    expect(body[1]).toMatchObject({
      periodId: P2,
      periodName: "Semestre 2",
      studentCount: 2,
      averageGrade: 13,
      passRate: 100,
      performanceDistribution: { excellent: 1, average: 1 },
    });
    expect(prisma.studentAnalytics.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          academicYearId: AY,
          periodId: P1,
          student: expect.objectContaining({
            schoolId: FIXTURES.schoolA,
            enrollments: { some: { classId: CLASS_ID, academicYearId: AY } },
          }),
        }),
      })
    );
  });

  it("should default to 'Unknown' period name", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findFirst).mockResolvedValue({
      id: CLASS_ID,
      schoolId: FIXTURES.schoolA,
      name: "6A",
    } as never);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await GET_PERIOD_COMPARISON(makeRequest(`http://localhost/api/analytics/period-comparison?academicYearId=${AY}&classId=${CLASS_ID}&periodIds=${P1}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].periodName).toBe("Unknown");
    expect(body[0].averageGrade).toBe(0);
    expect(body[0].passRate).toBe(0);
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findFirst).mockRejectedValue(new Error("boom"));
    const res = await GET_PERIOD_COMPARISON(makeRequest(`http://localhost/api/analytics/period-comparison?academicYearId=${AY}&classId=${CLASS_ID}&periodIds=${P1}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la comparaison");
  });
});

describe("GET /api/analytics/class-comparison", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_CLASS_COMPARISON(makeRequest("http://localhost/api/analytics/class-comparison"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when params are missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET_CLASS_COMPARISON(makeRequest("http://localhost/api/analytics/class-comparison"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Paramètres manquants");
  });

  it("should return 404 when a class is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findMany).mockResolvedValue([
      { id: CLASS_ID, name: "6A", schoolId: FIXTURES.schoolA, school: { name: "École A" } },
    ] as never);
    const res = await GET_CLASS_COMPARISON(makeRequest(`http://localhost/api/analytics/class-comparison?academicYearId=${AY}&classIds=${CLASS_ID}&classIds=${cuid("class2")}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Une ou plusieurs classes sont introuvables");
  });

  it("should forbid comparison when a class is out of scope", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findMany).mockResolvedValue([
      { id: CLASS_ID, name: "6A", schoolId: FIXTURES.schoolA, school: { name: "École A" } },
      { id: cuid("class2"), name: "5A", schoolId: FIXTURES.schoolB, school: { name: "École B" } },
    ] as never);
    const res = await GET_CLASS_COMPARISON(makeRequest(`http://localhost/api/analytics/class-comparison?academicYearId=${AY}&classIds=${CLASS_ID}&classIds=${cuid("class2")}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé à une ou plusieurs classes demandées");
  });

  it("should compare multiple classes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const class2 = cuid("class2");
    vi.mocked(prisma.class.findMany).mockResolvedValue([
      { id: CLASS_ID, name: "6A", schoolId: FIXTURES.schoolA, school: { name: "École A" } },
      { id: class2, name: "5A", schoolId: FIXTURES.schoolA, school: { name: "École A" } },
    ] as never);
    vi.mocked(prisma.enrollment.count)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(20);
    vi.mocked(prisma.studentAnalytics.findMany)
      .mockResolvedValueOnce([
        { studentId: FIXTURES.studentA, generalAverage: 14, riskLevel: "LOW", period: { sequence: 2 } },
      ] as never)
      .mockResolvedValueOnce([
        { studentId: FIXTURES.studentB, generalAverage: 8, riskLevel: "HIGH", period: { sequence: 2 } },
        { studentId: "cstud3", generalAverage: 9, riskLevel: "HIGH", period: { sequence: 1 } },
      ] as never);

    const res = await GET_CLASS_COMPARISON(makeRequest(`http://localhost/api/analytics/class-comparison?academicYearId=${AY}&classIds=${CLASS_ID}&classIds=${class2}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      classId: CLASS_ID,
      className: "6A",
      schoolName: "École A",
      studentCount: 25,
      averageGrade: 14,
      passRate: 100,
      riskDistribution: { low: 1, medium: 0, high: 0, critical: 0 },
    });
    expect(body[1]).toMatchObject({
      classId: class2,
      studentCount: 20,
      averageGrade: 8.5,
      passRate: 0,
      riskDistribution: { low: 0, medium: 0, high: 2, critical: 0 },
    });
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findMany).mockRejectedValue(new Error("boom"));
    const res = await GET_CLASS_COMPARISON(makeRequest(`http://localhost/api/analytics/class-comparison?academicYearId=${AY}&classIds=${CLASS_ID}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la comparaison");
  });
});