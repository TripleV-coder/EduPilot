import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { WALLET_WRITE_ROLES, maskAccountRef, walletAccountCreateSchema } from "@/lib/finance/wallet";

/**
 * POST /api/wallet/accounts — déclarer un compte de l'école (banque, Mobile
 * Money, caisse). Le portefeuille ne pouvait recevoir aucun compte.
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        const data = walletAccountCreateSchema.parse(await request.json());
        const duplicate = await prisma.walletAccount.findFirst({ where: { schoolId, name: data.name }, select: { id: true } });
        if (duplicate) return NextResponse.json({ error: "Un compte porte déjà ce nom." }, { status: 409 });
        const account = await prisma.walletAccount.create({
            data: {
                schoolId,
                name: data.name,
                kind: data.kind,
                accountRef: maskAccountRef(data.accountRef),
                balanceFcfa: BigInt(data.openingBalanceFcfa),
            },
        });
        await createAuditLog({
            userId: session.user.id,
            action: "WALLET_ACCOUNT_CREATED",
            entity: "WalletAccount",
            entityId: account.id,
            schoolId,
            newValues: { name: account.name, kind: account.kind, openingBalanceFcfa: data.openingBalanceFcfa },
        });
        return NextResponse.json({ id: account.id }, { status: 201 });
    },
    { requireAuth: true, allowedRoles: WALLET_WRITE_ROLES },
);
