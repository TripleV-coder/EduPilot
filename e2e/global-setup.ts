/**
 * E2E global setup — runs once before any test.
 *
 * Crée ou remet à zéro des comptes DÉDIÉS aux E2E (e2e/e2e-accounts.ts) dans
 * les écoles du seed de démonstration, retrouvées par leur code, plus un petit
 * jeu de données dédié (classe, matière enseignée, élève inscrit, parent
 * rattaché). Les comptes de démonstration existants ne sont plus réécrits
 * (N17) ; les identifiants réels sont écrits dans e2e/.auth/fixtures.json (N4).
 *
 * Refuse toute base non marquée jetable (règle 6) et ne tourne jamais en production.
 */
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UserRole } from "@prisma/client";
import prisma from "../src/lib/prisma";
import { runAsSystem } from "../src/lib/db/db-context";
import { buildTeacherSchoolAssignments } from "../src/lib/teachers/school-assignments";
import { assertDisposableDatabase } from "../scripts/lib/disposable-guard.mjs";
import {
    E2E_CLASS_NAME,
    E2E_FIXTURES_FILE,
    E2E_PASSWORD,
    E2E_SCHOOL_CODES,
    E2E_STUDENT_MATRICULE,
    E2E_USERS,
    type E2EFixtures,
} from "./e2e-accounts";
import { CONSENT_TERMS, LEGAL_TERMS_VERSION } from "../src/lib/security/consent-defaults";

// Compatibilité : imports historiques depuis ce module.
export { E2E_PASSWORD, E2E_USERS } from "./e2e-accounts";
export const E2E_ADMIN_EMAIL = E2E_USERS.SCHOOL_ADMIN_1;
export const E2E_ADMIN_PASSWORD = E2E_PASSWORD;

const E2E_EVALUATION_TITLE = "E2E – évaluation dédiée";

async function schoolIdByCode(code: string): Promise<string> {
    const school = await prisma.school.findFirst({ where: { code }, select: { id: true } });
    if (!school) throw new Error(`École de démonstration « ${code} » introuvable — lancez d'abord \`npm run db:seed\`.`);
    return school.id;
}

/** Compte dédié : créé, ou remis dans un état connu (il n'appartient qu'aux E2E). */
async function upsertDedicatedUser(
    passwordHash: string,
    email: string,
    role: UserRole,
    schoolId: string | null,
    firstName: string,
): Promise<string> {
    const state = {
        password: passwordHash,
        role,
        roles: [role],
        schoolId,
        firstName,
        lastName: "E2E",
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
        isTwoFactorEnabled: false,
        mustChangePassword: false,
    };
    const user = await prisma.user.upsert({
        where: { email },
        create: { email, ...state },
        update: state,
        select: { id: true },
    });
    // Lot 6 : comptes E2E dédiés — conditions déjà acceptées, sinon chaque
    // scénario s'arrêterait sur l'écran de consentement. Cet écran a son propre
    // parcours dans e2e/fresh-install (compte réellement neuf).
    const consent = {
        isGranted: true,
        version: LEGAL_TERMS_VERSION,
        grantedAt: new Date(),
        revokedAt: null,
    };
    await prisma.dataConsent.upsert({
        where: {
            userId_consentType_subjectUserId: {
                userId: user.id,
                consentType: CONSENT_TERMS,
                subjectUserId: user.id,
            },
        },
        create: { userId: user.id, consentType: CONSENT_TERMS, subjectUserId: user.id, ...consent },
        update: consent,
    });
    return user.id;
}

