import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { enrollInCurrentYear } from "./fixtures/enrollment";
import { GET as listIncidents } from "@/app/api/incidents/route";
import { GET as getIncident, PATCH as patchIncident } from "@/app/api/incidents/[id]/route";
import { GET as listOrientations } from "@/app/api/orientation/route";
import { GET as listClasses } from "@/app/api/classes/route";
import { POST as createIncident } from "@/app/api/incidents/route";
import { POST as saveAttendance } from "@/app/api/attendance/bulk/route";
import { GET as listStudents } from "@/app/api/students/route";

/**
 * Audit UX/rôles (2026-10-19) — incidents de discipline. La liste limitait le
 * parent à ses enfants, mais `?studentId=` écrasait ce filtre ; le détail
 * `/api/incidents/<id>` ne vérifiait que l'école (parent, élève, enseignant de
 * l'école lisaient l'incident de n'importe quel élève, fiche élève complète).
 * Orientation : `GET /api/orientation` servait à tout compte de l'école les
 * dossiers de tous les élèves (fiche et e-mail compris).
 */
const ids: Record<string, string> = {};
let schoolId: string;

const user = async (key: string, role: UserRole) => {
    const u = await prisma.user.create({
        data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "Incident", role, schoolId },
    });
    ids[`${key}User`] = u.id;
    return u.id;
};
const as = (key: string, role: UserRole) => actAs(sessionFor(role, schoolId, ids[`${key}User`]));
const list = (query = "") => callRoute(listIncidents, { path: `/api/incidents${query}` });
const detail = (id: string) => callRoute(getIncident, { path: `/api/incidents/${id}`, params: { id } });
const patch = (id: string) => callRoute(patchIncident, { method: "PATCH", path: `/api/incidents/${id}`, params: { id }, body: { isResolved: true } });
const idsOf = (body: unknown) => ((body as { data?: Array<{ id: string }> }).data ?? []).map((i) => i.id);

beforeAll(async () => {
    schoolId = (await createSchool("IT-INC")).id;
    for (const key of ["enfant", "autre"]) {
        const sp = await prisma.studentProfile.create({ data: { userId: await user(key, "STUDENT"), schoolId, matricule: uniqueCode("MAT") } });
        ids[key] = sp.id;
        const { academicYearId, levelCode } = await enrollInCurrentYear(sp.id, schoolId);
        const level = await prisma.classLevel.findFirstOrThrow({ where: { schoolId, code: levelCode } });
        ids[`ori_${key}`] = (await prisma.studentOrientation.create({ data: { studentId: sp.id, academicYearId, classLevelId: level.id } })).id;
    }
    const parent = await prisma.parentProfile.create({ data: { userId: await user("parent", "PARENT") } });
    await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: ids.enfant, relationship: "PARENT" } });
    await user("prof", "TEACHER");
    await user("autreProf", "TEACHER");
    await user("directeur", "DIRECTOR");
    await user("vieScolaire", "STAFF");
    await user("compta", "ACCOUNTANT");
    for (const key of ["enfant", "autre"]) {
        ids[`inc_${key}`] = (await prisma.behaviorIncident.create({
            data: { studentId: ids[key], reportedById: ids.profUser, incidentType: "DISRESPECT", date: new Date(), description: `Incident ${key}` },
        })).id;
    }
});

describe("Incidents : visibilité par rôle", () => {
    it("parent : ses enfants seulement, même avec ?studentId d'un autre élève", async () => {
        as("parent", "PARENT");
        expect(idsOf((await list()).body)).toEqual([ids.inc_enfant]);
        const forged = await list(`?studentId=${ids.autre}`);
        expect(forged.status).toBe(200);
        expect(idsOf(forged.body)).toEqual([]);
    });

    it("détail : parent et élève ne lisent pas l'incident d'un autre élève (404, rien révélé)", async () => {
        as("parent", "PARENT");
        const res = await detail(ids.inc_autre);
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain("Incident autre");
        expect((await detail(ids.inc_enfant)).status).toBe(200);
        as("enfant", "STUDENT");
        expect((await detail(ids.inc_autre)).status).toBe(404);
    });

    it("détail : nom de l'élève seulement, pas sa fiche complète", async () => {
        as("directeur", "DIRECTOR");
        const res = await detail(ids.inc_autre);
        expect(res.status).toBe(200);
        const student = (res.body as { student: Record<string, unknown> }).student;
        expect(Object.keys(student).sort()).toEqual(["id", "user"]);
    });

    it("enseignant : lit et modifie les incidents qu'il a signalés, pas ceux d'un collègue", async () => {
        as("autreProf", "TEACHER");
        expect((await detail(ids.inc_enfant)).status).toBe(404);
        expect((await patch(ids.inc_enfant)).status).toBe(404);
        expect((await prisma.behaviorIncident.findUniqueOrThrow({ where: { id: ids.inc_enfant } })).isResolved).toBe(false);
        as("prof", "TEACHER");
        expect((await patch(ids.inc_enfant)).status).toBe(200);
    });

    it("direction : tous les incidents de l'école", async () => {
        as("directeur", "DIRECTOR");
        expect(idsOf((await list()).body).sort()).toEqual([ids.inc_enfant, ids.inc_autre].sort());
    });
});

