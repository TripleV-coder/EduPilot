import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { logger } from "@/lib/utils/logger";
import { confirmOnlinePayment, failOnlinePayment, parseProviderAmount, parseProviderCurrency } from "@/lib/finance/online-payments";

/**
 * POST /api/payments/momo/webhook — Webhook MTN MoMo signé (HMAC-SHA256).
 *
 * Activation : définir MOMO_WEBHOOK_SECRET dans les variables d'environnement.
 * Sans ce secret, toutes les requêtes retournent 503 (non configuré).
 *
 * Enregistrer cette URL dans le portail développeur MTN MoMo :
 *   https://momodeveloper.mtn.com → Subscriptions → Collection → Webhook URL
 *
 * Le webhook valide un paiement Mobile Money en attente seulement si le
 * montant et la devise reçus sont ceux attendus (`confirmOnlinePayment`).
 */

const momoEventSchema = z.object({
    financialTransactionId: z.string(),
    externalId: z.string(),
    amount: z.string(),
    // Pas de devise par défaut : une devise absente est signalée, jamais supposée
    currency: z.string().optional(),
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

    // Signature vérifiée : le fournisseur n'a pas de session, les écritures
    // de paiement passent en contexte système déclaré (audit M2).
    try {
        if (event.status === "SUCCESSFUL") {
            // Montant et devise contrôlés avant toute validation
            const result = await runAsSystem("webhook:momo", () => confirmOnlinePayment({
                reference: event.externalId,
                provider: "MOMO",
                receivedAmount: parseProviderAmount(event.amount, "MOMO"),
                receivedCurrency: parseProviderCurrency(event.currency),
                providerTransactionId: event.financialTransactionId,
                source: `MoMo txn ${event.financialTransactionId}`,
            }));
            logger.info("MoMo webhook: confirmation traitée", {
                externalId: event.externalId,
                txn: event.financialTransactionId,
                outcome: result.outcome,
            });
        } else if (event.status === "FAILED") {
            await runAsSystem("webhook:momo", () => failOnlinePayment(event.externalId, "webhook MoMo"));
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        logger.error("MoMo webhook processing error", error as Error);
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}, { requireAuth: false });
