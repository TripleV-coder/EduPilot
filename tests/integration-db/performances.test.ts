import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/performances/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 — `GET /api/performances` contre une vraie base.
 *
 * Avant : toutes les classes de l'école, avec toutes leurs matières, toutes
 * les évaluations de la période et toutes leurs notes, chargées en mémoire
 * pour calculer des moyennes en JS (2 037 ms au smoke de l'audit).
 * Attendu : mêmes chiffres (moyennes des valeurs BRUTES, comme avant),
 * calculés par PostgreSQL. Valeurs attendues calculées à la main.
 */
type Perf = {
  activePeriodId: string;
  overallAverage: number;
  totalEvaluations: number;
  performanceByLevel: Array<{ name: string; average: number }>;
  performanceByClass: Array<{ name: string; average: number }>;
  performanceBySubject: Array<{ name: string; average: number }>;
};

let schoolId: string;
let adminId: string;
let p1: string;
let p2: string;

beforeAll(async () => {
  schoolId = (await createSchool("IT-C3-PERF")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  p1 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } })).id;
  p2 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T2", type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-31"), sequence: 2 } })).id;

  const sixieme = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const cinquieme = await prisma.classLevel.create({ data: { schoolId, name: "5e", code: uniqueCode("5E"), level: "SECONDARY_COLLEGE", sequence: 2 } });
  const c6a = await prisma.class.create({ data: { schoolId, classLevelId: sixieme.id, name: "A" } });
  const c5a = await prisma.class.create({ data: { schoolId, classLevelId: cinquieme.id, name: "A" } });
  const math = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const svt = await prisma.subject.create({ data: { schoolId, name: "SVT", code: uniqueCode("S") } });
  const type = await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("D") } });

  const students: string[] = [];
  for (let i = 0; i < 3; i++) {
    const u = await prisma.user.create({
      data: { email: `${uniqueCode(`e${i}`)}@integration.test`, password: "x", firstName: `E${i}`, lastName: "T", role: "STUDENT", schoolId },
    });
    students.push((await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(`M${i}`), schoolId } })).id);
  }

  async function evaluationWithGrades(classId: string, subjectId: string, periodId: string, values: Array<number | null>, absentIndex?: number) {
    const cs =
      (await prisma.classSubject.findFirst({ where: { classId, subjectId } })) ??
      (await prisma.classSubject.create({ data: { classId, subjectId } }));
    const evaluation = await prisma.evaluation.create({ data: { classSubjectId: cs.id, periodId, typeId: type.id, date: new Date("2026-02-01") } });
    for (let i = 0; i < values.length; i++) {
      await prisma.grade.create({
        data: { evaluationId: evaluation.id, studentId: students[i], value: values[i], isAbsent: i === absentIndex },
      });
    }
  }

  // Période 2 : 6e A Math 10, 14 ; 6e A SVT 8 (+ un absent noté 20, exclu) ; 5e A Math 16, 18
  await evaluationWithGrades(c6a.id, math.id, p2, [10, 14]);
  await evaluationWithGrades(c6a.id, svt.id, p2, [8, 20], 1);
  await evaluationWithGrades(c5a.id, math.id, p2, [16, 18]);
  // Période 1 : ignorée quand p2 est demandée
  await evaluationWithGrades(c6a.id, math.id, p1, [2, 2, 2]);
});

describe("C3 — /api/performances agrégé en base", () => {
  it("calcule les moyennes brutes par niveau, classe et matière pour la période", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: `/api/performances?periodId=${p2}` });
    const body = res.body as Perf;

    expect(res.status).toBe(200);
    // Notes retenues : 10, 14, 8, 16, 18 → 66 / 5
    expect(body.totalEvaluations).toBe(5);
    expect(body.overallAverage).toBe(13.2);
    expect(body.performanceByLevel).toEqual([
      { name: "5e", average: 17 },
      { name: "6e", average: 10.67 },
    ]);
    expect(body.performanceByClass).toEqual([
      { name: "5e A", average: 17 },
      { name: "6e A", average: 10.67 },
    ]);
    expect(body.performanceBySubject).toEqual([
      { name: "Mathématiques", average: 14.5 },
      { name: "SVT", average: 8 },
    ]);
  });

  it("utilise la période demandée, pas les autres", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: `/api/performances?periodId=${p1}` });
    const body = res.body as Perf;

    expect(body.activePeriodId).toBe(p1);
    expect(body.totalEvaluations).toBe(3);
    expect(body.overallAverage).toBe(2);
  });
});
