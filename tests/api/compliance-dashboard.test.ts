import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { count: vi.fn() },
    auditLog: { count: vi.fn(), groupBy: vi.fn() },
    dataAccessRequest: { count: vi.fn(), findMany: vi.fn() },
    dataConsent: { groupBy: vi.fn() },
    dataRetentionPolicy: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/compliance/dashboard/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/compliance/dashboard", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/compliance/dashboard"));
    expect(res.status).toBe(401);
  });

  it("calcule le score de conformité et les alertes pour un SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(100) // totalUsers
      .mockResolvedValueOnce(50) // activeUsers
      .mockResolvedValueOnce(10); // inactiveUsers
    vi.mocked(prisma.auditLog.count)
      .mockResolvedValueOnce(30) // recentAuditLogs
      .mockResolvedValueOnce(5) // deletedAccounts
      .mockResolvedValueOnce(20); // recentLogins
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(2);
    vi.mocked(prisma.dataConsent.groupBy).mockResolvedValue([
      { consentType: "MARKETING", isGranted: true, _count: 3 },
      { consentType: "MARKETING", isGranted: false, _count: 1 },
    ] as never);
    vi.mocked(prisma.dataRetentionPolicy.count).mockResolvedValue(1);
    vi.mocked(prisma.dataAccessRequest.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost:3000/api/compliance/dashboard"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toMatchObject({
      totalUsers: 100,
      activeUsers: 50,
      inactiveUsers: 10,
      complianceScore: 90,
    });
    expect(body.dataRequests.pending).toBe(2);
    expect(body.consents.statistics.MARKETING).toEqual({ granted: 3, denied: 1 });
    expect(body.consents.totalTypes).toBe(1);
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].level).toBe("warning");
  });

  it("un SCHOOL_ADMIN voit un dashboard cloisonné à son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.dataConsent.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.dataRetentionPolicy.count).mockResolvedValue(0);
    vi.mocked(prisma.dataAccessRequest.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost:3000/api/compliance/dashboard"));

    expect(res.status).toBe(200);
    const auditCountArgs = vi.mocked(prisma.auditLog.count).mock.calls[0][0] as {
      where: { user: { schoolId: string } };
    };
    expect(auditCountArgs.where.user.schoolId).toBe(FIXTURES.schoolA);
    const userCountArgs = vi.mocked(prisma.user.count).mock.calls[0][0] as {
      where: { schoolId: string };
    };
    expect(userCountArgs.where.schoolId).toBe(FIXTURES.schoolA);
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.count).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/compliance/dashboard"));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      "Erreur lors de la récupération du dashboard de conformité"
    );
  });
});