import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/root/monitoring/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
    auditLog: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
    session: { count: vi.fn() },
    dataAccessRequest: { count: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

describe("GET /api/root/monitoring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid a SCHOOL_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(403);
  });

  it("should forbid a SUPER_ADMIN with a non-root email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès root refusé");
  });

  it("should expose database, cache, system and errors health", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([
      { action: "LOGIN_ERROR", _count: 3 },
    ] as never);
    vi.mocked(prisma.session.count).mockResolvedValue(12);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(8);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(2);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.database.connectionPool.status).toBe("active");
    expect(["excellent", "good", "warning", "critical"]).toContain(body.database.health.status);

    expect(body.cache).toEqual({ connected: false, hitRate: 0, memory: null });

    expect(body.system).toEqual({
      maintenanceMode: false,
      activeSessions: 12,
      recentLogins: 8,
      pendingDataRequests: 2,
    });

    expect(body.errors.last24h).toBe(0);
    expect(body.errors.recent).toEqual([]);
    expect(body.errors.byType).toEqual([{ type: "LOGIN_ERROR", count: 3 }]);

    expect(body.alerts.map((a: { message: string }) => a.message)).toContain("Cache Redis non connecté");
    expect(body.alerts.map((a: { message: string }) => a.message)).toContain("2 requête(s) de données en attente");
  });

  it("should flag maintenance mode when system setting is on", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({ value: "on" } as never);
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.system.maintenanceMode).toBe(true);
  });

  it("should emit a warning alert when errors exceed 20 in 24h", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    const errors = Array.from({ length: 25 }, (_, i) => ({
      id: cuid(`err${i}`),
      action: "GRADE_ERROR",
      entity: "grade",
      entityId: null,
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      userId: null,
      user: null,
    })) as never;
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(errors);
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors.last24h).toBe(25);
    expect(body.errors.recent).toHaveLength(10);
    expect(body.alerts.map((a: { message: string }) => a.message)).toContain("25 erreurs dans les dernières 24h");
  });

  it("should return 500 when the database health check fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB Down"));
    const res = await GET(makeRequest("http://localhost/api/root/monitoring"), { session: ROOT });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération du monitoring");
  });
});