import { beforeAll, describe, expect, it } from "vitest";
import type { RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/analytics/students/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 — `GET /api/analytics/students` contre une vraie base.
 *
 * Avant (5 121 Ko sur la base de l'audit) : toutes les analyses de l'école
 * (élève × période, avec les performances par matière et l'élève complet)
 * étaient chargées, dédupliquées en JS, puis coupées par `limit` APRÈS coup —
 * sans ordre de risque : avec limit=200, une grande école voyait 200 élèves
 * quelconques, pas les plus à risque. Le filtre classId de la page Risques
 * était ignoré, et la classe n'était jamais renvoyée (« Non assignée »).
 */
type Item = { studentId: string; periodId: string; riskLevel: RiskLevel; className: string | null; subjectPerformances?: unknown; student?: unknown };

const IN_A = 20;
const IN_B = 10;

let schoolId: string;
let adminId: string;
let parentUserId: string;
let classBId: string;
let p2: string;
const studentIds: string[] = [];

/** Risque de la dernière période : 3 CRITICAL, 3 HIGH, puis LOW/NONE. */
function latestRisk(i: number): RiskLevel {
  if (i < 3) return "CRITICAL";
  if (i < 6) return "HIGH";
  return i % 2 === 0 ? "LOW" : "NONE";
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-C3-ANALYTICS")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const p1 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } })).id;
  p2 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T2", type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-31"), sequence: 2 } })).id;
  const level = await prisma.classLevel.create({ data: { schoolId, name: "3e", code: uniqueCode("3E"), level: "SECONDARY_COLLEGE", sequence: 4 } });
  const classA = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "3e A" } });
  classBId = (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "3e B" } })).id;

  for (let i = 0; i < IN_A + IN_B; i++) {
    const user = await prisma.user.create({
      data: { email: `${uniqueCode(`e${i}`)}@integration.test`, password: "x", firstName: `Élève${i}`, lastName: "Test", role: "STUDENT", schoolId },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode(`M${i}`), schoolId } });
    studentIds.push(student.id);
    await prisma.enrollment.create({ data: { studentId: student.id, classId: i < IN_A ? classA.id : classBId, academicYearId: year.id } });
    await prisma.studentAnalytics.create({ data: { studentId: student.id, periodId: p1, academicYearId: year.id, generalAverage: 12, riskLevel: "NONE" } });
    await prisma.studentAnalytics.create({
      data: { studentId: student.id, periodId: p2, academicYearId: year.id, generalAverage: 6 + (i % 10), riskLevel: latestRisk(i) },
    });
  }

  const parentUser = await prisma.user.create({
    data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "Test", role: "PARENT", schoolId },
  });
  parentUserId = parentUser.id;
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: studentIds[0], relationship: "PERE" } });
});

async function list(query = ""): Promise<Item[]> {
  const res = await callRoute(GET, { path: `/api/analytics/students${query ? `?${query}` : ""}` });
  expect(res.status).toBe(200);
  return res.body as Item[];
}

describe("C3 — /api/analytics/students", () => {
  it("renvoie la dernière analyse de chaque élève, sans détail superflu, avec sa classe", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await list();

    expect(items).toHaveLength(IN_A + IN_B);
    expect(new Set(items.map((i) => i.studentId)).size).toBe(IN_A + IN_B);
    expect(items.every((i) => i.periodId === p2)).toBe(true);
    expect(items.every((i) => i.subjectPerformances === undefined && i.student === undefined)).toBe(true);
    expect(items.filter((i) => i.className === "3e B")).toHaveLength(IN_B);
    expect(JSON.stringify(items).length / items.length).toBeLessThan(500);
  });

  it("place les élèves les plus à risque en premier", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await list();

    expect(items.slice(0, 3).map((i) => i.riskLevel)).toEqual(["CRITICAL", "CRITICAL", "CRITICAL"]);
    expect(items.slice(3, 6).map((i) => i.riskLevel)).toEqual(["HIGH", "HIGH", "HIGH"]);
  });

  it("applique la limite après le tri par risque : les plus à risque ne sont jamais écartés", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await list("limit=4");

    expect(items.map((i) => i.riskLevel)).toEqual(["CRITICAL", "CRITICAL", "CRITICAL", "HIGH"]);
  });

  it("filtre par classe (paramètre de la page Risques)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const items = await list(`latestOnly=true&classId=${classBId}`);

    expect(items).toHaveLength(IN_B);
    expect(items.every((i) => i.className === "3e B")).toBe(true);
  });

  it("limite toujours un parent à son enfant", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const items = await list();

    expect(items.map((i) => i.studentId)).toEqual([studentIds[0]]);
  });
});
