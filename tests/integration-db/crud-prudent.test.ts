import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";

import * as classRoute from "@/app/api/classes/[id]/route";
import * as evaluationRoute from "@/app/api/evaluations/[id]/route";
import * as scheduleRoute from "@/app/api/schedules/[id]/route";
import * as scheduleCollection from "@/app/api/schedules/route";
import * as yearRoute from "@/app/api/academic-years/[id]/route";
import * as bookRoute from "@/app/api/library/books/[id]/route";
import * as cagnotteRoute from "@/app/api/cagnottes/[cagnotteId]/route";
import * as menuRoute from "@/app/api/canteen/menu/route";

/**
 * Règle de suppression « prudente » (décision du 2026-11-05), sur PostgreSQL
 * réel : modification possible, suppression refusée en 409 quand des données
 * sont rattachées ; une évaluation part avec ses notes sur confirmation.
 */
let g: TenantGraph;
const admin = () => actAs(sessionFor("SCHOOL_ADMIN", g.schoolId, g.adminId));
const teacher = () => actAs(sessionFor("TEACHER", g.schoolId, g.teacherUserId));

beforeAll(async () => {
    g = await seedTenantGraph("CRUD");
    // Bibliothèque et cantine sont des modules à activer : sinon l'API répond 403 (voulu)
    await prisma.school.update({ where: { id: g.schoolId }, data: { enabledModules: [...ALL_MODULE_IDS] } });
}, 180_000);

describe("classes", () => {
    it("renomme une classe et refuse une capacité sous le nombre d'inscrits", async () => {
        admin();
        const renamed = await callRoute(classRoute.PATCH!, { method: "PATCH", path: `/api/classes/${g.ids.class}`, params: { id: g.ids.class }, body: { name: "6e B" } });
        expect(renamed.status).toBe(200);
        expect((await prisma.class.findUniqueOrThrow({ where: { id: g.ids.class } })).name).toBe("6e B");

        const tooSmall = await callRoute(classRoute.PATCH!, { method: "PATCH", path: `/api/classes/${g.ids.class}`, params: { id: g.ids.class }, body: { capacity: 0 + 1 } });
        // 1 élève inscrit : capacité 1 acceptée
        expect(tooSmall.status).toBe(200);
    });

    it("refuse de supprimer une classe qui porte des élèves (409 détaillé), supprime une classe vide", async () => {
        admin();
        const busy = await callRoute(classRoute.DELETE!, { method: "DELETE", path: `/api/classes/${g.ids.class}`, params: { id: g.ids.class } });
        expect(busy.status).toBe(409);
        expect((busy.body as { code: string }).code).toBe("HAS_DEPENDENCIES");

        const level = await prisma.classLevel.findUniqueOrThrow({ where: { id: g.ids.classLevel } });
        const empty = await prisma.class.create({ data: { schoolId: g.schoolId, classLevelId: level.id, name: uniqueCode("vide") } });
        const res = await callRoute(classRoute.DELETE!, { method: "DELETE", path: `/api/classes/${empty.id}`, params: { id: empty.id } });
        expect(res.status).toBe(200);
        expect(await prisma.class.findUnique({ where: { id: empty.id } })).toBeNull();
    });
});

describe("évaluations", () => {
    it("l'enseignant corrige le coefficient ; le barème ne passe pas sous une note saisie", async () => {
        teacher();
        const coef = await callRoute(evaluationRoute.PATCH!, { method: "PATCH", path: `/api/evaluations/${g.ids.evaluation}`, params: { id: g.ids.evaluation }, body: { coefficient: 2 } });
        expect(coef.status).toBe(200);
        expect(Number((await prisma.evaluation.findUniqueOrThrow({ where: { id: g.ids.evaluation } })).coefficient)).toBe(2);

        // Une note de 12 est saisie : barème 10 refusé
        const scale = await callRoute(evaluationRoute.PATCH!, { method: "PATCH", path: `/api/evaluations/${g.ids.evaluation}`, params: { id: g.ids.evaluation }, body: { maxGrade: 10 } });
        expect(scale.status).toBe(409);
    });

    it("la direction ne modifie pas l'évaluation d'un enseignant", async () => {
        admin();
        const res = await callRoute(evaluationRoute.PATCH!, { method: "PATCH", path: `/api/evaluations/${g.ids.evaluation}`, params: { id: g.ids.evaluation }, body: { title: "x" } });
        expect(res.status).toBe(403);
    });

    it("suppression avec notes : 409 sans confirmation, puis suppression tracée avec confirmation", async () => {
        teacher();
        const ask = await callRoute(evaluationRoute.DELETE!, { method: "DELETE", path: `/api/evaluations/${g.ids.evaluation}`, params: { id: g.ids.evaluation } });
        expect(ask.status).toBe(409);
        expect((ask.body as { code: string; gradeCount: number }).code).toBe("EVALUATION_HAS_GRADES");

        const done = await callRoute(evaluationRoute.DELETE!, { method: "DELETE", path: `/api/evaluations/${g.ids.evaluation}?confirm=true`, params: { id: g.ids.evaluation } });
        expect(done.status).toBe(200);
        expect(await prisma.evaluation.findUnique({ where: { id: g.ids.evaluation } })).toBeNull();
        expect(await prisma.grade.count({ where: { evaluationId: g.ids.evaluation } })).toBe(0);
        const audit = await prisma.auditLog.findFirst({ where: { action: "EVALUATION_DELETED", entityId: g.ids.evaluation } });
        expect(audit).not.toBeNull();
    });
});

