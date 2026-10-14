/**
 * Règles de l'établissement : réglages validés et tracés, catégories
 * protégées, évaluations de compétence hors moyenne, rachat après conseil.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";
import { DEFAULT_GRADING_SETTINGS } from "@/lib/academic/grading-rules";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAllStudentsForSchool: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/academic/class-averages", () => ({
  computeClassAnnual: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    configOption: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
    academicConfig: { findUnique: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    class: { findFirst: vi.fn(), findMany: vi.fn() },
    classLevel: { findFirst: vi.fn() },
    classSubject: { findMany: vi.fn() },
    classCouncil: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn(), updateMany: vi.fn() },
    alumni: { create: vi.fn() },
    period: { findFirst: vi.fn(), findUnique: vi.fn() },
    evaluationType: { upsert: vi.fn() },
    evaluation: { create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { computeClassAnnual } from "@/lib/academic/class-averages";
import { GET as GET_RULES, PUT as PUT_RULES } from "@/app/api/config/grading/route";
import { POST as POST_OPTION } from "@/app/api/config-options/route";
import { PATCH as PATCH_OPTION, DELETE as DELETE_OPTION } from "@/app/api/config-options/[id]/route";
import { POST as POST_COMPETENCE } from "@/app/api/competences/route";
import { promoteClass, PromotionError } from "@/lib/students/promotion";

const rulesUrl = "http://localhost:3000/api/config/grading";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.configOption.findFirst).mockResolvedValue(null);
});

describe("/api/config/grading — règles de l'établissement", () => {
  it("lit les règles (défauts officiels) et indique le droit de modifier", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ periodType: "SEMESTER", passingGrade: 10 } as never);
    const res = await GET_RULES(makeRequest(rulesUrl));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings).toEqual(DEFAULT_GRADING_SETTINGS);
    expect(body.periodsCount).toBe(2);
    expect(body.canEdit).toBe(false);
  });

  it("refuse la modification à un enseignant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PUT_RULES(makeRequest(rulesUrl, { method: "PUT", body: DEFAULT_GRADING_SETTINGS }));
    expect(res.status).toBe(403);
  });

  it("refuse des mentions non croissantes (400) — choix encadrés, jamais libres", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PUT_RULES(
      makeRequest(rulesUrl, {
        method: "PUT",
        body: { ...DEFAULT_GRADING_SETTINGS, mentions: [{ label: "Échec", min: 0 }, { label: "Bien", min: 14 }, { label: "Passable", min: 10 }] },
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.configOption.upsert).not.toHaveBeenCalled();
  });

  it("refuse une formule inconnue (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PUT_RULES(
      makeRequest(rulesUrl, {
        method: "PUT",
        body: { ...DEFAULT_GRADING_SETTINGS, calculation: { ...DEFAULT_GRADING_SETTINGS.calculation, subjectFormula: "(MI*2+D)/3" } },
      })
    );
    expect(res.status).toBe(400);
  });

  it("refuse une formule annuelle qui utilise une période absente de l'année (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ periodType: "SEMESTER" } as never);
    const res = await PUT_RULES(
      makeRequest(rulesUrl, {
        method: "PUT",
        body: { ...DEFAULT_GRADING_SETTINGS, calculation: { ...DEFAULT_GRADING_SETTINGS.calculation, annualFormula: "(P1 + P2 + 2*P3) / 4" } },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("ANNUAL_FORMULA_INVALID");
    expect(body.error).toContain("P3");
    expect(prisma.configOption.upsert).not.toHaveBeenCalled();
  });

  it("refuse une formule de matière dont le diviseur est faux, avec l'explication (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PUT_RULES(
      makeRequest(rulesUrl, {
        method: "PUT",
        body: { ...DEFAULT_GRADING_SETTINGS, calculation: { ...DEFAULT_GRADING_SETTINGS.calculation, subjectFormula: "(MI + MD) / 3" } },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/^Formule des matières : Avec toutes les notes à 20/);
  });

  it("enregistre une formule libre de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ periodType: "TRIMESTER" } as never);
    const next = {
      ...DEFAULT_GRADING_SETTINGS,
      calculation: { ...DEFAULT_GRADING_SETTINGS.calculation, subjectFormula: "(MI + MD + 2*MC) / 4", annualFormula: "(T1 + T2 + 2*T3) / 4" },
    };
    const res = await PUT_RULES(makeRequest(rulesUrl, { method: "PUT", body: next }));
    expect(res.status).toBe(200);
    // Les synonymes T1, T2, T3 sont acceptés tels quels
    expect((await res.json()).settings.calculation.annualFormula).toBe("(T1 + T2 + 2*T3) / 4");
  });

  it("enregistre, trace avant / après et relance le calcul si une règle de calcul change", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: cuid("annee2026") } as never);
    const next = { ...DEFAULT_GRADING_SETTINGS, calculation: { ...DEFAULT_GRADING_SETTINGS.calculation, rounding: "TRUNCATE" as const } };

    const res = await PUT_RULES(makeRequest(rulesUrl, { method: "PUT", body: next }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recalculation).toBe("started");
    expect(prisma.configOption.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ metadata: next }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SCHOOL_RULES_UPDATED",
        oldValues: DEFAULT_GRADING_SETTINGS,
        newValues: next,
      }),
    });
    expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, cuid("annee2026"));
  });

  it("ne relance pas le calcul pour une option sans effet sur les moyennes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PUT_RULES(makeRequest(rulesUrl, { method: "PUT", body: { ...DEFAULT_GRADING_SETTINGS, promotionRank: true } }));
    expect((await res.json()).recalculation).toBe("none");
    expect(syncAllStudentsForSchool).not.toHaveBeenCalled();
  });
});

describe("Catégories protégées des options génériques", () => {
  const optionId = "c" + "a".repeat(24);

  it("refuse de créer les règles de l'école depuis l'écran générique (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_OPTION(
      makeRequest("http://localhost:3000/api/config-options", {
        method: "POST",
        body: { category: "GRADING_SETTINGS", code: "DEFAULT", label: "x", metadata: { calculation: {} } },
      })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("RESERVED_CATEGORY");
    expect(prisma.configOption.create).not.toHaveBeenCalled();
  });

  it("refuse de modifier ou supprimer une option réservée (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ id: optionId, category: "GRADING_SETTINGS", code: "DEFAULT" } as never);
    const params = { params: Promise.resolve({ id: optionId }) };

    const patched = await PATCH_OPTION(
      makeRequest(`http://localhost:3000/api/config-options/${optionId}`, { method: "PATCH", body: { metadata: {} } }),
      params
    );
    expect(patched.status).toBe(403);
    const deleted = await DELETE_OPTION(makeRequest(`http://localhost:3000/api/config-options/${optionId}`, { method: "DELETE" }), params);
    expect(deleted.status).toBe(403);
    expect(prisma.configOption.update).not.toHaveBeenCalled();
    expect(prisma.configOption.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/competences — évaluation de compétence hors moyenne", () => {
  const url = "http://localhost:3000/api/competences";
  const teacherUserId = cuid("userteacher1");
  const body = { classId: cuid("classe6a"), subjectId: cuid("maths"), competenceId: "C3", level: "A" };

  function klass(teacherId = teacherUserId) {
    return {
      schoolId: FIXTURES.schoolA,
      classSubjects: [{ id: cuid("csmaths"), classId: cuid("classe6a"), teacher: { userId: teacherId } }],
      enrollments: [{ studentId: FIXTURES.studentA }, { studentId: FIXTURES.studentB }],
    };
  }

  it("refuse la direction (403) : seul l'enseignant de la matière évalue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_COMPETENCE(makeRequest(url, { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("refuse un niveau ou une compétence inconnus (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    const res = await POST_COMPETENCE(makeRequest(url, { method: "POST", body: { ...body, level: "TB" } }));
    expect(res.status).toBe(400);
  });

  it("refuse un enseignant d'une autre matière (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.class.findFirst).mockResolvedValue(klass(cuid("autreprof")) as never);
    const res = await POST_COMPETENCE(makeRequest(url, { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("enregistre sous le type « Compétence » (hors moyenne), période en cours", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.class.findFirst).mockResolvedValue(klass() as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({ id: cuid("periode2") } as never);
    vi.mocked(prisma.evaluationType.upsert).mockResolvedValue({ id: cuid("typecomp") } as never);
    vi.mocked(prisma.evaluation.create).mockResolvedValue({ id: cuid("evalcomp") } as never);

    const res = await POST_COMPETENCE(makeRequest(url, { method: "POST", body }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.evaluationType.upsert).mock.calls[0][0]).toMatchObject({
      create: { code: "COMPETENCE", category: "COMPETENCE" },
      update: { category: "COMPETENCE" },
    });
    // Période qui contient la date du jour (et non la première de l'année)
    expect(vi.mocked(prisma.period.findFirst).mock.calls[0][0]!.where).toMatchObject({
      startDate: { lte: expect.any(Date) },
      endDate: { gte: expect.any(Date) },
    });
    const created = vi.mocked(prisma.evaluation.create).mock.calls[0][0].data as { title: string; typeId: string };
    expect(created.title).toMatch(/^C3 ·/);
    expect(created.typeId).toBe(cuid("typecomp"));
  });
});

describe("Promotion — rachat seulement après conseil, si l'école l'autorise", () => {
  const sourceClassId = cuid("classe3a");

  function wirePromotion() {
    vi.mocked(prisma.class.findFirst).mockResolvedValue({ id: sourceClassId, name: "3e A", classLevel: { sequence: 9 } } as never);
    vi.mocked(prisma.academicYear.findFirst).mockImplementation((async (args: { where: { id?: string } }) =>
      args.where.id
        ? { id: cuid("annee2027"), startDate: new Date("2027-09-01") }
        : { id: cuid("annee2026"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-01") }) as never);
    vi.mocked(prisma.classLevel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { id: "enr1", studentId: FIXTURES.studentA, student: { user: { firstName: "Awa", lastName: "Dossou" } } },
    ] as never);
    vi.mocked(prisma.enrollment.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([]);
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ passingGrade: 10 } as never);
    vi.mocked(computeClassAnnual).mockResolvedValue({
      students: new Map([[FIXTURES.studentA, { general: 9.5, provisional: 9.5 }]]),
      classSize: 1,
      periods: [{ id: cuid("t3") }],
    } as never);
  }
  const promote = () =>
    promoteClass({
      schoolId: FIXTURES.schoolA,
      sourceClassId,
      targetAcademicYearId: cuid("annee2027"),
      decisions: [{ studentId: FIXTURES.studentA, decision: "PROMOTE" }],
      actorId: cuid("director"),
    });

  it("refuse le passage sous le seuil quand le rachat n'est pas activé", async () => {
    wirePromotion();
    await expect(promote()).rejects.toThrow(PromotionError);
    await expect(promote()).rejects.toThrow(/rachat n'est pas activé/);
  });

  it("refuse le rachat tant que le conseil de fin d'année n'est pas validé", async () => {
    wirePromotion();
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ metadata: { rescueAfterCouncil: true } } as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue(null);
    await expect(promote()).rejects.toThrow(/après la validation du conseil/);
  });

  it("autorise le rachat après conseil validé et le trace", async () => {
    wirePromotion();
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue({ metadata: { rescueAfterCouncil: true } } as never);
    vi.mocked(prisma.classCouncil.findUnique).mockResolvedValue({ validatedAt: new Date() } as never);

    await promote();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PROMOTE_CLASS",
        newValues: expect.objectContaining({ rescued: [{ studentId: FIXTURES.studentA, average: 9.5 }] }),
      }),
    });
  });
});
