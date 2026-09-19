import type { PrismaClient } from "@prisma/client";

export type RlsRoleStatus =
    | { status: "enforced"; role: string }
    | { status: "bypassed"; role: string; reason: string }
    | { status: "unknown"; reason: string };

/**
 * Le rôle de connexion est-il soumis aux politiques RLS (audit M2) ?
 * Un superutilisateur ou un rôle BYPASSRLS les ignore toutes, FORCE compris :
 * l'isolation en base serait alors inerte.
 */
export async function inspectRlsRole(client: Pick<PrismaClient, "$queryRawUnsafe">): Promise<RlsRoleStatus> {
    try {
        const rows = await client.$queryRawUnsafe<Array<{ role: string; superuser: boolean; bypass: boolean }>>(
            "SELECT current_user AS role, rolsuper AS superuser, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user",
        );
        const row = rows[0];
        if (!row) return { status: "unknown", reason: "rôle courant introuvable dans pg_roles" };
        if (row.superuser) return { status: "bypassed", role: row.role, reason: "superutilisateur" };
        if (row.bypass) return { status: "bypassed", role: row.role, reason: "attribut BYPASSRLS" };
        return { status: "enforced", role: row.role };
    } catch (error) {
        return { status: "unknown", reason: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Au démarrage en production : refuse un rôle qui contourne la RLS. Si la
 * base est injoignable, le démarrage continue (le contrôle ne peut pas
 * conclure) et l'anomalie est journalisée.
 */
export async function assertRlsEnforcedAtStartup(
    client: Pick<PrismaClient, "$queryRawUnsafe">,
    log: (message: string) => void,
): Promise<RlsRoleStatus> {
    const status = await inspectRlsRole(client);
    if (status.status === "bypassed") {
        throw new Error(
            `Démarrage refusé : l'application se connecte à PostgreSQL avec le rôle « ${status.role} » (${status.reason}), ` +
                "qui ignore la sécurité par ligne. Créez le rôle applicatif (node scripts/db/setup-app-role.mjs) " +
                "et utilisez-le dans DATABASE_URL — voir docs/MIGRATIONS.md, section RLS.",
        );
    }
    if (status.status === "unknown") {
        log(`Contrôle RLS impossible au démarrage : ${status.reason}`);
    }
    return status;
}
