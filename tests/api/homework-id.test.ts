import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { Homework, HomeworkSubmission, TeacherProfile, StudentProfile } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    homework: { findUnique: vi.fn(), update: vi.fn() },
    homeworkSubmission: { findUnique: vi.fn(), update: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn(),
  CACHE_PATHS: { homework: "homework" },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH, DELETE } from "@/app/api/homework/[id]/route";
import { POST as POST_GRADE } from "@/app/api/homework/submissions/[id]/grade/route";
import { invalidateByPath } from "@/lib/api/cache-helpers";

const homeworkId = cuid("devoir1");
const submissionId = cuid("soumission1");
const classSubjectId = cuid("classsubj1");
const classId = cuid("classe6a");
const studentProfileId = cuid("studenta");
const studentUserId = cuid("studentuser");
const teacherProfileId = cuid("teacher1");
const teacherUserId = cuid("userteacher");
const homeworkRoute = `http://localhost:3000/api/homework/${homeworkId}`;
const homeworkParams = { params: Promise.resolve({ id: homeworkId }) };
const gradeRoute = `http://localhost:3000/api/homework/submissions/${submissionId}/grade`;
const gradeParams = { params: Promise.resolve({ id: submissionId }) };

function homeworkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: homeworkId,
    title: "Devoir de maths",
    description: "Résoudre les exercices 1 à 5",
    isPublished: true,
    maxGrade: 20,
    coefficient: 1,
    dueDate: new Date(),
    classSubjectId,
    classSubject: {
      id: classSubjectId,
      classId,
      teacherId: teacherProfileId,
      class: { id: classId, schoolId: FIXTURES.schoolA },
      subject: { id: cuid("subject1"), name: "Mathématiques" },
    },
    ...overrides,
  };
}

/**
 * homework.findUnique sert au guard tenant (select schoolId imbriqué) puis au
 * handler (include complet).
 */
function mockHomeworkFindUnique(record: ReturnType<typeof homeworkFixture> | null) {
  vi.mocked(prisma.homework.findUnique).mockImplementation(async (args: Prisma.HomeworkFindUniqueArgs) => {
    if (args?.select) {
      if (!record) return null;
      return {
        classSubject: { class: { schoolId: record.classSubject.class.schoolId } },
      } as unknown as Homework;
    }
    return record as unknown as Homework;
  });
}

function teacherSession() {
  return makeSession("TEACHER", { id: teacherUserId });
}

function submissionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    homeworkId,
    homework: {
      title: "Devoir de maths",
      maxGrade: 20,
      classSubject: { teacherId: teacherProfileId },
    },
    student: { schoolId: FIXTURES.schoolA, user: { id: studentUserId } },
    ...overrides,
  };
}

/**
 * homeworkSubmission.findUnique sert au guard tenant (select student.schoolId)
 * puis au handler (include complet).
 */
