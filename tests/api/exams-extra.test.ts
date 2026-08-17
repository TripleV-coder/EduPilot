import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { ExamTemplate, ExamSession, TeacherProfile, StudentProfile } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    examTemplate: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    examSession: { findUnique: vi.fn(), update: vi.fn() },
    examAnswer: { createMany: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    classSubject: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/benin/exam-prep-service", () => ({
  examPrepService: {
    analyzeStudentReadiness: vi.fn(),
    getClassExamStats: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { GET as GET_EXAMS, POST as POST_EXAMS } from "@/app/api/exams/route";
import { GET as GET_EXAM, DELETE as DELETE_EXAM } from "@/app/api/exams/[id]/route";
import { GET as GET_PREP } from "@/app/api/exams/prep/route";
import { POST as POST_SUBMIT_SESSION } from "@/app/api/exams/sessions/[id]/submit/route";
import { examPrepService } from "@/lib/benin/exam-prep-service";

const examId = cuid("examen1");
const examSessionId = cuid("session1");
const classSubjectId = cuid("classsubj1");
const classId = cuid("classe6a");
const questionA = cuid("question1");
const questionB = cuid("question2");
const teacherProfileId = cuid("teacher1");
const teacherUserId = cuid("userteacher");
const studentProfileId = cuid("studenta");
const studentUserId = cuid("studentuser");
const examRoute = "http://localhost:3000/api/exams";
const routeParams = { params: Promise.resolve({ id: examId }) };

function examFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: examId,
    title: "Examen de maths",
    totalPoints: 20,
    duration: 60,
    isPublished: true,
    passingScore: 10,
    createdAt: new Date(),
    createdById: teacherUserId,
    classSubjectId,
    questions: [
      { id: questionA, type: "MCQ", question: "Q1", points: 10, order: 1, correctAnswer: "B" },
      { id: questionB, type: "MCQ", question: "Q2", points: 10, order: 2, correctAnswer: "C" },
    ],
    classSubject: {
      id: classSubjectId,
      class: { id: classId, schoolId: FIXTURES.schoolA },
    },
    ...overrides,
  };
}

/**
 * examTemplate.findUnique sert au guard tenant (select schoolId imbriqué) puis
 * aux handlers (include complet).
 */
function mockExamTemplateFindUnique(record: ReturnType<typeof examFixture> | null) {
  vi.mocked(prisma.examTemplate.findUnique).mockImplementation(async (args: Prisma.ExamTemplateFindUniqueArgs) => {
    if (args?.select) {
      if (!record) return null;
      return {
        classSubject: { class: { schoolId: record.classSubject.class.schoolId } },
      } as unknown as ExamTemplate;
    }
    return record as unknown as ExamTemplate;
  });
}

