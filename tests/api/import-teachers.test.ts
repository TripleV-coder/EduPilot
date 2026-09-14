import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/import/teachers/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { checkTeacherQuota } from "@/lib/saas/quotas";
import { hash } from "bcryptjs";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
  hash: vi.fn().mockResolvedValue("hashed"),
}));
vi.mock("@/lib/saas/quotas", () => ({
  checkTeacherQuota: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn().mockResolvedValue(undefined),
  CACHE_PATHS: { teachers: "/api/teachers", users: "/api/users", classes: "/api/classes" },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    school: { findUnique: vi.fn() },
    teacherProfile: { create: vi.fn() },
    teacherSchoolAssignment: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const ADMIN = makeSession("SCHOOL_ADMIN");

function mockTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
    const tx = prisma;
    return (fn as (t: typeof tx) => Promise<unknown>)(tx);
  });
}

function makeBody(data: unknown[], schoolId?: string) {
  return { data, ...(schoolId ? { schoolId } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction();
  vi.mocked(prisma.school.findUnique).mockResolvedValue({ id: FIXTURES.schoolA } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.user.create).mockResolvedValue({ id: cuid("user1") } as never);
  vi.mocked(prisma.teacherProfile.create).mockResolvedValue({ id: cuid("prof1") } as never);
  vi.mocked(prisma.teacherSchoolAssignment.createMany).mockResolvedValue({ count: 1 } as never);
});

describe("POST /api/import/teachers", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-authorized roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when data is not an array", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: { data: "nope" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid data format");
  });

  it("should return 400 when more than 500 rows", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const rows = Array.from({ length: 501 }, (_, i) => ({ email: `t${i}@school.bj`, firstName: "A", lastName: "B" }));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody(rows) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Maximum 500");
  });

  it("should return 400 when no school context", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody([{ email: "t@school.bj", firstName: "A", lastName: "B" }]) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School context required");
  });

  it("should return 400 when school does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/teachers?schoolId=bad", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School not found");
  });

  it("should return 403 when teacher quota is reached", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(checkTeacherQuota).mockResolvedValue({ allowed: false, current: 50, limit: 50, usagePercentage: 100 });
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
  });

  it("should return 403 when import would exceed quota", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(checkTeacherQuota).mockResolvedValue({ allowed: true, current: 48, limit: 50, usagePercentage: 96 });
    const rows = Array.from({ length: 5 }, () => ({ email: "x@school.bj", firstName: "A", lastName: "B" }));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody(rows) }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_WILL_EXCEED");
  });

  it("should create teachers and invalidate caches", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody([
      { email: "t1@school.bj", firstName: "Jean", lastName: "Dupont", subjects: "Maths,Physique", phone: "01" },
      { email: "t2@school.bj", firstName: "Marie", lastName: "Martin" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "TEACHER", mustChangePassword: true, schoolId: FIXTURES.schoolA }),
    }));
    expect(prisma.teacherProfile.create).toHaveBeenCalledTimes(2);
    expect(prisma.teacherSchoolAssignment.createMany).toHaveBeenCalledTimes(2);
    expect(hash).toHaveBeenCalledTimes(2);
    expect(invalidateByPath).toHaveBeenCalled();
  });

  // Règle 4 (Lot 5, N47) : les trois cas suivants exigeaient l'import PARTIEL
  // (lignes valides créées, autres ignorées, 200) — le défaut corrigé. L'import
  // est désormais en tout ou rien : 422 et rien n'est écrit ; une erreur de base
  // annule toute la transaction.
  it("rejects the whole file on a validation error (422), nothing created", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody([
      { email: "not-an-email", firstName: "", lastName: "Dupont" },
      { email: "ok@school.bj", firstName: "Jean", lastName: "Dupont" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.created).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ row: 1, field: "email" }),
      expect.objectContaining({ row: 1, field: "firstName" }),
    ]);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it("rejects the file when an email is already used (422)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ email: "taken@school.bj" }] as never);
    const body = makeBody([
      { email: "new@school.bj", firstName: "Jean", lastName: "Dupont" },
      { email: "taken@school.bj", firstName: "Paul", lastName: "Biya" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.errors).toEqual([expect.objectContaining({ row: 2, field: "email" })]);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rolls back the whole import on a database error", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.user.create).mockRejectedValueOnce(new Error("connection lost"));
    const body = makeBody([{ email: "t@school.bj", firstName: "Jean", lastName: "Dupont" }]);
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body }));

    expect(res.status).toBe(500);
    expect(invalidateByPath).not.toHaveBeenCalled();
  });

  it("should accept a schoolId in body for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const body = makeBody([{ email: "t@school.bj", firstName: "Jean", lastName: "Dupont" }], cuid("schoolx"));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(1);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: cuid("schoolx") }),
    }));
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.school.findUnique).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/import/teachers", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Une erreur interne est survenue. Veuillez réessayer.");
  });
});