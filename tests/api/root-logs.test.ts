import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/root/logs/route";

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

function logRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("log1"),
    action: "DELETE",
    entity: "Payment",
    entityId: cuid("pay1"),
    ipAddress: "10.0.0.1",
    createdAt: new Date("2026-01-01"),
    user: { id: cuid("u1"), email: "admin@a.bj", firstName: "Awa", lastName: "Dossou" },
    school: { id: FIXTURES.schoolA, name: "École A" },
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/root/logs", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/root/logs"));
    expect(res.status).toBe(401);
  });

  it("refuse un compte non-root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost:3000/api/root/logs"));
    expect(res.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("liste les journaux d'audit (paginé)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([logRecord()]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/root/logs"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entity).toBe("Payment");
    expect(body.pagination.total).toBe(1);
  });

  it("applique les filtres search / action / entity / schoolId", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/root/logs?search=pay&action=DELETE&entity=Payment&schoolId=" +
          FIXTURES.schoolA
      )
    );

    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(where.where.action).toBe("DELETE");
    expect(where.where.entity).toBe("Payment");
    expect(where.where.schoolId).toBe(FIXTURES.schoolA);
    expect(where.where.OR).toBeDefined();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/root/logs"));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des journaux d'audit");
  });
});