import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { publicAccountView } from "@/lib/payments/school-accounts";
import {
    accountAdminErrorResponse,
    activateSchoolAccount,
    authorizePaymentAccountAccess,
    revokeSchoolAccount,
    verifySchoolAccount,
} from "@/lib/payments/school-account-admin";

/**
 * POST /api/schools/<école>/payment-accounts/<compte> — action sur un compte
 * marchand de l'école (S7) : `verify` (test des identifiants chez FedaPay, en
 * lecture seule), `activate` (devient le compte d'encaissement ; l'ancien
 * compte actif du même environnement est révoqué), `revoke`.
 * Le compte doit appartenir à l'école de l'adresse : sinon 404, sans indice.
 */
const actionSchema = z.object({ action: z.enum(["verify", "activate", "revoke"]) });

export const POST = createApiHandler(async (request, { params, session }) => {
    const { id: schoolId, accountId } = await params;
    const denied = await authorizePaymentAccountAccess(session, schoolId, "write");
    if (denied) return denied;

    const { action } = actionSchema.parse(await request.json());
    const account = await prisma.schoolPaymentAccount.findFirst({ where: { id: accountId, schoolId } });
    if (!account) return NextResponse.json({ error: "Compte marchand introuvable" }, { status: 404 });

    try {
        if (action === "verify") {
            const { account: updated, result } = await verifySchoolAccount(session, account);
            return NextResponse.json({ data: publicAccountView(updated), result });
        }
        const updated = action === "activate" ? await activateSchoolAccount(session, account) : await revokeSchoolAccount(session, account);
        return NextResponse.json({ data: publicAccountView(updated) });
    } catch (error) {
        const refused = accountAdminErrorResponse(error);
        if (refused) return refused;
        throw error;
    }
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
