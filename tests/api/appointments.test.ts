import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/appointments/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/teachers/school-assignments", () => ({
  isTeacherAssignedToSchool: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentStudent: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

describe("GET /api/appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/appointments"));
    expect(res.status).toBe(401);
  });

  it("should scope a teacher to their own appointments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1" } as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);

    const res = await GET(makeRequest("http://localhost/api/appointments"));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as { where: { teacherId: string } };
    expect(call.where.teacherId).toBe("tp1");
  });

  it("should scope a student to their own appointments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "sp1" } as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/appointments"));
    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as { where: { studentId: string } };
    expect(call.where.studentId).toBe("sp1");
  });

  it("should filter by status and upcoming", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/appointments?status=CONFIRMED&upcoming=true"));
    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as { where: { status: object; scheduledAt: object } };
    expect(call.where.status).toEqual({ in: ["PENDING", "CONFIRMED"] });
    expect(call.where.scheduledAt).toBeDefined();
  });

  it("should enforce multi-tenant isolation for admins", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/appointments"));
    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as { where: { teacher: object } };
    expect(call.where.teacher).toEqual({
      OR: [
        { schoolId: FIXTURES.schoolA },
        { schoolAssignments: { some: { schoolId: FIXTURES.schoolA, status: "ACTIVE" } } },
      ],
    });
  });
});

describe("POST /api/appointments", () => {
  const validBody = {
    teacherId: FIXTURES.schoolA,
    parentId: FIXTURES.schoolB,
    studentId: FIXTURES.studentA,
    scheduledAt: "2026-10-05T10:00:00Z",
    duration: 30,
    type: "IN_PERSON",
  };

  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-parent roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("should return 404 when teacher not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
  });

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1" } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access to the student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1" } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolB, userId: "u9" } as never);
    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("should reject when the parent is not linked to the student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u1" }));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1", userId: "u5", schoolAssignments: [] } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA, userId: "u9" } as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: FIXTURES.schoolB } as never);
    vi.mocked(prisma.parentStudent.findFirst).mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(400);
  });

  it("should reject conflicting appointments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u1" }));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1", userId: "u5", schoolAssignments: [] } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA, userId: "u9" } as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: FIXTURES.schoolB } as never);
    vi.mocked(prisma.parentStudent.findFirst).mockResolvedValue({ id: "ps1" } as never);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "ap1" } as never);

    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: validBody }));
    expect(res.status).toBe(400);
  });

  it("should create the appointment, generate a meeting link and notify", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u1" }));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1", userId: "u5", schoolAssignments: [] } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA, userId: "u9" } as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: FIXTURES.schoolB } as never);
    vi.mocked(prisma.parentStudent.findFirst).mockResolvedValue({ id: "ps1" } as never);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: "ap1",
      teacher: { user: { id: "u5", firstName: "T", lastName: "E" } },
      parent: { user: { id: "u1", firstName: "P", lastName: "A" } },
      student: { user: { id: "u9", firstName: "S", lastName: "T" } },
    } as never);

    const res = await POST(makeRequest("http://localhost/api/appointments", {
      method: "POST",
      body: { ...validBody, type: "VIDEO_CALL" },
    }));
    expect(res.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const createCall = vi.mocked(prisma.appointment.create).mock.calls[0][0] as { data: { meetingLink?: string } };
    expect(createCall.data.meetingLink).toMatch(/^https:\/\/meet\.edupilot\.app\//);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/appointments", { method: "POST", body: { teacherId: "x" } }));
    expect(res.status).toBe(400);
  });
});