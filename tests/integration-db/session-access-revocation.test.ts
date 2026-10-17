import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { authConfig } from "@/lib/auth/config";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";
import { detachTeacherFromSchool } from "@/lib/teachers/school-membership";
import { GET as listClasses } from "@/app/api/classes/route";
import { GET as listStudents } from "@/app/api/students/route";

/**
 * Audit MS-01 (docs/audit-2026-10-15/07-multi-ecoles-et-cache.md) — un droit
 * d'établissement retiré pendant une session ouverte restait dans le jeton
 * jusqu'à son expiration (24 h) : la liste des écoles accessibles n'était
 * recalculée qu'à la connexion ou à un changement d'école explicite.
 *
 * Chaque test passe par les VRAIS callbacks `jwt` puis `session` d'Auth.js
 * (ceux qu'exécute `auth()` à chaque requête), puis appelle les routes avec la
 * session obtenue. Chaque test crée ses propres comptes : aucun ne dépend de
 * l'ordre d'exécution ni du cache laissé par un autre.
 */
let A: TenantGraph;
let B: TenantGraph;

const jwt = (args: Record<string, unknown>) => authConfig.callbacks!.jwt!(args as never) as Promise<JWT>;
const toSession = async (token: JWT): Promise<Session> =>
    (await authConfig.callbacks!.session!({
        session: { user: {}, expires: new Date(Date.now() + 3_600_000).toISOString() },
        token,
    } as never)) as Session;
/** Jeton tel qu'émis à la connexion, avant le retrait. */
const loginToken = (userId: string, role: UserRole, primary: string, active: string, accessible: string[]) =>
    ({ id: userId, role, schoolId: active, primarySchoolId: primary, accessibleSchoolIds: accessible, iat: Math.floor(Date.now() / 1000) - 60 }) as JWT;
const classNames = (body: unknown) => ((body as { data?: Array<{ name: string }> }).data ?? []).map((c) => c.name);