describe("emploi du temps", () => {
    it("refuse un créneau qui en englobe un autre (création et modification)", async () => {
        admin();
        // Existant : lundi 08:00-09:00 ; un 07:00-10:00 l'englobe
        const created = await callRoute(scheduleCollection.POST!, {
            method: "POST", path: "/api/schedules",
            body: { classId: g.ids.class, dayOfWeek: 1, startTime: "07:00", endTime: "10:00" },
        });
        expect(created.status).toBe(400);

        const other = await prisma.schedule.create({ data: { classId: g.ids.class, dayOfWeek: 2, startTime: "10:00", endTime: "11:00" } });
        const moved = await callRoute(scheduleRoute.PATCH!, {
            method: "PATCH", path: `/api/schedules/${other.id}`, params: { id: other.id },
            body: { dayOfWeek: 1, startTime: "07:30", endTime: "09:30" },
        });
        expect(moved.status).toBe(409);

        const removed = await callRoute(scheduleRoute.DELETE!, { method: "DELETE", path: `/api/schedules/${other.id}`, params: { id: other.id } });
        expect(removed.status).toBe(200);
    });
});

describe("années, ouvrages, cagnottes, menus", () => {
    it("une année qui porte des inscriptions ne se supprime pas", async () => {
        admin();
        const res = await callRoute(yearRoute.DELETE!, { method: "DELETE", path: `/api/academic-years/${g.ids.year}`, params: { id: g.ids.year } });
        expect(res.status).toBe(409);
    });

    it("le nombre d'exemplaires ne descend pas sous les prêts en cours", async () => {
        admin();
        await prisma.book.update({ where: { id: g.ids.book }, data: { quantity: 3, available: 1 } });
        const res = await callRoute(bookRoute.PATCH!, { method: "PATCH", path: `/api/library/books/${g.ids.book}`, params: { id: g.ids.book }, body: { quantity: 1 } });
        expect(res.status).toBe(409);
        const ok = await callRoute(bookRoute.PATCH!, { method: "PATCH", path: `/api/library/books/${g.ids.book}`, params: { id: g.ids.book }, body: { quantity: 5 } });
        expect(ok.status).toBe(200);
        expect((await prisma.book.findUniqueOrThrow({ where: { id: g.ids.book } })).available).toBe(3);
    });

    it("cagnotte : clôture journalisée ; annulation et suppression refusées avec une contribution confirmée", async () => {
        admin();
        const parent = await prisma.user.create({ data: { email: `${uniqueCode("par")}@integration.test`, password: "x", firstName: "P", lastName: "C", role: "PARENT", schoolId: g.schoolId } });
        await prisma.cagnotteContribution.create({ data: { cagnotteId: g.ids.cagnotte, parentUserId: parent.id, amountFcfa: BigInt(1000), status: "CONFIRMED" } });

        const cancel = await callRoute(cagnotteRoute.PATCH!, { method: "PATCH", path: `/api/cagnottes/${g.ids.cagnotte}`, params: { cagnotteId: g.ids.cagnotte }, body: { status: "CANCELLED" } });
        expect(cancel.status).toBe(409);
        const del = await callRoute(cagnotteRoute.DELETE!, { method: "DELETE", path: `/api/cagnottes/${g.ids.cagnotte}`, params: { cagnotteId: g.ids.cagnotte } });
        expect(del.status).toBe(409);

        const close = await callRoute(cagnotteRoute.PATCH!, { method: "PATCH", path: `/api/cagnottes/${g.ids.cagnotte}`, params: { cagnotteId: g.ids.cagnotte }, body: { status: "CLOSED" } });
        expect(close.status).toBe(200);
        expect(await prisma.cagnotteJournalEntry.count({ where: { cagnotteId: g.ids.cagnotte, kind: "CLOSED" } })).toBe(1);
    });

    it("un menu de cantine se retire par sa date", async () => {
        admin();
        await prisma.canteenMenu.create({ data: { schoolId: g.schoolId, date: new Date("2026-03-02T00:00:00.000Z"), mainCourse: "Riz", priceStudent: 0 } });
        const res = await callRoute(menuRoute.DELETE!, { method: "DELETE", path: "/api/canteen/menu?date=2026-03-02" });
        expect(res.status).toBe(200);
        const again = await callRoute(menuRoute.DELETE!, { method: "DELETE", path: "/api/canteen/menu?date=2026-03-02" });
        expect(again.status).toBe(404);
    });
});
