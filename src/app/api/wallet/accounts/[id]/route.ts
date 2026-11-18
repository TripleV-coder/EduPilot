import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";
import { WALLET_WRITE_ROLES, maskAccountRef, walletAccountUpdateSchema } from "@/lib/finance/wallet";

async function loadAccount(id: string) {
    return prisma.walletAccount.findUnique({ where: { id }, select: { id: true, schoolId: true, name: true, kind: true, balanceFcfa: true } });
}

/** PATCH /api/wallet/accounts/[id] — corriger un compte déclaré (nom, numéro, solde d'ouverture). */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const account = await loadAccount(id);
        if (!account || !canAccessSchool(session, account.schoolId)) {
            return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
        }
        const data = walletAccountUpdateSchema.parse(await request.json());
        if (data.name && data.name !== account.name) {
            const duplicate = await prisma.walletAccount.findFirst({ where: { schoolId: account.schoolId, name: data.name, id: { not: id } }, select: { id: true } });
            if (duplicate) return NextResponse.json({ error: "Un compte porte déjà ce nom." }, { status: 409 });
        }
        const updated = await prisma.walletAccount.update({
            where: { id },
            data: {
                ...(data.name ? { name: data.name } : {}),
                ...(data.kind ? { kind: data.kind } : {}),
                ...(data.accountRef !== undefined ? { accountRef: maskAccountRef(data.accountRef) } : {}),
                ...(data.openingBalanceFcfa !== undefined ? { balanceFcfa: BigInt(data.openingBalanceFcfa) } : {}),
            },
        });
        await createAuditLog({
            userId: session.user.id,
            action: "WALLET_ACCOUNT_UPDATED",
            entity: "WalletAccount",
            entityId: id,
            schoolId: account.schoolId,
            oldValues: { name: account.name, kind: account.kind, openingBalanceFcfa: account.balanceFcfa.toString() },
            newValues: { name: updated.name, kind: updated.kind, openingBalanceFcfa: updated.balanceFcfa.toString() },
            severity: "WARNING",
        });
        return NextResponse.json({ id: updated.id });
    },
    { requireAuth: true, allowedRoles: WALLET_WRITE_ROLES },
);

/** DELETE /api/wallet/accounts/[id] — compte sans mouvement saisi ni décaissement (règle prudente). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const account = await loadAccount(id);
        if (!account || !canAccessSchool(session, account.schoolId)) {
            return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
        }
        const [transactions, disbursements] = await Promise.all([
            prisma.walletTransaction.count({ where: { accountId: id } }),
            prisma.scheduledDisbursement.count({ where: { accountId: id } }),
        ]);
        const conflict = dependencyConflict(
            `le compte « ${account.name} »`,
            [
                { count: transactions, one: "mouvement saisi", many: "mouvements saisis" },
                { count: disbursements, one: "décaissement", many: "décaissements" },
            ],
            "Son historique doit rester consultable.",
        );
        if (conflict) return conflict;
        await prisma.walletAccount.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "WALLET_ACCOUNT_DELETED",
            entity: "WalletAccount",
            entityId: id,
            schoolId: account.schoolId,
            oldValues: { name: account.name, kind: account.kind },
            severity: "WARNING",
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: WALLET_WRITE_ROLES },
);
