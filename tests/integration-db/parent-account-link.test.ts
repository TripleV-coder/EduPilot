import { beforeAll, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/users/route";
import { POST as issueLinkCode } from "@/app/api/students/[id]/link-code/route";
import { POST as linkChild } from "@/app/api/parents/link-child/route";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Démarrage à vide (Lot 5, N37) — un parent doit pouvoir être créé depuis
 * l'interface (« Nouvel utilisateur », rôle Parent) puis rattacher son enfant
 * avec le code de liaison émis par l'école. Sans profil parent créé avec le
 * compte, /api/parents/link-child répondait 404 : aucun parent ne pouvait
 * consulter les notes d'une installation neuve (l'import CSV était le seul chemin).
 */
let schoolId: string;
let adminId: string;
let studentId: string;
let matricule: string;

beforeAll(async () => {
  const school = await createSchool("IT-N37");
  schoolId = school.id;
  const admin = await ownerDb.user.create({
    data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "N37", role: "SCHOOL_ADMIN", schoolId },
  });
  adminId = admin.id;
  const studentUser = await ownerDb.user.create({
    data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Aïcha", lastName: "Hounsou", role: "STUDENT", schoolId },
  });
  matricule = uniqueCode("MAT");
  const student = await ownerDb.studentProfile.create({ data: { userId: studentUser.id, schoolId, matricule } });
  studentId = student.id;
});

describe("N37 — compte parent créé depuis l'interface, puis rattaché", () => {
  it("POST /api/users (rôle PARENT) crée le compte et son profil parent", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const email = `${uniqueCode("parent")}@integration.test`;
    const res = await callRoute(createUser, {
      method: "POST",
      path: "/api/users",
      body: { firstName: "Fabrice", lastName: "Hounsou", email, role: "PARENT" },
    });
    expect(res.status).toBe(201);

    const user = await ownerDb.user.findUniqueOrThrow({ where: { email }, include: { parentProfile: true } });
    expect(user).toMatchObject({ role: "PARENT", schoolId, mustChangePassword: true });
    expect(user.parentProfile).not.toBeNull();
  });

  it("le parent rattache son enfant avec le code émis par l'école", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const email = `${uniqueCode("parent")}@integration.test`;
    const created = await callRoute(createUser, {
      method: "POST",
      path: "/api/users",
      body: { firstName: "Mireille", lastName: "Hounsou", email, role: "PARENT" },
    });
    expect(created.status).toBe(201);
    const parentUser = await ownerDb.user.findUniqueOrThrow({ where: { email } });

    const issued = await callRoute(issueLinkCode, {
      method: "POST",
      path: `/api/students/${studentId}/link-code`,
      params: { id: studentId },
    });
    expect(issued.status).toBeLessThan(300);
    const code = (issued.body as { code: string }).code;

    actAs(sessionFor("PARENT", schoolId, parentUser.id));
    const linked = await callRoute(linkChild, {
      method: "POST",
      path: "/api/parents/link-child",
      body: { matricule, verificationCode: code },
    });
    expect(linked.status, JSON.stringify(linked.body)).toBeLessThan(300);

    const parentProfile = await ownerDb.parentProfile.findUniqueOrThrow({ where: { userId: parentUser.id } });
    expect(await ownerDb.parentStudent.count({ where: { parentId: parentProfile.id, studentId } })).toBe(1);
  });
});
