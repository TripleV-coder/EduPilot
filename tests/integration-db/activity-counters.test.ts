import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as complianceDashboard } from "@/app/api/compliance/dashboard/route";

/**
 * Indicateurs d'activité (2026-11-08) : ils lisaient la table `sessions`, que
 * les sessions JWT n'alimentent jamais. « Comptes actifs » valait toujours 0,
 * « inactifs depuis 90 jours » comptait TOUS les comptes (fausse alerte dès 11
 * comptes) et « connexions récentes » cherchait l'action LOGIN au lieu de
 * LOGIN_SUCCESS. Ils comptent désormais les connexions réussies du journal.
 */
let schoolId: string;
let adminId: string;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
    schoolId = (await createSchool("ACTIV")).id;
    adminId = (
        await prisma.user.create({
            data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Activité", role: "SCHOOL_ADMIN", schoolId },
        })
    ).id;
    const users = await Promise.all(
        Array.from({ length: 14 }, (_, i) =>
            prisma.user.create({
                data: { email: `${uniqueCode(`u${i}`)}@integration.test`, password: "x", firstName: "Compte", lastName: `N${i}`, role: "TEACHER", schoolId },
            }),
        ),
    );
    // 10 comptes connectés aujourd'hui, 2 il y a 60 jours, 2 jamais (+ l'administrateur, jamais)
    const at = (userId: string, ago: number) => ({ userId, action: "LOGIN_SUCCESS", entity: "user", entityId: userId, createdAt: new Date(Date.now() - ago) });
    await prisma.auditLog.createMany({
        data: [...users.slice(0, 10).map((u) => at(u.id, 60 * 60 * 1000)), ...users.slice(10, 12).map((u) => at(u.id, 60 * DAY))],
    });
});

describe("tableau de conformité : activité réelle des comptes", () => {
    it("actifs (30 j), inactifs (90 j) et connexions des dernières 24 h", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
        const res = await callRoute(complianceDashboard, { path: "/api/compliance/dashboard" });
        expect(res.status).toBe(200);
        const body = res.body as {
            summary: { totalUsers: number; activeUsers: number; inactiveUsers: number };
            auditLogs: { recentLogins: number };
        };
        expect(body.summary.totalUsers).toBe(15);
        expect(body.summary.activeUsers).toBe(10);
        // jamais connectés : 2 comptes + l'administrateur ; ceux d'il y a 60 j restent « actifs à 90 j »
        expect(body.summary.inactiveUsers).toBe(3);
        expect(body.auditLogs.recentLogins).toBe(10);
        // Plus de fausse alerte « N comptes inactifs » (seuil : plus de 10)
        expect(JSON.stringify(body)).not.toMatch(/comptes inactifs depuis 90\+ jours/);
    });
});
