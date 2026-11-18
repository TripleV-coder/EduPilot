import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as createFee } from "@/app/api/fees/route";
import { POST as createStudent } from "@/app/api/students/route";
import { PATCH as updateStudent } from "@/app/api/students/[id]/route";

/**
 * Lot S2 (audit de souveraineté, I-01/I-02) — rien ne garantissait qu'une
 * année scolaire ne relie que des données de son établissement : un frais
 * pouvait dépendre de l'année d'une autre école (POST /api/fees, PUT
 * /api/fees/[id], POST /api/finance/fees), une inscription d'une année d'une
 * autre école que sa classe (POST /api/students, changement de classe).
 */
let schoolA: string;
let schoolB: string;
let yearA: string;
let yearB: string;
let classA: string;
let classB: string;
let adminA: Session;

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const newYear = async (schoolId: string) =>
    (await prisma.academicYear.create({ data: { schoolId, name: uniqueCode("AN"), startDate: day("2026-09-01"), endDate: day("2027-07-31") } })).id;
async function newClass(schoolId: string) {
    const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    return (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: uniqueCode("6e") } })).id;
}
async function newStudent(schoolId: string) {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "S2", role: "STUDENT", schoolId },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
}
const feeRow = (schoolId: string, academicYearId: string | null) =>
    prisma.fee.create({ data: { schoolId, academicYearId, name: `Frais ${uniqueCode("F")}`, amount: 1000 } });
const enrollmentRow = async (classId: string, academicYearId: string, studentSchool = schoolA) =>
    prisma.enrollment.create({ data: { studentId: await newStudent(studentSchool), classId, academicYearId } });
const feeRefused = /année scolaire d'un frais/;
const enrollmentRefused = /année scolaire d'une inscription/;
const yearMoveRefused = /Établissement de l'année scolaire/;
const classMoveRefused = /Établissement de la classe/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Ligne créée garde-fous désactivés : simule une donnée historique incohérente. */
async function historical<T>(table: "fees" | "enrollments", create: () => Promise<T>): Promise<T> {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
    try {
        return await create();
    } finally {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    }
}
const as = async (role: UserRole, active: string, accessible: string[]) => {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "S2", role, schoolId: active },
    });
    const base = sessionFor(role, active, user.id);
    return { ...base, user: { ...base.user, accessibleSchoolIds: accessible } } as Session;
};

beforeAll(async () => {
    [schoolA, schoolB] = [(await createSchool("IT-S2-A")).id, (await createSchool("IT-S2-B")).id];
    [yearA, yearB] = [await newYear(schoolA), await newYear(schoolB)];
    [classA, classB] = [await newClass(schoolA), await newClass(schoolB)];
    adminA = await as("SCHOOL_ADMIN", schoolA, [schoolA]);
});