async function prepareDedicatedData(): Promise<E2EFixtures> {
    const school1 = await schoolIdByCode(E2E_SCHOOL_CODES.SCHOOL_1);
    const school2 = await schoolIdByCode(E2E_SCHOOL_CODES.SCHOOL_2);
    const hash = await bcrypt.hash(E2E_PASSWORD, 12);

    await upsertDedicatedUser(hash, E2E_USERS.SUPER_ADMIN, "SUPER_ADMIN", null, "Root");
    await upsertDedicatedUser(hash, E2E_USERS.SCHOOL_ADMIN_1, "SCHOOL_ADMIN", school1, "Admin1");
    await upsertDedicatedUser(hash, E2E_USERS.SCHOOL_ADMIN_2, "SCHOOL_ADMIN", school2, "Admin2");
    await upsertDedicatedUser(hash, E2E_USERS.DIRECTOR_1, "DIRECTOR", school1, "Directeur");
    await upsertDedicatedUser(hash, E2E_USERS.ACCOUNTANT_1, "ACCOUNTANT", school1, "Comptable");
    const teacherUserId = await upsertDedicatedUser(hash, E2E_USERS.TEACHER_1, "TEACHER", school1, "Enseignant");
    const studentUserId = await upsertDedicatedUser(hash, E2E_USERS.STUDENT_1, "STUDENT", school1, "Élève");
    const parentUserId = await upsertDedicatedUser(hash, E2E_USERS.PARENT_1, "PARENT", school1, "Parent");

    const teacher = await prisma.teacherProfile.upsert({
        where: { userId: teacherUserId },
        create: { userId: teacherUserId, schoolId: school1, specialization: "Mathématiques" },
        update: { schoolId: school1 },
        select: { id: true },
    });
    await prisma.teacherSchoolAssignment.createMany({
        data: buildTeacherSchoolAssignments({ teacherId: teacher.id, userId: teacherUserId, primarySchoolId: school1, schoolIds: [school1] }),
        skipDuplicates: true,
    });

    const [level, subject, year] = await Promise.all([
        prisma.classLevel.findFirst({ where: { schoolId: school1 }, orderBy: { sequence: "asc" }, select: { id: true } }),
        prisma.subject.findFirst({ where: { schoolId: school1 }, orderBy: { code: "asc" }, select: { id: true } }),
        prisma.academicYear.findFirst({ where: { schoolId: school1, isCurrent: true }, select: { id: true } }),
    ]);
    if (!level || !subject || !year) {
        throw new Error("Seed de démonstration incomplet (niveau, matière ou année en cours manquant à Saint-Michel).");
    }

    const klass = await prisma.class.upsert({
        where: { schoolId_classLevelId_name: { schoolId: school1, classLevelId: level.id, name: E2E_CLASS_NAME } },
        create: { schoolId: school1, classLevelId: level.id, name: E2E_CLASS_NAME, mainTeacherId: teacher.id },
        update: { mainTeacherId: teacher.id },
        select: { id: true },
    });
    const classSubject = await prisma.classSubject.upsert({
        where: { classId_subjectId: { classId: klass.id, subjectId: subject.id } },
        create: { classId: klass.id, subjectId: subject.id, teacherId: teacher.id },
        update: { teacherId: teacher.id },
        select: { id: true },
    });

    // Une évaluation dédiée : la page Notes de l'enseignant liste ses évaluations.
    const [period, evaluationType] = await Promise.all([
        prisma.period.findFirst({ where: { academicYearId: year.id }, orderBy: { sequence: "asc" }, select: { id: true } }),
        prisma.evaluationType.findFirst({ where: { schoolId: school1 }, orderBy: { code: "asc" }, select: { id: true } }),
    ]);
    if (!period || !evaluationType) {
        throw new Error("Seed de démonstration incomplet (période ou type d'évaluation manquant à Saint-Michel).");
    }
    const existingEvaluation = await prisma.evaluation.findFirst({
        where: { classSubjectId: classSubject.id, title: E2E_EVALUATION_TITLE },
        select: { id: true },
    });
    if (!existingEvaluation) {
        await prisma.evaluation.create({
            data: {
                classSubjectId: classSubject.id,
                periodId: period.id,
                typeId: evaluationType.id,
                title: E2E_EVALUATION_TITLE,
                date: new Date(),
            },
        });
    }

    const student = await prisma.studentProfile.upsert({
        where: { userId: studentUserId },
        create: { userId: studentUserId, schoolId: school1, matricule: E2E_STUDENT_MATRICULE },
        update: { schoolId: school1 },
        select: { id: true },
    });
    const enrolled = await prisma.enrollment.findFirst({
        where: { studentId: student.id, classId: klass.id, academicYearId: year.id },
        select: { id: true },
    });
    if (!enrolled) {
        await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id, status: "ACTIVE" } });
    }

    const parent = await prisma.parentProfile.upsert({
        where: { userId: parentUserId },
        create: { userId: parentUserId },
        update: {},
        select: { id: true },
    });
    await prisma.parentStudent.upsert({
        where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
        create: { parentId: parent.id, studentId: student.id, relationship: "PARENT", isPrimary: true },
        update: {},
    });

    return { SCHOOL_1_ID: school1, SCHOOL_2_ID: school2, SCHOOL_1_CLASS_ID: klass.id };
}

export default async function globalSetup() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("E2E global setup must not run in production.");
    }
    // Règle 6 / N17 : écrit des comptes et des données → base marquée jetable
    // obligatoire (scripts/db/mark-disposable.mjs), jamais la base locale ou réelle.
    await assertDisposableDatabase(prisma, "e2e/global-setup.ts");

    // Préparation hors de toute session : contexte système déclaré (RLS, audit M2).
    const fixtures = await runAsSystem("e2e:global-setup", prepareDedicatedData);
    mkdirSync(path.dirname(E2E_FIXTURES_FILE), { recursive: true });
    writeFileSync(E2E_FIXTURES_FILE, JSON.stringify(fixtures, null, 2));

    console.log(`[e2e] ${Object.keys(E2E_USERS).length} comptes dédiés prêts ; identifiants dans ${path.relative(process.cwd(), E2E_FIXTURES_FILE)}`);
    await prisma.$disconnect();
}
