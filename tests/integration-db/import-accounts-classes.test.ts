import { beforeAll, describe, expect, it } from "vitest";
import { POST as importTeachers } from "@/app/api/import/teachers/route";
import { POST as importParents } from "@/app/api/import/parents/route";
import { POST as importClasses } from "@/app/api/import/classes/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 5 (N47) — imports des enseignants, des parents et des classes, sur une
 * vraie base, alignés sur l'import des élèves (N46) : tout ou rien, rapport
 * { row, field, message }, doublons détectés dans le fichier et en base.
 * Avant : lignes valides créées, autres ignorées ; matricule d'enfant inconnu
 * ignoré en silence (parent sans enfant) ; niveau de classe inconnu CRÉÉ à la
 * volée avec le cycle PRIMARY (donnée fausse pour un collège).
 */
let schoolId: string;
let adminId: string;
let matricule: string;
let levelCode: string;

type Report = { created: number; errors: Array<{ row: number; field?: string; message: string }> };
const email = (who: string) => `${uniqueCode(who)}@integration.test`.toLowerCase();

async function post(handler: typeof importTeachers, path: string, data: unknown[]) {
  actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
  return callRoute(handler, { method: "POST", path, body: { data } });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-N47")).id;
  adminId = (
    await ownerDb.user.create({
      data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "N47", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
  const studentUser = await ownerDb.user.create({
    data: { email: email("eleve"), password: "x", firstName: "Aïcha", lastName: "Hounsou", role: "STUDENT", schoolId },
  });
  matricule = uniqueCode("MAT");
  await ownerDb.studentProfile.create({ data: { userId: studentUser.id, schoolId, matricule } });
  levelCode = uniqueCode("6E");
  await ownerDb.classLevel.create({ data: { schoolId, name: "Sixième", code: levelCode, level: "SECONDARY_COLLEGE", sequence: 1 } });
});

describe("N47 — import des enseignants", () => {
  const teacher = (overrides: Record<string, unknown> = {}) => ({ firstName: "Koffi", lastName: "Dossou", email: email("prof"), ...overrides });

  it("tout ou rien : une ligne invalide, aucun enseignant créé", async () => {
    const before = await ownerDb.teacherProfile.count({ where: { schoolId } });
    const res = await post(importTeachers, "/api/import/teachers", [teacher(), teacher({ email: "faux" })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 2, field: "email" })]);
    expect(await ownerDb.teacherProfile.count({ where: { schoolId } })).toBe(before);
  });

  it("doublon dans le fichier signalé sur les deux lignes", async () => {
    const shared = email("double");
    const res = await post(importTeachers, "/api/import/teachers", [teacher({ email: shared }), teacher({ email: shared })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors.map((e) => e.row)).toEqual([1, 2]);
  });

  it("fichier valide : tous créés, accents conservés", async () => {
    const a = email("emile");
    const res = await post(importTeachers, "/api/import/teachers", [teacher({ firstName: "Émile", lastName: "Dègbè", email: a }), teacher()]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((res.body as Report).created).toBe(2);
    const created = await ownerDb.user.findUniqueOrThrow({ where: { email: a }, include: { teacherProfile: true } });
    expect(created).toMatchObject({ lastName: "Dègbè", role: "TEACHER", mustChangePassword: true });
    expect(created.teacherProfile?.schoolId).toBe(schoolId);
  });
});

describe("N47 — import des parents", () => {
  const parent = (overrides: Record<string, unknown> = {}) => ({
    firstName: "Fabrice",
    lastName: "Hounsou",
    email: email("parent"),
    phone: "+22990000000",
    ...overrides,
  });

  it("un matricule d'enfant inconnu est signalé au lieu d'un parent sans enfant", async () => {
    const before = await ownerDb.parentProfile.count();
    const res = await post(importParents, "/api/import/parents", [parent({ childrenMatricules: `${matricule}, INCONNU-000` })]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 1, field: "childrenMatricules" })]);
    expect(await ownerDb.parentProfile.count()).toBe(before);
  });

  it("fichier valide : parent créé et rattaché à son enfant", async () => {
    const a = email("mireille");
    const res = await post(importParents, "/api/import/parents", [parent({ email: a, childrenMatricules: matricule })]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const created = await ownerDb.user.findUniqueOrThrow({
      where: { email: a },
      include: { parentProfile: { include: { parentStudents: true } } },
    });
    expect(created.parentProfile?.parentStudents).toHaveLength(1);
  });
});

describe("N47 — import des classes", () => {
  it("un niveau inconnu est signalé au lieu d'être créé en primaire", async () => {
    const levelsBefore = await ownerDb.classLevel.count({ where: { schoolId } });
    const res = await post(importClasses, "/api/import/classes", [{ name: "6ème Z", level: "NIVEAU-INCONNU" }]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors).toEqual([expect.objectContaining({ row: 1, field: "level" })]);
    expect(await ownerDb.classLevel.count({ where: { schoolId } })).toBe(levelsBefore);
  });

  it("tout ou rien, doublon de nom dans le fichier signalé", async () => {
    const before = await ownerDb.class.count({ where: { schoolId } });
    const res = await post(importClasses, "/api/import/classes", [
      { name: "6ème B", level: levelCode },
      { name: "6ème B", level: levelCode },
    ]);
    expect(res.status).toBe(422);
    expect((res.body as Report).errors.map((e) => e.row)).toEqual([1, 2]);
    expect(await ownerDb.class.count({ where: { schoolId } })).toBe(before);
  });

  it("fichier valide : classes créées sur le niveau existant (code ou nom)", async () => {
    const res = await post(importClasses, "/api/import/classes", [
      { name: "6ème C", level: levelCode },
      { name: "6ème D", level: "Sixième" },
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((res.body as Report).created).toBe(2);
    const created = await ownerDb.class.findMany({ where: { schoolId, name: { in: ["6ème C", "6ème D"] } }, include: { classLevel: true } });
    expect(created.map((c) => c.classLevel.level)).toEqual(["SECONDARY_COLLEGE", "SECONDARY_COLLEGE"]);
  });
});
