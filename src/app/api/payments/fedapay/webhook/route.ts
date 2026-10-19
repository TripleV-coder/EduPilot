import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { logger } from "@/lib/utils/logger";
import { verifyFedaPayEvent } from "@/lib/payments/fedapay";
import { confirmOnlinePayment, failOnlinePayment, parseProviderAmount, parseProviderCurrency } from "@/lib/finance/online-payments";

/**
 * POST /api/payments/fedapay/webhook — Webhook FedaPay (signature vérifiée).
 *
 * Activation : définir FEDAPAY_WEBHOOK_SECRET. Sans ce secret → 503.
 * Enregistrer cette URL dans FedaPay (Workbench → Webhooks).
 *
 * Rapproche les paiements Mobile Money via FedaPay : on retrouve le `Payment`
 * par `reference` (= merchant_reference). transaction.approved → validé
 * seulement si montant et devise sont conformes (`confirmOnlinePayment`),
 * canceled/declined → annulé.
 */
const APPROVED = new Set(["transaction.approved"]);
const CANCELLED = new Set(["transaction.canceled", "transaction.declined"]);

export const POST = createApiHandler(async (request) => {
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

    // Signature vérifiée : le fournisseur n'a pas de session, les écritures
    // de paiement passent en contexte système déclaré (audit M2).
    try {
        if (APPROVED.has(event.name)) {
            // Montant et devise contrôlés avant toute validation
            const result = await runAsSystem("webhook:fedapay", () => confirmOnlinePayment({
                reference,
                provider: "FEDAPAY",
                receivedAmount: parseProviderAmount(event.entity?.amount, "FEDAPAY"),
                receivedCurrency: parseProviderCurrency(event.entity?.currency),
                providerTransactionId: fedapayId || null,
                // Route globale : paiements historiques seulement ; ceux liés au
                // compte d'une école passent par /webhook/<compte> (S7)
                paymentAccountId: null,
                source: `FedaPay txn ${fedapayId}`,
            }));
            logger.info("FedaPay webhook: confirmation traitée", { reference, fedapayId, outcome: result.outcome });
            return NextResponse.json({ received: true, reconciled: result.outcome === "CONFIRMED" ? 1 : 0, outcome: result.outcome });
        }

        if (CANCELLED.has(event.name)) {
            const count = await runAsSystem("webhook:fedapay", () => failOnlinePayment(reference, "webhook FedaPay", { provider: "FEDAPAY", paymentAccountId: null }));
            return NextResponse.json({ received: true, cancelled: count });
        }

        // Autres événements (created, pending…) : acquittés sans changement d'état.
        return NextResponse.json({ received: true });
    } catch (error) {
        logger.error("FedaPay webhook processing error", error as Error, {
            module: "api/payments/fedapay/webhook",
        });
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}, { requireAuth: false });
