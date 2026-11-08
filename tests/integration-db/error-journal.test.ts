import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, uniqueCode } from "./helpers";
import { createApiHandler } from "@/lib/api/api-helpers";
import { POST as clientError } from "@/app/api/monitoring/client-error/route";
import { purgeOldErrors, resetErrorQuotaForTests } from "@/lib/monitoring/error-journal";
import { resetAlertThrottleForTests } from "@/lib/monitoring/admin-alerts";
import { setSharedStoreEnabled } from "@/lib/shared-state/pg";

/**
 * Journal des erreurs (remplace Sentry, 2026-11-08), sur une vraie base :
 * une erreur 500 d'API et une erreur du navigateur sont inscrites, les
 * super-administrateurs actifs sont alertés UNE fois par erreur distincte et
 * par période (verrou partagé en base), et la purge garde 30 jours.
 */
let adminId: string;
let inactiveAdminId: string;
const tag = uniqueCode("journal");

beforeAll(async () => {
    // Liste restrictive facultative : vide ici, tous les SUPER_ADMIN actifs sont alertés
    vi.stubEnv("ROOT_USER_EMAILS", "");
    setSharedStoreEnabled(true);
    resetErrorQuotaForTests();
    resetAlertThrottleForTests();
    adminId = (await prisma.user.create({ data: { email: `${uniqueCode("root")}@integration.test`, password: "x", firstName: "Root", lastName: "Alerte", role: "SUPER_ADMIN" } })).id;
    inactiveAdminId = (
        await prisma.user.create({ data: { email: `${uniqueCode("root-off")}@integration.test`, password: "x", firstName: "Root", lastName: "Parti", role: "SUPER_ADMIN", isActive: false } })
    ).id;
});
afterAll(() => {
    setSharedStoreEnabled(null);
    vi.unstubAllEnvs();
});

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
    for (let i = 0; i < 50; i++) {
        const value = await read();
        if (done(value)) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return read();
}

const alertsFor = (userId: string, needle: string) =>
    prisma.notification.count({ where: { userId, type: "SYSTEM", message: { contains: needle } } });

describe("journal des erreurs", () => {
    it("erreur 500 d'une route API : inscrite, super-administrateurs actifs alertés une seule fois", async () => {
        const failing = createApiHandler(async () => {
            throw new Error(`Panne simulée ${tag}`);
        }, { requireAuth: false });
        actAs(null);

        const first = await callRoute(failing, { path: `/api/simulation/${tag}?email=parent@ecole.bj` });
        expect(first.status).toBe(500);
        const rows = await waitFor(() => prisma.errorLog.findMany({ where: { message: { contains: tag } } }), (r) => r.length === 1);
        expect(rows[0]).toMatchObject({ source: "server", path: `/api/simulation/${tag}` }); // sans la chaîne de requête
        expect(await waitFor(() => alertsFor(adminId, tag), (n) => n === 1)).toBe(1);
        expect(await alertsFor(inactiveAdminId, tag)).toBe(0);

        // Même panne une deuxième fois : inscrite, mais pas de seconde alerte
        await callRoute(failing, { path: `/api/simulation/${tag}` });
        await waitFor(() => prisma.errorLog.count({ where: { message: { contains: tag } } }), (n) => n === 2);
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(await alertsFor(adminId, tag)).toBe(1);
    });

    it("erreur du navigateur, même sans session : inscrite comme « client »", async () => {
        actAs(null);
        const res = await callRoute(clientError, {
            method: "POST",
            path: "/api/monitoring/client-error",
            body: { message: `TypeError: écran cassé ${tag}`, path: "/login" },
        });
        expect(res.status).toBe(202);
        const row = await prisma.errorLog.findFirst({ where: { message: { contains: `écran cassé ${tag}` } } });
        expect(row).toMatchObject({ source: "client", path: "/login" });
    });

    it("purge : plus de 30 jours supprimés, le reste conservé", async () => {
        const old = await prisma.errorLog.create({
            data: { source: "server", message: `ancienne ${tag}`, fingerprint: "test", createdAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) },
        });
        await purgeOldErrors();
        expect(await prisma.errorLog.findUnique({ where: { id: old.id } })).toBeNull();
        expect(await prisma.errorLog.count({ where: { message: { contains: tag } } })).toBeGreaterThanOrEqual(3);
    });
});
