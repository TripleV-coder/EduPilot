import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { authConfig } from "@/lib/auth/config";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";
import { detachTeacherFromSchool } from "@/lib/teachers/school-membership";
import { GET as listClasses } from "@/app/api/classes/route";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as getClass } from "@/app/api/classes/[id]/route";
import { GET as listGrades } from "@/app/api/grades/route";
import { PATCH as patchTeacher } from "@/app/api/teachers/[id]/route";
import { GET as listRecipients } from "@/app/api/messages/recipients/route";
import { POST as sendMessage } from "@/app/api/messages/route";
import { POST as reportIncident } from "@/app/api/incidents/route";

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

            // Aucune invalidation applicative : le trigger pose le marqueur en base
            await prisma.organizationMembership.delete({ where: { id: membership.id } });

            const after = await jwt({ token: { ...token } });
            expect(after.accessibleSchoolIds).not.toContain(B.schoolId);
            expect(after.organizationIds).toEqual([]);
            expect(after.schoolId).toBe(A.schoolId);
        } finally {
            await prisma.school.update({ where: { id: B.schoolId }, data: { organizationId: null } });
        }
    });

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

describe("Rattachement actif obligatoire : les cours ne rouvrent pas une école", () => {
    it("rattachement à B désactivé, cours de B conservés : B refusée, A intacte", async () => {
        const t = await teacherInAandB();
        // Tout chemin qui désactive le rattachement sans retirer les cours
        // (archivage, import, console SQL) : les cours restent en historique.
        await prisma.teacherSchoolAssignment.update({
            where: { teacherId_schoolId: { teacherId: t.teacherId, schoolId: B.schoolId } },
            data: { status: "INACTIVE", endDate: new Date() },
        });
        expect(await prisma.classSubject.count({ where: { teacherId: t.teacherId, class: { schoolId: B.schoolId } } })).toBe(1);

        const token = await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]) });
        expect(token.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(token.schoolId).toBe(A.schoolId);

        actAs(await toSession(token));
        const klass = await callRoute(getClass, { path: `/api/classes/${B.ids.class}`, params: { id: B.ids.class } });
        expect([403, 404]).toContain(klass.status);
        expect(JSON.stringify(klass.body)).not.toContain("BRAVO");
        const grades = await callRoute(listGrades, { path: `/api/grades?classId=${B.ids.class}` });
        expect(JSON.stringify(grades.body)).not.toContain(B.ids.grade);
        const forced = await callRoute(listClasses, { path: `/api/classes?schoolId=${B.schoolId}` });
        expect(forced.status).toBe(403);
        const own = await callRoute(listClasses, { path: "/api/classes" });
        expect(classNames(own.body)).toContain("Classe-ALPHA");
    });

    it("fiche enseignant : retrait de B refusé tant que des cours y sont confiés, rattachement intact", async () => {
        const t = await teacherInAandB();
        const root = await prisma.user.create({
            data: { email: `${uniqueCode("rev-root-fiche")}@integration.test`, password: "x", firstName: "Root", lastName: "Fiche", role: "SUPER_ADMIN", schoolId: null },
        });
        actAs(sessionFor("SUPER_ADMIN", null, root.id));
        const res = await callRoute(patchTeacher, {
            method: "PATCH", path: `/api/teachers/${t.teacherId}`, params: { id: t.teacherId },
            body: { primarySchoolId: A.schoolId, additionalSchoolIds: [] },
        });
        expect(res.status).toBe(400);
        const assignment = await prisma.teacherSchoolAssignment.findUniqueOrThrow({ where: { teacherId_schoolId: { teacherId: t.teacherId, schoolId: B.schoolId } } });
        expect(assignment.status).toBe("ACTIVE");
    });

    it("fiche enseignant : B retirée (cours déjà réaffectés) → la même session perd B, garde A", async () => {
        const t = await teacherInAandB();
        await prisma.classSubject.updateMany({ where: { teacherId: t.teacherId, class: { schoolId: B.schoolId } }, data: { teacherId: null } });
        const token = loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        expect((await jwt({ token: { ...token } })).accessibleSchoolIds).toContain(B.schoolId);

        const root = await prisma.user.create({
            data: { email: `${uniqueCode("rev-root-fiche2")}@integration.test`, password: "x", firstName: "Root", lastName: "Fiche", role: "SUPER_ADMIN", schoolId: null },
        });
        actAs(sessionFor("SUPER_ADMIN", null, root.id));
        const res = await callRoute(patchTeacher, {
            method: "PATCH", path: `/api/teachers/${t.teacherId}`, params: { id: t.teacherId },
            body: { primarySchoolId: A.schoolId, additionalSchoolIds: [] },
        });
        expect(res.status).toBe(200);

        const after = await jwt({ token: { ...token } });
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(after.schoolId).toBe(A.schoolId);
        actAs(await toSession(after));
        const forced = await callRoute(listClasses, { path: `/api/classes?schoolId=${B.schoolId}` });
        expect(forced.status).toBe(403);
        expect(classNames((await callRoute(listClasses, { path: "/api/classes" })).body)).toContain("Classe-ALPHA");
    });
});

