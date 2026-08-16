import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_EXPORT } from "@/app/api/audit-logs/export/route";
import { PATCH, DELETE } from "@/app/api/alumni/[id]/route";
import { GET as GET_BENCH } from "@/app/api/benchmark/latest/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return new MockNextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn() },
    alumni: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    benchmarkSnapshot: { findFirst: vi.fn() },
  },
}));

describe("GET /api/audit-logs/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET_EXPORT(makeRequest("http://localhost/api/audit-logs/export"));
    expect(res.status).toBe(403);
  });

  it("should export a CSV with CSV-injection protection", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: "l1",
        createdAt: new Date("2026-08-10T10:00:00Z"),
        action: "LOGIN",
        entity: "User",
        entityId: "u1",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla",
        user: { firstName: "Jean", lastName: "Dupont", email: "jean@test.fr", role: "TEACHER" },
      },
      {
        id: "l2",
        createdAt: new Date("2026-08-11T10:00:00Z"),
        action: "DELETE",
        entity: "User",
        entityId: null,
        ipAddress: "",
        userAgent: "",
        user: { firstName: "=SUM(A1)", lastName: "X", email: "x@test.fr", role: "ADMIN" },
      },
    ] as never);

    const res = await GET_EXPORT(makeRequest("http://localhost/api/audit-logs/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("Date,Utilisateur,Email,Role,Action");
    expect(csv).toContain("'=SUM(A1)");
  });

  it("should scope SCHOOL_ADMIN exports to their school users", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }, { id: "u2" }] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

    await GET_EXPORT(makeRequest("http://localhost/api/audit-logs/export?action=LOGIN"));
    const call = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0] as { where: { userId: object; action?: object } };
    expect(call.where.userId).toEqual({ in: ["u1", "u2"] });
    expect(call.where.action).toEqual({ contains: "LOGIN", mode: "insensitive" });
  });

  it("should forbid a SCHOOL_ADMIN from exporting another school's user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }] as never);

    const res = await GET_EXPORT(makeRequest("http://localhost/api/audit-logs/export?userId=u2"));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/alumni/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when alumni not found or cross-school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.alumni.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/alumni/a1", { method: "PATCH", body: { firstName: "Jean" } }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(404);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.alumni.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA } as never);
    const res = await PATCH(makeRequest("http://localhost/api/alumni/a1", { method: "PATCH", body: { graduationYear: 1800 } }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(400);
  });

  it("should update alumni and normalize empty email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.alumni.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.alumni.update).mockResolvedValue({ id: "a1", firstName: "Jean" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/alumni/a1", { method: "PATCH", body: { firstName: "Jean", email: "" } }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(200);
    expect(prisma.alumni.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: null }) })
    );
  });
});

describe("DELETE /api/alumni/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should delete alumni and write an audit log", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.alumni.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA } as never);

    const res = await DELETE(makeRequest("http://localhost/api/alumni/a1", { method: "DELETE" }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(200);
    expect(prisma.alumni.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("GET /api/benchmark/latest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET_BENCH(makeRequest("http://localhost/api/benchmark/latest"));
    expect(res.status).toBe(403);
  });

  it("should return null snapshot when none exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.benchmarkSnapshot.findFirst).mockResolvedValue(null);
    const res = await GET_BENCH(makeRequest("http://localhost/api/benchmark/latest"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot).toBeNull();
  });

  it("should return the latest snapshot with indicators", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.benchmarkSnapshot.findFirst).mockResolvedValue({
      id: "b1",
      capturedAt: new Date("2026-08-01T00:00:00Z"),
      periodLabel: "2025-2026",
      rankNational: 12,
      rankDept: 3,
      rankPeerGroup: 2,
      totalNational: 100,
      totalDept: 20,
      totalPeer: 10,
      scoreOverall: 78.5,
      indicators: [
        { id: "i1", label: "Taux de réussite", schoolValue: 92, nationalValue: 85, departmentValue: 87, peerValue: 90, unit: "%", tone: "GOOD" },
      ],
    } as never);

    const res = await GET_BENCH(makeRequest("http://localhost/api/benchmark/latest"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot.indicators).toHaveLength(1);
    expect(body.snapshot.scoreOverall).toBe(78.5);
  });
});