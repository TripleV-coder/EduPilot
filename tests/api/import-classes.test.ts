import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/import/classes/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn().mockResolvedValue(undefined),
  CACHE_PATHS: { classes: "/api/classes" },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    school: { findUnique: vi.fn() },
    class: { findMany: vi.fn(), create: vi.fn() },
    classLevel: { findMany: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    teacherSchoolAssignment: { findFirst: vi.fn() },
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
  vi.mocked(prisma.classLevel.findMany).mockResolvedValue([{ id: cuid("level1"), code: "6EME", name: "Sixième" }] as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.class.findMany).mockResolvedValue([]);
  vi.mocked(prisma.class.create).mockResolvedValue({ id: cuid("class1") } as never);
});

// Règle 4 (Lot 5, N47) : les cas « niveau manquant créé », « enseignant
// inconnu → classe sans titulaire », « doublon ignoré » et « erreurs de
// validation → 200 » exigeaient l'import PARTIEL ou des données inventées
// (niveau créé en PRIMARY) — les défauts corrigés. Import en tout ou rien : 422,
// rien d'écrit. Les requêtes par ligne (findFirst) sont remplacées par des
// lectures groupées (findMany).
describe("POST /api/import/classes", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-authorized roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when data is not an array", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: { data: 42 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid data format");
  });

  it("should return 400 when more than 500 rows", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const rows = Array.from({ length: 501 }, () => ({ name: "6ème A", level: "6EME" }));
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody(rows) }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when no school context", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School context required");
  });

  it("should create classes on existing levels (by code or name)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody([
      { name: "6ème A", level: "6EME", capacity: 35 },
      { name: "6ème B", level: "sixième", capacity: 30 },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(prisma.class.create).toHaveBeenCalledTimes(2);
    expect(prisma.class.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: FIXTURES.schoolA, classLevelId: cuid("level1"), capacity: 35 }),
    }));
    expect(invalidateByPath).toHaveBeenCalled();
  });

  it("rejects an unknown level instead of creating it as primary (422)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([{ name: "5ème A", level: "5EME" }]) }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.errors).toEqual([expect.objectContaining({ row: 1, field: "level" })]);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("should assign the main teacher when found and assigned to school", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { email: "t@school.bj", teacherProfile: { id: cuid("prof1") } },
    ] as never);
    vi.mocked(prisma.teacherSchoolAssignment.findFirst).mockResolvedValue({ id: cuid("asg1") } as never);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([{ name: "6ème C", level: "6EME", mainTeacherEmail: "T@school.bj" }]) }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.created).toBe(1);
    expect(prisma.class.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mainTeacherId: cuid("prof1") }),
    }));
  });

  it("rejects an unknown main teacher instead of a class without one (422)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([{ name: "6ème D", level: "6EME", mainTeacherEmail: "ghost@school.bj" }]) }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.errors).toEqual([expect.objectContaining({ row: 1, field: "mainTeacherEmail" })]);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate class names, in the file and in the school (422)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.class.findMany).mockResolvedValue([{ name: "6ème Z" }] as never);
    const body = makeBody([
      { name: "6ème A", level: "6EME" },
      { name: "6ème A", level: "6EME" },
      { name: "6ème Z", level: "6EME" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.errors.map((e: { row: number }) => e.row)).toEqual([1, 2, 3]);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("rejects the whole file on a validation error (422)", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody([
      { name: "", level: "6EME" },
      { name: "6ème E", level: "6EME" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(422);
    expect(result.created).toBe(0);
    expect(result.errors).toEqual([expect.objectContaining({ row: 1, field: "name" })]);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.school.findUnique).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/import/classes", { method: "POST", body: makeBody([]) }));
    expect(res.status).toBe(500);
  });
});
