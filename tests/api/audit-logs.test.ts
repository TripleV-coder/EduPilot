import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditLog, User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/audit-logs/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/audit-logs", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(makeRequest("http://localhost:3000/api/audit-logs"));
    expect(response.status).toBe(401);
  });

  it("refuse un TEACHER (réservé aux admins)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));

    const response = await GET(makeRequest("http://localhost:3000/api/audit-logs"));
    expect(response.status).toBe(403);
  });

  it("rejette une plage de dates invalide (400) sans toucher la DB", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));

    const response = await GET(
      makeRequest("http://localhost:3000/api/audit-logs?startDate=garbage")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Plage de dates invalide");
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("rejette startDate postérieure à endDate (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/audit-logs?startDate=2026-02-01&endDate=2026-01-01"
      )
    );
    expect(response.status).toBe(400);
  });

  it("filtre par plage de dates valide et pagine", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      { id: cuid("log1"), action: "CREATE", entity: "Payment" },
    ] as unknown as AuditLog[]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/audit-logs?startDate=2026-01-01&endDate=2026-01-31&page=1&limit=10"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    expect(vi.mocked(prisma.auditLog.findMany).mock.calls[0][0].where.createdAt).toEqual({
      gte: new Date("2026-01-01"),
      lte: new Date("2026-01-31"),
    });
  });

  it("un SCHOOL_ADMIN ne voit que les logs des utilisateurs de son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const schoolUserId = cuid("userecolea");
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: schoolUserId }] as unknown as User[]);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as unknown as AuditLog[]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    const response = await GET(makeRequest("http://localhost:3000/api/audit-logs"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0].where).toEqual({
      schoolId: FIXTURES.schoolA,
    });
    expect(vi.mocked(prisma.auditLog.findMany).mock.calls[0][0].where.userId).toEqual({
      in: [schoolUserId],
    });
  });
});
