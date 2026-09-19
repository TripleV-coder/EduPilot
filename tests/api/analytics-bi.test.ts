import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/analytics/bi/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { collectedByLocalMonth, latestSnapshotStats } from "@/lib/services/analytics/bi-aggregates";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { count: vi.fn() },
    fee: { findMany: vi.fn() },
    payment: { groupBy: vi.fn() },
    attendance: { groupBy: vi.fn() },
  },
}));
// Agrégats SQL (série mensuelle, derniers instantanés) : prouvés contre un vrai
// PostgreSQL par tests/integration-db/analytics-bi.test.ts.
vi.mock("@/lib/services/analytics/bi-aggregates", () => ({
  collectedByLocalMonth: vi.fn(),
  latestSnapshotStats: vi.fn(),
}));

const SCHOOL = FIXTURES.schoolA;
const NO_SNAPSHOT = { total: 0, passing: 0, subjects: [] };

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function mockEmptyData() {
  vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);
  vi.mocked(prisma.fee.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
  vi.mocked(collectedByLocalMonth).mockResolvedValue([]);
  vi.mocked(latestSnapshotStats).mockResolvedValue(NO_SNAPSHOT);
}

describe("GET /api/analytics/bi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/bi"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid STAFF (no ANALYTICS_VIEW permission)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF"));
    const res = await GET(makeRequest("http://localhost/api/analytics/bi"), { session: makeSession("STAFF") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("should return 400 when no school is available", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/analytics/bi"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Établissement requis");
  });

  it("should forbid cross-school request via query param", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest(`http://localhost/api/analytics/bi?schoolId=${FIXTURES.schoolB}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should compute the full BI payload", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(120);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { amount: 100000, createdAt: new Date() },
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { method: "CASH", _sum: { amount: 40000 } },
    ] as never);
    vi.mocked(collectedByLocalMonth).mockResolvedValue([{ month: currentMonthKey(), amount: 40000 }]);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
      { status: "PRESENT", _count: { _all: 90 } },
      { status: "LATE", _count: { _all: 10 } },
      { status: "ABSENT", _count: { _all: 20 } },
    ] as never);
    // Deux élèves : 12 (réussite) et 8 ; Maths 16 et 8 → 12
    vi.mocked(latestSnapshotStats).mockResolvedValue({ total: 2, passing: 1, subjects: [{ subject: "Maths", average: 12 }] });

    const res = await GET(makeRequest("http://localhost/api/analytics/bi"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.kpis.studentCount).toBe(120);
    expect(body.kpis.collectionRate).toBe(40);
    expect(body.kpis.attendanceRate).toBe(83.3);
    expect(body.kpis.passRate).toBe(50);
    expect(body.totalCollected).toBe(40000);

    expect(body.paymentMix).toEqual([{ method: "CASH", amount: 40000, share: 100 }]);

    expect(body.monthly).toHaveLength(12);
    expect(body.monthly.some((m: { billed: number }) => m.billed > 0)).toBe(true);
    expect(body.monthly.some((m: { collected: number }) => m.collected > 0)).toBe(true);

    expect(body.topSubjects).toEqual([{ subject: "Maths", average: 12 }]);
    expect(body.insight).toBeNull();
    expect(typeof body.updatedAt).toBe("string");
  });

  it("should apply academicYearId filter when provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    mockEmptyData();

    const ay = "cay1ay1ay1ay1ay1ay1ay1a";
    const res = await GET(makeRequest(`http://localhost/api/analytics/bi?academicYearId=${ay}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    expect(prisma.fee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ academicYearId: ay }) })
    );
    expect(latestSnapshotStats).toHaveBeenCalledWith(expect.objectContaining({ academicYearId: ay }));
    expect(collectedByLocalMonth).toHaveBeenCalledWith(expect.objectContaining({ academicYearId: ay }), expect.any(Date));
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    mockEmptyData();
    vi.mocked(prisma.payment.groupBy).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("http://localhost/api/analytics/bi"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Une erreur interne est survenue. Veuillez réessayer.");
  });

  it("should handle empty fee data with zero rates", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: SCHOOL }));
    mockEmptyData();

    const res = await GET(makeRequest(`http://localhost/api/analytics/bi?schoolId=${SCHOOL}`), { session: makeSession("SUPER_ADMIN", { schoolId: SCHOOL }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.collectionRate).toBe(0);
    expect(body.kpis.attendanceRate).toBe(0);
    expect(body.kpis.passRate).toBe(0);
    expect(body.paymentMix).toEqual([]);
    expect(body.topSubjects).toEqual([]);
    expect(body.monthly.every((m: { billed: number; collected: number }) => m.billed === 0 && m.collected === 0)).toBe(true);
  });
});
