import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { POST as createTeacher } from "@/app/api/teachers/route";
import { POST as createStudent } from "@/app/api/students/route";
import { POST as createUser } from "@/app/api/users/route";
import { POST as importStudents } from "@/app/api/import/students/route";
import { POST as importTeachers } from "@/app/api/import/teachers/route";
import { POST as importParents } from "@/app/api/import/parents/route";
import { POST as bulkImportStudents } from "@/app/api/students/bulk-import/route";
import { POST as genericImport } from "@/app/api/import/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M1 / N31 — tout compte créé par un tiers (admin, import) reçoit un mot de
 * passe provisoire UNIQUE, communiqué une seule fois à l'auteur de la création,
 * et `mustChangePassword` (imposé par le middleware).
 *
 * Avant : créations unitaires sans mot de passe → "00000000" côté serveur (et
 * formulaires enseignant/utilisateur qui envoyaient "00000000", refusé par la
 * validation : création impossible depuis l'écran) ; mot de passe choisi par
 * l'admin jamais à changer ; imports : UN secret aléatoire par lot, partagé
 * par tous les comptes du lot et communiqué à personne.
 */
type Credential = { email: string; provisionalPassword: string };

let schoolId: string;
let classId: string;
let academicYearId: string;

const email = (prefix: string) => `${uniqueCode(prefix)}@integration.test`;

async function passwordOf(address: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: address.toLowerCase() },
    select: { password: true, mustChangePassword: true },
  });
  return user;
}

/** Chaque identifiant ouvre SON compte et aucun autre ; tous doivent changer leur mot de passe. */
async function expectDistinctWorkingCredentials(credentials: Credential[], expectedCount: number) {
  expect(credentials).toHaveLength(expectedCount);
  expect(new Set(credentials.map((c) => c.provisionalPassword)).size).toBe(expectedCount);
  for (const [i, credential] of credentials.entries()) {
    const own = await passwordOf(credential.email);
    expect(own.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(credential.provisionalPassword, own.password)).toBe(true);
    const other = credentials[(i + 1) % credentials.length];
    expect(await bcrypt.compare(other.provisionalPassword, own.password)).toBe(false);
  }
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-N31")).id;
  const admin = await prisma.user.create({
    data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "N31", role: "SCHOOL_ADMIN", schoolId },
  });
  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  academicYearId = year.id;
  const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  classId = (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e A" } })).id;
  actAs(sessionFor("SCHOOL_ADMIN", schoolId, admin.id));
});

describe("N31 — créations unitaires : plus de mot de passe partagé ni connu", () => {
  it("enseignant créé sans mot de passe (écran « Ajouter un enseignant ») : mot de passe provisoire unique renvoyé", async () => {
    const address = email("prof");
    const res = await callRoute(createTeacher, {
      method: "POST",
      path: "/api/teachers",
      body: { email: address, firstName: "Paul", lastName: "Houngbo" },
    });

    expect(res.status).toBe(201);
    const { provisionalPassword } = res.body as { provisionalPassword: string };
    expect(typeof provisionalPassword).toBe("string");
    expect(provisionalPassword).not.toBe("00000000");
    const user = await passwordOf(address);
    expect(user.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(provisionalPassword, user.password)).toBe(true);
    expect(await bcrypt.compare("00000000", user.password)).toBe(false);
  });

  it("élève créé sans mot de passe : mot de passe provisoire unique renvoyé", async () => {
    const address = email("eleve");
    const res = await callRoute(createStudent, {
      method: "POST",
      path: "/api/students",
      body: { email: address, firstName: "Awa", lastName: "Dossou", matricule: uniqueCode("MAT"), classId, academicYearId },
    });

    expect(res.status).toBe(201);
    const { provisionalPassword } = res.body as { provisionalPassword: string };
    const user = await passwordOf(address);
    expect(user.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(provisionalPassword, user.password)).toBe(true);
  });

  it("élève dont l'admin choisit le mot de passe : changement tout de même exigé (l'admin le connaît)", async () => {
    const address = email("eleve-mdp");
    const res = await callRoute(createStudent, {
      method: "POST",
      path: "/api/students",
      body: { email: address, firstName: "Kofi", lastName: "Adjovi", password: "Choisi!Admin1", matricule: uniqueCode("MAT"), classId, academicYearId },
    });

    expect(res.status).toBe(201);
    expect((res.body as { provisionalPassword?: string }).provisionalPassword).toBeUndefined();
    const user = await passwordOf(address);
    expect(user.mustChangePassword).toBe(true);
    expect(await bcrypt.compare("Choisi!Admin1", user.password)).toBe(true);
  });

  it("utilisateur créé sans mot de passe (écran « Nouvel utilisateur ») : mot de passe provisoire unique renvoyé", async () => {
    const address = email("compta");
    const res = await callRoute(createUser, {
      method: "POST",
      path: "/api/users",
      body: { email: address, firstName: "Rita", lastName: "Sossa", role: "ACCOUNTANT" },
    });

    expect(res.status).toBe(201);
    const { provisionalPassword } = res.body as { provisionalPassword: string };
    const user = await passwordOf(address);
    expect(user.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(provisionalPassword, user.password)).toBe(true);
  });
});

describe("M1 — imports : un mot de passe provisoire par compte, communiqué à l'auteur de l'import", () => {
  it("import d'élèves", async () => {
    const rows = [1, 2, 3].map((n) => ({ firstName: `Élève${n}`, lastName: "Import", email: email(`imp-s${n}`) }));
    const res = await callRoute(importStudents, { method: "POST", path: "/api/import/students", body: { data: rows } });

    expect(res.status).toBe(200);
    await expectDistinctWorkingCredentials((res.body as { credentials: Credential[] }).credentials, 3);
  });

  it("import d'enseignants", async () => {
    const rows = [1, 2].map((n) => ({ firstName: `Prof${n}`, lastName: "Import", email: email(`imp-t${n}`) }));
    const res = await callRoute(importTeachers, { method: "POST", path: "/api/import/teachers", body: { data: rows } });

    expect(res.status).toBe(200);
    await expectDistinctWorkingCredentials((res.body as { credentials: Credential[] }).credentials, 2);
  });

  it("import de parents", async () => {
    const rows = [1, 2].map((n) => ({ firstName: `Parent${n}`, lastName: "Import", email: email(`imp-p${n}`), phone: "+22997000000" }));
    const res = await callRoute(importParents, { method: "POST", path: "/api/import/parents", body: { data: rows } });

    expect(res.status).toBe(200);
    await expectDistinctWorkingCredentials((res.body as { credentials: Credential[] }).credentials, 2);
  });

  it("import groupé d'élèves (bulk-import)", async () => {
    const rows = [1, 2].map((n) => ({ firstName: `Bulk${n}`, lastName: "Import", email: email(`imp-b${n}`) }));
    const res = await callRoute(bulkImportStudents, { method: "POST", path: "/api/students/bulk-import", body: { students: rows } });

    expect(res.status).toBe(200);
    await expectDistinctWorkingCredentials((res.body as { credentials: Credential[] }).credentials, 2);
  });

  it("import générique (type STUDENTS)", async () => {
    const rows = [1, 2].map((n) => ({ firstName: `Gen${n}`, lastName: "Import", email: email(`imp-g${n}`) }));
    const res = await callRoute(genericImport, { method: "POST", path: "/api/import", body: { type: "STUDENTS", data: rows } });

    expect(res.status).toBe(200);
    await expectDistinctWorkingCredentials((res.body as { credentials: Credential[] }).credentials, 2);
  });
});
