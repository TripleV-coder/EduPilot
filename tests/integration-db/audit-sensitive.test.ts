import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET as GET_MEDICAL, POST as POST_MEDICAL } from "@/app/api/health/medical-records/route";
import { GET as GET_CLASSES } from "@/app/api/classes/route";
import { GET as GET_GRADES } from "@/app/api/grades/route";
import { resetReadDedup } from "@/lib/security/sensitive-data";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 6 — traçabilité : consultations et modifications de données sensibles
 * (notes, santé, paiements, rôles) laissées dans AuditLog. La trace est posée
 * au passage central, donc aucune route ne peut l'oublier.
 */
let school: string;
const ids: Record<string, string> = {};

async function makeUser(key: string, role: UserRole) {
  const user = await ownerDb.user.create({
    data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: key, lastName: "Trace", role, schoolId: school },
  });
  ids[key] = user.id;
  return user;
}

beforeAll(async () => {
  school = (await createSchool("IT-TRACE")).id;
  await ownerDb.school.update({ where: { id: school }, data: { enabledModules: [...ALL_MODULE_IDS] } });
  await makeUser("ADMIN", "SCHOOL_ADMIN");
  const student = await makeUser("ELEVE", "STUDENT");
  const profile = await ownerDb.studentProfile.create({
    data: { userId: student.id, schoolId: school, matricule: uniqueCode("M").slice(0, 20) },
  });
  ids.PROFILE = profile.id;
});

beforeEach(async () => {
  resetReadDedup();
  await ownerDb.auditLog.deleteMany({ where: { userId: ids.ADMIN } });
});

const asAdmin = () => actAs(sessionFor("SCHOOL_ADMIN", school, ids.ADMIN));
const traces = (where: Record<string, unknown> = {}) =>
  ownerDb.auditLog.findMany({ where: { userId: ids.ADMIN, ...where }, orderBy: { createdAt: "desc" } });

describe("Lot 6 — traçabilité des données sensibles", () => {
  it("consulter un dossier médical laisse une trace", async () => {
    asAdmin();
    expect((await callRoute(GET_MEDICAL, { method: "GET", path: "/api/health/medical-records" })).status).toBe(200);

    const found = await traces({ entity: "MedicalRecord" });
    expect(found).toHaveLength(1);
    expect(found[0].action).toBe("DATA_ACCESS");
    expect(found[0].schoolId).toBe(school);
  });

  it("consulter des notes laisse une trace", async () => {
    asAdmin();
    expect((await callRoute(GET_GRADES, { method: "GET", path: `/api/grades?studentId=${ids.PROFILE}` })).status).toBe(200);
    expect(await traces({ entity: "Grade", action: "DATA_ACCESS" })).toHaveLength(1);
  });

  it("les consultations répétées ne noient pas le journal", async () => {
    asAdmin();
    for (let i = 0; i < 5; i += 1) {
      await callRoute(GET_MEDICAL, { method: "GET", path: "/api/health/medical-records" });
    }
    expect(await traces({ entity: "MedicalRecord" })).toHaveLength(1);
  });

  it("modifier un dossier médical laisse une trace de modification", async () => {
    asAdmin();
    const res = await callRoute(POST_MEDICAL, {
      method: "POST",
      path: "/api/health/medical-records",
      body: { studentId: ids.PROFILE, bloodType: "O+", allergies: [], chronicDiseases: [] },
    });
    expect([200, 201], JSON.stringify(res.body)).toContain(res.status);

    const found = await traces({ entity: "MedicalRecord", action: "DATA_MODIFICATION" });
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].schoolId).toBe(school);
    expect(found[0].newValues).toMatchObject({ method: "POST" });
  });

  it("une route ordinaire ne laisse aucune trace", async () => {
    asAdmin();
    expect((await callRoute(GET_CLASSES, { method: "GET", path: "/api/classes" })).status).toBe(200);
    expect(await traces()).toHaveLength(0);
  });

  it("une requête refusée ne laisse pas de trace de modification", async () => {
    actAs(sessionFor("STUDENT", school, ids.ELEVE));
    const res = await callRoute(POST_MEDICAL, {
      method: "POST",
      path: "/api/health/medical-records",
      body: { studentId: ids.PROFILE, bloodType: "A+" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(
      await ownerDb.auditLog.count({ where: { userId: ids.ELEVE, action: "DATA_MODIFICATION" } }),
    ).toBe(0);
  });
});
