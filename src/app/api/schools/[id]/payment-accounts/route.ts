import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isLivePaymentsEnabled } from "@/lib/payments/live-mode";
import { arePaymentSecretsAvailable } from "@/lib/payments/secret-box";
import { collectingEnvironment, publicAccountView, SCHOOL_PAYMENT_PROVIDER } from "@/lib/payments/school-accounts";
import { accountAdminErrorResponse, authorizePaymentAccountAccess, createSchoolAccount } from "@/lib/payments/school-account-admin";

/**
 * Comptes marchands d'une école (S7, ADR-0011).
 *
 * GET  — liste masquée (état, environnement, 4 derniers caractères, adresse de
 *        webhook à déclarer chez FedaPay) ; jamais de secret.
 * POST — enregistre un compte FedaPay de l'école (inactif, à tester puis
 *        activer). Secrets chiffrés et liés à l'école ; refus si la clé de
 *        chiffrement manque (jamais de stockage en clair).
 */
export const GET = createApiHandler(async (_request, { params, session }) => {
    const { id: schoolId } = await params;
    const denied = await authorizePaymentAccountAccess(session, schoolId, "read");
    if (denied) return denied;

    const accounts = await prisma.schoolPaymentAccount.findMany({
        where: { schoolId, provider: SCHOOL_PAYMENT_PROVIDER },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
        data: accounts.map(publicAccountView),
        // Ce que l'installation permet : environnement d'encaissement et clé de chiffrement
        collectingEnvironment: collectingEnvironment(),
        liveEnabled: isLivePaymentsEnabled(),
        secretsAvailable: arePaymentSecretsAvailable(),
    });
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] });

const createSchema = z.object({
    environment: z.enum(["SANDBOX", "LIVE"]),
    secretKey: z.string().trim().min(12).max(200),
    webhookSecret: z.string().trim().min(12).max(200),
});

export const POST = createApiHandler(async (request, { params, session }) => {
    const { id: schoolId } = await params;
    const denied = await authorizePaymentAccountAccess(session, schoolId, "write");
    if (denied) return denied;
    if (!arePaymentSecretsAvailable()) {
        return NextResponse.json(
            { error: "Le chiffrement des comptes marchands n'est pas configuré sur cette installation (PAYMENT_SECRETS_KEY).", code: "PAYMENT_SECRETS_UNAVAILABLE" },
            { status: 503 },
        );
    }
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });

    const data = createSchema.parse(await request.json());
    try {
        const account = await createSchoolAccount(session, { schoolId, ...data });
        return NextResponse.json({ data: publicAccountView(account) }, { status: 201 });
    } catch (error) {
        const refused = accountAdminErrorResponse(error);
        if (refused) return refused;
        throw error;
    }
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
