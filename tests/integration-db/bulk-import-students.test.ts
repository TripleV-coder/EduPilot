import { beforeAll, describe, expect, it } from "vitest";
import { POST as bulkImportStudents } from "@/app/api/students/bulk-import/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N52 — `/api/students/bulk-import`, second point d'entrée de l'import des
 * élèves (appelé par aucun écran, ouvert aux appels directs de l'API) :
 * - il rattachait un parent à l'élève par simple email, sans vérification —
 *   le chemin écarté par N50 (un adulte relié aux données d'un mineur sur la
 *   foi d'une cellule de tableur) ;
 * - il importait en partie : lignes en erreur ignorées, autres créées.
 * Désormais : mêmes règles que `/api/import/students` (N46, N50, N54).
 */
let schoolId: string;
let adminId: string;
let parentEmail: string;
const CLASS_NAME = "5ème B";

type Report = {
  created: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  warnings?: Array<{ field?: string; message: string }>;
};

const email = (who: string) => `${uniqueCode(who)}@integration.test`.toLowerCase();
const row = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Koffi",
  lastName: "Adjovi",
  email: email("eleve"),
  className: CLASS_NAME,
  ...overrides,
});

async function post(students: unknown[]) {
  actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
  return callRoute(bulkImportStudents, { method: "POST", path: "/api/students/bulk-import", body: { students } });
}

async function countStudents() {
  return ownerDb.studentProfile.count({ where: { schoolId } });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-N52")).id;
  adminId = (
    await ownerDb.user.create({
      data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "N52", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  await ownerDb.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
  });
  const level = await ownerDb.classLevel.create({ data: { schoolId, name: "5e", code: uniqueCode("5E"), level: "SECONDARY_COLLEGE", sequence: 2 } });
  await ownerDb.class.create({ data: { schoolId, classLevelId: level.id, name: CLASS_NAME } });

  // Un vrai compte parent de l'établissement : l'ancien code s'y serait rattaché.
  parentEmail = email("parent");
  const parent = await ownerDb.user.create({
    data: { email: parentEmail, password: "x", firstName: "Parent", lastName: "N52", role: "PARENT", schoolId },
  });
  await ownerDb.parentProfile.create({ data: { userId: parent.id } });
});

describe("N52 — /api/students/bulk-import aligné sur l'import des élèves", () => {
  it("ne rattache plus un parent par simple email : élève créé, avertissement, aucun lien", async () => {
    const student = email("n52");
    const res = await post([row({ email: student, parentEmail })]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as Report;
    expect(body.created).toBe(1);
    expect(body.warnings).toEqual([expect.objectContaining({ field: "parentEmail" })]);

    const created = await ownerDb.user.findUniqueOrThrow({ where: { email: student }, include: { studentProfile: true } });
    expect(await ownerDb.parentStudent.count({ where: { studentId: created.studentProfile!.id } })).toBe(0);
  });

  it("tout ou rien : une ligne invalide → 422 situé, aucun élève créé", async () => {
    const before = await countStudents();
    const res = await post([row(), row({ email: "pas-un-email" })]);
    expect(res.status, JSON.stringify(res.body)).toBe(422);
    const body = res.body as Report;
    expect(body.created).toBe(0);
    expect(body.errors).toEqual([expect.objectContaining({ row: 2, field: "email" })]);
    expect(await countStudents()).toBe(before);
  });
});
