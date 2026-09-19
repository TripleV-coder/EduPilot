import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET as EXPORT_ME, DELETE as ERASE_ME } from "@/app/api/user/data/route";
import { POST as FULFILL } from "@/app/api/compliance/data-requests/[id]/fulfill/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 6 — droits des personnes (accès, rectification, effacement).
 *
 * L'audit ne les avait pas testés. Deux défauts trouvés en les déroulant :
 * `DELETE /api/user/data` anonymisait sur-le-champ (l'écran annonçait pourtant
 * « votre demande a été enregistrée »), et les demandes de rectification ou
 * d'effacement n'étaient jamais traitables (400 « type non supporté »).
 */
let school: string;
let otherSchool: string;
const ids: Record<string, string> = {};

async function makeUser(key: string, role: UserRole, schoolId = school) {
  const user = await ownerDb.user.create({
    data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: key, lastName: "Droits", role, schoolId },
  });
  ids[key] = user.id;
  return user;
}

async function makeStudent(key: string, withEnrollment: boolean) {
  const user = await makeUser(key, "STUDENT");
  const profile = await ownerDb.studentProfile.create({
    data: { userId: user.id, schoolId: school, matricule: uniqueCode(key).slice(0, 20) },
  });
  ids[`${key}:profile`] = profile.id;
  if (withEnrollment) {
    const year = await ownerDb.academicYear.create({
      data: { schoolId: school, name: `AN-${uniqueCode(key).slice(0, 6)}`, startDate: new Date("2026-09-01"), endDate: new Date("2027-07-01") },
    });
    const level = await ownerDb.classLevel.create({
      data: { schoolId: school, name: `N-${uniqueCode(key).slice(0, 6)}`, code: uniqueCode(key).slice(0, 10), level: "PRIMARY", sequence: 1 },
    });
    const klass = await ownerDb.class.create({
      data: { schoolId: school, name: `C-${uniqueCode(key).slice(0, 6)}`, classLevelId: level.id, capacity: 30 },
    });
    await ownerDb.enrollment.create({
      data: { studentId: profile.id, classId: klass.id, academicYearId: year.id, status: "ACTIVE" },
    });
  }
  return profile;
}

async function request(userId: string, requestType: "EXPORT" | "DELETION" | "RECTIFICATION") {
  return ownerDb.dataAccessRequest.create({ data: { userId, requestType } });
}

beforeAll(async () => {
  school = (await createSchool("IT-RGPD")).id;
  otherSchool = (await createSchool("IT-RGPDX")).id;
  await makeUser("ADMIN", "SCHOOL_ADMIN");
  await makeUser("ADMIN_X", "SCHOOL_ADMIN", otherSchool);
  await makeUser("PROF", "TEACHER");
  await makeStudent("PARTI", false);
  await makeStudent("INSCRIT", true);
});

const as = (key: string, role: UserRole, schoolId = school) => actAs(sessionFor(role, schoolId, ids[key]));
const fulfill = (id: string) =>
  callRoute(FULFILL, { method: "POST", path: `/api/compliance/data-requests/${id}/fulfill`, params: { id } });
const fulfillWith = (id: string, body: unknown) =>
  callRoute(FULFILL, { method: "POST", path: `/api/compliance/data-requests/${id}/fulfill`, params: { id }, body });

describe("Lot 6 — droits des personnes", () => {
  it("chacun exporte ses propres données", async () => {
    as("PROF", "TEACHER");
    const res = await callRoute(EXPORT_ME, { method: "GET", path: "/api/user/data" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as { personalInfo: { firstName: string; role: string } };
    expect(body.personalInfo.firstName).toBe("PROF");
    expect(body.personalInfo.role).toBe("TEACHER");
  });

  it("une demande d'effacement est ENREGISTRÉE, le compte n'est pas anonymisé sur-le-champ", async () => {
    as("PROF", "TEACHER");
    const res = await callRoute(ERASE_ME, { method: "DELETE", path: "/api/user/data" });
    expect(res.status, JSON.stringify(res.body)).toBe(202);

    const user = await ownerDb.user.findUniqueOrThrow({ where: { id: ids.PROF } });
    expect(user.firstName).toBe("PROF");
    expect(user.isActive).toBe(true);

    const pending = await ownerDb.dataAccessRequest.findMany({
      where: { userId: ids.PROF, requestType: "DELETION", status: "PENDING" },
    });
    expect(pending).toHaveLength(1);
  });

  it("une seconde demande ne crée pas de doublon", async () => {
    as("PROF", "TEACHER");
    expect((await callRoute(ERASE_ME, { method: "DELETE", path: "/api/user/data" })).status).toBe(202);
    expect(
      await ownerDb.dataAccessRequest.count({ where: { userId: ids.PROF, requestType: "DELETION", status: "PENDING" } }),
    ).toBe(1);
  });

  it("l'administration traite une demande d'export", async () => {
    const req = await request(ids.PARTI, "EXPORT");
    as("ADMIN", "SCHOOL_ADMIN");
    const res = await fulfill(req.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((res.body as { data: { personalInfo: { firstName: string } } }).data.personalInfo.firstName).toBe("PARTI");
    expect((await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("COMPLETED");
  });

  it("l'administration traite une demande d'effacement : le compte est anonymisé", async () => {
    const req = await request(ids.PARTI, "DELETION");
    as("ADMIN", "SCHOOL_ADMIN");
    const res = await fulfill(req.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const user = await ownerDb.user.findUniqueOrThrow({ where: { id: ids.PARTI } });
    expect(user.firstName).toBe("Utilisateur");
    expect(user.lastName).toBe("Supprimé");
    expect(user.isActive).toBe(false);
    expect(user.email).not.toContain("integration.test");

    expect((await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("COMPLETED");
    expect(
      await ownerDb.auditLog.count({ where: { action: { contains: "ANONYMIZATION" }, userId: ids.ADMIN } }),
    ).toBeGreaterThan(0);
  });

  it("un élève encore inscrit n'est pas effacé : le registre de l'école est conservé", async () => {
    const req = await request(ids.INSCRIT, "DELETION");
    as("ADMIN", "SCHOOL_ADMIN");
    const res = await fulfill(req.id);
    expect(res.status).toBe(409);
    expect((res.body as { code?: string }).code).toBe("STUDENT_STILL_ENROLLED");

    const user = await ownerDb.user.findUniqueOrThrow({ where: { id: ids.INSCRIT } });
    expect(user.firstName).toBe("INSCRIT");
    expect((await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");
  });

  it("une rectification est close en décrivant la correction faite", async () => {
    const req = await request(ids.INSCRIT, "RECTIFICATION");
    as("ADMIN", "SCHOOL_ADMIN");

    expect((await fulfill(req.id)).status).toBe(400);
    expect((await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");

    const res = await fulfillWith(req.id, { notes: "Date de naissance corrigée le 17/09/2026." });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const done = await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.processedBy).toBe(ids.ADMIN);
    expect(done.notes).toContain("Date de naissance corrigée");
  });

  it("l'administration d'une autre école ne traite rien", async () => {
    const req = await request(ids.INSCRIT, "EXPORT");
    as("ADMIN_X", "SCHOOL_ADMIN", otherSchool);
    expect((await fulfill(req.id)).status).toBe(403);
    expect((await ownerDb.dataAccessRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");
  });
});
