import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/root/analytics/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

describe("GET /api/root/analytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/root/analytics"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid a SCHOOL_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/analytics"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès root refusé");
  });

  it("should forbid a SUPER_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/analytics"), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès root refusé");
  });

  it("should aggregate platform analytics into a timeline", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ day: "2026-08-15", count: 2 }])
      .mockResolvedValueOnce([{ day: "2026-08-15", count: 1, revenue: 50000 }])
      .mockResolvedValueOnce([{ day: "2026-08-15", count: 1 }])
      .mockResolvedValueOnce([{ day: "2026-08-15", count: 5 }]);

    const res = await GET(makeRequest("http://localhost/api/root/analytics"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.period).toBe("30d");
    expect(body.timeline).toEqual([
      { date: "2026-08-15", users: 2, payments: 1, revenue: 50000, schools: 1, activity: 5 },
    ]);
    expect(body.summary).toMatchObject({
      users: 2,
      payments: 1,
      revenue: 50000,
      schools: 1,
      activity: 5,
      averageRevenuePerDay: 50000,
      averageUsersPerDay: 2,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
  });

  it("should echo the requested period", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/root/analytics?period=1y"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe("1y");
    expect(body.summary.users).toBe(0);
  });

  it("should return 500 when a query fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("http://localhost/api/root/analytics"), { session: ROOT });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des analytics");
  });
});