import { beforeAll, describe, expect, it, vi } from "vitest";

// Console root : l'e-mail de la session doit figurer dans ROOT_USER_EMAILS, lu au
// chargement de lib/security/root-access — défini avant l'import des routes.
vi.hoisted(() => {
    process.env.ROOT_USER_EMAILS = "super_admin@integration.test";
});

import { GET as rootAnalytics } from "@/app/api/root/analytics/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import prisma from "./owner-db";

/**
 * N15 — `GET /api/root/analytics` répondait **500** au SUPER_ADMIN depuis le
 * Lot 3 : la page d'analyse de la console root était inutilisable.
 *
 * Cause : `SELECT DATE("createdAt") as day` rend un `date` PostgreSQL, que le
 * pilote convertit en objet `Date` — et non en chaîne, contrairement à ce que
 * disait l'annotation de type. Les clés du regroupement devenaient donc des
 * objets `Date`, et le tri final appelait `localeCompare` sur un objet :
 * `TypeError`, capturée en 500.
 *
 * Aucun test à Prisma mocké ne pouvait le voir : c'est la conversion du pilote
 * PostgreSQL qui est en cause. D'où ce test sur une vraie base.
 */
let schoolId: string;

beforeAll(async () => {
    schoolId = (await createSchool("IT-ROOTAN")).id;
    // Deux jours distincts, pour que le tri de la chronologie porte sur quelque chose.
    for (const daysAgo of [1, 3]) {
        await prisma.user.create({
            data: {
                email: `${uniqueCode("rootan")}@integration.test`,
                password: "x",
                firstName: "Root",
                lastName: "Analytics",
                role: "TEACHER",
                schoolId,
                createdAt: new Date(Date.now() - daysAgo * 86_400_000),
            },
        });
    }
});

describe("N15 — analyses de la console root", () => {
    it("répond 200 au super-administrateur, pas 500", async () => {
        actAs(sessionFor("SUPER_ADMIN", null, "it-root-analytics"));
        const res = await callRoute(rootAnalytics, { path: "/api/root/analytics?period=30d" });

        expect(res.status).toBe(200);
    });

    it("rend une chronologie triée, dont les dates sont des chaînes AAAA-MM-JJ", async () => {
        actAs(sessionFor("SUPER_ADMIN", null, "it-root-analytics"));
        const res = await callRoute(rootAnalytics, { path: "/api/root/analytics?period=30d" });
        const body = res.body as {
            timeline: Array<{ date: string; users: number }>;
            summary: { users: number };
        };

        expect(body.timeline.length).toBeGreaterThanOrEqual(2);
        for (const point of body.timeline) {
            expect(typeof point.date).toBe("string");
            expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        const dates = body.timeline.map((point) => point.date);
        expect([...dates].sort()).toEqual(dates);
        expect(body.summary.users).toBeGreaterThanOrEqual(2);
    });

    it("refuse un compte non root", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", schoolId));
        const res = await callRoute(rootAnalytics, { path: "/api/root/analytics" });

        expect(res.status).toBe(403);
    });
});
