import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";

/**
 * Bail d'exclusion mutuelle des tâches planifiées (audit N8).
 *
 * Une ligne de `system_settings` par tâche (`job-lease:<nom>`), dont la valeur
 * vaut `<expiration ISO>|<jeton>`. La prise est atomique (INSERT … ON CONFLICT
 * … WHERE bail expiré) : parmi des acquisitions simultanées, une seule
 * réussit. Contrairement à un verrou consultatif de session PostgreSQL, le
 * bail ne dépend pas de la connexion (pool Prisma) et expire seul si le
 * processus meurt en cours de tâche.
 */
const leaseKey = (name: string) => `job-lease:${name}`;

/** Jeton du bail si acquis, `null` si une autre exécution le détient encore. */
export async function acquireJobLease(name: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const now = new Date();
    const value = `${new Date(now.getTime() + ttlMs).toISOString()}|${token}`;

    const rows = await prisma.$queryRaw<Array<{ key: string }>>`
        INSERT INTO "system_settings" ("id", "key", "value", "type", "isSecret", "updatedAt")
        VALUES (${randomUUID()}, ${leaseKey(name)}, ${value}, 'job-lease', false, ${now})
        ON CONFLICT ("key") DO UPDATE
            SET "value" = EXCLUDED."value", "updatedAt" = EXCLUDED."updatedAt"
            WHERE split_part("system_settings"."value", '|', 1) < ${now.toISOString()}
        RETURNING "key"`;

    return rows.length > 0 ? token : null;
}

/** Libère le bail, seulement s'il appartient encore à ce jeton. */
export async function releaseJobLease(name: string, token: string): Promise<void> {
    await prisma.$executeRaw`
        DELETE FROM "system_settings"
        WHERE "key" = ${leaseKey(name)} AND split_part("value", '|', 2) = ${token}`;
}
