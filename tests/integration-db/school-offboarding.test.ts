import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  collectSchoolScope,
  exportSchoolData,
  purgeSchool,
  verifySchoolRemoval,
  type SchoolScope,
} from "@/lib/security/school-offboarding";
import ownerDb from "./owner-db";
import { createSchool, uniqueCode } from "./helpers";

/**
 * Lot 6 — fin de conservation d'un établissement : ses données lui sont
 * rendues, puis effacées, et l'effacement est PROUVÉ (nombre de lignes
 * restantes par table).
 */
let scope: SchoolScope;
let neighbour: { schoolId: string; userId: string };
let outDir: string;

beforeAll(async () => {
  const school = await createSchool("IT-OFF");
  const other = await createSchool("IT-OFF-VOISIN");

  const admin = await ownerDb.user.create({
    data: { email: `${uniqueCode("off-admin")}@integration.test`.toLowerCase(), password: "x", firstName: "Adja", lastName: "Sortie", role: "SCHOOL_ADMIN", schoolId: school.id },
  });
  const studentUser = await ownerDb.user.create({
    data: { email: `${uniqueCode("off-eleve")}@integration.test`.toLowerCase(), password: "x", firstName: "Koffi", lastName: "Sortie", role: "STUDENT", schoolId: school.id },
  });
  const student = await ownerDb.studentProfile.create({
    data: { userId: studentUser.id, schoolId: school.id, matricule: uniqueCode("OFF").slice(0, 20), address: "Cotonou, Akpakpa" },
  });
  await ownerDb.medicalRecord.create({ data: { studentId: student.id, bloodType: "O+" } });
  await ownerDb.auditLog.create({
    data: { userId: admin.id, schoolId: school.id, action: "DATA_ACCESS", entity: "MedicalRecord" },
  });
  await ownerDb.dataConsent.create({
    data: { userId: admin.id, consentType: "TERMS", subjectUserId: admin.id, isGranted: true, version: "2026-09-17" },
  });

  const neighbourUser = await ownerDb.user.create({
    data: { email: `${uniqueCode("off-voisin")}@integration.test`.toLowerCase(), password: "x", firstName: "Voisine", lastName: "Reste", role: "SCHOOL_ADMIN", schoolId: other.id },
  });
  neighbour = { schoolId: other.id, userId: neighbourUser.id };

  scope = await collectSchoolScope(school.id);
  outDir = await mkdtemp(path.join(tmpdir(), "edupilot-offboarding-"));
});

describe("Lot 6 — fin de conservation d'un établissement", () => {
  it("l'export contient les données de l'école, une ligne JSON par enregistrement", async () => {
    const result = await exportSchoolData(scope, outDir);
    const files = await readdir(outDir);

    expect(files).toContain("users.jsonl");
    expect(files).toContain("student_profiles.jsonl");
    expect(files).toContain("medical_records.jsonl");

    const users = (await readFile(path.join(outDir, "users.jsonl"), "utf-8")).trim().split("\n").map((l) => JSON.parse(l));
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.firstName).sort()).toEqual(["Adja", "Koffi"]);
    // Rien de l'école voisine.
    expect(users.every((u) => u.schoolId === scope.schoolId)).toBe(true);

    const students = (await readFile(path.join(outDir, "student_profiles.jsonl"), "utf-8")).trim().split("\n").map((l) => JSON.parse(l));
    expect(students[0].address).toBe("Cotonou, Akpakpa");

    expect(result.tables.find((t) => t.table === "users")?.rows).toBe(2);
  });

  it("avant la purge, le rapport montre bien des lignes restantes", async () => {
    const before = await verifySchoolRemoval(scope);
    expect(before.find((t) => t.table === "users")?.rows).toBe(2);
    expect(before.find((t) => t.table === "medical_records")?.rows).toBe(1);
  });

  it("après la purge, plus une seule ligne : le rapport est vide", async () => {
    await purgeSchool(scope);

    const remaining = await verifySchoolRemoval(scope);
    expect(remaining, JSON.stringify(remaining)).toEqual([]);

    expect(await ownerDb.school.findUnique({ where: { id: scope.schoolId } })).toBeNull();
    expect(await ownerDb.user.count({ where: { id: { in: scope.userIds } } })).toBe(0);
    expect(await ownerDb.medicalRecord.count({ where: { studentId: { in: scope.studentIds } } })).toBe(0);
    expect(await ownerDb.auditLog.count({ where: { schoolId: scope.schoolId } })).toBe(0);
  });

  it("l'établissement voisin n'est pas touché", async () => {
    expect(await ownerDb.school.findUnique({ where: { id: neighbour.schoolId } })).not.toBeNull();
    expect(await ownerDb.user.findUnique({ where: { id: neighbour.userId } })).not.toBeNull();
  });
});
