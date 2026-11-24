import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { POST as createEvaluation } from "@/app/api/evaluations/route";

/**
 * OFF-01 (2026-11-24) — une évaluation saisie hors ligne est renvoyée au retour
 * du réseau, parfois après une réponse perdue : la clé d'idempotence générée
 * par l'appareil garantit qu'elle n'est créée qu'une fois.
 */
let g: TenantGraph;
const body = (clientKey: string, extra: Record<string, unknown> = {}) => ({
    classSubjectId: g.ids.classSubject, periodId: g.ids.period, typeId: g.ids.evaluationType,
    date: new Date("2025-10-20").toISOString(), maxGrade: 20, clientKey, ...extra,
});
const post = (payload: unknown) => {
    actAs(sessionFor("TEACHER", g.schoolId, g.teacherUserId));
    return callRoute(createEvaluation, { method: "POST", path: "/api/evaluations", body: payload });
};
const countFor = (clientKey: string) => prisma.evaluation.count({ where: { clientKey } });

beforeAll(async () => {
    g = await seedTenantGraph("IT-OFF01");
}, 180_000);

describe("OFF-01 — évaluation idempotente", () => {
    it("renvoi de la même clé : même évaluation, une seule en base", async () => {
        const key = randomUUID();
        const first = await post(body(key));
        expect(first.status, JSON.stringify(first.body)).toBe(201);
        const replay = await post(body(key));
        expect(replay.status).toBe(200);
        expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
        expect(await countFor(key)).toBe(1);
    });

    it("plafond du type atteint par cette évaluation : le renvoi n'est pas refusé", async () => {
        const capped = await prisma.evaluationType.create({ data: { schoolId: g.schoolId, name: "Composition", code: `CMP${Date.now()}`, maxCount: 1 } });
        const key = randomUUID();
        expect((await post(body(key, { typeId: capped.id }))).status).toBe(201);
        expect((await post(body(key, { typeId: capped.id }))).status).toBe(200);
        expect((await post(body(randomUUID(), { typeId: capped.id }))).status).toBeGreaterThanOrEqual(400);
    });

    it("deux envois simultanés de la même clé : une seule évaluation, aucune erreur serveur", async () => {
        const key = randomUUID();
        const results = await Promise.all([post(body(key)), post(body(key)), post(body(key))]);
        expect(results.every((r) => r.status === 200 || r.status === 201), JSON.stringify(results.map((r) => r.status))).toBe(true);
        expect(new Set(results.map((r) => (r.body as { id: string }).id)).size).toBe(1);
        expect(await countFor(key)).toBe(1);
    });

    it("même clé pour une autre matière : refusée (409)", async () => {
        const key = randomUUID();
        expect((await post(body(key))).status).toBe(201);
        const otherSubject = await prisma.subject.create({ data: { schoolId: g.schoolId, name: "Physique", code: `PHY${Date.now()}` } });
        const teacher = await prisma.teacherProfile.findFirstOrThrow({ where: { userId: g.teacherUserId } });
        const cs = await prisma.classSubject.create({ data: { classId: g.ids.class, subjectId: otherSubject.id, teacherId: teacher.id } });
        expect((await post(body(key, { classSubjectId: cs.id }))).status).toBe(409);
    });

    it("sans clé : comportement inchangé (deux évaluations)", async () => {
        const without = { ...body(randomUUID()) } as Record<string, unknown>;
        delete without.clientKey;
        expect((await post(without)).status).toBe(201);
        expect((await post(without)).status).toBe(201);
    });
});
