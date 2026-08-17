import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_PENDING } from "@/app/api/admin/pending-actions/route";
import { GET, POST } from "@/app/api/admin/system/info/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { count: vi.fn() },
    user: { count: vi.fn() },
    dataAccessRequest: { count: vi.fn() },
    behaviorIncident: { count: vi.fn() },
    payment: { count: vi.fn() },
    studentProfile: { count: vi.fn() },
    teacherProfile: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    grade: { count: vi.fn() },
    auditLog: { count: vi.fn(), create: vi.fn() },
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/pending-actions", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_PENDING(makeRequest("http://localhost/api/admin/pending-actions"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SYSTEM_READ permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET_PENDING(makeRequest("http://localhost/api/admin/pending-actions"));
    expect(res.status).toBe(403);
  });

  it("should return pending actions with counts", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockResolvedValue(2);
    vi.mocked(prisma.user.count).mockResolvedValue(3);
    vi.mocked(prisma.dataAccessRequest.count).mockImplementation(async (args: { where?: { status?: string } } | undefined) =>
      args?.where?.status === "PENDING" ? 4 : 1
    );
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(5);
    vi.mocked(prisma.payment.count).mockResolvedValue(6);
    const res = await GET_PENDING(makeRequest("http://localhost/api/admin/pending-actions"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toHaveLength(6);
    expect(body.allActions).toHaveLength(6);
    expect(body.actions.find((a: { id: string }) => a.id === "schools")).toMatchObject({
      type: "School Approvals",
      count: 2,
      priority: "high",
    });
    expect(body.actions.find((a: { id: string }) => a.id === "data-requests")).toMatchObject({ count: 4, priority: "high" });
    expect(body.actions.find((a: { id: string }) => a.id === "incidents")).toMatchObject({ count: 5, priority: "high" });
    expect(body.actions.find((a: { id: string }) => a.id === "payments")).toMatchObject({ count: 6, priority: "medium" });
    expect(body.actions.find((a: { id: string }) => a.id === "compliance")).toMatchObject({ count: 1, priority: "low" });
    expect(body.summary).toEqual({
      total: 21,
      highPriority: 11,
      mediumPriority: 9,
      lowPriority: 1,
    });
    expect(body.timestamp).toBeDefined();
  });

  it("should filter out actions with zero count", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockResolvedValue(0);
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);
    const res = await GET_PENDING(makeRequest("http://localhost/api/admin/pending-actions"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toHaveLength(0);
    expect(body.summary.total).toBe(0);
  });

  it("should degrade gracefully when counts fail", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockResolvedValue(1);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.dataAccessRequest.count).mockRejectedValue(new Error("model missing"));
    vi.mocked(prisma.behaviorIncident.count).mockRejectedValue(new Error("model missing"));
    vi.mocked(prisma.payment.count).mockResolvedValue(1);
    const res = await GET_PENDING(makeRequest("http://localhost/api/admin/pending-actions"));
    const body = await res.json();

    expect(res.status).toBe(200);
    const dataRequests = body.allActions.find((a: { id: string }) => a.id === "data-requests");
    const incidents = body.allActions.find((a: { id: string }) => a.id === "incidents");
    expect(dataRequests.count).toBe(0);
    expect(incidents.count).toBe(0);
    expect(body.actions).toHaveLength(3);
  });
});

describe("GET /api/admin/system/info", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/admin/system/info"));
    expect(res.status).toBe(401);
  });

  it("should forbid non-super-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/admin/system/info"));
    expect(res.status).toBe(403);
  });

  it("should return system, database and activity stats", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.count).mockResolvedValue(100);
    vi.mocked(prisma.school.count).mockResolvedValue(5);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(900);
    vi.mocked(prisma.teacherProfile.count).mockResolvedValue(80);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(850);
    vi.mocked(prisma.grade.count).mockResolvedValue(5000);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(120);
    const res = await GET(makeRequest("http://localhost/api/admin/system/info"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.system).toMatchObject({ environment: "test", nodeVersion: expect.any(String) });
    expect(body.database).toMatchObject({
      provider: "PostgreSQL",
      status: "connected",
      users: 100,
      schools: 5,
      students: 900,
      teachers: 80,
      enrollments: 850,
      grades: 5000,
    });
    expect(body.activity).toEqual({ logs24h: 120 });
    expect(body.timestamp).toBeDefined();
    expect(prisma.teacherProfile.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it("should return 500 on database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.count).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/admin/system/info"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des informations système");
  });
});

describe("POST /api/admin/system/info", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/admin/system/info", { method: "POST", body: { action: "clear-cache" } }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-super-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/admin/system/info", { method: "POST", body: { action: "clear-cache" } }));
    expect(res.status).toBe(403);
  });

  it("should clear the cache and log the action", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: cuid("log1") } as never);
    const res = await POST(makeRequest("http://localhost/api/admin/system/info", { method: "POST", body: { action: "clear-cache" } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Cache effacé avec succès");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: ROOT.user!.id,
        action: "SYSTEM_CACHE_CLEAR",
        entity: "system",
        entityId: "cache",
      }),
    }));
  });

  it("should return 400 for an unknown action", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await POST(makeRequest("http://localhost/api/admin/system/info", { method: "POST", body: { action: "reboot" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Action non reconnue");
  });

  it("should return 500 on database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/admin/system/info", { method: "POST", body: { action: "clear-cache" } }));
    expect(res.status).toBe(500);
  });
});