describe("Plusieurs instances : la révocation faite ailleurs s'applique sans délai", () => {
    /** Une seconde copie des modules = une autre instance, avec son propre cache. */
    async function otherInstance() {
        vi.resetModules();
        const mod = await import("@/lib/auth/config");
        return (args: Record<string, unknown>) => mod.authConfig.callbacks!.jwt!(args as never) as Promise<JWT>;
    }

    it("instance 1 a B en cache ; retrait via l'instance 2 ; requête suivante sur l'instance 1 : B retirée", async () => {
        const t = await teacherInAandB();
        const token = loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        const instance1 = jwt;
        const instance2 = await otherInstance();

        // Les deux instances ont calculé (et mis en cache) les droits avec B
        expect((await instance1({ token: { ...token } })).accessibleSchoolIds).toContain(B.schoolId);
        expect((await instance2({ token: { ...token } })).accessibleSchoolIds).toContain(B.schoolId);

        // Retrait opéré sur l'instance 2 (son cache local seul est vidé)
        const { detachTeacherFromSchool: detachOn2 } = await import("@/lib/teachers/school-membership");
        expect(await detachOn2({ teacherId: t.teacherId, schoolId: B.schoolId, actorUserId: B.adminId, by: "SCHOOL" })).toEqual({ ok: true });

        // Aucune attente : l'instance 1 voit le marqueur posé en base
        const after = await instance1({ token: { ...token } });
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(after.schoolId).toBe(A.schoolId);
    });

    it("changement par SQL direct (aucune invalidation applicative) : appliqué à la requête suivante", async () => {
        const t = await teacherInAandB();
        const token = loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        expect((await jwt({ token: { ...token } })).accessibleSchoolIds).toContain(B.schoolId);
        await prisma.$executeRaw`UPDATE "teacher_school_assignments" SET "status" = 'INACTIVE' WHERE "userId" = ${t.userId} AND "schoolId" = ${B.schoolId}`;
        await prisma.$executeRaw`UPDATE "class_subjects" SET "teacherId" = NULL WHERE "teacherId" = ${t.teacherId}`;
        const after = await jwt({ token: { ...token } });
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
    });

    it("changement de rôle : appliqué à la requête suivante, sans déconnexion", async () => {
        const t = await teacherInAandB();
        const token = loginToken(t.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId, B.schoolId]);
        await jwt({ token: { ...token } });
        await prisma.user.update({ where: { id: t.userId }, data: { role: "STAFF" } });
        const after = await jwt({ token: { ...token } });
        expect(after.invalidated).toBeUndefined();
        expect(after.role).toBe("STAFF");
        expect(after.permissions).not.toContain("analytics:view");
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
    });
});

describe("F1 — compte supprimé définitivement", () => {
    it("la même session est invalidée et les routes protégées la refusent ; un autre compte n'est pas affecté", async () => {
        const gone = await teacherInAandB();
        const kept = await teacherInAandB();
        const goneToken = loginToken(gone.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId]);
        const keptToken = loginToken(kept.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId]);
        actAs(await toSession(await jwt({ token: { ...goneToken } })));
        expect((await callRoute(listClasses, { path: "/api/classes" })).status).toBe(200);

        await prisma.user.delete({ where: { id: gone.userId } });

        const after = await jwt({ token: { ...goneToken } });
        expect(after.invalidated).toBe(true);
        const session = await toSession(after);
        expect(session.user).toBeUndefined();
        actAs(session);
        const refused = await callRoute(listClasses, { path: "/api/classes" });
        expect(refused.status).toBe(401);
        expect(JSON.stringify(refused.body)).not.toContain("ALPHA");

        const other = await jwt({ token: { ...keptToken } });
        expect(other.invalidated).toBeUndefined();
        actAs(await toSession(other));
        const ok = await callRoute(listClasses, { path: "/api/classes" });
        expect(ok.status).toBe(200);
        expect(classNames(ok.body)).toContain("Classe-ALPHA");
    });
});

