import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { hasPermission, Permission } from "@/lib/rbac/permissions";
import { GET as profile360 } from "@/app/api/students/[id]/profile-360/route";

/**
 * Faille profile-360 (audit du parcours parent, 2026-10-17) — la route ne
 * contrôlait que la permission STUDENT_READ, que détiennent PARENT et
 * STUDENT, et l'accès à l'école : un parent ou un élève lisait la fiche 360
 * de n'importe quel élève de l'école (contacts des parents, allergies, rang).
 */
let schoolA: string;
let schoolB: string;
let child: string;
let classmate: string;
let foreign: string;
let parentUser: string;
let childUser: string;
let classmateUser: string;
const SECRET_EMAIL = `${uniqueCode("parent-camarade")}@integration.test`;
const SECRET_ALLERGEN = `Allergene-${uniqueCode("A")}`;

async function user(role: UserRole, schoolId: string | null, firstName = role) {
    return prisma.user.create({
        data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName, lastName: "P360", role, schoolId },
    });
}
async function student(schoolId: string, firstName: string) {
    const u = await user("STUDENT", schoolId, firstName);
    const profile = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode("MAT"), schoolId } });
    return { id: profile.id, userId: u.id };
}
const get = (id: string) => callRoute(profile360, { method: "GET", path: `/api/students/${id}/profile-360`, params: { id } });
const as = async (role: UserRole, schoolId: string | null, userId?: string) =>
    actAs(sessionFor(role, schoolId, userId ?? (await user(role, schoolId)).id));

beforeAll(async () => {
    [schoolA, schoolB] = [(await createSchool("IT-P360-A")).id, (await createSchool("IT-P360-B")).id];
    ({ id: child, userId: childUser } = await student(schoolA, "Enfant"));
    ({ id: classmate, userId: classmateUser } = await student(schoolA, "Camarade"));
    ({ id: foreign } = await student(schoolB, "Etranger"));

    const parent = await user("PARENT", schoolA, "Parent");
    parentUser = parent.id;
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId: child, relationship: "PARENT" } });

    // Données sensibles du camarade : contact d'un autre parent, allergie
    const otherParent = await prisma.user.create({
        data: { email: SECRET_EMAIL, password: "x", firstName: "Autre", lastName: "Parent", role: "PARENT", schoolId: schoolA },
    });
    const otherProfile = await prisma.parentProfile.create({ data: { userId: otherParent.id } });
    await prisma.parentStudent.create({ data: { parentId: otherProfile.id, studentId: classmate, relationship: "PARENT" } });
    await prisma.medicalRecord.create({
        data: { studentId: classmate, allergies: { create: [{ allergen: SECRET_ALLERGEN, severity: "HIGH" }] } },
    });
});

/**
 * Un refus ne laisse passer aucune donnée de l'élève demandé : 403 dans
 * l'école, 404 hors école (la RLS masque la fiche d'un autre établissement).
 */
function expectRefusedWithoutData(res: { status: number; body: unknown }, status: 403 | 404 = 403) {
    expect(res.status).toBe(status);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(SECRET_EMAIL);
    expect(text).not.toContain(SECRET_ALLERGEN);
    expect(text).not.toContain("Camarade");
    expect(text).not.toContain("Etranger");
}

describe("profile-360 : parents et élèves limités à leurs propres fiches", () => {
    it("PARENT détient STUDENT_READ : son refus vient du contrôle de lien, pas de la permission", () => {
        expect(hasPermission("PARENT", Permission.STUDENT_READ)).toBe(true);
        // STUDENT n'a pas STUDENT_READ : il est refusé avant même le contrôle de lien
        expect(hasPermission("STUDENT", Permission.STUDENT_READ)).toBe(false);
    });

    it("un parent accède à la fiche de son enfant", async () => {
        await as("PARENT", schoolA, parentUser);
        const res = await get(child);
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).toContain("Enfant");
    });

    it("un parent ne peut pas lire la fiche d'un autre élève de la même école", async () => {
        await as("PARENT", schoolA, parentUser);
        expectRefusedWithoutData(await get(classmate));
    });

    it("un parent ne peut pas lire la fiche d'un élève d'une autre école", async () => {
        await as("PARENT", schoolA, parentUser);
        expectRefusedWithoutData(await get(foreign), 404);
    });

    it("un élève ne peut pas consulter la fiche d'un camarade", async () => {
        await as("STUDENT", schoolA, childUser);
        expectRefusedWithoutData(await get(classmate));
        await as("STUDENT", schoolA, classmateUser);
        expectRefusedWithoutData(await get(child));
    });

    it("les personnels de l'école conservent l'accès (direction, comptabilité, enseignant)", async () => {
        for (const role of ["SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER"] as const) {
            await as(role, schoolA);
            const res = await get(classmate);
            expect(res.status, role).toBe(200);
            expect(JSON.stringify(res.body), role).toContain(SECRET_ALLERGEN);
        }
    });

    it("un personnel d'une autre école reste refusé", async () => {
        await as("SCHOOL_ADMIN", schoolB);
        expectRefusedWithoutData(await get(classmate), 404);
    });
});
