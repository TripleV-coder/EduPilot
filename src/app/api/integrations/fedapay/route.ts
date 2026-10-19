import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { arePaymentSecretsAvailable } from "@/lib/payments/secret-box";
import { accountWebhookPath, collectingEnvironment, SCHOOL_PAYMENT_PROVIDER } from "@/lib/payments/school-accounts";

/**
 * GET /api/integrations/fedapay — statut FedaPay de l'école active (S7).
 *
 * Chaque école encaisse sur SON compte : le statut porte sur le compte actif
 * de l'école dans l'environnement autorisé, jamais sur une clé globale. Aucun
 * secret ni identifiant de clé n'est renvoyé ; la gestion des comptes se fait
 * par /api/schools/<école>/payment-accounts.
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        const environment = collectingEnvironment();
        if (!schoolId || !canAccessSchool(session, schoolId)) {
            return NextResponse.json({ configured: false, mode: environment.toLowerCase(), webhookPath: null, secretsAvailable: arePaymentSecretsAvailable() });
        }
        const account = await prisma.schoolPaymentAccount.findFirst({
            where: { schoolId, provider: SCHOOL_PAYMENT_PROVIDER, environment, status: "ACTIVE" },
            select: { id: true },
        });
        return NextResponse.json({
            configured: Boolean(account),
            mode: environment.toLowerCase(),
            webhookPath: account ? accountWebhookPath(account.id) : null,
            secretsAvailable: arePaymentSecretsAvailable(),
            accountsPath: `/api/schools/${schoolId}/payment-accounts`,
        });
    },
    { requireAuth: true }
);