describe("Orientation : dossiers visibles par rôle", () => {
    const orientations = (query = "") => callRoute(listOrientations, { path: `/api/orientation${query}` });
    const oriIds = (body: unknown) => (body as Array<{ id: string }>).map((o) => o.id).sort();

    it("parent : le dossier de son enfant seulement, même avec ?studentId d'un autre élève", async () => {
        as("parent", "PARENT");
        expect(oriIds((await orientations()).body)).toEqual([ids.ori_enfant]);
        expect(oriIds((await orientations(`?studentId=${ids.autre}`)).body)).toEqual([]);
    });

    it("élève : le sien seulement", async () => {
        as("autre", "STUDENT");
        expect(oriIds((await orientations()).body)).toEqual([ids.ori_autre]);
    });

    it("comptabilité : hors de la page Orientation, refusée (403)", async () => {
        as("compta", "ACCOUNTANT");
        expect((await orientations()).status).toBe(403);
    });

    it("direction : tous les dossiers, nom de l'élève sans e-mail ni fiche", async () => {
        as("directeur", "DIRECTOR");
        const res = await orientations();
        expect(oriIds(res.body)).toEqual([ids.ori_enfant, ids.ori_autre].sort());
        const student = (res.body as Array<{ student: Record<string, unknown> }>)[0].student;
        expect(Object.keys(student).sort()).toEqual(["id", "user"]);
        expect(JSON.stringify(res.body)).not.toContain("@integration.test");
    });
});

describe("Cumul de rôles (audit 2026-10-24) : garde sur le rôle principal seulement", () => {
    it("vie scolaire principale + enseignant secondaire : modification refusée, rien ne change", async () => {
        const session = sessionFor("STAFF", schoolId, ids.vieScolaireUser);
        (session.user as Record<string, unknown>).roles = ["STAFF", "TEACHER"];
        actAs(session);
        expect((await patch(ids.inc_autre)).status).toBe(403);
        expect((await prisma.behaviorIncident.findUniqueOrThrow({ where: { id: ids.inc_autre } })).isResolved).toBe(false);
    });
});

describe("Feuille d'appel : classes de l'enseignant (audit 100 profils 2026-10-24)", () => {
    it("?mine=1 : l'enseignant ne reçoit que ses classes ; sans le paramètre, comportement inchangé", async () => {
        const teacher = await prisma.teacherProfile.create({ data: { userId: ids.profUser, schoolId } });
        const subject = await prisma.subject.create({ data: { schoolId, name: "Maths", code: uniqueCode("M") } });
        const mine = (await prisma.class.findFirstOrThrow({ where: { schoolId } })).id;
        await prisma.classSubject.create({ data: { classId: mine, subjectId: subject.id, teacherId: teacher.id } });
        as("prof", "TEACHER");
        const res = await callRoute(listClasses, { path: "/api/classes?mine=1" });
        const ids2 = ((res.body as { data?: Array<{ id: string }> }).data ?? (res.body as Array<{ id: string }>)).map((c) => c.id);
        expect(ids2).toEqual([mine]);
        const all = await callRoute(listClasses, { path: "/api/classes" });
        expect(((all.body as { data?: unknown[] }).data ?? (all.body as unknown[])).length).toBeGreaterThan(1);
    });
});

describe("Vie scolaire (STAFF) : appel et incidents dans son école, rien de plus", () => {
    it("appel et incident dans son école ; autre école refusée ; clôture refusée", async () => {
        as("vieScolaire", "STAFF");
        const klass = await prisma.class.findFirstOrThrow({ where: { schoolId } });
        // La feuille d'appel charge l'effectif par /api/students?classId= (refusé à STAFF avant le 2026-10-25 : « Aucun élève »).
        const roster = await callRoute(listStudents, { path: `/api/students?classId=${klass.id}&limit=1000` });
        expect(roster.status).toBe(200);
        expect(idsOf(roster.body)).toContain(ids.enfant);
        const own = await callRoute(saveAttendance, { method: "POST", path: "/api/attendance/bulk", body: { classId: klass.id, date: "2026-10-20", records: [{ studentId: ids.enfant, status: "PRESENT" }] } });
        expect(own.status).toBe(200);

        const other = (await createSchool("IT-INC-X")).id;
        const foreignUser = await prisma.user.create({ data: { email: `${uniqueCode("x")}@integration.test`, password: "x", firstName: "X", lastName: "X", role: "STUDENT", schoolId: other } });
        const foreign = await prisma.studentProfile.create({ data: { userId: foreignUser.id, schoolId: other, matricule: uniqueCode("MX") } });
        await enrollInCurrentYear(foreign.id, other);
        const foreignClass = await prisma.class.findFirstOrThrow({ where: { schoolId: other } });
        const crossAttendance = await callRoute(saveAttendance, { method: "POST", path: "/api/attendance/bulk", body: { classId: foreignClass.id, date: "2026-10-20", records: [{ studentId: foreign.id, status: "PRESENT" }] } });
        expect([403, 404]).toContain(crossAttendance.status);
        const crossRoster = await callRoute(listStudents, { path: `/api/students?classId=${foreignClass.id}&limit=1000` });
        expect(idsOf(crossRoster.body)).not.toContain(foreign.id);

        const body = (studentId: string) => ({ studentId, incidentType: "DISRESPECT", severity: "LOW", date: "2026-10-20T10:00:00.000Z", description: "Bavardage en étude" });
        const created = await callRoute(createIncident, { method: "POST", path: "/api/incidents", body: body(ids.enfant) });
        expect([200, 201]).toContain(created.status);
        const cross = await callRoute(createIncident, { method: "POST", path: "/api/incidents", body: body(foreign.id) });
        expect(cross.status).toBeGreaterThanOrEqual(400);
        expect(await prisma.behaviorIncident.count({ where: { studentId: foreign.id } })).toBe(0);

        expect((await patch(ids.inc_autre)).status).toBe(403);
    });
});
