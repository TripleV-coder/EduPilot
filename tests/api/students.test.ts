import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/students/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/students/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";
import { checkStudentQuota } from "@/lib/saas/quotas";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed") } }));
vi.mock("@/lib/saas/quotas", () => ({
  checkStudentQuota: vi.fn().mockResolvedValue({ allowed: true, limit: 1000 }),
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn(),
  CACHE_PATHS: { students: "students" },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    studentProfile: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    class: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    enrollment: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const CREATE_BODY = {
  email: "new.student@test.fr",
  firstName: "Jean",
  lastName: "Dupont",
  phone: "+229 01 23 45 67",
  password: "Passw0rd123",
  matricule: "MAT-2026-001",
  dateOfBirth: "2012-05-10",
  gender: "MALE",
  classId: FIXTURES.schoolA,
  academicYearId: FIXTURES.schoolB,
};

describe("GET /api/students", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/students"));
    expect(res.status).toBe(401);
  });

  it("should list students with pagination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
      { id: "s1", matricule: "MAT-1", user: { id: "u1", email: "a@b.fr", firstName: "Jean", lastName: "Dupont", isActive: true, schoolId: FIXTURES.schoolA }, enrollments: [] },
    ] as never);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost/api/students?page=1&limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("should scope a parent to their children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as never);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/students"));
    const call = vi.mocked(prisma.studentProfile.findMany).mock.calls[0][0] as { where: { id: object } };
    expect(call.where.id).toEqual({ in: [FIXTURES.studentA] });
  });

  it("should return an empty page for a parent without children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [] } as never);

    const res = await GET(makeRequest("http://localhost/api/students"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("should filter by search and classId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: "ay1" } as never);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/students?search=Dupont&classId=cl1"));
    const call = vi.mocked(prisma.studentProfile.findMany).mock.calls[0][0] as { where: { OR?: object[]; enrollments: object } };
    expect(call.where.OR).toBeDefined();
    expect(call.where.enrollments).toBeDefined();
  });
});

describe("POST /api/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: true, limit: 1000 });
  });

  it("should return 403 when the school is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 404 when the class is not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(404);
  });

  it("should reject a class from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1", schoolId: FIXTURES.schoolB } as never);
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(400);
  });

  it("should enforce the student quota", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: false, limit: 100 });
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(expect.objectContaining({ code: "QUOTA_EXCEEDED" }));
  });

  it("should reject a duplicate email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(400);
  });

  it("should create the student, profile and enrollment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: "u1" }));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue({ id: "u1", email: "new.student@test.fr", firstName: "Jean", lastName: "Dupont" }) },
        studentProfile: { create: vi.fn().mockResolvedValue({ id: "s1", matricule: "MAT-2026-001" }) },
        enrollment: { create: vi.fn() },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: CREATE_BODY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("s1");
    expect(body.user.email).toBe("new.student@test.fr");
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/students", { method: "POST", body: { email: "bad" } }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/students/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET_ONE(makeRequest("http://localhost/api/students/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      user: { schoolId: FIXTURES.schoolB },
    } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/students/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(403);
  });

  it("should forbid a parent accessing another child", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: "other" }] } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/students/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(403);
  });

  it("should return the student for an authorized teacher", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/students/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/students/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/students/s1", { method: "PATCH", body: { firstName: "Jean" } }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(403);
  });

  it("should update the student profile and enrollment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: FIXTURES.schoolB, schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        user: { update: vi.fn() },
        studentProfile: { update: vi.fn().mockResolvedValue({ id: "s1" }) },
        enrollment: {
          findFirst: vi.fn().mockResolvedValue({ id: "e1" }),
          update: vi.fn(),
        },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await PATCH(makeRequest("http://localhost/api/students/s1", {
      method: "PATCH",
      body: { firstName: "Jeanne", classId: FIXTURES.schoolB, isActive: false },
    }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    const { invalidateByPath } = await import("@/lib/api/cache-helpers");
    expect(invalidateByPath).toHaveBeenCalled();
  });

  it("should return 404 when the target class is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/students/s1", { method: "PATCH", body: { classId: FIXTURES.schoolB } }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/students/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should soft-delete the student (deactivate user)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      user: { schoolId: FIXTURES.schoolA },
    } as never);

    const res = await DELETE(makeRequest("http://localhost/api/students/s1", { method: "DELETE" }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deactivated).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });
});