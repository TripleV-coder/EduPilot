import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as createEvaluation } from "@/app/api/evaluations/route";

/**
 * Recette sur base vierge (2026-10-26) : le plafond d'un type d'évaluation
 * (« 2 devoirs surveillés par période ») se configurait mais n'était jamais
 * appliqué. Périmètre : matière de la classe × période × type (moteur de
 * moyennes (MI + D1 + D2) / 3 : deux devoirs par matière et par période).
 */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ids: Record<string, string> = {};

beforeAll(async () => {
    const schoolId = (await createSchool("IT-CAP")).id;
    const year = await prisma.academicYear.create({ data: { schoolId, name: uniqueCode("AN"), startDate: day("2025-09-01"), endDate: day("2026-07-31"), isCurrent: true } });
    for (const [key, seq, start, end] of [["t1", 1, "2025-09-01", "2025-12-20"], ["t2", 2, "2026-01-05", "2026-03-31"]] as const) {
        ids[key] = (await prisma.period.create({ data: { academicYearId: year.id, name: key.toUpperCase(), type: "TRIMESTER", startDate: day(start), endDate: day(end), sequence: seq } })).id;
    }
    const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    const teacherUser = await prisma.user.create({ data: { email: `${uniqueCode("prof")}@integration.test`, password: "x", firstName: "Prof", lastName: "Cap", role: "TEACHER", schoolId } });
    ids.teacherUser = teacherUser.id;
    const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
    const maths = await prisma.subject.create({ data: { schoolId, name: "Maths", code: uniqueCode("M") } });
    const svt = await prisma.subject.create({ data: { schoolId, name: "SVT", code: uniqueCode("S") } });
    for (const key of ["a", "b"]) {
        const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: uniqueCode(key) } });
        ids[`maths_${key}`] = (await prisma.classSubject.create({ data: { classId: klass.id, subjectId: maths.id, teacherId: teacher.id } })).id;
        if (key === "a") ids.svt_a = (await prisma.classSubject.create({ data: { classId: klass.id, subjectId: svt.id, teacherId: teacher.id } })).id;
    }
    ids.ds = (await prisma.evaluationType.create({ data: { schoolId, name: "Devoir surveillé", code: uniqueCode("DS"), category: "DEVOIR", maxCount: 2 } })).id;
    ids.interro = (await prisma.evaluationType.create({ data: { schoolId, name: "Interrogation", code: uniqueCode("IE") } })).id;
    ids.school = schoolId;
});

const create = (classSubjectId: string, periodId: string, typeId: string, title: string) => {
    actAs(sessionFor("TEACHER", ids.school, ids.teacherUser));
    return callRoute(createEvaluation, {
        method: "POST",
        path: "/api/evaluations",
        body: { classSubjectId, periodId, typeId, title, date: "2025-10-10T08:00:00.000Z", maxGrade: 20, coefficient: 1 },
    });
};

describe("Plafond d'un type d'évaluation (2 devoirs surveillés par période)", () => {
    it("1er et 2e devoir acceptés, 3e refusé (409) et non créé", async () => {
        expect((await create(ids.maths_a, ids.t1, ids.ds, "DS 1")).status).toBe(201);
        expect((await create(ids.maths_a, ids.t1, ids.ds, "DS 2")).status).toBe(201);
        const third = await create(ids.maths_a, ids.t1, ids.ds, "DS 3");
        expect(third.status).toBe(409);
        expect(third.body).toMatchObject({ code: "EVALUATION_TYPE_CAP_REACHED" });
        expect(await prisma.evaluation.count({ where: { classSubjectId: ids.maths_a, periodId: ids.t1, typeId: ids.ds } })).toBe(2);
    });

    it("le plafond est propre à la période, à la matière et à la classe", async () => {
        expect((await create(ids.maths_a, ids.t2, ids.ds, "DS 1 T2")).status).toBe(201);
        expect((await create(ids.svt_a, ids.t1, ids.ds, "DS 1 SVT")).status).toBe(201);
        expect((await create(ids.maths_b, ids.t1, ids.ds, "DS 1 classe B")).status).toBe(201);
    });

    it("un type sans plafond n'est pas limité", async () => {
        for (let i = 1; i <= 3; i++) expect((await create(ids.maths_a, ids.t1, ids.interro, `IE ${i}`)).status).toBe(201);
    });

    it("deux envois simultanés quand il ne reste qu'une place : un seul passe", async () => {
        expect((await create(ids.maths_b, ids.t2, ids.ds, "DS 1 B T2")).status).toBe(201);
        const results = await Promise.all([
            create(ids.maths_b, ids.t2, ids.ds, "DS concurrent 1"),
            create(ids.maths_b, ids.t2, ids.ds, "DS concurrent 2"),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(await prisma.evaluation.count({ where: { classSubjectId: ids.maths_b, periodId: ids.t2, typeId: ids.ds } })).toBe(2);
    });
});