function teacherSession() {
  return makeSession("TEACHER", { id: teacherUserId });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exams", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_EXAMS(makeRequest(examRoute));
    expect(res.status).toBe(401);
  });

  it("liste les examens pour un SCHOOL_ADMIN (filtré par école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.examTemplate.findMany).mockResolvedValue([examFixture()] as never);

    const res = await GET_EXAMS(makeRequest(examRoute));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exams).toHaveLength(1);
    const args = vi.mocked(prisma.examTemplate.findMany).mock.calls[0][0];
    expect(args.where.classSubject).toEqual({ class: { schoolId: FIXTURES.schoolA } });
  });

  it("filtre les examens d'un TEACHER par ses matières", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: teacherProfileId,
    } as unknown as TeacherProfile);
    vi.mocked(prisma.examTemplate.findMany).mockResolvedValue([examFixture()] as never);

    const res = await GET_EXAMS(makeRequest(examRoute));
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.examTemplate.findMany).mock.calls[0][0];
    expect(args.where.classSubject).toEqual({
      class: { schoolId: FIXTURES.schoolA },
      teacherId: teacherProfileId,
    });
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.examTemplate.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET_EXAMS(makeRequest(examRoute));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/exams", () => {
  const validBody = {
    title: "Examen de géométrie",
    classSubjectId,
    totalPoints: 20,
    duration: 60,
    isPublished: false,
  };

  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la matière n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Matière/Classe non trouvée");
  });

  it("refuse une matière d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolB },
      teacher: { userId: teacherUserId },
    } as never);
    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("refuse un TEACHER qui crée pour la matière d'un autre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: cuid("autreprof") },
    } as never);
    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "Vous ne pouvez créer des examens que pour vos propres matières"
    );
  });

  it("crée l'examen pour un TEACHER propriétaire de la matière (201)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.examTemplate.create).mockResolvedValue(examFixture({ title: "Examen de géométrie" }) as never);

    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(examId);
    const createArgs = vi.mocked(prisma.examTemplate.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      title: "Examen de géométrie",
      classSubjectId,
      createdById: teacherUserId,
    });
  });

  it("retourne 400 sur body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_EXAMS(
      makeRequest(examRoute, { method: "POST", body: { title: "", classSubjectId: "bad" } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({
      id: classSubjectId,
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    } as never);
    vi.mocked(prisma.examTemplate.create).mockRejectedValue(new Error("db down"));
    const res = await POST_EXAMS(makeRequest(examRoute, { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/exams/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_EXAM(makeRequest(`${examRoute}/${examId}`), routeParams);
    expect(res.status).toBe(401);
  });

  it("retourne 404 si l'examen n'existe pas (guard tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(null);
    const res = await GET_EXAM(makeRequest(`${examRoute}/${examId}`), routeParams);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Examen non trouvé");
  });

  it("masque un examen d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(
      examFixture({ classSubject: { id: classSubjectId, class: { id: classId, schoolId: FIXTURES.schoolB } } })
    );
    const res = await GET_EXAM(makeRequest(`${examRoute}/${examId}`), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne l'examen avec ses questions (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(examFixture());
    const res = await GET_EXAM(makeRequest(`${examRoute}/${examId}`), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(examId);
    expect(body.questions).toHaveLength(2);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.examTemplate.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET_EXAM(makeRequest(`${examRoute}/${examId}`), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/exams/[id]", () => {
  it("refuse un TEACHER non créateur (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockExamTemplateFindUnique(examFixture({ createdById: cuid("autrecreeur") }));
    const res = await DELETE_EXAM(makeRequest(`${examRoute}/${examId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Vous ne pouvez supprimer que vos propres examens");
  });

  it("retourne 404 si l'examen n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(null);
    const res = await DELETE_EXAM(makeRequest(`${examRoute}/${examId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("supprime l'examen pour un TEACHER créateur (200)", async () => {
    vi.mocked(auth).mockResolvedValue(teacherSession());
    mockExamTemplateFindUnique(examFixture());
    vi.mocked(prisma.examTemplate.delete).mockResolvedValue({ id: examId } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: cuid("audit1") } as never);

    const res = await DELETE_EXAM(makeRequest(`${examRoute}/${examId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Examen supprimé avec succès");
    expect(prisma.examTemplate.delete).toHaveBeenCalledWith({ where: { id: examId } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "DELETE_EXAM", entity: "ExamTemplate" }) })
    );
  });

  it("autorise un SCHOOL_ADMIN (isAdmin)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(examFixture({ createdById: cuid("autrecreeur") }));
    vi.mocked(prisma.examTemplate.delete).mockResolvedValue({ id: examId } as never);
    const res = await DELETE_EXAM(makeRequest(`${examRoute}/${examId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(200);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    mockExamTemplateFindUnique(examFixture());
    vi.mocked(prisma.examTemplate.delete).mockRejectedValue(new Error("db down"));
    const res = await DELETE_EXAM(makeRequest(`${examRoute}/${examId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/exams/prep", () => {
  it("retourne 400 sans studentId ni classId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET_PREP(makeRequest(`${examRoute}/prep`));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("studentId or classId required");
  });

  it("retourne 404 si l'élève n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?studentId=${studentProfileId}`));
    expect(res.status).toBe(404);
  });

  it("refuse un élève d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentProfileId,
      schoolId: FIXTURES.schoolB,
    } as unknown as StudentProfile);
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?studentId=${studentProfileId}`));
    expect(res.status).toBe(403);
  });

  it("analyse la préparation individuelle d'un élève (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentProfileId,
      schoolId: FIXTURES.schoolA,
    } as unknown as StudentProfile);
    vi.mocked(examPrepService.analyzeStudentReadiness).mockResolvedValue({
      studentId: studentProfileId,
      overallReadiness: 75,
      subjectReadiness: [],
      predictedSuccess: 80,
      weakAreas: [],
      strongAreas: [],
    } as never);

    const res = await GET_PREP(makeRequest(`${examRoute}/prep?studentId=${studentProfileId}&exam=CEP`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overallReadiness).toBe(75);
    expect(examPrepService.analyzeStudentReadiness).toHaveBeenCalledWith(studentProfileId, "CEP");
  });

  it("contourne le guard tenant pour un SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(examPrepService.analyzeStudentReadiness).mockResolvedValue({
      studentId: studentProfileId,
      overallReadiness: 50,
      subjectReadiness: [],
      predictedSuccess: 50,
      weakAreas: [],
      strongAreas: [],
    } as never);
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?studentId=${studentProfileId}`));
    expect(res.status).toBe(200);
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("retourne 404 si l'analyse ne trouve pas l'élève", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: studentProfileId,
      schoolId: FIXTURES.schoolA,
    } as unknown as StudentProfile);
    vi.mocked(examPrepService.analyzeStudentReadiness).mockResolvedValue(null);
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?studentId=${studentProfileId}`));
    expect(res.status).toBe(404);
  });

  it("retourne 404 si la classe n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?classId=${classId}`));
    expect(res.status).toBe(404);
  });

  it("calcule les statistiques de classe (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: classId,
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(examPrepService.getClassExamStats).mockResolvedValue({
      classId,
      readiness: 60,
    } as never);

    const res = await GET_PREP(makeRequest(`${examRoute}/prep?classId=${classId}&exam=BEPC`));
    expect(res.status).toBe(200);
    expect(res.json()).resolves.toEqual({ classId, readiness: 60 });
    expect(examPrepService.getClassExamStats).toHaveBeenCalledWith(classId, "BEPC");
  });

  it("retourne 500 si le service échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: classId,
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(examPrepService.getClassExamStats).mockRejectedValue(new Error("boom"));
    const res = await GET_PREP(makeRequest(`${examRoute}/prep?classId=${classId}`));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/exams/sessions/[id]/submit", () => {
  const sessionRouteParams = { params: Promise.resolve({ id: examSessionId }) };
  const sessionRoute = `http://localhost:3000/api/exams/sessions/${examSessionId}/submit`;

  function examSessionFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: examSessionId,
      startedAt: new Date(Date.now() - 300000),
      submittedAt: null,
      student: { schoolId: FIXTURES.schoolA, user: { id: studentUserId } },
      examTemplate: {
        title: "Examen de maths",
        totalPoints: 20,
        passingScore: 10,
        questions: [
          { id: questionA, type: "MCQ", question: "Q1", points: 10, order: 1, correctAnswer: "B" },
          { id: questionB, type: "MCQ", question: "Q2", points: 10, order: 2, correctAnswer: "C" },
        ],
        classSubject: { class: { schoolId: FIXTURES.schoolA } },
      },
      ...overrides,
    };
  }

  function mockSessionLookups(record: ReturnType<typeof examSessionFixture> | null) {
    vi.mocked(prisma.examSession.findUnique).mockImplementation(async (args: Prisma.ExamSessionFindUniqueArgs) => {
      if (args?.select) {
        if (!record) return null;
        return { student: { schoolId: record.student.schoolId } } as unknown as ExamSession;
      }
      return record as unknown as ExamSession;
    });
  }

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, { method: "POST", body: { answers: [] } }),
      sessionRouteParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la session n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(null);
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, { method: "POST", body: { answers: [] } }),
      sessionRouteParams
    );
    expect(res.status).toBe(404);
  });

  it("refuse la session d'un autre élève (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: cuid("autreuser") }));
    mockSessionLookups(examSessionFixture());
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, { method: "POST", body: { answers: [] } }),
      sessionRouteParams
    );
    expect(res.status).toBe(403);
  });

  it("rejette un examen déjà soumis (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture({ submittedAt: new Date() }));
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, { method: "POST", body: { answers: [] } }),
      sessionRouteParams
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Examen déjà soumis");
  });

  it("retourne 400 sur questions dupliquées", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture());
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, {
        method: "POST",
        body: { answers: [{ questionId: questionA, answer: "B" }, { questionId: questionA, answer: "C" }] },
      }),
      sessionRouteParams
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("note les réponses MCQ et marque la session soumise (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture());
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: Prisma.ExamSessionUpdateArgs) => ({
      id: examSessionId,
      ...args.data,
      answers: [],
    }) as unknown as ExamSession);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: cuid("notif1") } as never);

    // Q1 correcte (10 pts), Q2 fausse → 10/20, admis (>= 10)
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, {
        method: "POST",
        body: { answers: [{ questionId: questionA, answer: "B" }, { questionId: questionB, answer: "A" }] },
      }),
      sessionRouteParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(10);
    expect(body.isPassed).toBe(true);
    expect(body.submittedAt).toBeDefined();

    const rows = vi.mocked(prisma.examAnswer.createMany).mock.calls[0][0].data;
    expect(rows).toEqual([
      expect.objectContaining({ questionId: questionA, isCorrect: true, pointsEarned: 10 }),
      expect.objectContaining({ questionId: questionB, isCorrect: false, pointsEarned: 0 }),
    ]);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: studentUserId, type: "SUCCESS" }),
      })
    );
  });

  it("échoue sous le seuil de réussite (isPassed=false)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture());
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: Prisma.ExamSessionUpdateArgs) => ({
      id: examSessionId,
      ...args.data,
      answers: [],
    }) as unknown as ExamSession);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: cuid("notif1") } as never);

    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, {
        method: "POST",
        body: { answers: [{ questionId: questionA, answer: "X" }, { questionId: questionB, answer: "Y" }] },
      }),
      sessionRouteParams
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.score).toBe(0);
    expect(body.isPassed).toBe(false);
  });

  it("laisse isPassed à null en présence de questions manuelles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(
      examSessionFixture({
        examTemplate: {
          title: "Examen dissert",
          totalPoints: 20,
          passingScore: 10,
          questions: [
            { id: questionA, type: "ESSAY", question: "Rédaction", points: 20, order: 1 },
          ],
          classSubject: { class: { schoolId: FIXTURES.schoolA } },
        },
      })
    );
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: Prisma.ExamSessionUpdateArgs) => ({
      id: examSessionId,
      ...args.data,
      answers: [],
    }) as unknown as ExamSession);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: cuid("notif1") } as never);

    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, {
        method: "POST",
        body: { answers: [{ questionId: questionA, answer: "Ma rédaction" }] },
      }),
      sessionRouteParams
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isPassed).toBeNull();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "INFO", title: "Examen soumis" }),
      })
    );
  });

  it("ignore les questionId inconnus de la correction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture());
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: Prisma.ExamSessionUpdateArgs) => ({
      id: examSessionId,
      ...args.data,
      answers: [],
    }) as unknown as ExamSession);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: cuid("notif1") } as never);

    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, {
        method: "POST",
        body: { answers: [{ questionId: cuid("inconnu"), answer: "X" }] },
      }),
      sessionRouteParams
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.examAnswer.createMany).mock.calls[0][0].data).toEqual([]);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: studentUserId }));
    mockSessionLookups(examSessionFixture());
    vi.mocked(prisma.examAnswer.createMany).mockRejectedValue(new Error("db down"));
    const res = await POST_SUBMIT_SESSION(
      makeRequest(sessionRoute, { method: "POST", body: { answers: [] } }),
      sessionRouteParams
    );
    expect(res.status).toBe(500);
  });
});