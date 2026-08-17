import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { Course, CourseEnrollment, StudentProfile } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    course: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    classSubject: { findFirst: vi.fn(), findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    courseEnrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    lessonCompletion: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    lesson: { findUnique: vi.fn(), count: vi.fn() },
    enrollment: { findMany: vi.fn(), findFirst: vi.fn() },
    notification: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { GET as GET_LIST, POST as POST_CREATE } from "@/app/api/courses/route";
import { GET as GET_DETAIL, PATCH, DELETE } from "@/app/api/courses/[id]/route";
import { POST as POST_ENROLL, DELETE as DELETE_ENROLL } from "@/app/api/courses/[id]/enroll/route";
import { GET as GET_PROGRESS } from "@/app/api/courses/progress/route";
import { POST as POST_LESSON_COMPLETE } from "@/app/api/courses/lessons/complete/route";

const courseId = cuid("cours1");
const classSubjectId = cuid("classsubj1");
const classId = cuid("classe6a");
const moduleId = cuid("module1");
const lessonA = cuid("lesson1");
const lessonB = cuid("lesson2");
const studentId = cuid("studenta");
const teacherProfileId = cuid("teacher1");
const teacherUserId = cuid("userteacher");
const courseRoute = "http://localhost:3000/api/courses";
const routeParams = { params: Promise.resolve({ id: courseId }) };

function courseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: courseId,
    title: "Cours de mathématiques",
    description: "Description du cours",
    thumbnail: null,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    classSubjectId,
    createdById: teacherUserId,
    classSubject: {
      id: classSubjectId,
      classId,
      teacherId: teacherProfileId,
      class: { id: classId, schoolId: FIXTURES.schoolA },
      subject: { id: cuid("subject1"), name: "Mathématiques" },
    },
    modules: [
      {
        id: moduleId,
        title: "Module 1",
        order: 0,
        lessons: [
          { id: lessonA, title: "Leçon 1", type: "TEXT", duration: 10, order: 0 },
          { id: lessonB, title: "Leçon 2", type: "VIDEO", duration: 15, order: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * course.findUnique sert au guard tenant (select schoolId imbriqué) puis aux
 * handlers (include complet).
 */
function mockCourseFindUnique(record: ReturnType<typeof courseFixture> | null) {
  vi.mocked(prisma.course.findUnique).mockImplementation(async (args: Prisma.CourseFindUniqueArgs) => {
    if (args?.select) {
      if (!record) return null;
      return {
        classSubject: { class: { schoolId: record.classSubject.class.schoolId } },
      } as unknown as Course;
    }
    return record as unknown as Course;
  });
}

function classSubjectFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: classSubjectId,
    classId,
    teacherId: teacherProfileId,
    schoolId: FIXTURES.schoolA,
    class: { id: classId, schoolId: FIXTURES.schoolA },
    subject: { id: cuid("subject1"), name: "Mathématiques" },
    ...overrides,
  };
}

function makeStudentSession() {
  return makeSession("STUDENT", { id: studentId, schoolId: FIXTURES.schoolA });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/courses", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_LIST(makeRequest(courseRoute));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBeDefined();
  });

  it("liste les cours d'un STUDENT à partir de ses classes actives", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      enrollments: [{ classId }],
    } as never);
    vi.mocked(prisma.course.findMany).mockResolvedValue([courseFixture()] as never);
    vi.mocked(prisma.course.count).mockResolvedValue(1);

    const res = await GET_LIST(makeRequest(courseRoute));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(courseId);
    expect(body.pagination.total).toBe(1);

    const findManyArgs = vi.mocked(prisma.course.findMany).mock.calls[0][0];
    expect(findManyArgs.where.isPublished).toBe(true);
    expect(findManyArgs.where.classSubject).toEqual({ classId: { in: [classId] } });
  });

  it("filtre par classSubjectId, isPublished et search", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.course.findMany).mockResolvedValue([courseFixture()] as never);
    vi.mocked(prisma.course.count).mockResolvedValue(1);

    const res = await GET_LIST(
      makeRequest(`${courseRoute}?classSubjectId=${classSubjectId}&isPublished=false&search=math`)
    );
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.course.findMany).mock.calls[0][0];
    expect(args.where.classSubjectId).toBe(classSubjectId);
    expect(args.where.isPublished).toBe(false);
    expect(args.where.title).toEqual({ contains: "math", mode: "insensitive" });
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.course.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET_LIST(makeRequest(courseRoute));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/courses", () => {
  const validBody = {
    classSubjectId,
    title: "Cours de géométrie",
    description: "Un cours complet",
    isPublished: false,
    modules: [
      {
        title: "Module 1",
        order: 0,
        lessons: [
          { title: "Leçon 1", content: "<p>Contenu</p>", type: "TEXT", order: 0 },
        ],
      },
    ],
  };

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(401);
  });

  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la matière n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(null);
    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Matière non trouvée");
  });

  it("retourne 403 si la matière appartient à une autre école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(
      classSubjectFixture({ schoolId: FIXTURES.schoolB, class: { id: classId, schoolId: FIXTURES.schoolB } }) as never
    );
    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("refuse un TEACHER non affecté à la matière (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(classSubjectFixture() as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: teacherProfileId } as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValueOnce(classSubjectFixture() as never);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValueOnce(null);

    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Vous n'êtes pas affecté à cette matière");
  });

  it("crée le cours avec modules et leçons (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(classSubjectFixture() as never);
    vi.mocked(prisma.course.create).mockResolvedValue(courseFixture({ title: "Cours de géométrie" }) as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: cuid("audit1") } as never);

    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(courseId);

    const createArgs = vi.mocked(prisma.course.create).mock.calls[0][0];
    expect(createArgs.data.classSubjectId).toBe(classSubjectId);
    expect(createArgs.data.createdById).toBe(cuid("userSCHOOL_ADMIN"));
    expect(createArgs.data.modules.create).toHaveLength(1);
    expect(createArgs.data.modules.create[0].lessons.create).toHaveLength(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity: "Course", action: "CREATE" }) })
    );
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("notifie les élèves inscrits quand le cours est publié", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(classSubjectFixture() as never);
    vi.mocked(prisma.course.create).mockResolvedValue(courseFixture({ isPublished: true }) as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { student: { user: { id: studentId } } },
    ] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST_CREATE(
      makeRequest(courseRoute, { method: "POST", body: { ...validBody, isPublished: true } })
    );
    expect(res.status).toBe(201);
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classId, status: "ACTIVE" } })
    );
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("retourne 400 sur body invalide (titre trop court)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_CREATE(
      makeRequest(courseRoute, { method: "POST", body: { ...validBody, title: "ab" } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("retourne 500 si la transaction échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(classSubjectFixture() as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("tx failed"));
    const res = await POST_CREATE(makeRequest(courseRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/courses/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(401);
  });

  it("masque un cours d'une autre école (403 via guard tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(
      courseFixture({ classSubject: { id: classSubjectId, classId, teacherId: teacherProfileId, class: { id: classId, schoolId: FIXTURES.schoolB } } })
    );
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le cours n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(null);
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(404);
  });

  it("retourne le cours complet pour un SCHOOL_ADMIN (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(courseId);
    expect(body.modules).toHaveLength(1);
    expect(body.enrollments).toBeUndefined();
  });

  it("masque un cours non publié à un STUDENT (404)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    mockCourseFindUnique(courseFixture({ isPublished: false }));
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(404);
  });

  it("inclut la progression pour un STUDENT inscrit", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
    } as unknown as StudentProfile);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("coursenroll1"),
      courseId,
      studentId,
      progress: 50,
      completedAt: null,
    } as unknown as CourseEnrollment);
    vi.mocked(prisma.lessonCompletion.findMany).mockResolvedValue([{ id: cuid("lc1") }] as never);

    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrollment.progress).toBe(50);
    expect(body.completedLessons).toHaveLength(1);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.course.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET_DETAIL(makeRequest(`${courseRoute}/${courseId}`), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/courses/[id]", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { title: "Nouveau titre" } }),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le cours n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(null);
    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { title: "Nouveau titre" } }),
      routeParams
    );
    expect(res.status).toBe(404);
  });

  it("refuse un TEACHER non propriétaire du cours (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("teacherother"),
    } as never);
    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { title: "Nouveau titre" } }),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("met à jour le cours et journalise (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.course.update).mockImplementation(async (args: Prisma.CourseUpdateArgs) => ({
      id: courseId,
      ...args.data,
    }) as unknown as Course);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: cuid("audit1") } as never);

    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { title: "Nouveau titre" } }),
      routeParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Nouveau titre");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("notifie les élèves lors de la publication", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture({ isPublished: false }));
    vi.mocked(prisma.course.update).mockImplementation(async (args: Prisma.CourseUpdateArgs) => ({
      id: courseId,
      ...args.data,
      isPublished: true,
    }) as unknown as Course);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { student: { user: { id: studentId } } },
    ] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { isPublished: true } }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("retourne 400 sur body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { thumbnail: "pas-une-url" } }),
      routeParams
    );
    expect(res.status).toBe(400);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.course.update).mockRejectedValue(new Error("db down"));
    const res = await PATCH(
      makeRequest(`${courseRoute}/${courseId}`, { method: "PATCH", body: { title: "Nouveau titre" } }),
      routeParams
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/courses/[id]", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    const res = await DELETE(makeRequest(`${courseRoute}/${courseId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le cours n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(null);
    const res = await DELETE(makeRequest(`${courseRoute}/${courseId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("refuse un TEACHER non propriétaire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("teacherother"),
    } as never);
    const res = await DELETE(makeRequest(`${courseRoute}/${courseId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("supprime le cours et journalise (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.course.delete).mockResolvedValue({ id: courseId } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: cuid("audit1") } as never);

    const res = await DELETE(makeRequest(`${courseRoute}/${courseId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: courseId } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "DELETE", entity: "Course" }) })
    );
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockCourseFindUnique(courseFixture());
    vi.mocked(prisma.course.delete).mockRejectedValue(new Error("db down"));
    const res = await DELETE(makeRequest(`${courseRoute}/${courseId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/courses/[id]/enroll", () => {
  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 sans profil étudiant", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("retourne 404 si le cours n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("refuse un cours non publié (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [{ classId }],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(
      courseFixture({ isPublished: false }) as unknown as Course
    );
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(400);
  });

  it("refuse un cours d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [{ classId }],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(
      courseFixture({
        classSubject: {
          id: classSubjectId,
          classId,
          class: { id: classId, schoolId: FIXTURES.schoolB },
          subject: { id: cuid("subject1"), name: "Mathématiques" },
        },
      }) as unknown as Course
    );
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("refuse un élève non inscrit dans la classe (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [{ classId: cuid("autreclasse") }],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(courseFixture() as unknown as Course);
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Vous devez être inscrit à cette classe");
  });

  it("inscrit l'élève au cours (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [{ classId }],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(courseFixture() as unknown as Course);
    vi.mocked(prisma.courseEnrollment.create).mockResolvedValue({
      id: cuid("coursenroll1"),
      courseId,
      studentId,
      progress: 0,
    } as unknown as CourseEnrollment);

    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.progress).toBe(0);
    const createArgs = vi.mocked(prisma.courseEnrollment.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({ courseId, studentId, progress: 0 });
  });

  it("convertit un conflit P2002 en 400 « déjà inscrit »", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentId,
      schoolId: FIXTURES.schoolA,
      enrollments: [{ classId }],
    } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(courseFixture() as unknown as Course);
    vi.mocked(prisma.courseEnrollment.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002" })
    );
    const res = await POST_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "POST" }), routeParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Déjà inscrit à ce cours");
  });
});