describe("F3 — un cours conservé ne rouvre pas les destinataires d'une école quittée", () => {
    type Person = { id: string };
    const ids = (body: unknown) => ((body as { data?: Person[] }).data ?? []).map((p) => p.id);

    /** Parent rattaché à A dont l'enfant est en classe à B : seul `recipientIsAllowed` le filtre. */
    async function parentInAofChildInB() {
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("rev-parent-ab")}@integration.test`, password: "x", firstName: "Parent", lastName: "AB", role: "PARENT", schoolId: A.schoolId },
        });
        const profile = await prisma.parentProfile.create({ data: { userId: user.id } });
        await prisma.parentStudent.create({ data: { parentId: profile.id, studentId: B.ids.student, relationship: "PARENT" } });
        return user.id;
    }
    const studentUserOf = async (studentId: string) =>
        (await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { userId: true } })).userId;

    it("rattachement à B désactivé, cours conservés : aucun élève ni parent de B ; envoi et incident refusés ; A intact", async () => {
        const t = await teacherInAandB();
        const parentAB = await parentInAofChildInB();
        const studentB = await studentUserOf(B.ids.student);
        const studentA = await studentUserOf(A.ids.student);
        await prisma.teacherSchoolAssignment.update({
            where: { teacherId_schoolId: { teacherId: t.teacherId, schoolId: B.schoolId } },
            data: { status: "INACTIVE", endDate: new Date() },
        });
        expect(await prisma.classSubject.count({ where: { teacherId: t.teacherId, class: { schoolId: B.schoolId } } })).toBe(1);

        actAs(await toSession(await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, A.schoolId, [A.schoolId, B.schoolId]) })));
        const recipients = await callRoute(listRecipients, { path: "/api/messages/recipients" });
        expect(recipients.status).toBe(200);
        const list = ids(recipients.body);
        expect(list).not.toContain(studentB);
        expect(list).not.toContain(parentAB);
        expect(list).toContain(studentA); // destinataire légitime de A

        const sent = await callRoute(sendMessage, { method: "POST", path: "/api/messages", body: { recipientId: parentAB, subject: "Suivi", content: "Bonjour" } });
        expect(sent.status).toBe(403);
        expect(await prisma.message.count({ where: { senderId: t.userId, recipientId: parentAB } })).toBe(0);

        const incident = await callRoute(reportIncident, {
            method: "POST", path: "/api/incidents",
            body: { studentId: B.ids.student, incidentType: "OTHER", severity: "LOW", date: new Date().toISOString(), description: "Signalement de test hors rattachement" },
        });
        expect(incident.status).toBe(403);
        expect(await prisma.behaviorIncident.count({ where: { reportedById: t.userId } })).toBe(0);
    });

    it("rattachement réactivé, école B active : ses élèves et parents redeviennent destinataires", async () => {
        const t = await teacherInAandB();
        const parentAB = await parentInAofChildInB();
        const studentB = await studentUserOf(B.ids.student);
        await prisma.teacherSchoolAssignment.update({ where: { teacherId_schoolId: { teacherId: t.teacherId, schoolId: B.schoolId } }, data: { status: "INACTIVE" } });
        await prisma.teacherSchoolAssignment.update({ where: { teacherId_schoolId: { teacherId: t.teacherId, schoolId: B.schoolId } }, data: { status: "ACTIVE", endDate: null } });

        const token = await jwt({ token: loginToken(t.userId, "TEACHER", A.schoolId, B.schoolId, [A.schoolId]) });
        expect(token.accessibleSchoolIds).toEqual(expect.arrayContaining([A.schoolId, B.schoolId]));
        expect(token.schoolId).toBe(B.schoolId);
        actAs(await toSession(token));
        const list = ids((await callRoute(listRecipients, { path: "/api/messages/recipients" })).body);
        expect(list).toContain(studentB);
        expect(list).toContain(parentAB);
    });
});

describe("Fiche enseignant créée ou supprimée hors des parcours de l'application", () => {
    /** Enseignant d'école principale A, sans aucune ligne de rattachement. */
    async function teacherWithoutProfile() {
        return prisma.user.create({
            data: { email: `${uniqueCode("rev-fiche")}@integration.test`, password: "x", firstName: "Prof", lastName: "SansFiche", role: "TEACHER", schoolId: A.schoolId },
        });
    }

    it("suppression d'une fiche rattachée à B (sans autre lien) : B quitte le jeton à la requête suivante", async () => {
        const user = await teacherWithoutProfile();
        const profile = await prisma.teacherProfile.create({ data: { userId: user.id, schoolId: B.schoolId } });
        const token = loginToken(user.id, "TEACHER", A.schoolId, B.schoolId, [A.schoolId, B.schoolId]);
        expect((await jwt({ token: { ...token } })).accessibleSchoolIds).toContain(B.schoolId);

        await prisma.teacherProfile.delete({ where: { id: profile.id } });

        const after = await jwt({ token: { ...token } });
        expect(after.accessibleSchoolIds).toEqual([A.schoolId]);
        expect(after.schoolId).toBe(A.schoolId);
    });

    it("création d'une fiche rattachée à B pour un compte existant : appliquée à la requête suivante", async () => {
        const user = await teacherWithoutProfile();
        const token = loginToken(user.id, "TEACHER", A.schoolId, A.schoolId, [A.schoolId]);
        expect((await jwt({ token: { ...token } })).accessibleSchoolIds).toEqual([A.schoolId]);

        await prisma.teacherProfile.create({ data: { userId: user.id, schoolId: B.schoolId } });

        expect((await jwt({ token: { ...token } })).accessibleSchoolIds).toEqual(expect.arrayContaining([A.schoolId, B.schoolId]));
    });
});