describe("A. Année d'un frais : même établissement", () => {
    it("frais et année de la même école : acceptés (API et base)", async () => {
        actAs(adminA);
        const res = await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name: `Frais ${uniqueCode("F")}`, amount: 1000, academicYearId: yearA } });
        expect(res.status).toBe(201);
        await feeRow(schoolA, yearA);
        await feeRow(schoolA, null); // un frais sans année reste possible
    });

    it("année d'une autre école : 400 à l'API (aucun frais), refusée par Prisma et par SQL direct", async () => {
        actAs(adminA);
        const name = `Frais ${uniqueCode("X")}`;
        const res = await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name, amount: 1000, academicYearId: yearB } });
        expect(res.status).toBe(400);
        expect(await prisma.fee.count({ where: { name } })).toBe(0);
        await expect(feeRow(schoolA, yearB)).rejects.toThrow(feeRefused);
        await expect(prisma.$executeRawUnsafe(
            `INSERT INTO "fees" ("id", "schoolId", "academicYearId", "name", "amount", "updatedAt") VALUES ($1, $2, $3, 'X', 1000, now())`,
            uniqueCode("fee"), schoolA, yearB,
        )).rejects.toThrow(feeRefused);
    });

    it("modifications : vers l'année d'une autre école ou vers une autre école, refusées ; dans la même école ou sans année, acceptées", async () => {
        const fee = await feeRow(schoolA, yearA);
        await expect(prisma.fee.update({ where: { id: fee.id }, data: { academicYearId: yearB } })).rejects.toThrow(feeRefused);
        await expect(prisma.fee.update({ where: { id: fee.id }, data: { schoolId: schoolB } })).rejects.toThrow(feeRefused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "fees" SET "academicYearId" = $1 WHERE "id" = $2`, yearB, fee.id)).rejects.toThrow(feeRefused);
        const otherYearA = await newYear(schoolA);
        await prisma.fee.update({ where: { id: fee.id }, data: { academicYearId: otherYearA } });
        await prisma.fee.update({ where: { id: fee.id }, data: { academicYearId: null } });
        await prisma.fee.update({ where: { id: fee.id }, data: { name: "Renommé", amount: 2000 } });
        expect((await prisma.fee.findUniqueOrThrow({ where: { id: fee.id } })).academicYearId).toBeNull();
    });
});

describe("B. Année d'une inscription : établissement de la classe", () => {
    it("classe et année de la même école : acceptées", async () => {
        const e = await enrollmentRow(classA, yearA);
        expect(e.academicYearId).toBe(yearA);
    });

    it("année d'une autre école : refusée par Prisma et par SQL direct", async () => {
        await expect(enrollmentRow(classA, yearB)).rejects.toThrow(enrollmentRefused);
        const student = await newStudent(schoolA);
        await expect(prisma.$executeRawUnsafe(
            `INSERT INTO "enrollments" ("id", "studentId", "classId", "academicYearId", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
            uniqueCode("enr"), student, classA, yearB,
        )).rejects.toThrow(enrollmentRefused);
    });

    it("POST /api/students : classe d'une école, année d'une autre → 400, aucun élève créé", async () => {
        actAs(adminA);
        const email = `${uniqueCode("nouveau")}@integration.test`;
        const res = await callRoute(createStudent, {
            method: "POST", path: "/api/students",
            body: { email, firstName: "Nouvel", lastName: "Eleve", matricule: uniqueCode("MAT"), classId: classA, academicYearId: yearB },
        });
        expect(res.status).toBe(400);
        expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it("changement de classe (compte de deux écoles) vers une classe d'une autre école que l'année : 400 ; même école : accepté", async () => {
        const e = await enrollmentRow(classA, yearA);
        actAs(await as("SCHOOL_ADMIN", schoolA, [schoolA, schoolB]));
        const refused = await callRoute(updateStudent, { method: "PATCH", path: `/api/students/${e.studentId}`, params: { id: e.studentId }, body: { classId: classB } });
        expect(refused.status).toBe(400);
        expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).classId).toBe(classA);
        const otherClassA = await newClass(schoolA);
        const ok = await callRoute(updateStudent, { method: "PATCH", path: `/api/students/${e.studentId}`, params: { id: e.studentId }, body: { classId: otherClassA } });
        expect(ok.status).toBe(200);
        expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).classId).toBe(otherClassA);
    });

    it("modifications de l'inscription : vers une classe ou une année d'une autre école, refusées (Prisma et SQL)", async () => {
        const e = await enrollmentRow(classA, yearA);
        await expect(prisma.enrollment.update({ where: { id: e.id }, data: { classId: classB } })).rejects.toThrow(enrollmentRefused);
        await expect(prisma.enrollment.update({ where: { id: e.id }, data: { academicYearId: yearB } })).rejects.toThrow(enrollmentRefused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "enrollments" SET "classId" = $1 WHERE "id" = $2`, classB, e.id)).rejects.toThrow(enrollmentRefused);
        await prisma.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED" } });
    });
});

describe("Changement d'école d'une année ou d'une classe", () => {
    it("année liée à un frais ou à une inscription : changement refusé (Prisma et SQL) ; année sans lien : accepté", async () => {
        const withFee = await newYear(schoolA);
        await feeRow(schoolA, withFee);
        await expect(prisma.academicYear.update({ where: { id: withFee }, data: { schoolId: schoolB } })).rejects.toThrow(yearMoveRefused);
        const withEnrollment = await newYear(schoolA);
        await enrollmentRow(classA, withEnrollment);
        await expect(prisma.$executeRawUnsafe(`UPDATE "academic_years" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, withEnrollment)).rejects.toThrow(yearMoveRefused);
        const free = await newYear(schoolA);
        await prisma.academicYear.update({ where: { id: free }, data: { schoolId: schoolB } });
        await prisma.academicYear.update({ where: { id: withFee }, data: { name: uniqueCode("REN") } });
    });

    it("classe avec inscriptions : changement d'école refusé ; classe sans inscription : accepté", async () => {
        const used = await newClass(schoolA);
        await enrollmentRow(used, yearA);
        await expect(prisma.class.update({ where: { id: used }, data: { schoolId: schoolB } })).rejects.toThrow(classMoveRefused);
        const empty = await newClass(schoolA);
        await prisma.class.update({ where: { id: empty }, data: { schoolId: schoolB } });
    });
});

