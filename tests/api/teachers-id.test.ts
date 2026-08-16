import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/teachers/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/teachers/school-assignments", () => ({
  isTeacherAssignedToSchool: vi.fn().mockResolvedValue(true),
  normalizeTeacherSchoolIds: vi.fn((args: { primarySchoolId: string }) => ({ primarySchoolId: args.primarySchoolId, schoolIds: [args.primarySchoolId] })),
  buildTeacherSchoolAssignments: vi.fn(() => []),
}));
vi.mock("@/lib/saas/quotas", () => ({
  checkTeacherQuota: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findUnique: vi.fn(), update: vi.fn() },
    schedule: { findMany: vi.fn() },
    school: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

function makeTeacher(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    userId: "u1",
    schoolId: FIXTURES.schoolA,
    deletedAt: null,
    user: { id: "u1", email: "prof@test.fr" },
    school: { id: FIXTURES.schoolA, name: "École A", code: "A" },
    classSubjects: [],
    mainClasses: [],
    schoolAssignments: [],
    ...overrides,
  } as never;
}

describe("GET /api/teachers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/teachers/t1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when teacher not found or deleted", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/teachers/t1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);

    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher({ deletedAt: new Date() }));
    const res2 = await GET(makeRequest("http://localhost/api/teachers/t1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res2.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher());
    const { isTeacherAssignedToSchool } = await import("@/lib/teachers/school-assignments");
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);

    const res = await GET(makeRequest("http://localhost/api/teachers/t1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should return the teacher with deduplicated subjects, classes and schedule", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher({
      classSubjects: [
        { id: "cs1", subject: { id: "s1", name: "Maths", code: "MAT", coefficient: 3 }, class: { id: "cl1", name: "6A", schoolId: FIXTURES.schoolA, classLevel: { id: "l1", name: "Sixième", level: "COLLEGE" }, _count: { enrollments: 25 } } },
        { id: "cs2", subject: { id: "s1", name: "Maths", code: "MAT", coefficient: 3 }, class: { id: "cl2", name: "5A", schoolId: FIXTURES.schoolA, classLevel: { id: "l2", name: "Cinquième", level: "COLLEGE" }, _count: { enrollments: 30 } } },
      ],
      schoolAssignments: [{ id: "sa1", schoolId: FIXTURES.schoolA, isPrimary: true, status: "ACTIVE", school: { id: FIXTURES.schoolA, name: "École A", code: "A" } }],
    }));
    vi.mocked(prisma.schedule.findMany).mockResolvedValue([{ id: "sch1", dayOfWeek: 1 }] as never);

    const res = await GET(makeRequest("http://localhost/api/teachers/t1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subjects).toHaveLength(1);
    expect(body.classes).toHaveLength(2);
    expect(body.schedules).toHaveLength(1);
  });
});

describe("PATCH /api/teachers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { firstName: "Paul" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when teacher missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { firstName: "Paul" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("should reject duplicate emails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher());
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA }] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "other" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { email: "taken@test.fr" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(400);
  });

  it("should forbid non-super-admin school reassignment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher());
    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { primarySchoolId: FIXTURES.schoolB } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should update the teacher in a transaction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher());
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA }] as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        user: { update: vi.fn() },
        teacherProfile: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: "t1", schoolAssignments: [] }),
        },
        teacherSchoolAssignment: { updateMany: vi.fn(), upsert: vi.fn() },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { firstName: "Paul" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher());
    const res = await PATCH(makeRequest("http://localhost/api/teachers/t1", { method: "PATCH", body: { firstName: "X" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/teachers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should soft-delete the teacher and archive assignments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher({
      schoolAssignments: [{ schoolId: FIXTURES.schoolA }],
    }));
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        classSubject: { updateMany: vi.fn() },
        class: { updateMany: vi.fn() },
        teacherAvailability: { deleteMany: vi.fn() },
        teacherSchoolAssignment: { updateMany: vi.fn() },
        teacherProfile: { update: vi.fn() },
        user: { update: vi.fn() },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await DELETE(makeRequest("http://localhost/api/teachers/t1", { method: "DELETE" }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("should require SUPER_ADMIN for multi-school teachers", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(makeTeacher({
      schoolId: FIXTURES.schoolA,
      schoolAssignments: [{ schoolId: FIXTURES.schoolB }],
    }));

    const res = await DELETE(makeRequest("http://localhost/api/teachers/t1", { method: "DELETE" }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });
});