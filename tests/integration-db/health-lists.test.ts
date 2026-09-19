import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET as getRecords } from "@/app/api/health/medical-records/route";
import { GET as getVaccinations } from "@/app/api/health/vaccinations/route";
import { GET as getContacts } from "@/app/api/health/emergency-contacts/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 + minimisation — listes de santé contre une vraie base.
 *
 * Appelées sans élève précis, ces routes renvoyaient à l'équipe TOUTE l'école :
 * dossiers médicaux avec allergies, vaccins et contacts imbriqués (1 539 Ko),
 * vaccinations avec l'élève (2 644 Ko), contacts d'urgence (975 Ko).
 * Aucun écran ne consomme ce mode (la page Médical interroge élève par élève).
 * Attendu : mode liste paginé (format unique) et réduit à l'identification ;
 * modes « un élève » / « un dossier » inchangés.
 */
type Pagination = { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number };

const STUDENTS = 30;
let schoolId: string;
let adminId: string;
let parentUserId: string;
const studentIds: string[] = [];

beforeAll(async () => {
  schoolId = (await createSchool("IT-HEALTH")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;

  for (let i = 0; i < STUDENTS; i++) {
    const user = await prisma.user.create({
      data: { email: `${uniqueCode(`e${i}`)}@integration.test`, password: "x", firstName: `E${i}`, lastName: "Test", role: "STUDENT", schoolId },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode(`M${i}`), schoolId } });
    studentIds.push(student.id);
    const record = await prisma.medicalRecord.create({ data: { studentId: student.id, bloodType: "O+", notes: "Asthme léger" } });
    await prisma.vaccination.createMany({
      data: [
        { medicalRecordId: record.id, vaccineName: "DT-Polio", dateGiven: new Date(Date.UTC(2020, 0, 1 + i)) },
        { medicalRecordId: record.id, vaccineName: "ROR", dateGiven: new Date(Date.UTC(2021, 0, 1 + i)) },
      ],
    });
    await prisma.emergencyContact.create({ data: { medicalRecordId: record.id, name: `Tuteur ${i}`, relationship: "PERE", phone: "0190000000" } });
  }

  const parentUser = await prisma.user.create({
    data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "Test", role: "PARENT", schoolId },
  });
  parentUserId = parentUser.id;
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: studentIds[0], relationship: "PERE" } });
});

describe("mode liste de l'équipe : paginé et minimal", () => {
  it("dossiers médicaux : première page bornée, sans allergies ni vaccins ni contacts", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getRecords, { path: "/api/health/medical-records" });
    const body = res.body as { medicalRecords: Array<Record<string, unknown>>; pagination: Pagination };

    expect(res.status).toBe(200);
    expect(body.medicalRecords).toHaveLength(20);
    expect(body.pagination).toMatchObject({ limit: 20, hasNextPage: true, total: STUDENTS });
    expect(body.medicalRecords.every((r) => r.allergies === undefined && r.vaccinations === undefined && r.emergencyContacts === undefined)).toBe(true);
  });

  it("dossiers médicaux : le curseur parcourt tous les dossiers sans doublon", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const first = await callRoute(getRecords, { path: "/api/health/medical-records" });
    const firstBody = first.body as { medicalRecords: Array<{ id: string }>; pagination: Pagination };
    const second = await callRoute(getRecords, { path: `/api/health/medical-records?cursor=${firstBody.pagination.nextCursor}` });
    const secondBody = second.body as { medicalRecords: Array<{ id: string }>; pagination: Pagination };

    const ids = [...firstBody.medicalRecords, ...secondBody.medicalRecords].map((r) => r.id);
    expect(ids).toHaveLength(STUDENTS);
    expect(new Set(ids).size).toBe(STUDENTS);
    expect(secondBody.pagination.hasNextPage).toBe(false);
  });

  it("vaccinations : liste paginée, statistiques de couverture conservées", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getVaccinations, { path: "/api/health/vaccinations" });
    const body = res.body as { vaccinations: unknown[]; pagination: Pagination; stats: { totalStudents: number } };

    expect(res.status).toBe(200);
    expect(body.vaccinations).toHaveLength(20);
    expect(body.pagination.total).toBe(STUDENTS * 2);
    expect(body.stats.totalStudents).toBe(STUDENTS);
  });

  it("contacts d'urgence : liste paginée", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getContacts, { path: "/api/health/emergency-contacts" });
    const body = res.body as { emergencyContacts: unknown[]; pagination: Pagination };

    expect(res.status).toBe(200);
    expect(body.emergencyContacts).toHaveLength(20);
    expect(body.pagination.total).toBe(STUDENTS);
  });
});

describe("modes utilisés par la page Médical : inchangés", () => {
  it("un élève : dossier complet avec allergies, vaccins et contacts", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getRecords, { path: `/api/health/medical-records?studentId=${studentIds[3]}` });
    const body = res.body as { medicalRecords: Array<{ vaccinations: unknown[]; emergencyContacts: unknown[] }> };

    expect(body.medicalRecords).toHaveLength(1);
    expect(body.medicalRecords[0].vaccinations).toHaveLength(2);
    expect(body.medicalRecords[0].emergencyContacts).toHaveLength(1);
  });

  it("un élève : toutes ses vaccinations", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(getVaccinations, { path: `/api/health/vaccinations?studentId=${studentIds[3]}` });

    expect((res.body as { vaccinations: unknown[] }).vaccinations).toHaveLength(2);
  });

  it("un parent en mode liste ne voit que son enfant", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const res = await callRoute(getRecords, { path: "/api/health/medical-records" });
    const body = res.body as { medicalRecords: Array<{ studentId: string }> };

    expect(body.medicalRecords.map((r) => r.studentId)).toEqual([studentIds[0]]);
  });
});