/** Enseignant principal en A, rattaché à B et y enseignant une classe. */
async function teacherInAandB() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("rev-prof")}@integration.test`, password: "x", firstName: "Prof", lastName: "Revocation", role: "TEACHER", schoolId: A.schoolId },
    });
    const teacher = await prisma.teacherProfile.create({ data: { userId: user.id, schoolId: A.schoolId } });
    await prisma.teacherSchoolAssignment.createMany({
        data: [
            { teacherId: teacher.id, userId: user.id, schoolId: A.schoolId, status: "ACTIVE", isPrimary: true },
            { teacherId: teacher.id, userId: user.id, schoolId: B.schoolId, status: "ACTIVE", isPrimary: false },
        ],
    });
    for (const g of [A, B]) {
        const subject = await prisma.subject.create({ data: { schoolId: g.schoolId, name: "SVT", code: uniqueCode("SVT") } });
        await prisma.classSubject.create({ data: { classId: g.ids.class, subjectId: subject.id, teacherId: teacher.id } });
    }
    return { userId: user.id, teacherId: teacher.id };
}

beforeAll(async () => {
    [A, B] = await Promise.all([seedTenantGraph("REV-A"), seedTenantGraph("REV-B")]);
    await prisma.school.updateMany({ where: { id: { in: [A.schoolId, B.schoolId] } }, data: { enabledModules: [...ALL_MODULE_IDS] } });
    await prisma.class.update({ where: { id: A.ids.class }, data: { name: "Classe-ALPHA" } });
    await prisma.class.update({ where: { id: B.ids.class }, data: { name: "Classe-BRAVO" } });
});

describe("Retrait d'une école pendant une session ouverte", () => {
    it("enseignant retiré de B : le jeton suivant perd B et revient sur A, sans reconnexion", async () => {
        const t = await teacherInAandB();
        const token = loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        // Requête avant le retrait : B est bien accessible (et le statut est mis en cache)
        const before = await jwt({ token: { ...token } });
        expect(before.accessibleSchoolIds).toEqual(expect.arrayContaining([A.schoolId, B.schoolId]));
        expect(before.schoolId).toBe(B.schoolId);

        expect(await detachTeacherFromSchool({ teacherId: t.teacherId, schoolId: B.schoolId, actorUserId: B.adminId, by: "SCHOOL" })).toEqual({ ok: true });

        const after = await jwt({ token: { ...token } });
        expect(after.invalidated).toBeUndefined();
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(after.schoolId).toBe(A.schoolId);
        const session = await toSession(after);
        expect(session.user.schoolId).toBe(A.schoolId);
        expect(session.user.accessibleSchoolIds).not.toContain(B.schoolId);
    });

    it("avec la session issue de l'ancien jeton : rien de B, accès légitime à A conservé", async () => {
        const t = await teacherInAandB();
        await detachTeacherFromSchool({ teacherId: t.teacherId, schoolId: B.schoolId, actorUserId: B.adminId, by: "SCHOOL" });

        actAs(await toSession(await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]) })));
        const bravo = await callRoute(listClasses, { path: "/api/classes?search=BRAVO" });
        expect(classNames(bravo.body)).not.toContain("Classe-BRAVO");
        const forced = await callRoute(listClasses, { path: `/api/classes?schoolId=${B.schoolId}` });
        expect(forced.status).toBe(403);
        expect(JSON.stringify(forced.body)).not.toContain("BRAVO");
        const students = await callRoute(listStudents, { path: "/api/students" });
        expect(JSON.stringify(students.body)).not.toContain(B.ids.student);

        const own = await callRoute(listClasses, { path: "/api/classes" });
        expect(own.status).toBe(200);
        expect(classNames(own.body)).toContain("Classe-ALPHA");
    });

    it("école active non concernée par le retrait : inchangée", async () => {
        const t = await teacherInAandB();
        await detachTeacherFromSchool({ teacherId: t.teacherId, schoolId: B.schoolId, actorUserId: B.adminId, by: "SCHOOL" });
        const after = await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId, B.schoolId]) });
        expect(after.schoolId).toBe(A.schoolId);
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
    });

    it("responsable de réseau retiré du réseau : les écoles du réseau quittent le jeton", async () => {
        const org = await prisma.organization.create({ data: { name: uniqueCode("Réseau"), code: uniqueCode("ORG") } });
        await prisma.school.update({ where: { id: B.schoolId }, data: { organizationId: org.id } });
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("rev-reseau")}@integration.test`, password: "x", firstName: "Reseau", lastName: "Revocation", role: "NETWORK_ADMIN", schoolId: A.schoolId },
        });
        const membership = await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: user.id } });
        const token = loginToken(user.id, "NETWORK_ADMIN", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        try {
            const before = await jwt({ token: { ...token } });
            expect(before.accessibleSchoolIds).toContain(B.schoolId);

            await prisma.organizationMembership.delete({ where: { id: membership.id } });
            // Autre instance ou aucune invalidation locale : la propagation est bornée par le TTL
            await new Promise((resolve) => setTimeout(resolve, 5_100));

            const after = await jwt({ token: { ...token } });
            expect(after.accessibleSchoolIds).not.toContain(B.schoolId);
            expect(after.organizationIds).toEqual([]);
            expect(after.schoolId).toBe(A.schoolId);
        } finally {
            await prisma.school.update({ where: { id: B.schoolId }, data: { organizationId: null } });
        }
    }, 15_000);

    it("parent dont le lien avec l'enfant de B est retiré : B quitte le jeton", async () => {
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("rev-parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "Revocation", role: "PARENT", schoolId: A.schoolId },
        });
        const profile = await prisma.parentProfile.create({ data: { userId: user.id } });
        const link = await prisma.parentStudent.create({ data: { parentId: profile.id, studentId: B.ids.student, relationship: "PARENT" } });
        await prisma.parentStudent.delete({ where: { id: link.id } });

        const after = await jwt({ token: loginToken(user.id, "PARENT", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]) });
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(after.schoolId).toBe(A.schoolId);
    });

    it("plateforme (SUPER_ADMIN) : l'école choisie n'est pas remplacée", async () => {
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("rev-root")}@integration.test`, password: "x", firstName: "Root", lastName: "Revocation", role: "SUPER_ADMIN", schoolId: null },
        });
        const after = await jwt({ token: loginToken(user.id, "SUPER_ADMIN", A.schoolId, B.schoolId, []) });
        expect(after.schoolId).toBe(B.schoolId);
        expect(after.invalidated).toBeUndefined();
    });

    it("compte désactivé : la session reste invalidée (non-régression)", async () => {
        const t = await teacherInAandB();
        await prisma.user.update({ where: { id: t.userId }, data: { isActive: false } });
        const after = await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId, B.schoolId]) });
        expect(after.invalidated).toBe(true);
        expect((await toSession(after)).user).toBeUndefined();
    });
});
