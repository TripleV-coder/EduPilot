import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/schedules/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/teachers/school-assignments", () => ({
  isTeacherAssignedToSchool: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    teacherProfile: { findUnique: vi.fn() },
    classSubject: { findMany: vi.fn(), findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    schedule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: "sch1",
    classId: cuid("class1"),
    classSubjectId: cuid("cs1"),
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "10:00",
    room: "Salle 1",
    ...overrides,
  } as never;
}

describe("GET /api/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/schedules"));
    expect(res.status).toBe(401);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/schedules"));
    expect(res.status).toBe(403);
  });

  it("should list schedules for the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.schedule.findMany).mockResolvedValue([makeSchedule()]);
    const res = await GET(makeRequest("http://localhost/api/schedules?dayOfWeek=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("should return 404 when the teacher does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/schedules?teacherId=t1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Enseignant introuvable");
  });

  it("should forbid schedules of a teacher outside the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);
    const res = await GET(makeRequest("http://localhost/api/schedules?teacherId=t1"));
    expect(res.status).toBe(403);
  });

  it("should filter schedules by teacher", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([{ id: cuid("cs1") }] as never);
    vi.mocked(prisma.schedule.findMany).mockResolvedValue([makeSchedule()]);
    const res = await GET(makeRequest("http://localhost/api/schedules?teacherId=t1"));
    expect(res.status).toBe(200);
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ classSubjectId: { in: [cuid("cs1")] } }) }),
    );
  });
});

describe("POST /api/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  const body = {
    classId: cuid("class1"),
    classSubjectId: cuid("cs1"),
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "10:00",
    room: "Salle 1",
  };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("should return 400 VALIDATION_ERROR on invalid body (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body: { ...body, startTime: "10:00", endTime: "08:00" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 404 when the class does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should return 404 when the class subject does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Matière de classe introuvable");
  });

  it("should return 400 when the class subject belongs to another class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ classId: cuid("class2"), teacherId: null, class: { schoolId: FIXTURES.schoolA } } as never);
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cette matière n'appartient pas à la classe sélectionnée");
  });

  it("should forbid a class subject from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ classId: cuid("class1"), teacherId: null, class: { schoolId: FIXTURES.schoolB } } as never);
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on class time conflict", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ classId: cuid("class1"), teacherId: null, class: { schoolId: FIXTURES.schoolA } } as never);
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue(makeSchedule());
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(400);
  });

  it("should return 400 on teacher time conflict", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ classId: cuid("class1"), teacherId: cuid("teach1"), class: { schoolId: FIXTURES.schoolA } } as never);
    vi.mocked(prisma.schedule.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(makeSchedule());
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(400);
  });

  it("should create the schedule slot", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ classId: cuid("class1"), teacherId: null, class: { schoolId: FIXTURES.schoolA } } as never);
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.schedule.create).mockResolvedValue(makeSchedule());
    const res = await POST(makeRequest("http://localhost/api/schedules", { method: "POST", body }));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    expect(resBody.id).toBe("sch1");
  });
});