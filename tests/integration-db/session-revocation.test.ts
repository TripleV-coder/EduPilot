import { describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { uniqueCode } from "./helpers";
import { isSessionRevoked, purgeExpiredRevokedSessions, revokeSession } from "@/lib/auth/session-revocation";

/**
 * Sessions fermées (sécurité HTTP, 2026-10-18) — la déconnexion ne révoquait
 * pas le jeton : une copie du cookie restait valable. Le bout en bout (cookie
 * recopié refusé après déconnexion) est vérifié en HTTP réel sur le banc local.
 */
describe("révocation des sessions", () => {
    it("une session révoquée est reconnue ; révoquer deux fois reste sans effet", async () => {
        const sid = uniqueCode("sid");
        expect(await isSessionRevoked(sid)).toBe(false);
        await revokeSession(sid, "user-test");
        await revokeSession(sid, "user-test");
        expect(await isSessionRevoked(sid)).toBe(true);
        expect(await prisma.revokedSession.count({ where: { sid } })).toBe(1);
    });

    it("purge : seules les lignes dont le jeton a expiré disparaissent", async () => {
        const live = uniqueCode("sid");
        const old = uniqueCode("sid");
        await revokeSession(live, "u");
        await prisma.revokedSession.create({ data: { sid: old, userId: "u", expiresAt: new Date(Date.now() - 1000) } });
        await purgeExpiredRevokedSessions();
        expect(await isSessionRevoked(live)).toBe(true);
        expect(await isSessionRevoked(old)).toBe(false);
    });
});
