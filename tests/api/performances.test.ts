import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/performances/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    period: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
  },
}));

function makeYear(overrides: Record<string, unknown> = {}) {
  return { id: "ay1", name: "2025-2026", schoolId: FIXTURES.schoolA, isCurrent: true, ...overrides } as never;
}

function makePeriod(id: string, name: string) {
  return { id, name, startDate: new Date("2020-01-01"), endDate: new Date("2020-12-31") };
}

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "6A",
    schoolId: FIXTURES.schoolA,
    classLevelId: "l1",
    classLevel: { name: "Sixième" },
    classSubjects: [
      {
        id: "cs1",
        subject: { id: "s1", name: "Maths" },
        evaluations: [
          { id: "ev1", periodId: "p1", grades: [{ value: 12 }, { value: 14 }, { value: 16 }] },
        ],
      },
      {
        id: "cs2",
        subject: { id: "s2", name: "Français" },
        evaluations: [
          { id: "ev2", periodId: "p1", grades: [{ value: 10 }] },
        ],
      },
    ],
    ...overrides,
  } as never;
}

describe("GET /api/performances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 404 when no active academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Aucune année académique active trouvée.");
  });

  it("should return 404 when no period exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeYear());
    vi.mocked(prisma.period.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Aucune période trouvée.");
  });

  it("should compute performance metrics for the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeYear());
    vi.mocked(prisma.period.findMany).mockResolvedValue([
      makePeriod("p1", "Trimestre 1"),
      makePeriod("p2", "Trimestre 2"),
    ]);
    vi.mocked(prisma.class.findMany).mockResolvedValue([
      makeClass(),
      makeClass({
        id: "cl2",
        name: "CM2A",
        classLevelId: "l2",
        classLevel: { name: "CM2" },
        classSubjects: [
          {
            id: "cs3",
            subject: { id: "s1", name: "Maths" },
            evaluations: [
              { id: "ev3", periodId: "p1", grades: [{ value: 8 }, { value: 10 }] },
            ],
          },
        ],
      }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/performances?periodId=p1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.academicYear).toBe("2025-2026");
    expect(body.periods).toEqual([
      { id: "p1", name: "Trimestre 1" },
      { id: "p2", name: "Trimestre 2" },
    ]);
    expect(body.activePeriodId).toBe("p1");
    expect(body.overallAverage).toBeCloseTo(11.67, 2);
    expect(body.totalEvaluations).toBe(6);
    expect(body.performanceByLevel).toEqual([
      { name: "Sixième", average: 13 },
      { name: "CM2", average: 9 },
    ]);
    expect(body.performanceByClass).toEqual([
      { name: "Sixième 6A", average: 13 },
      { name: "CM2 CM2A", average: 9 },
    ]);
    expect(body.performanceBySubject).toEqual([
      { name: "Maths", average: 12 },
      { name: "Français", average: 10 },
    ]);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, isCurrent: true } })
    );
    expect(prisma.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA } })
    );
  });

  it("should fall back to the first period when none is active", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeYear());
    vi.mocked(prisma.period.findMany).mockResolvedValue([
      makePeriod("p9", "Période 1"),
      makePeriod("p10", "Période 2"),
    ]);
    vi.mocked(prisma.class.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activePeriodId).toBe("p9");
  });

  it("should not scope SUPER_ADMIN to a school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeYear());
    vi.mocked(prisma.period.findMany).mockResolvedValue([makePeriod("p1", "Trimestre 1")]);
    vi.mocked(prisma.class.findMany).mockResolvedValue([]);
    await GET(makeRequest("http://localhost/api/performances?periodId=p1"), { session: makeSession("SUPER_ADMIN") });
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isCurrent: true } })
    );
    expect(prisma.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: undefined } })
    );
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/performances"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});