describe("Données historiques incohérentes", () => {
    it("conservées ; autres champs modifiables ; correction vers la bonne école acceptée, autre lien incohérent refusé", async () => {
        const fee = await historical("fees", () => feeRow(schoolA, yearB));
        const enrollment = await historical("enrollments", async () => enrollmentRow(classA, yearB));
        expect((await prisma.fee.findUniqueOrThrow({ where: { id: fee.id } })).academicYearId).toBe(yearB);

        await prisma.fee.update({ where: { id: fee.id }, data: { name: "Historique", amount: 3000 } });
        await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });

        const otherYearB = await newYear(schoolB);
        await expect(prisma.fee.update({ where: { id: fee.id }, data: { academicYearId: otherYearB } })).rejects.toThrow(feeRefused);
        await expect(prisma.enrollment.update({ where: { id: enrollment.id }, data: { academicYearId: otherYearB } })).rejects.toThrow(enrollmentRefused);

        await prisma.fee.update({ where: { id: fee.id }, data: { academicYearId: yearA } });
        await prisma.enrollment.update({ where: { id: enrollment.id }, data: { academicYearId: yearA } });
        expect((await prisma.fee.findUniqueOrThrow({ where: { id: fee.id } })).academicYearId).toBe(yearA);
    });
});

describe("Courses concurrentes (PostgreSQL)", () => {
    it("frais en cours sur une année, puis changement d'école de l'année : le changement attend et est refusé", async () => {
        const year = await newYear(schoolA);
        const [create, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => { await tx.fee.create({ data: { schoolId: schoolA, academicYearId: year, name: "Course", amount: 1 } }); await sleep(400); }),
            sleep(100).then(() => prisma.academicYear.update({ where: { id: year }, data: { schoolId: schoolB } })),
        ]);
        expect([create.status, move.status]).toEqual(["fulfilled", "rejected"]);
        expect((await prisma.academicYear.findUniqueOrThrow({ where: { id: year } })).schoolId).toBe(schoolA);
    });

    it("changement d'école de l'année en cours, puis frais : le frais attend et est refusé", async () => {
        const year = await newYear(schoolA);
        const [move, create] = await Promise.allSettled([
            prisma.$transaction(async (tx) => { await tx.academicYear.update({ where: { id: year }, data: { schoolId: schoolB } }); await sleep(400); }),
            sleep(100).then(() => feeRow(schoolA, year)),
        ]);
        expect([move.status, create.status]).toEqual(["fulfilled", "rejected"]);
        expect(await prisma.fee.count({ where: { academicYearId: year, schoolId: schoolA } })).toBe(0);
    });

    it("inscription en cours, puis changement d'école de la classe : le changement attend et est refusé", async () => {
        const klass = await newClass(schoolA);
        const student = await newStudent(schoolA);
        const [create, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => { await tx.enrollment.create({ data: { studentId: student, classId: klass, academicYearId: yearA } }); await sleep(400); }),
            sleep(100).then(() => prisma.class.update({ where: { id: klass }, data: { schoolId: schoolB } })),
        ]);
        expect([create.status, move.status]).toEqual(["fulfilled", "rejected"]);
        expect((await prisma.class.findUniqueOrThrow({ where: { id: klass } })).schoolId).toBe(schoolA);
    });

    it("changement d'école de la classe en cours, puis inscription : l'inscription attend et est refusée", async () => {
        const klass = await newClass(schoolA);
        const student = await newStudent(schoolA);
        const [move, create] = await Promise.allSettled([
            prisma.$transaction(async (tx) => { await tx.class.update({ where: { id: klass }, data: { schoolId: schoolB } }); await sleep(400); }),
            sleep(100).then(() => prisma.enrollment.create({ data: { studentId: student, classId: klass, academicYearId: yearA } })),
        ]);
        expect([move.status, create.status]).toEqual(["fulfilled", "rejected"]);
        expect(await prisma.enrollment.count({ where: { classId: klass } })).toBe(0);
    });

    it("inscription en cours, puis changement d'école de son année : le changement attend et est refusé", async () => {
        const year = await newYear(schoolA);
        const student = await newStudent(schoolA);
        const [create, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => { await tx.enrollment.create({ data: { studentId: student, classId: classA, academicYearId: year } }); await sleep(400); }),
            sleep(100).then(() => prisma.academicYear.update({ where: { id: year }, data: { schoolId: schoolB } })),
        ]);
        expect([create.status, move.status]).toEqual(["fulfilled", "rejected"]);
        expect((await prisma.academicYear.findUniqueOrThrow({ where: { id: year } })).schoolId).toBe(schoolA);
    });
});
