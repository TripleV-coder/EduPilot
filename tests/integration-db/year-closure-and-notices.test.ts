import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { PATCH as PATCH_STATUS } from "@/app/api/academic-years/[id]/status/route";
import { POST as POST_GRADES } from "@/app/api/grades/batch/route";
import { POST as POST_ATTENDANCE } from "@/app/api/attendance/bulk/route";
import { POST as POST_EVALUATION } from "@/app/api/evaluations/route";
import { POST as POST_NOTICES } from "@/app/api/finance/payment-notices/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * TD-018 (clôture d'année) et TD-017 (avis de paiement) contre une vraie base,
 * à travers createApiHandler et la RLS : `evaluations`, `grades`,
 * `attendances` et `payments` sont des tables couvertes.
 */
let schoolId: string;
let adminId: string;
let yearId: string;
let periodId: string;
let classSubjectId: string;
let typeId: string;
let classId: string;
let levelId: string;
let evaluationId: string;
let feeId: string;
const students: string[] = [];

beforeAll(async () => {
  schoolId = (await createSchool("IT-CLOSE")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
  });
  yearId = year.id;
  periodId = (
    await prisma.period.create({
      data: { academicYearId: yearId, name: "T1", type: "TRIMESTER", startDate: new Date("2026-09-01"), endDate: new Date("2099-12-20"), sequence: 1 },
    })
  ).id;
  const levelCode = uniqueCode("6E");
  levelId = (await prisma.classLevel.create({ data: { schoolId, name: "6ème", code: levelCode, level: "SECONDARY_COLLEGE", sequence: 1 } })).id;
  classId = (await prisma.class.create({ data: { schoolId, classLevelId: levelId, name: "6e A" } })).id;
  const subjectId = (await prisma.subject.create({ data: { schoolId, name: "Maths", code: uniqueCode("M") } })).id;
  classSubjectId = (await prisma.classSubject.create({ data: { classId, subjectId } })).id;
  typeId = (await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("DV") } })).id;
  evaluationId = (
    await prisma.evaluation.create({ data: { classSubjectId, periodId, typeId, date: new Date("2026-10-01") } })
  ).id;

  for (const [first, last] of [["Awa", "Zinsou"], ["Koffi", "Adjovi"], ["Sena", "Houngbo"]]) {
    const user = await prisma.user.create({
      data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: last, role: "STUDENT", schoolId },
    });
    const profile = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode(last), schoolId } });
    students.push(profile.id);
  }
  await prisma.enrollment.createMany({ data: students.map((studentId) => ({ studentId, classId, academicYearId: yearId })) });

  feeId = (
    await prisma.fee.create({ data: { schoolId, academicYearId: yearId, name: "Scolarité T1", amount: 45000, classLevelCode: levelCode } })
  ).id;
  const pay = (studentId: string, amount: number, status: "VERIFIED" | "RECONCILED" | "PENDING" | "CANCELLED") =>
    ({ studentId, feeId, amount, method: "CASH" as const, status });
  await prisma.payment.createMany({
    data: [
      pay(students[0], 45000, "VERIFIED"), // Zinsou : soldé
      pay(students[1], 5000, "RECONCILED"), // Adjovi : 5 000 réglés…
      pay(students[1], 10000, "PENDING"), // … 10 000 déclarés, non déduits
      pay(students[2], 45000, "CANCELLED"), // Houngbo : annulé, ne compte pas
    ],
  });
});

const gradeBody = () => ({ evaluationId, grades: [{ studentId: students[0], value: 14 }] });

