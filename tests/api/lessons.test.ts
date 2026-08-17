import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { Lesson, StudentProfile, LessonCompletion } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    courseEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    lessonCompletion: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), delete: vi.fn() },
    notification: { create: vi.fn() },
    classSubject: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST, DELETE } from "@/app/api/lessons/[id]/complete/route";

const lessonId = cuid("lesson1");
const courseId = cuid("cours1");
const moduleId = cuid("module1");
const classId = cuid("classe6a");
const classSubjectId = cuid("classsubj1");
const studentId = cuid("studenta");
const teacherProfileId = cuid("teacher1");
const routeParams = { params: Promise.resolve({ id: lessonId }) };
const route = `http://localhost:3000/api/lessons/${lessonId}/complete`;

function lessonFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: lessonId,
    title: "Leçon 1",
    type: "TEXT",
    module: {
      id: moduleId,
      course: {
        id: courseId,
        title: "Cours de mathématiques",
        classSubjectId,
        classSubject: {
          teacherId: teacherProfileId,
          teacher: { id: teacherProfileId, user: { id: cuid("userteacher") } },
        },
        modules: [
          { lessons: [{ id: lessonId }, { id: cuid("lesson2") }] },
          { lessons: [{ id: cuid("lesson3") }] },
        ],
      },
    },
    ...overrides,
  };
}

/**
 * lesson.findUnique sert au guard tenant (select schoolId imbriqué) puis au
 * handler (include complet).
 */
function mockLessonFindUnique(record: ReturnType<typeof lessonFixture> | null) {
  vi.mocked(prisma.lesson.findUnique).mockImplementation(async (args: Prisma.LessonFindUniqueArgs) => {
    if (args?.select) {
      if (!record) return null;
      return {
        module: {
          course: {
            classSubject: { class: { schoolId: FIXTURES.schoolA } },
          },
        },
      } as unknown as Lesson;
    }
    return record as unknown as Lesson;
  });
}

function studentSession() {
  return makeSession("STUDENT", { id: studentId, schoolId: FIXTURES.schoolA });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lessons/[id]/complete", () => {
  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 sans profil étudiant", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("retourne 404 si la leçon n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("refuse un élève non inscrit au cours (403)", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Vous devez être inscrit à ce cours");
  });

  it("rejette une leçon déjà complétée (400)", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ id: cuid("ce1") } as never);
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue({
      id: cuid("lc1"),
      lessonId,
      studentId,
    } as unknown as LessonCompletion);
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Leçon déjà complétée");
  });

  it("marque la leçon complétée et met à jour la progression (201)", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("ce1"),
      completedAt: null,
    } as never);
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.lessonCompletion.create).mockResolvedValue({
      id: cuid("lc1"),
      lessonId,
      studentId,
    } as unknown as LessonCompletion);
    vi.mocked(prisma.lessonCompletion.count).mockResolvedValue(1);

    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toBe(33);
    expect(body.isCompleted).toBe(false);
    expect(prisma.lessonCompletion.create).toHaveBeenCalledWith({
      data: { lessonId, studentId },
    });
    expect(prisma.courseEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 33 }),
      })
    );
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("détecte un cours terminé (100%) et notifie l'élève et le professeur", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("ce1"),
      completedAt: null,
    } as never);
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.lessonCompletion.create).mockResolvedValue({
      id: cuid("lc1"),
      lessonId,
      studentId,
    } as unknown as LessonCompletion);
    vi.mocked(prisma.lessonCompletion.count).mockResolvedValue(3);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      teacher: { user: { id: cuid("userteacher") } },
    } as never);

    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toBe(100);
    expect(body.isCompleted).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "COMPLETE", entity: "Course" }) })
    );
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ id: cuid("ce1") } as never);
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.lessonCompletion.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(route, { method: "POST" }), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/lessons/[id]/complete", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(studentSession());
    const res = await DELETE(makeRequest(route, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 400 sans studentId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE(makeRequest(route, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("studentId requis");
  });

  it("retourne 404 si la leçon n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockLessonFindUnique(null);
    const res = await DELETE(
      makeRequest(`${route}?studentId=${studentId}`, { method: "DELETE" }),
      routeParams
    );
    expect(res.status).toBe(404);
  });

  it("refuse un TEACHER non propriétaire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("teacherother"),
    } as never);
    const res = await DELETE(
      makeRequest(`${route}?studentId=${studentId}`, { method: "DELETE" }),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la complétion n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue(null);
    const res = await DELETE(
      makeRequest(`${route}?studentId=${studentId}`, { method: "DELETE" }),
      routeParams
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Complétion non trouvée");
  });

  it("supprime la complétion et recalcule la progression (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.lessonCompletion.findUnique).mockResolvedValue({
      id: cuid("lc1"),
      lessonId,
      studentId,
    } as unknown as LessonCompletion);
    vi.mocked(prisma.lessonCompletion.delete).mockResolvedValue({
      id: cuid("lc1"),
    } as unknown as LessonCompletion);
    vi.mocked(prisma.lessonCompletion.count).mockResolvedValue(1);

    const res = await DELETE(
      makeRequest(`${route}?studentId=${studentId}`, { method: "DELETE" }),
      routeParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.progress).toBe(33);
    expect(prisma.courseEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_studentId: { courseId, studentId } },
        data: expect.objectContaining({ progress: 33, completedAt: null }),
      })
    );
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockLessonFindUnique(lessonFixture());
    vi.mocked(prisma.lessonCompletion.findUnique).mockRejectedValue(new Error("db down"));
    const res = await DELETE(
      makeRequest(`${route}?studentId=${studentId}`, { method: "DELETE" }),
      routeParams
    );
    expect(res.status).toBe(500);
  });
});