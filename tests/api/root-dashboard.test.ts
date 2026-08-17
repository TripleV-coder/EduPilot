import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/root/dashboard/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
    school: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    studentProfile: { count: vi.fn() },
    teacherProfile: { count: vi.fn() },
    class: { count: vi.fn() },
    payment: { count: vi.fn(), aggregate: vi.fn() },
    auditLog: { count: vi.fn(), findMany: vi.fn() },
    dataAccessRequest: { count: vi.fn() },
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });
const SCHOOL = cuid("sch1");

describe("GET /api/root/dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid a SCHOOL_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(403);
  });

  it("should forbid a SUPER_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès root refusé");
  });

  it("should expose the platform dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7);
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(500);
    vi.mocked(prisma.teacherProfile.count).mockResolvedValue(40);
    vi.mocked(prisma.class.count).mockResolvedValue(60);
    vi.mocked(prisma.payment.count).mockResolvedValue(200);
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 1000000 } } as never)
      .mockResolvedValueOnce({
        _sum: { amount: 300000 },
        _count: 50,
        _avg: { amount: 6000 },
      } as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(25);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(3);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 1 }]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { createdAt: new Date("2026-08-10T08:00:00Z") },
      { createdAt: new Date("2026-08-10T09:00:00Z") },
      { createdAt: new Date("2026-08-11T08:00:00Z") },
    ] as never);
    vi.mocked(prisma.user.groupBy).mockResolvedValue([
      { role: "SCHOOL_ADMIN", _count: 60 },
      { role: "TEACHER", _count: 40 },
    ] as never);
    vi.mocked(prisma.school.groupBy)
      .mockResolvedValueOnce([{ type: "PRIVATE", _count: 9 }] as never)
      .mockResolvedValueOnce([{ level: "PRIMARY", _count: 10 }] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      { id: "la1", action: "LOGIN", entity: "user", entityId: null, createdAt: new Date(), userId: null, user: null },
    ] as never);
    vi.mocked(prisma.school.findMany).mockResolvedValue([
      { id: SCHOOL, name: "École A", code: "A-01", city: "Cotonou", isActive: true, _count: { users: 50, classes: 6 } },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.overview.schools).toEqual({ total: 10, active: 7, inactive: 3 });
    expect(body.overview.users).toEqual({ total: 100, active: 80, inactive: 20 });
    expect(body.overview.students).toBe(500);
    expect(body.overview.teachers).toBe(40);
    expect(body.overview.classes).toBe(60);
    expect(body.overview.revenue).toEqual({
      total: 1000000,
      last30Days: 300000,
      averagePayment: 6000,
      paymentCount: 50,
    });

    expect(body.activity.last24h).toEqual({ auditLogs: 25, pendingRequests: 3 });
    expect(body.activity.recent).toHaveLength(1);

    expect(body.analytics.userGrowth).toEqual([
      { date: "2026-08-10T00:00:00.000Z", count: 2 },
      { date: "2026-08-11T00:00:00.000Z", count: 1 },
    ]);
    expect(body.analytics.usersByRole).toEqual([
      { role: "SCHOOL_ADMIN", count: 60 },
      { role: "TEACHER", count: 40 },
    ]);
    expect(body.analytics.schoolsByType).toEqual([{ type: "PRIVATE", count: 9 }]);
    expect(body.analytics.schoolsByLevel).toEqual([{ level: "PRIMARY", count: 10 }]);

    expect(body.topSchools).toEqual([
      { id: SCHOOL, name: "École A", code: "A-01", city: "Cotonou", isActive: true, users: 50, classes: 6 },
    ]);

    expect(body.system.health).toEqual({ status: "healthy" });
    expect(body.system.cache).toBeNull();
    expect(typeof body.timestamp).toBe("string");
  });

  it("should report degraded system health when the DB probe fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);
    vi.mocked(prisma.teacherProfile.count).mockResolvedValue(0);
    vi.mocked(prisma.class.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 0 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0, _avg: { amount: 0 } } as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB Down"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.school.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.school.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.system.health).toEqual({ status: "error" });
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("http://localhost/api/root/dashboard"), { session: ROOT });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération du dashboard root");
  });
});