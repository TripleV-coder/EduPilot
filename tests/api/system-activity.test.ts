import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/system/activity/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("log1"),
    action: "CREATE",
    entity: "student",
    entityId: cuid("entity1"),
    userId: cuid("user1"),
    schoolId: cuid("schoola"),
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    user: { id: cuid("user1"), firstName: "Jean", lastName: "Dupont", role: "SCHOOL_ADMIN" },
    school: { id: cuid("schoola"), name: "École A" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
    makeLog(),
    makeLog({ id: cuid("log2"), action: "LOGIN_SUCCESS", entity: "user", user: null, school: null }),
    makeLog({ id: cuid("log3"), action: "DELETE", entity: "teacher", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }),
  ] as never);
  vi.mocked(prisma.auditLog.count).mockResolvedValue(2);
  vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([
    { action: "CREATE", _count: 1 },
    { action: "LOGIN_SUCCESS", _count: 1 },
  ] as never);
});

describe("GET /api/system/activity", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/system/activity"));
    expect(res.status).toBe(401);
  });

  it("should forbid non-super-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/system/activity"));
    expect(res.status).toBe(403);
  });

  it("should return transformed activities with stats", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await GET(makeRequest("http://localhost/api/system/activity?limit=10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activities).toHaveLength(3);
    expect(body.activities[0]).toMatchObject({
      action: "Création d'élève",
      description: "Création d'élève",
      icon: "plus-circle",
      severity: "medium",
      user: "Jean Dupont",
      school: "École A",
      userId: cuid("user1"),
      schoolId: cuid("schoola"),
    });
    expect(body.activities[0].timeAgo).toBe("Il y a 5 minutes");
    expect(body.activities[1]).toMatchObject({
      action: "Connexion réussie",
      icon: "log-in",
      severity: "low",
      user: "Système",
      school: "Global",
    });
    expect(body.activities[2]).toMatchObject({
      action: "Suppression d'enseignant",
      icon: "trash",
      severity: "high",
    });
    expect(body.stats).toEqual({
      total: 3,
      last24Hours: 2,
      byAction: [
        { action: "CREATE", _count: 1 },
        { action: "LOGIN_SUCCESS", _count: 1 },
      ],
    });
    expect(body.timestamp).toBeDefined();
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it("should use the default limit of 10 when absent", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    await GET(makeRequest("http://localhost/api/system/activity"));
    expect(vi.mocked(prisma.auditLog.findMany).mock.calls[0][0]).toMatchObject({ take: 10 });
  });

  it("should return 500 on database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/system/activity"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Erreur lors de la récupération de l'activité système");
    expect(body.details).toBe("db down");
  });
});