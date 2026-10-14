/**
 * Réclamations de notes après conseil de classe (décision du 2026-10-02) :
 * rendez-vous pris par la famille, correction proposée par l'enseignant de la
 * matière, approuvée ou refusée par le directeur des études.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAnalyticsAfterGradeChange: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return { ...actual, invalidateByPath: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    evaluation: { findUnique: vi.fn() },
    classCouncil: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    configOption: { findFirst: vi.fn().mockResolvedValue(null) },
    gradeCorrectionRequest: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    grade: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    parentProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    appointment: { findFirst: vi.fn(), create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { POST as PROPOSE, GET as LIST } from "@/app/api/grades/corrections/route";
import { PATCH as DECIDE } from "@/app/api/grades/corrections/[id]/route";
import { POST as BOOK } from "@/app/api/grades/corrections/appointment/route";

const evaluationId = cuid("evalcorr1");
const teacherUserId = cuid("userteacher1");
const correctionId = cuid("corr0001");
const route = "http://localhost:3000/api/grades/corrections";

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    id: evaluationId,
    periodId: cuid("periode1"),
    maxGrade: 20,
    classSubject: { classId: cuid("classe6a"), class: { schoolId: FIXTURES.schoolA }, teacher: { userId: teacherUserId } },
    ...overrides,
  };
}

const proposal = {
  evaluationId,
  studentId: FIXTURES.studentA,
  proposedValue: 14.5,
  reason: "Copie recomptée : exercice 3 oublié",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.configOption.findFirst).mockResolvedValue(null);
});

describe("POST /api/grades/corrections — proposition de l'enseignant", () => {
  it("refuse la direction : seul l'enseignant de la matière propose (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(res.status).toBe(403);
  });

  it("refuse un autre enseignant (403 SUBJECT_TEACHER_ONLY)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluation() as never);
    const res = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SUBJECT_TEACHER_ONLY");
  });

  it("renvoie à la saisie directe tant que le conseil n'est pas validé (409 NOT_LOCKED)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluation() as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue(null);
    const res = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_LOCKED");
  });

  it("contrôle la note proposée (barème et précision de l'école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluation() as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "enr" } as never);

    const over = await PROPOSE(makeRequest(route, { method: "POST", body: { ...proposal, proposedValue: 21 } }));
    expect(over.status).toBe(400);
    expect((await over.json()).code).toBe("GRADE_OUT_OF_RANGE");

    vi.mocked(prisma.configOption.findFirst).mockResolvedValueOnce({ metadata: { gradeStep: "1" } } as never);
    const step = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(step.status).toBe(400);
    expect((await step.json()).code).toBe("GRADE_STEP_MISMATCH");
    expect(prisma.gradeCorrectionRequest.create).not.toHaveBeenCalled();
  });

  it("enregistre la proposition en attente et la trace", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluation() as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "enr" } as never);
    vi.mocked(prisma.gradeCorrectionRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.gradeCorrectionRequest.create).mockResolvedValue({ id: correctionId } as never);

    const res = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.gradeCorrectionRequest.create).mock.calls[0][0].data).toMatchObject({
      evaluationId,
      studentId: FIXTURES.studentA,
      requestedById: teacherUserId,
      proposedValue: 14.5,
      proposedAbsent: false,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "GRADE_CORRECTION_PROPOSED", entityId: correctionId }),
    });
  });

  it("refuse une seconde proposition en attente pour la même note (409)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluation() as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "enr" } as never);
    vi.mocked(prisma.gradeCorrectionRequest.findFirst).mockResolvedValue({ id: "deja" } as never);
    const res = await PROPOSE(makeRequest(route, { method: "POST", body: proposal }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_PENDING");
  });
});

describe("GET /api/grades/corrections", () => {
  it("l'enseignant ne voit que les réclamations de ses matières", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.gradeCorrectionRequest.findMany).mockResolvedValue([]);
    const res = await LIST(makeRequest(`${route}?status=PENDING`));
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.gradeCorrectionRequest.findMany).mock.calls[0][0]!.where as Record<string, unknown>;
    expect(where).toMatchObject({
      status: "PENDING",
      evaluation: { classSubject: { class: { schoolId: FIXTURES.schoolA }, teacher: { userId: teacherUserId } } },
    });
  });
});

describe("PATCH /api/grades/corrections/[id] — décision du directeur des études", () => {
  const params = { params: Promise.resolve({ id: correctionId }) };
  const pending = {
    id: correctionId,
    evaluationId,
    studentId: FIXTURES.studentA,
    requestedById: teacherUserId,
    proposedValue: 14.5,
    proposedAbsent: false,
    proposedExcused: false,
    excuseReason: null,
    reason: "Copie recomptée",
    evaluation: { id: evaluationId, classSubject: { class: { schoolId: FIXTURES.schoolA } } },
  };

  it("refuse l'enseignant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    const res = await DECIDE(makeRequest(`${route}/${correctionId}`, { method: "PATCH", body: { decision: "APPROVE" } }), params);
    expect(res.status).toBe(403);
  });

  it("exige une raison pour refuser (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await DECIDE(makeRequest(`${route}/${correctionId}`, { method: "PATCH", body: { decision: "REJECT" } }), params);
    expect(res.status).toBe(400);
  });

  it("approuve : applique la note, l'historise et recalcule", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.gradeCorrectionRequest.findUnique).mockResolvedValue(pending as never);
    vi.mocked(prisma.gradeCorrectionRequest.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.grade.findUnique).mockResolvedValue({ id: "g1", value: 12, isAbsent: false, isExcused: false, excuseReason: null, deletedAt: null } as never);
    vi.mocked(prisma.grade.upsert).mockResolvedValue({ id: "g1", value: 14.5, isAbsent: false, isExcused: false, excuseReason: null } as never);

    const res = await DECIDE(makeRequest(`${route}/${correctionId}`, { method: "PATCH", body: { decision: "APPROVE" } }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("APPROVED");
    expect(vi.mocked(prisma.grade.upsert).mock.calls[0][0].update).toMatchObject({ value: 14.5, isAbsent: false, deletedAt: null });
    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: "GRADE_CORRECTION_APPROVED",
          oldValues: expect.objectContaining({ value: 12 }),
          newValues: expect.objectContaining({ value: 14.5, reason: "Copie recomptée" }),
        }),
      ],
    });
    expect(syncAnalyticsAfterGradeChange).toHaveBeenCalledWith(evaluationId, [FIXTURES.studentA]);
  });

  it("une réclamation déjà traitée ne l'est pas deux fois (409)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.gradeCorrectionRequest.findUnique).mockResolvedValue(pending as never);
    vi.mocked(prisma.gradeCorrectionRequest.updateMany).mockResolvedValue({ count: 0 });
    const res = await DECIDE(makeRequest(`${route}/${correctionId}`, { method: "PATCH", body: { decision: "APPROVE" } }), params);
    expect(res.status).toBe(409);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("celui qui propose ne peut pas approuver sa propre correction (403)", async () => {
    const director = makeSession("DIRECTOR");
    vi.mocked(auth).mockResolvedValue(director);
    vi.mocked(prisma.gradeCorrectionRequest.findUnique).mockResolvedValue({ ...pending, requestedById: director.user.id } as never);
    const res = await DECIDE(makeRequest(`${route}/${correctionId}`, { method: "PATCH", body: { decision: "APPROVE" } }), params);
    expect(res.status).toBe(403);
    expect(prisma.gradeCorrectionRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/grades/corrections/appointment — rendez-vous de réclamation", () => {
  const url = `${route}/appointment`;
  const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

  it("refuse le personnel (réservé à l'élève et à sa famille)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await BOOK(makeRequest(url, { method: "POST", body: { evaluationId, studentId: FIXTURES.studentA, scheduledAt: future } }));
    expect(res.status).toBe(403);
  });

  it("un élève ne réclame que pour lui-même (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentB } as never);
    const res = await BOOK(makeRequest(url, { method: "POST", body: { evaluationId, studentId: FIXTURES.studentA, scheduledAt: future } }));
    expect(res.status).toBe(403);
  });

  it("prend rendez-vous avec l'enseignant de la matière, déterminé par le serveur", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    vi.mocked(prisma.grade.findUnique).mockResolvedValue({
      deletedAt: null,
      evaluation: {
        title: "Devoir 2",
        date: new Date("2026-02-10"),
        type: { name: "Devoir" },
        classSubject: { teacherId: cuid("teacherprof1"), subject: { name: "Mathématiques" } },
      },
    } as never);
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({ id: cuid("parent1") } as never);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: "rdv1", scheduledAt: future, status: "PENDING" } as never);

    const res = await BOOK(makeRequest(url, { method: "POST", body: { evaluationId, studentId: FIXTURES.studentA, scheduledAt: future } }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.appointment.create).mock.calls[0][0].data).toMatchObject({
      teacherId: cuid("teacherprof1"),
      parentId: cuid("parent1"),
      studentId: FIXTURES.studentA,
      type: "IN_PERSON",
    });
    expect(String(vi.mocked(prisma.appointment.create).mock.calls[0][0].data.notes)).toContain("Réclamation de note : Mathématiques");
  });

  it("refuse un créneau passé (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    const res = await BOOK(
      makeRequest(url, { method: "POST", body: { evaluationId, studentId: FIXTURES.studentA, scheduledAt: "2020-01-01T08:00:00.000Z" } })
    );
    expect(res.status).toBe(400);
  });
});
