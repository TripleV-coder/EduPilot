import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/system/health/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getJobQueueStats } from "@/lib/jobs/queue";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
    user: { count: vi.fn() },
    school: { count: vi.fn() },
  },
}));
vi.mock("@/lib/jobs/queue", () => ({ getJobQueueStats: vi.fn() }));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
  vi.mocked(prisma.user.count).mockResolvedValue(42);
  vi.mocked(prisma.school.count).mockResolvedValue(7);
  vi.mocked(getJobQueueStats).mockResolvedValue({ PENDING: 0, RUNNING: 0, DONE: 3, FAILED: 0, oldestPendingRunAt: null });
});

describe("GET /api/system/health", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/system/health"));
    expect(res.status).toBe(401);
  });

  it("should forbid non-super-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/system/health"));
    expect(res.status).toBe(403);
  });

  it("should return health metrics with database check", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await GET(makeRequest("http://localhost/api/system/health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.activeUsers).toBe(42);
    expect(body.totalUsers).toBe(42);
    expect(body.totalSchools).toBe(7);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.uptime).toMatch(/^\d+h \d+m$/);
    expect(body.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(body.dbResponseTimeMs).toBeGreaterThanOrEqual(0);
    expect(body.checks.database).toBe("healthy");
    expect(body.checks.api).toBe("healthy");
    expect(body.checks.cache).toBe("disabled");
    expect(body.checks.jobs).toBe("healthy");
    expect(body.jobs).toMatchObject({ PENDING: 0, DONE: 3, backlogMs: 0 });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("signale une file d'envoi bloquée depuis plus de 10 minutes", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(getJobQueueStats).mockResolvedValue({
      PENDING: 12, RUNNING: 0, DONE: 0, FAILED: 0, oldestPendingRunAt: new Date(Date.now() - 15 * 60_000),
    });
    const body = await (await GET(makeRequest("http://localhost/api/system/health"))).json();
    expect(body.checks.jobs).toBe("warning");
    expect(body.jobs.PENDING).toBe(12);
  });

  it("should return 500 when the database check fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused"));
    const res = await GET(makeRequest("http://localhost/api/system/health"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Erreur lors de la récupération de l'état du système");
    expect(body.details).toBe("connection refused");
  });
});