import prisma from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";

/**
 * Sessions fermées (sécurité HTTP, 2026-10-18).
 *
 * Les sessions sont des JWT sans état : la déconnexion n'effaçait que le
 * cookie du navigateur, et une copie du cookie restait valable jusqu'à son
 * expiration. Chaque jeton porte désormais un identifiant de session stable
 * (`sid`, attribué à la connexion) ; la déconnexion l'inscrit ici et il est
 * refusé à chaque requête. L'identifiant `jti` d'Auth.js ne convient pas : il
 * change à chaque réémission du jeton.
 */

/** Durée maximale d'un jeton (config Auth.js) : au-delà, la ligne est inutile. */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function revokeSession(sid: string, userId: string): Promise<void> {
    await runAsSystem("auth:session-revocation", () =>
        prisma.revokedSession.upsert({
            where: { sid },
            create: { sid, userId, expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) },
            update: {},
        }),
    );
}

export async function isSessionRevoked(sid: string): Promise<boolean> {
    const row = await runAsSystem("auth:session-revocation", () =>
        prisma.revokedSession.findUnique({ where: { sid }, select: { sid: true } }),
    );
    return row !== null;
}

/** Purge des sessions fermées dont le jeton a de toute façon expiré. */
export async function purgeExpiredRevokedSessions(now = new Date()): Promise<number> {
    const { count } = await runAsSystem("auth:session-revocation", () =>
        prisma.revokedSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    );
    return count;
}