describe("TD-018 — clôture d'année", () => {
  it("avant clôture, les notes s'écrivent", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(POST_GRADES, { method: "POST", path: "/api/grades/batch", body: gradeBody() });
    expect(res.status).toBe(201);
  });

  it("demande confirmation tant que des inscriptions sont actives, puis clôture et journalise", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const path = `/api/academic-years/${yearId}/status`;

    const refused = await callRoute(PATCH_STATUS, { method: "PATCH", path, params: { id: yearId }, body: { action: "close" } });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: "ACTIVE_ENROLLMENTS", activeEnrollments: 3 });

    const closed = await callRoute(PATCH_STATUS, { method: "PATCH", path, params: { id: yearId }, body: { action: "close", force: true } });
    expect(closed.status).toBe(200);
    expect(await prisma.academicYear.findUnique({ where: { id: yearId }, select: { status: true, isCurrent: true } })).toEqual({
      status: "CLOSED",
      isCurrent: false,
    });
    expect(await prisma.auditLog.count({ where: { entityId: yearId, action: "ACADEMIC_YEAR_CLOSED" } })).toBe(1);
  });

  it("une année clôturée refuse notes, présences et évaluations (409)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));

    const grades = await callRoute(POST_GRADES, { method: "POST", path: "/api/grades/batch", body: gradeBody() });
    expect(grades.status).toBe(409);
    expect(grades.body).toMatchObject({ code: "ACADEMIC_YEAR_CLOSED" });

    const attendance = await callRoute(POST_ATTENDANCE, {
      method: "POST",
      path: "/api/attendance/bulk",
      body: { classId, date: "2026-10-05", records: [{ studentId: students[0], status: "ABSENT" }] },
    });
    expect(attendance.status).toBe(409);
    expect(await prisma.attendance.count({ where: { classId } })).toBe(0);

    const evaluation = await callRoute(POST_EVALUATION, {
      method: "POST",
      path: "/api/evaluations",
      body: { classSubjectId, periodId, typeId, date: "2026-10-10" },
    });
    expect(evaluation.status).toBe(409);
  });

  it("un directeur ne peut pas rouvrir ; l'administration si, et les écritures reprennent", async () => {
    const path = `/api/academic-years/${yearId}/status`;
    actAs(sessionFor("DIRECTOR", schoolId));
    const denied = await callRoute(PATCH_STATUS, { method: "PATCH", path, params: { id: yearId }, body: { action: "reopen" } });
    expect(denied.status).toBe(403);

    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const reopened = await callRoute(PATCH_STATUS, { method: "PATCH", path, params: { id: yearId }, body: { action: "reopen" } });
    expect(reopened.status).toBe(200);

    const grades = await callRoute(POST_GRADES, { method: "POST", path: "/api/grades/batch", body: gradeBody() });
    expect(grades.status).toBe(201);
  });

  it("une autre école ne voit pas l'année (404)", async () => {
    const other = await createSchool("IT-CLOSE-OTHER");
    actAs(sessionFor("SCHOOL_ADMIN", other.id));
    const res = await callRoute(PATCH_STATUS, {
      method: "PATCH",
      path: `/api/academic-years/${yearId}/status`,
      params: { id: yearId },
      body: { action: "close", force: true },
    });
    expect(res.status).toBe(404);
  });
});

describe("TD-017 — avis de paiement", () => {
  it("reste à payer par élève, sous RLS : seuls les paiements validés sont déduits", async () => {
    actAs(sessionFor("ACCOUNTANT", schoolId));
    const res = await callRoute(POST_NOTICES, {
      method: "POST",
      path: "/api/finance/payment-notices",
      body: { feeId, classLevelId: levelId },
    });
    expect(res.status).toBe(200);
    const body = res.body as { rows: Array<{ lastName: string; paid: number; pending: number; remaining: number }>; totals: unknown };
    expect(body.rows.map(({ lastName, paid, pending, remaining }) => ({ lastName, paid, pending, remaining }))).toEqual([
      { lastName: "Adjovi", paid: 5000, pending: 10000, remaining: 40000 },
      { lastName: "Houngbo", paid: 0, pending: 0, remaining: 45000 },
      { lastName: "Zinsou", paid: 45000, pending: 0, remaining: 0 },
    ]);
    expect(body.totals).toEqual({ students: 3, debtors: 2, due: 135000, paid: 50000, remaining: 85000 });
  });

  it("produit un PDF", async () => {
    actAs(sessionFor("ACCOUNTANT", schoolId));
    const res = await callRoute(POST_NOTICES, {
      method: "POST",
      path: "/api/finance/payment-notices",
      body: { feeId, classLevelId: levelId, format: "pdf" },
    });
    expect(res.status).toBe(200);
    expect(String(res.body).startsWith("%PDF-")).toBe(true);
  });

  it("le frais d'une autre école est introuvable (404)", async () => {
    const other = await createSchool("IT-NOTICE-OTHER");
    actAs(sessionFor("ACCOUNTANT", other.id));
    const res = await callRoute(POST_NOTICES, {
      method: "POST",
      path: "/api/finance/payment-notices",
      body: { feeId, classLevelId: levelId },
    });
    expect(res.status).toBe(404);
  });
});
