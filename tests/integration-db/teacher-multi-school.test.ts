import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as listInvitations, POST as createInvitation } from "@/app/api/teacher-invitations/route";
import { DELETE as revokeInvitation } from "@/app/api/teacher-invitations/[invitationId]/route";
import { DELETE as removeMember } from "@/app/api/teachers/[id]/membership/route";
import { GET as mySchools, POST as joinSchool } from "@/app/api/me/schools/route";
import { DELETE as leaveSchool } from "@/app/api/me/schools/[schoolId]/route";
import { getSchoolAccessForAssignedRoles } from "@/lib/auth/school-access";

/**
 * Enseignant multi-écoles : une école B remet un code à un enseignant dont le
 * compte est rattaché à l'école A ; il la rejoint, y reçoit un cours, puis la
 * quitte ou en est retiré. Le socle (service, modèle) existait sans route ni
 * écran.
 */
const ids: Record<string, string> = {};

beforeAll(async () => {
    ids.schoolA = (await createSchool("IT-MSA")).id;
    ids.schoolB = (await createSchool("IT-MSB")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("prof")}@integration.test`, password: "x", firstName: "Koffi", lastName: "Multi", role: "TEACHER", schoolId: ids.schoolA },
    });
    ids.teacherUser = user.id;
    ids.teacher = (await prisma.teacherProfile.create({ data: { userId: user.id, schoolId: ids.schoolA } })).id;
    await prisma.teacherSchoolAssignment.create({
        data: { teacherId: ids.teacher, userId: user.id, schoolId: ids.schoolA, status: "ACTIVE", isPrimary: true },
    });
    const adminB = await prisma.user.create({
        data: { email: `${uniqueCode("dirb")}@integration.test`, password: "x", firstName: "Dir", lastName: "B", role: "DIRECTOR", schoolId: ids.schoolB },
    });
    ids.directorB = adminB.id;
});

const asDirectorB = () => actAs(sessionFor("DIRECTOR", ids.schoolB, ids.directorB));
const asTeacher = () => actAs(sessionFor("TEACHER", ids.schoolA, ids.teacherUser));
const newCode = async () => {
    asDirectorB();
    const res = await callRoute(createInvitation, { method: "POST", path: "/api/teacher-invitations" });
    expect(res.status).toBe(201);
    return res.body as { id: string; code: string };
};
const join = (code: string) => {
    asTeacher();
    return callRoute(joinSchool, { method: "POST", path: "/api/me/schools", body: { code } });
};
const access = () => getSchoolAccessForAssignedRoles({ userId: ids.teacherUser, roles: ["TEACHER"], primarySchoolId: ids.schoolA });

describe("Enseignant multi-écoles", () => {
    it("l'école émet un code (empreinte seule en base) et l'enseignant la rejoint", async () => {
        const { id, code } = await newCode();
        const stored = await prisma.teacherInvitation.findUniqueOrThrow({ where: { id } });
        expect(stored.codeHash).not.toContain(code.replace("-", ""));

        // Un code erroné est refusé sans rien révéler
        const wrong = await join("AAAAA-AAAAA");
        expect(wrong.status).toBe(400);

        const ok = await join(code.toLowerCase().replace("-", " "));
        expect(ok.status).toBe(201);
        expect(ok.body).toMatchObject({ schoolId: ids.schoolB, alreadyMember: false });
        expect((await access()).accessibleSchoolIds).toEqual(expect.arrayContaining([ids.schoolA, ids.schoolB]));

        asTeacher();
        const mine = await callRoute(mySchools, { path: "/api/me/schools" });
        expect((mine.body as { schools: Array<{ id: string; primary: boolean }> }).schools).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: ids.schoolA, primary: true }),
                expect.objectContaining({ id: ids.schoolB, primary: false }),
            ]),
        );

        asDirectorB();
        const list = await callRoute(listInvitations, { path: "/api/teacher-invitations" });
        const body = list.body as { invitations: unknown[]; members: Array<{ teacherId: string }> };
        expect(body.members.map((m) => m.teacherId)).toContain(ids.teacher);
        expect(JSON.stringify(body)).not.toContain(code);
    });

    it("un code ne sert qu'une fois ; un code révoqué ne sert plus", async () => {
        const used = await prisma.teacherInvitation.findFirstOrThrow({ where: { schoolId: ids.schoolB, usedAt: { not: null } } });
        expect(used.usedByUserId).toBe(ids.teacherUser);

        const { id, code } = await newCode();
        asDirectorB();
        expect((await callRoute(revokeInvitation, { method: "DELETE", path: `/api/teacher-invitations/${id}`, params: { invitationId: id } })).status).toBe(200);
        // Déjà membre : réponse « déjà membre » sans consommer… mais un code révoqué est invalide
        const res = await join(code);
        expect(res.status).toBe(400);
    });

    it("une autre école ne révoque pas le code de l'école B", async () => {
        const { id } = await newCode();
        actAs(sessionFor("SCHOOL_ADMIN", ids.schoolA));
        const res = await callRoute(revokeInvitation, { method: "DELETE", path: `/api/teacher-invitations/${id}`, params: { invitationId: id } });
        expect(res.status).toBe(404);
        expect((await prisma.teacherInvitation.findUniqueOrThrow({ where: { id } })).revokedAt).toBeNull();
    });

    it("quitter l'école B lui retire ses cours de B, garde l'historique ; l'école principale ne se quitte pas", async () => {
        const level = await prisma.classLevel.create({ data: { schoolId: ids.schoolB, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
        const klass = await prisma.class.create({ data: { schoolId: ids.schoolB, classLevelId: level.id, name: uniqueCode("6A"), mainTeacherId: ids.teacher } });
        const subject = await prisma.subject.create({ data: { schoolId: ids.schoolB, name: "Maths", code: uniqueCode("M") } });
        const course = await prisma.classSubject.create({ data: { classId: klass.id, subjectId: subject.id, teacherId: ids.teacher } });

        asTeacher();
        const primary = await callRoute(leaveSchool, { method: "DELETE", path: `/api/me/schools/${ids.schoolA}`, params: { schoolId: ids.schoolA } });
        expect(primary.status).toBe(409);

        const left = await callRoute(leaveSchool, { method: "DELETE", path: `/api/me/schools/${ids.schoolB}`, params: { schoolId: ids.schoolB } });
        expect(left.status).toBe(200);
        expect((await prisma.classSubject.findUniqueOrThrow({ where: { id: course.id } })).teacherId).toBeNull();
        expect((await prisma.class.findUniqueOrThrow({ where: { id: klass.id } })).mainTeacherId).toBeNull();
        const assignment = await prisma.teacherSchoolAssignment.findUniqueOrThrow({ where: { teacherId_schoolId: { teacherId: ids.teacher, schoolId: ids.schoolB } } });
        expect(assignment.status).toBe("INACTIVE");
        expect((await access()).accessibleSchoolIds).not.toContain(ids.schoolB);
    });

    it("l'école peut retirer un enseignant rattaché, pas un enseignant dont elle est l'école principale", async () => {
        const { code } = await newCode();
        expect((await join(code)).status).toBe(201);

        asDirectorB();
        const removed = await callRoute(removeMember, { method: "DELETE", path: `/api/teachers/${ids.teacher}/membership`, params: { id: ids.teacher } });
        expect(removed.status).toBe(200);
        expect((await access()).accessibleSchoolIds).not.toContain(ids.schoolB);

        actAs(sessionFor("SCHOOL_ADMIN", ids.schoolA));
        const primary = await callRoute(removeMember, { method: "DELETE", path: `/api/teachers/${ids.teacher}/membership`, params: { id: ids.teacher } });
        expect(primary.status).toBe(409);

        expect(await prisma.auditLog.count({ where: { entityId: ids.teacher, action: { in: ["TEACHER_JOINED_SCHOOL", "TEACHER_LEFT_SCHOOL", "TEACHER_REMOVED_FROM_SCHOOL"] } } })).toBe(4);
    });

    it("un non-enseignant ne rejoint pas une école par code (403)", async () => {
        const { code } = await newCode();
        asDirectorB();
        const res = await callRoute(joinSchool, { method: "POST", path: "/api/me/schools", body: { code } });
        expect(res.status).toBe(403);
    });
});
