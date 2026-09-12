import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/class-subjects/route";
import { POST as POST_BATCH } from "@/app/api/class-subjects/batch/route";
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
    classSubject: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
  },
}));

function makeClassSubject(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("cs1"),
    classId: cuid("class1"),
    subjectId: cuid("subj1"),
    teacherId: null,
    coefficient: 3,
    weeklyHours: 4,
    ...overrides,
  } as never;
}

const ASSIGNMENT_BODY = {
  classId: cuid("class1"),
  subjectId: cuid("subj1"),
  teacherId: cuid("teach1"),
  coefficient: 3,
  weeklyHours: 4,
};

describe("GET /api/class-subjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/class-subjects"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SUBJECT_READ permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/class-subjects"));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/class-subjects"));
    expect(res.status).toBe(403);
  });

  it("should return 404 when the teacher does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/class-subjects?teacherId=t1"));
    expect(res.status).toBe(404);
  });

  it("should forbid class subjects of a teacher outside the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);
    const res = await GET(makeRequest("http://localhost/api/class-subjects?teacherId=t1"));
    expect(res.status).toBe(403);
  });

  it("should list class subjects with filters", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([makeClassSubject()]);
    const res = await GET(makeRequest("http://localhost/api/class-subjects?classId=cl1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.classSubject.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ classId: "cl1" }) }));
  });
});

describe("POST /api/class-subjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SUBJECT_UPDATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(403);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("should return 400 VALIDATION_ERROR on invalid body (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: { classId: "bad" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when the class does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should return 404 when the subject does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Matière introuvable");
  });

  it("should forbid a subject from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 404 when the teacher does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Enseignant introuvable");
  });

  it("should forbid a teacher not assigned to the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when the assignment already exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(makeClassSubject());
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(400);
  });

  it("should create the class subject", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.classSubject.create).mockResolvedValue(makeClassSubject());
    const res = await POST(makeRequest("http://localhost/api/class-subjects", { method: "POST", body: ASSIGNMENT_BODY }));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    expect(resBody.id).toBe(cuid("cs1"));
  });
});

describe("POST /api/class-subjects/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
  });

  const batchBody = { assignments: [ASSIGNMENT_BODY] };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SUBJECT_UPDATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(403);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("should return 400 VALIDATION_ERROR on empty assignments (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: { assignments: [] } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when the class does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should return 404 when the subject does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(404);
  });

  it("should forbid a subject from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);
    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(403);
  });

  it("should create new assignments and sync the class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.classSubject.create).mockResolvedValue(makeClassSubject());

    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ ok: true, processedClassCount: 1 });
    expect(prisma.classSubject.create).toHaveBeenCalled();
    expect(prisma.classSubject.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classId: cuid("class1"), subjectId: { notIn: [cuid("subj1")] } } }),
    );
  });

  it("should update existing assignments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(makeClassSubject());
    vi.mocked(prisma.classSubject.update).mockResolvedValue(makeClassSubject());

    const res = await POST_BATCH(makeRequest("http://localhost/api/class-subjects/batch", { method: "POST", body: batchBody }));
    expect(res.status).toBe(200);
    expect(prisma.classSubject.update).toHaveBeenCalled();
    expect(prisma.classSubject.create).not.toHaveBeenCalled();
  });
});