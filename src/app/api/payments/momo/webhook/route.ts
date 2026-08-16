import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/payments/momo/webhook — Webhook MTN MoMo signé (HMAC-SHA256).
 *
 * Activation : définir MOMO_WEBHOOK_SECRET dans les variables d'environnement.
 * Sans ce secret, toutes les requêtes retournent 503 (non configuré).
 *
 * Enregistrer cette URL dans le portail développeur MTN MoMo :
 *   https://momodeveloper.mtn.com → Subscriptions → Collection → Webhook URL
 *
 * Le webhook rapproche automatiquement les paiements Mobile Money
 * (PaymentMethod.MOBILE_MONEY_MTN, status PENDING → VERIFIED).
 */

const momoEventSchema = z.object({
    financialTransactionId: z.string(),
    externalId: z.string(),
    amount: z.string(),
    currency: z.string().default("XOF"),
    status: z.enum(["SUCCESSFUL", "FAILED", "PENDING"]),
    payerMessage: z.string().optional(),
    payeeNote: z.string().optional(),
    payer: z
        .object({ partyIdType: z.string(), partyId: z.string() })
        .optional(),
});

function verifySignature(body: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    let mismatch = 0;
    for (let i = 0; i < sigBuf.length; i++) {
        mismatch |= sigBuf[i] ^ expBuf[i];
    }
    return mismatch === 0;
}

export const POST = createApiHandler(async (request) => {
    const secret = process.env.MOMO_WEBHOOK_SECRET;
    if (!secret) {
        logger.warn("MoMo webhook called but MOMO_WEBHOOK_SECRET not configured");
        return NextResponse.json({ error: "Integration non configurée" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-momo-signature");

    if (!verifySignature(rawBody, signature, secret)) {
        logger.warn("MoMo webhook: signature invalide");
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    let event: z.infer<typeof momoEventSchema>;
    try {
        event = momoEventSchema.parse(JSON.parse(rawBody));
    } catch {
        return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    try {
        if (event.status === "SUCCESSFUL") {
            const updated = await prisma.payment.updateMany({
                where: {
                    reference: event.externalId,
                    status: "PENDING",
                    method: { in: ["MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV"] },
                },
                data: {
                    status: "VERIFIED",
                    paidAt: new Date(),
                    notes: `MoMo txn ${event.financialTransactionId}`,
                    reconciledAt: new Date(),
                },
            });

            logger.info(`MoMo webhook: ${updated.count} paiement(s) rapprochés`, {
                externalId: event.externalId,
                txn: event.financialTransactionId,
            });
        } else if (event.status === "FAILED") {
            await prisma.payment.updateMany({
                where: {
                    reference: event.externalId,
                    status: "PENDING",
                    method: { in: ["MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV"] },
                },
                data: { status: "CANCELLED" },
            });

            logger.info(`MoMo webhook: paiement annulé`, { externalId: event.externalId });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        logger.error("MoMo webhook processing error", error as Error);
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}, { requireAuth: false });
