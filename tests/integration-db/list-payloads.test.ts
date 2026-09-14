import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET as getFees } from "@/app/api/fees/route";
import { GET as getSchedules } from "@/app/api/schedules/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 — poids des listes contre une vraie base.
 *
 * /api/fees (2,8 Mo sur la base de l'audit) incluait chaque paiement de chaque
 * frais avec le nom de l'élève, alors qu'aucun écran ne les lit.
 * /api/schedules (8,9 Mo) répétait, pour CHAQUE créneau, toutes les matières
 * de la classe avec leurs enseignants — et n'incluait pas la matière du
 * créneau, que les écrans affichent (d'où « — » partout).
 */
const PAYMENTS = 50;
const SUBJECTS = 8;
const SLOTS = 40;

let schoolId: string;
let adminId: string;
let classId: string;

beforeAll(async () => {
  schoolId = (await createSchool("IT-C3-LISTS")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const fee = await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 150000, academicYearId: year.id } });

  for (let i = 0; i < PAYMENTS; i++) {
    const user = await prisma.user.create({
      data: { email: `${uniqueCode(`e${i}`)}@integration.test`, password: "x", firstName: `Élève${i}`, lastName: "Test", role: "STUDENT", schoolId },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode(`M${i}`), schoolId } });
    await prisma.payment.create({ data: { studentId: student.id, feeId: fee.id, amount: 50000, method: "CASH", status: "VERIFIED" } });
  }

  const level = await prisma.classLevel.create({ data: { schoolId, name: "4e", code: uniqueCode("4E"), level: "SECONDARY_COLLEGE", sequence: 3 } });
  classId = (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "4e A" } })).id;
  const teacherUser = await prisma.user.create({
    data: { email: `${uniqueCode("prof")}@integration.test`, password: "x", firstName: "Prof", lastName: "Test", role: "TEACHER", schoolId },
  });
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });

  const classSubjectIds: string[] = [];
  for (let i = 0; i < SUBJECTS; i++) {
    const subject = await prisma.subject.create({ data: { schoolId, name: `Matière ${i}`, code: uniqueCode(`S${i}`) } });
    classSubjectIds.push((await prisma.classSubject.create({ data: { classId, subjectId: subject.id, teacherId: teacher.id } })).id);
  }
  for (let i = 0; i < SLOTS; i++) {
    await prisma.schedule.create({
      data: {
        classId,
        classSubjectId: classSubjectIds[i % SUBJECTS],
        dayOfWeek: 1 + (i % 5),
        startTime: `${String(7 + Math.floor(i / 5)).padStart(2, "0")}:00`,
        endTime: `${String(8 + Math.floor(i / 5)).padStart(2, "0")}:00`,
      },
    });
  }
});

describe("C3 — /api/fees", () => {
  it("liste les frais sans le détail des paiements", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getFees, { path: "/api/fees" });
    const fees = res.body as Array<Record<string, unknown>>;

    expect(res.status).toBe(200);
    expect(fees).toHaveLength(1);
    expect(fees[0].payments).toBeUndefined();
    expect((fees[0].academicYear as { name?: string })?.name).toBeDefined();
    expect(JSON.stringify(fees).length).toBeLessThan(2_000);
  });
});

describe("C3 — /api/schedules", () => {
  it("donne à chaque créneau sa matière et son enseignant, sans répéter toutes les matières de la classe", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getSchedules, { path: `/api/schedules?classId=${classId}` });
    const slots = res.body as Array<{
      classId: string;
      class: Record<string, unknown>;
      classSubject?: { teacherId?: string; subject?: { name?: string } };
    }>;

    expect(res.status).toBe(200);
    expect(slots).toHaveLength(SLOTS);
    expect(slots.every((s) => s.classSubject?.subject?.name?.startsWith("Matière"))).toBe(true);
    expect(slots.every((s) => typeof s.classSubject?.teacherId === "string")).toBe(true);
    expect(slots.every((s) => s.class.classSubjects === undefined && s.class.name === "4e A")).toBe(true);
    expect(JSON.stringify(slots).length / SLOTS).toBeLessThan(600);
  });
});
