import { beforeAll, describe, expect, it } from "vitest";
import { POST as genericImport } from "@/app/api/import/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N55 — `/api/import` (type STUDENTS), troisième point d'entrée de l'import
 * des élèves (appel direct de l'API, aucun écran) :
 * - l'établissement lu dans la requête était pris tel quel, quel que soit le
 *   rôle : un administrateur pouvait créer des élèves dans une autre école ;
 * - un prénom ou un nom manquant devenait « Élève » / « Nouveau » (données
 *   inventées) ; aucune validation d'email, de doublon ni de date ;
 * - classe, date de naissance, genre, adresse ignorés en silence.
 * Désormais : mêmes règles que `/api/import/students` (N46, N50, N54).
 */
let schoolA: string;
let schoolB: string;
let adminA: string;
const CLASS_NAME = "4ème C";

type Report = { created: number; errors: Array<{ row: number; field?: string; message: string }> };

const email = (who: string) => `${uniqueCode(who)}@integration.test`.toLowerCase();
const row = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Sèna",
  lastName: "Agossou",
  email: email("eleve"),
  className: CLASS_NAME,
  ...overrides,
});

async function post(body: Record<string, unknown>) {
  actAs(sessionFor("SCHOOL_ADMIN", schoolA, adminA));
  return callRoute(genericImport, { method: "POST", path: "/api/import", body: { type: "STUDENTS", ...body } });
}

const countIn = (schoolId: string) => ownerDb.studentProfile.count({ where: { schoolId } });

beforeAll(async () => {
  schoolA = (await createSchool("IT-N55A")).id;
  schoolB = (await createSchool("IT-N55B")).id;
  adminA = (
    await ownerDb.user.create({
      data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "N55", role: "SCHOOL_ADMIN", schoolId: schoolA },
    })
  ).id;
  await ownerDb.academicYear.create({
    data: { schoolId: schoolA, name: uniqueCode("2026"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
  });
  const level = await ownerDb.classLevel.create({ data: { schoolId: schoolA, name: "4e", code: uniqueCode("4E"), level: "SECONDARY_COLLEGE", sequence: 3 } });
  await ownerDb.class.create({ data: { schoolId: schoolA, classLevelId: level.id, name: CLASS_NAME } });
});

describe("N55 — /api/import (STUDENTS) aligné sur l'import des élèves", () => {
  it("un administrateur n'écrit jamais dans une autre école que la sienne", async () => {
    const [beforeA, beforeB] = [await countIn(schoolA), await countIn(schoolB)];
    const res = await post({ schoolId: schoolB, data: [row()] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await countIn(schoolB)).toBe(beforeB);
    expect(await countIn(schoolA)).toBe(beforeA + 1);
  });

  it("un prénom manquant est signalé, jamais remplacé par un nom inventé", async () => {
    const before = await countIn(schoolA);
    const res = await post({ data: [row({ firstName: "" })] });
    expect(res.status, JSON.stringify(res.body)).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 1, field: "firstName" })]);
    expect(await countIn(schoolA)).toBe(before);
    expect(await ownerDb.user.count({ where: { firstName: "Élève", lastName: "Nouveau", schoolId: schoolA } })).toBe(0);
  });

  it("classe, date de naissance et adresse fournies sont enregistrées", async () => {
    const student = email("complet");
    const res = await post({ data: [row({ email: student, dateOfBirth: "07/06/2013", address: "Gbégamey, Cotonou" })] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const created = await ownerDb.user.findUniqueOrThrow({
      where: { email: student },
      include: { studentProfile: { include: { enrollments: true } } },
    });
    expect(created.studentProfile?.address).toBe("Gbégamey, Cotonou");
    expect(created.studentProfile?.dateOfBirth?.toISOString().slice(0, 10)).toBe("2013-06-07");
    expect(created.studentProfile?.enrollments).toHaveLength(1);
  });
});
