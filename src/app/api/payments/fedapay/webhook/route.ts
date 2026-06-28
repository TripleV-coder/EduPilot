import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { verifyFedaPayEvent } from "@/lib/payments/fedapay";

/**
 * POST /api/payments/fedapay/webhook — Webhook FedaPay (signature vérifiée).
 *
 * Activation : définir FEDAPAY_WEBHOOK_SECRET. Sans ce secret → 503.
 * Enregistrer cette URL dans FedaPay (Workbench → Webhooks).
 *
 * Rapproche les paiements Mobile Money via FedaPay : on retrouve le `Payment`
 * par `reference` (= merchant_reference) et on passe PENDING → VERIFIED
 * (transaction.approved) ou → CANCELLED (canceled/declined).
 */
const APPROVED = new Set(["transaction.approved"]);
const CANCELLED = new Set(["transaction.canceled", "transaction.declined"]);
const FEDAPAY_METHODS = ["MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV"] as const;

export async function POST(request: NextRequest) {
    if (!process.env.FEDAPAY_WEBHOOK_SECRET) {
        logger.warn("FedaPay webhook appelé sans FEDAPAY_WEBHOOK_SECRET");
        return NextResponse.json({ error: "Intégration non configurée" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-fedapay-signature");

    let event;
    try {
        event = verifyFedaPayEvent(rawBody, signature);
    } catch (error) {
        logger.warn("FedaPay webhook: signature invalide", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const reference =
        typeof event.entity?.merchant_reference === "string"
            ? event.entity.merchant_reference
            : null;
    const fedapayId = event.entity?.id != null ? String(event.entity.id) : "";

    if (!reference) {
        // Événement sans référence marchande (ex. event de test) — acquitté sans action.
        return NextResponse.json({ received: true, reconciled: 0 });
    }

    try {
        if (APPROVED.has(event.name)) {
            const updated = await prisma.payment.updateMany({
                where: { reference, status: "PENDING", method: { in: [...FEDAPAY_METHODS] } },
                data: {
                    status: "VERIFIED",
                    paidAt: new Date(),
                    reconciledAt: new Date(),
                    notes: `FedaPay txn ${fedapayId}`,
                },
            });
            logger.info("FedaPay webhook: paiement(s) rapproché(s)", {
                reference,
                fedapayId,
                count: updated.count,
            });
            return NextResponse.json({ received: true, reconciled: updated.count });
        }

        if (CANCELLED.has(event.name)) {
            const updated = await prisma.payment.updateMany({
                where: { reference, status: "PENDING", method: { in: [...FEDAPAY_METHODS] } },
                data: { status: "CANCELLED" },
            });
            logger.info("FedaPay webhook: paiement(s) annulé(s)", { reference, count: updated.count });
            return NextResponse.json({ received: true, cancelled: updated.count });
        }

        // Autres événements (created, pending…) : acquittés sans changement d'état.
        return NextResponse.json({ received: true });
    } catch (error) {
        logger.error("FedaPay webhook processing error", error as Error, {
            module: "api/payments/fedapay/webhook",
        });
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}