function mockSubmissionFindUnique(record: ReturnType<typeof submissionFixture>) {
  vi.mocked(prisma.homeworkSubmission.findUnique).mockImplementation(
    async (args: Prisma.HomeworkSubmissionFindUniqueArgs) => {
      if (args?.select) {
        return { student: { schoolId: record.student.schoolId } } as unknown as HomeworkSubmission;
      }
      return record as unknown as HomeworkSubmission;
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/homework/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(401);
  });

  it("retourne 404 si le devoir n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(null);
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Devoir non trouvé");
  });

  it("refuse un STUDENT qui n'est pas dans la classe (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentProfileId,
      enrollments: [],
    } as unknown as StudentProfile);
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(403);
  });

  it("retourne le devoir pour un TEACHER (200)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(homeworkFixture());
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(homeworkId);
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("retourne le devoir pour un STUDENT de la classe (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentProfileId,
      enrollments: [{ classId }],
    } as unknown as StudentProfile);
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(200);
    const profileArgs = vi.mocked(prisma.studentProfile.findUnique).mock.calls[0][0];
    expect(profileArgs.include.enrollments.where).toEqual({
      status: "ACTIVE",
      classId,
    });
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    vi.mocked(prisma.homework.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest(homeworkRoute), homeworkParams);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/homework/[id]", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await PATCH(
      makeRequest(homeworkRoute, { method: "PATCH", body: { title: "Nouveau titre" } }),
      homeworkParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le devoir n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(null);
    const res = await PATCH(
      makeRequest(homeworkRoute, { method: "PATCH", body: { title: "Nouveau titre" } }),
      homeworkParams
    );
    expect(res.status).toBe(404);
  });

  it("refuse un TEACHER non propriétaire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("teacherother"),
    } as unknown as TeacherProfile);
    const res = await PATCH(
      makeRequest(homeworkRoute, { method: "PATCH", body: { title: "Nouveau titre" } }),
      homeworkParams
    );
    expect(res.status).toBe(403);
  });

  it("met à jour le devoir et invalide le cache (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.homework.update).mockImplementation(async (args: Prisma.HomeworkUpdateArgs) => ({
      id: homeworkId,
      ...args.data,
    }) as unknown as Homework);

    const res = await PATCH(
      makeRequest(homeworkRoute, {
        method: "PATCH",
        body: { title: "Nouveau titre", dueDate: "2026-09-01T10:00:00Z" },
      }),
      homeworkParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Nouveau titre");
    const updateArgs = vi.mocked(prisma.homework.update).mock.calls[0][0];
    expect(updateArgs.data.dueDate).toEqual(new Date("2026-09-01T10:00:00Z"));
    expect(invalidateByPath).toHaveBeenCalledWith("homework");
  });

  it("retourne 400 sur body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockHomeworkFindUnique(homeworkFixture());
    const res = await PATCH(
      makeRequest(homeworkRoute, { method: "PATCH", body: { title: "x" } }),
      homeworkParams
    );
    expect(res.status).toBe(400);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.homework.update).mockRejectedValue(new Error("db down"));
    const res = await PATCH(
      makeRequest(homeworkRoute, { method: "PATCH", body: { title: "Nouveau titre" } }),
      homeworkParams
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/homework/[id]", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await DELETE(makeRequest(homeworkRoute, { method: "DELETE" }), homeworkParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le devoir n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(null);
    const res = await DELETE(makeRequest(homeworkRoute, { method: "DELETE" }), homeworkParams);
    expect(res.status).toBe(404);
  });

  it("refuse un TEACHER non propriétaire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("teacherother"),
    } as unknown as TeacherProfile);
    const res = await DELETE(makeRequest(homeworkRoute, { method: "DELETE" }), homeworkParams);
    expect(res.status).toBe(403);
  });

  it("supprime en douceur et invalide le cache (200)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: teacherProfileId,
    } as unknown as TeacherProfile);
    vi.mocked(prisma.homework.update).mockResolvedValue({ id: homeworkId } as never);

    const res = await DELETE(makeRequest(homeworkRoute, { method: "DELETE" }), homeworkParams);
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Devoir supprimé avec succès");
    expect(prisma.homework.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: homeworkId },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
    expect(invalidateByPath).toHaveBeenCalledWith("homework");
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockHomeworkFindUnique(homeworkFixture());
    vi.mocked(prisma.homework.update).mockRejectedValue(new Error("db down"));
    const res = await DELETE(makeRequest(homeworkRoute, { method: "DELETE" }), homeworkParams);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/homework/submissions/[id]/grade", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 15 } }),
      gradeParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la soumission n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.homeworkSubmission.findUnique).mockResolvedValue(null);
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 15 } }),
      gradeParams
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Soumission non trouvée");
  });

  it("refuse un TEACHER non propriétaire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockSubmissionFindUnique(
      submissionFixture({
        homework: {
          title: "Devoir de maths",
          maxGrade: 20,
          classSubject: { teacherId: cuid("teacherother") },
        },
      })
    );
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: teacherProfileId,
    } as unknown as TeacherProfile);
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 15 } }),
      gradeParams
    );
    expect(res.status).toBe(403);
  });

  it("rejette une note supérieure à maxGrade (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockSubmissionFindUnique(submissionFixture());
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 21 } }),
      gradeParams
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("La note ne peut pas dépasser 20");
  });

  it("note la soumission et notifie l'élève (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockSubmissionFindUnique(submissionFixture());
    vi.mocked(prisma.homeworkSubmission.update).mockImplementation(
      async (args: Prisma.HomeworkSubmissionUpdateArgs) => ({
        id: submissionId,
        ...args.data,
        student: { user: { id: studentUserId, firstName: "Jean", lastName: "Biya" } },
        homework: {
          title: "Devoir de maths",
          classSubject: { subject: { name: "Mathématiques" } },
        },
        gradedBy: { firstName: "Paul", lastName: "Kaba" },
      }) as unknown as HomeworkSubmission
    );
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: cuid("notif1") } as never);

    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 15, feedback: "Bon travail" } }),
      gradeParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grade).toBe(15);
    expect(body.feedback).toBe("Bon travail");
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: studentUserId,
          type: "GRADE",
          title: "Devoir noté",
        }),
      })
    );
  });

  it("retourne 400 sur body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockSubmissionFindUnique(submissionFixture());
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: -5 } }),
      gradeParams
    );
    expect(res.status).toBe(400);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockSubmissionFindUnique(submissionFixture());
    vi.mocked(prisma.homeworkSubmission.update).mockRejectedValue(new Error("db down"));
    const res = await POST_GRADE(
      makeRequest(gradeRoute, { method: "POST", body: { grade: 15 } }),
      gradeParams
    );
    expect(res.status).toBe(500);
  });
});