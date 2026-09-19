import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/teachers/route";
import { GET as GET_AVAIL, POST as POST_AVAIL, DELETE as DELETE_AVAIL } from "@/app/api/teachers/[id]/availability/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkTeacherQuota } from "@/lib/saas/quotas";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/saas/quotas", () => ({
  checkTeacherQuota: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));
vi.mock("@/lib/teachers/school-assignments", () => ({
  buildTeacherSchoolScope: vi.fn((schoolId: string) => ({ OR: [{ schoolId }] })),
  normalizeTeacherSchoolIds: vi.fn((input: { primarySchoolId?: string | null; schoolId?: string | null; additionalSchoolIds?: string[] | null }) => {
    const resolvedPrimarySchoolId = input.primarySchoolId ?? input.schoolId ?? null;
    const schoolIds = Array.from(new Set([resolvedPrimarySchoolId, ...(input.additionalSchoolIds || [])].filter((s): s is string => !!s)));
    return {
      primarySchoolId: resolvedPrimarySchoolId,
      schoolIds,
      additionalSchoolIds: resolvedPrimarySchoolId ? schoolIds.filter((s) => s !== resolvedPrimarySchoolId) : schoolIds,
    };
  }),
  buildTeacherSchoolAssignments: vi.fn((input: { teacherId: string; primarySchoolId: string; schoolIds: string[] }) =>
    Array.from(new Set([input.primarySchoolId, ...input.schoolIds])).map((schoolId) => ({
      teacherId: input.teacherId,
      schoolId,
      status: "ACTIVE",
      isPrimary: schoolId === input.primarySchoolId,
    })),
  ),
  isTeacherAssignedToSchool: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  withCache: (handler: () => unknown) => handler(),
  generateCacheKey: () => "teachers:list:test",
  invalidateByPath: vi.fn().mockResolvedValue(undefined),
  CACHE_PATHS: { teachers: "/api/teachers" },
  CACHE_TTL_MEDIUM: 120,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    school: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    teacherSchoolAssignment: { createMany: vi.fn() },
    teacherAvailability: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    appointment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

function makeTeacher(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("teach1"),
    schoolId: FIXTURES.schoolA,
    user: { firstName: "Paul", lastName: "Biya", email: "paul@test.bj", isActive: true },
    school: { id: FIXTURES.schoolA, name: "École A", code: "A" },
    classSubjects: [
      { subject: { id: cuid("subj1"), name: "Maths" } },
      { subject: { id: cuid("subj1"), name: "Maths" } },
      { subject: { id: cuid("subj2"), name: "Physique" } },
    ],
    schoolAssignments: [],
    ...overrides,
  } as never;
}

const TEACHER_CREATE_BODY = {
  email: "paul.biya@test.bj",
  firstName: "Paul",
  lastName: "Biya",
  password: "Passw0rd!123",
  primarySchoolId: FIXTURES.schoolA,
};

describe("GET /api/teachers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/teachers"));
    expect(res.status).toBe(401);
  });

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/teachers"));
    expect(res.status).toBe(403);
  });

  it("should list teachers with deduplicated subjects and pagination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findMany).mockResolvedValue([makeTeacher()]);
    vi.mocked(prisma.teacherProfile.count).mockResolvedValue(1);

    // Lot 8 : cette route passe au format de pagination unique du projet
    // (curseur keyset sur le nom) — elle était restée sur ?page= / { teachers }.
    const res = await GET(makeRequest("http://localhost/api/teachers?limit=10&search=paul&status=ACTIVE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].subjects).toHaveLength(2);
    expect(body.pagination).toEqual(expect.objectContaining({ limit: 10, hasNextPage: false, total: 1 }));
  });
});

describe("POST /api/teachers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkTeacherQuota).mockResolvedValue({ allowed: true, limit: 100 });
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should forbid multi-school creation for non-super-admin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/teachers", {
      method: "POST",
      body: { ...TEACHER_CREATE_BODY, additionalSchoolIds: [FIXTURES.schoolB] },
    }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Seul le SUPER_ADMIN peut créer un enseignant multi-établissements");
  });

  it("should return 400 when a selected school does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findMany).mockResolvedValue([]);
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(400);
  });

  it("should return 403 when teacher quota is reached", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA }] as never);
    vi.mocked(checkTeacherQuota).mockResolvedValue({ allowed: false, limit: 5 });
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("Quota d'enseignants atteint");
  });

  it("should return 400 on duplicate email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA }] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "other" } as never);
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Un utilisateur existe déjà avec cet email");
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: { firstName: "X" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("should create the teacher in a transaction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA }] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue({ id: cuid("usernew") }) },
        teacherProfile: { create: vi.fn().mockResolvedValue({ id: cuid("teachnew"), userId: cuid("usernew"), schoolId: FIXTURES.schoolA }) },
        teacherSchoolAssignment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.profile.id).toBe(cuid("teachnew"));
    const { invalidateByPath } = await import("@/lib/api/cache-helpers");
    expect(invalidateByPath).toHaveBeenCalledWith("/api/teachers");
  });

  it("should return 500 on unexpected database error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findMany).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/teachers", { method: "POST", body: TEACHER_CREATE_BODY }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/teachers/[id]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when teacher profile missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await GET_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);
    const res = await GET_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should return availabilities and booked slots", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherAvailability.findMany).mockResolvedValue([{ id: "av1", dayOfWeek: 1, startTime: "08:00", endTime: "10:00", isActive: true }] as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ scheduledAt: new Date(), duration: 30 }] as never);

    const res = await GET_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.availabilities).toHaveLength(1);
    expect(body.bookedSlots).toHaveLength(1);
  });
});

describe("POST /api/teachers/[id]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  const slot = { dayOfWeek: 1, startTime: "08:00", endTime: "10:00" };

  it("should return 404 when teacher profile missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: slot }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid a teacher who is not the owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "someone-else", schoolId: FIXTURES.schoolA } as never);
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: slot }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid slot", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "u1", schoolId: FIXTURES.schoolA } as never);
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: { ...slot, startTime: "25:00" } }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(400);
  });

  it("should reject overlapping availability", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "u1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherAvailability.findFirst).mockResolvedValue({ id: "av1" } as never);
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: slot }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Ce créneau chevauche une disponibilité existante");
  });

  it("should create the availability slot", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "u1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherAvailability.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.teacherAvailability.create).mockResolvedValue({ id: "av1", dayOfWeek: 1 } as never);
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: slot }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("av1");
  });

  it("should return 500 on unexpected database error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "u1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherAvailability.create).mockRejectedValue(new Error("db down"));
    const res = await POST_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability", { method: "POST", body: slot }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/teachers/[id]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 400 when availabilityId is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await DELETE_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when teacher profile missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await DELETE_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability?availabilityId=av1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid a teacher who is not the owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "someone-else", schoolId: FIXTURES.schoolA } as never);
    const res = await DELETE_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability?availabilityId=av1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(403);
  });

  it("should delete the availability slot", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ userId: "u1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherAvailability.delete).mockResolvedValue({ id: "av1" } as never);
    const res = await DELETE_AVAIL(makeRequest("http://localhost/api/teachers/t1/availability?availabilityId=av1"), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
    expect(prisma.teacherAvailability.delete).toHaveBeenCalledWith({ where: { id: "av1" } });
  });
});