describe("DELETE /api/courses/[id]/enroll", () => {
  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 sans profil étudiant", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await DELETE_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("retourne 404 si l'inscription n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: studentId } as never);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue(null);
    const res = await DELETE_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Inscription non trouvée");
  });

  it("refuse la désinscription d'un cours terminé (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: studentId } as never);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("coursenroll1"),
      courseId,
      studentId,
      completedAt: new Date(),
    } as unknown as CourseEnrollment);
    const res = await DELETE_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(400);
  });

  it("désinscrit l'élève (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: studentId } as never);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("coursenroll1"),
      courseId,
      studentId,
      completedAt: null,
    } as unknown as CourseEnrollment);
    vi.mocked(prisma.courseEnrollment.delete).mockResolvedValue({ id: cuid("coursenroll1") } as never);

    const res = await DELETE_ENROLL(makeRequest(`${courseRoute}/${courseId}/enroll`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(prisma.courseEnrollment.delete).toHaveBeenCalledWith({
      where: { courseId_studentId: { courseId, studentId } },
    });
  });
});

describe("GET /api/courses/progress", () => {
  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET_PROGRESS(makeRequest(`${courseRoute}/progress`));
    expect(res.status).toBe(403);
  });

  it("retourne 404 sans profil étudiant", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null);
    const res = await GET_PROGRESS(makeRequest(`${courseRoute}/progress`));
    expect(res.status).toBe(404);
  });

  it("calcule la progression par cours (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([
      {
        courseId,
        completedAt: null,
        course: {
          title: "Cours de mathématiques",
          modules: [
            { lessons: [{ id: lessonA }, { id: lessonB }] },
            { lessons: [{ id: cuid("lesson3") }] },
          ],
        },
      },
    ] as never);
    vi.mocked(prisma.lessonCompletion.findMany).mockResolvedValue([
      { lessonId: lessonA },
      { lessonId: lessonB },
    ] as never);

    const res = await GET_PROGRESS(makeRequest(`${courseRoute}/progress`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toHaveLength(1);
    expect(body.progress[0]).toMatchObject({
      courseId,
      totalLessons: 3,
      completedLessons: 2,
      progress: 67,
    });
  });

  it("filtre par courseId quand fourni", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.lessonCompletion.findMany).mockResolvedValue([] as never);

    const res = await GET_PROGRESS(makeRequest(`${courseRoute}/progress?courseId=${courseId}`));
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.courseEnrollment.findMany).mock.calls[0][0];
    expect(args.where).toEqual({ studentId, courseId });
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockRejectedValue(new Error("db down"));
    const res = await GET_PROGRESS(makeRequest(`${courseRoute}/progress`));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/courses/lessons/complete", () => {
  const completeRoute = "http://localhost:3000/api/courses/lessons/complete";
  const lessonRecord = {
    id: lessonA,
    title: "Leçon 1",
    module: {
      course: {
        id: courseId,
        classSubject: {
          class: { id: classId, schoolId: FIXTURES.schoolA },
        },
      },
    },
  };

  function mockLessonLookups(record: typeof lessonRecord | null) {
    vi.mocked(prisma.lesson.findUnique).mockImplementation(async (args: Prisma.LessonFindUniqueArgs) => {
      if (args?.select) {
        if (!record) return null;
        return {
          module: { course: { classSubject: { class: { schoolId: record.module.course.classSubject.class.schoolId } } } },
        } as unknown as Lesson;
      }
      return record as unknown as Lesson;
    });
  }

  it("retourne 400 si lessonId est absent", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: {} })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("lessonId est requis");
  });

  it("retourne 404 sans profil étudiant", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null);
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(404);
  });

  it("retourne 404 si la leçon n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    mockLessonLookups(null);
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(404);
  });

  it("masque une leçon d'une autre école (403 via guard tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    mockLessonLookups({
      id: lessonA,
      title: "Leçon 1",
      module: {
        course: {
          id: courseId,
          classSubject: {
            class: { id: classId, schoolId: FIXTURES.schoolB },
          },
        },
      },
    });
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(403);
  });

  it("refuse un élève non inscrit au cours ni à la classe (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    mockLessonLookups(lessonRecord);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(403);
  });

  it("upsert la complétion et met à jour la progression (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    mockLessonLookups(lessonRecord);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("ce1"),
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.lessonCompletion.upsert).mockResolvedValue({
      id: cuid("lc1"),
      lessonId: lessonA,
      studentId,
    } as never);
    vi.mocked(prisma.lesson.count).mockResolvedValue(2);
    vi.mocked(prisma.lessonCompletion.count).mockResolvedValue(1);

    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.completion.lessonId).toBe(lessonA);

    const upsertArgs = vi.mocked(prisma.lessonCompletion.upsert).mock.calls[0][0];
    expect(upsertArgs.where).toEqual({
      lessonId_studentId: { lessonId: lessonA, studentId },
    });
    expect(prisma.courseEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_studentId: { courseId, studentId } },
        data: expect.objectContaining({ progress: 50 }),
      })
    );
  });

  it("retourne 500 si la transaction échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeStudentSession());
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: studentId } as never);
    mockLessonLookups(lessonRecord);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({
      id: cuid("ce1"),
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("tx failed"));
    const res = await POST_LESSON_COMPLETE(
      makeRequest(completeRoute, { method: "POST", body: { lessonId: lessonA } })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});