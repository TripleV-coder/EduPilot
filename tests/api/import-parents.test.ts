import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/import/parents/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { hash } from "bcryptjs";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
  hash: vi.fn().mockResolvedValue("hashed"),
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn().mockResolvedValue(undefined),
  CACHE_PATHS: { users: "/api/users" },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    school: { findUnique: vi.fn() },
    parentProfile: { create: vi.fn() },
    studentProfile: { findMany: vi.fn() },
    parentStudent: { create: vi.fn() },
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
  vi.mocked(prisma.parentProfile.create).mockResolvedValue({ id: cuid("parent1") } as never);
  vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([]);
  vi.mocked(prisma.parentStudent.create).mockResolvedValue({} as never);
});

describe("POST /api/import/parents", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-authorized roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when data is not an array", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body: { data: {} } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid data format");
  });

  it("should return 400 when more than 500 rows", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const rows = Array.from({ length: 501 }, () => ({ email: "p@school.bj", firstName: "A", lastName: "B", phone: "01" }));
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body: makeBody(rows) }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when no school context", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School context required");
  });

  it("should return 400 when school does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/parents?schoolId=bad", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School not found");
  });

  it("should create parents and link children matricules", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
      { id: cuid("student1"), matricule: "E00001" },
      { id: cuid("student2"), matricule: "E00002" },
    ] as never);
    const body = makeBody([
      {
        email: "parent1@school.bj",
        firstName: "Paul",
        lastName: "Biya",
        phone: "+229 01 23 45 67",
        job: "Commerçant",
        childrenMatricules: "E00001, E00002",
      },
      {
        email: "parent2@school.bj",
        firstName: "Awa",
        lastName: "Soumaré",
        phone: "+229 98 76 54 32",
      },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "PARENT", schoolId: FIXTURES.schoolA, mustChangePassword: true }),
    }));
    expect(prisma.parentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ profession: "Commerçant" }),
    }));
    expect(prisma.studentProfile.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.parentStudent.create).toHaveBeenCalledTimes(2);
    expect(prisma.parentStudent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ relationship: "PARENT", isPrimary: true }),
    }));
    expect(hash).toHaveBeenCalledTimes(2);
    expect(invalidateByPath).toHaveBeenCalled();
  });

  // Règle 4 (Lot 5, N47) : les trois cas suivants exigeaient l'import PARTIEL
  // (200, lignes valides créées) — le défaut corrigé. Tout ou rien : 422, rien
  // d'écrit ; une erreur de base annule toute la transaction.
  it("rejects the whole file on a validation error (phone required, email format)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody([
      { email: "bad-email", firstName: "Paul", lastName: "Biya" },
      { email: "ok@school.bj", firstName: "Awa", lastName: "Soumaré", phone: "01" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.created).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ row: 1, field: "email" }),
      expect.objectContaining({ row: 1, field: "phone" }),
    ]);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects the file when an email is already used, or a child matricule is unknown", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ email: "taken@school.bj" }] as never);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([{ id: cuid("student1"), matricule: "E00001" }] as never);
    const body = makeBody([
      { email: "new@school.bj", firstName: "Paul", lastName: "Biya", phone: "01", childrenMatricules: "E00001, E99999" },
      { email: "taken@school.bj", firstName: "Awa", lastName: "Soumaré", phone: "02" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.errors).toEqual([
      expect.objectContaining({ row: 1, field: "childrenMatricules" }),
      expect.objectContaining({ row: 2, field: "email" }),
    ]);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(invalidateByPath).not.toHaveBeenCalled();
  });

  it("rolls back the whole import on a database error", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.user.create).mockRejectedValueOnce(new Error("constraint violation"));
    const body = makeBody([{ email: "p@school.bj", firstName: "Paul", lastName: "Biya", phone: "01" }]);
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body }));

    expect(res.status).toBe(500);
    expect(invalidateByPath).not.toHaveBeenCalled();
  });

  it("should accept a schoolId in body for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const body = makeBody([{ email: "p@school.bj", firstName: "Paul", lastName: "Biya", phone: "01" }], cuid("schoolx"));
    const res = await POST(makeRequest("http://localhost/api/import/parents", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(1);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: cuid("schoolx") }),
    }));
  });
});