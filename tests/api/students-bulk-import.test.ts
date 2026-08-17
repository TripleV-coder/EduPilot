import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/students/bulk-import/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkStudentQuota } from "@/lib/saas/quotas";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

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
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
  hash: vi.fn().mockResolvedValue("hashed"),
}));
vi.mock("@/lib/saas/quotas", () => ({
  checkStudentQuota: vi.fn().mockResolvedValue({ allowed: true, current: 10, limit: 1000 }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    studentProfile: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    class: { findFirst: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    enrollment: { create: vi.fn() },
    parentStudent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const DIRECTOR = makeSession("DIRECTOR");

const STUDENT_ROW = {
  email: "jean.dupont@school.bj",
  firstName: "Jean",
  lastName: "Dupont",
  className: "Terminale A1",
  dateOfBirth: "01/01/2005",
  gender: "M",
  birthPlace: "Cotonou",
  address: "Akpakpa",
  parentEmail: "papa.dupont@school.bj",
};

function mockTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
    const tx = prisma;
    return (fn as (t: typeof tx) => Promise<unknown>)(tx);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction();
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([]);
  vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.user.create).mockResolvedValue({ id: cuid("user1") } as never);
  vi.mocked(prisma.studentProfile.create).mockResolvedValue({ id: cuid("student1") } as never);
  vi.mocked(prisma.class.findFirst).mockResolvedValue({ id: cuid("class1") } as never);
  vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: cuid("year1") } as never);
  vi.mocked(prisma.enrollment.create).mockResolvedValue({ id: cuid("enr1") } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
});

describe("POST /api/students/bulk-import", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without STUDENT_CREATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when school context is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(400);
  });

  it("should return 400 on invalid body (empty students)", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [] } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("should return 403 when student quota is reached", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: false, current: 1000, limit: 1000, usagePercentage: 100 });
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
  });

  it("should return 403 when import would exceed quota", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: true, current: 998, limit: 1000, usagePercentage: 99.8 });
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW, STUDENT_ROW, STUDENT_ROW] } }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_WILL_EXCEED");
  });

  it("should import students with enrollment and parent link", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      parentProfile: { id: cuid("parent1") },
    } as never);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.success).toBe(1);
    expect(body.results.failed).toBe(0);
    expect(body.results.created).toEqual([`${STUDENT_ROW.firstName} ${STUDENT_ROW.lastName} (${STUDENT_ROW.email})`]);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "STUDENT", schoolId: FIXTURES.schoolA, mustChangePassword: true }),
    }));
    expect(prisma.studentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ matricule: "E00001", gender: "M" }),
    }));
    expect(prisma.class.findFirst).toHaveBeenCalled();
    expect(prisma.academicYear.findFirst).toHaveBeenCalled();
    expect(prisma.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ studentId: cuid("student1"), classId: cuid("class1"), status: "ACTIVE" }),
    }));
    expect(prisma.parentStudent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parentId: cuid("parent1"), studentId: cuid("student1"), relationship: "PARENT" }),
    }));
  });

  it("should generate sequential matricules from the last one", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ matricule: "E00042" } as never);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.success).toBe(1);
    expect(prisma.studentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ matricule: "E00043" }),
    }));
  });

  it("should skip existing emails and report failures", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ email: "jean.dupont@school.bj" }] as never);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.success).toBe(0);
    expect(body.results.failed).toBe(1);
    expect(body.results.errors).toEqual([`Email déjà utilisé: ${STUDENT_ROW.email}`]);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("should skip duplicate matricules", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([{ matricule: "E00001" }] as never);
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", {
      method: "POST",
      body: { students: [{ ...STUDENT_ROW, matricule: "E00001" }] },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.failed).toBe(1);
    expect(body.results.errors).toEqual(["Matricule déjà utilisé: E00001"]);
  });

  it("should catch row-level database errors", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.user.create).mockRejectedValueOnce(new Error("unique violation"));
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.success).toBe(0);
    expect(body.results.failed).toBe(1);
    expect(body.results.errors[0]).toContain("unique violation");
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/students/bulk-import", { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/students/bulk-import", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/students/bulk-import"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without STUDENT_CREATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/students/bulk-import"));
    expect(res.status).toBe(403);
  });

  it("should return the CSV template", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await GET(makeRequest("http://localhost/api/students/bulk-import"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("email,firstName,lastName,className");
    expect(text).toContain("jean.dupont@exemple.com");
  });
});