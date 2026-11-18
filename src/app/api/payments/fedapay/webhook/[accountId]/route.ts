import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { logger } from "@/lib/utils/logger";
import prisma from "@/lib/prisma";
import { verifyAccountWebhook } from "@/lib/payments/fedapay-account-client";
import { accountWebhookSecret, SCHOOL_PAYMENT_PROVIDER } from "@/lib/payments/school-accounts";
import { PaymentSecretsUnavailableError } from "@/lib/payments/secret-box";
import { confirmOnlinePayment, failOnlinePayment, parseProviderAmount, parseProviderCurrency } from "@/lib/finance/online-payments";

/**
 * POST /api/payments/fedapay/webhook/<compte> — webhook du compte FedaPay d'UNE
 * école (S7, ADR-0011).
 *
 * Chaque école déclare cette adresse dans SON tableau de bord FedaPay
 * (Workbench → Webhooks) et en recopie le secret : la documentation FedaPay
 * le donne unique par point de terminaison et distinct entre test et
 * production. La signature est vérifiée avec le secret de CE compte, puis
 * seuls les paiements liés à ce compte peuvent être validés ou annulés : un
 * événement du compte de l'école A n'écrit jamais sur un paiement de l'école B
 * (refus noté et signalé, sans écriture financière). Montant, devise,
 * identifiant de transaction et référence restent contrôlés (S3).
 *
 * Un compte révoqué depuis garde son webhook : une confirmation tardive de ses
 * paiements passés reste reçue.
 */
const APPROVED = new Set(["transaction.approved"]);
const CANCELLED = new Set(["transaction.canceled", "transaction.declined"]);

export const POST = createApiHandler(async (request, { params }) => {
    const { accountId } = await params;
    const notFound = () => NextResponse.json({ error: "Point de terminaison inconnu" }, { status: 404 });
    if (typeof accountId !== "string" || accountId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(accountId)) return notFound();

    // Le fournisseur n'a pas de session : lecture du compte et écritures de
    // paiement en contexte système déclaré (audit M2)
    return runAsSystem("webhook:fedapay-account", async () => {
        const account = await prisma.schoolPaymentAccount.findUnique({ where: { id: accountId } });
        if (!account || account.provider !== SCHOOL_PAYMENT_PROVIDER) return notFound();

        let secret: string | null;
        try {
            secret = accountWebhookSecret(account);
        } catch (error) {
            if (error instanceof PaymentSecretsUnavailableError) {
                logger.error("Webhook FedaPay : clé de chiffrement des comptes marchands indisponible", error, { accountId });
                return NextResponse.json({ error: "Intégration indisponible" }, { status: 503 });
            }
            throw error;
        }
        if (!secret) {
            logger.error("Webhook FedaPay : secret du compte illisible", undefined, { accountId, schoolId: account.schoolId });
            return NextResponse.json({ error: "Intégration indisponible" }, { status: 503 });
        }

        const rawBody = await request.text();
        let event;
        try {
            event = verifyAccountWebhook(rawBody, request.headers.get("x-fedapay-signature"), secret);
        } catch (error) {
            logger.warn("Webhook FedaPay : signature invalide pour ce compte", {
                accountId,
                error: error instanceof Error ? error.message : String(error),
            });
            return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
        }

        const reference = typeof event.entity?.merchant_reference === "string" ? event.entity.merchant_reference : null;
        const fedapayId = event.entity?.id != null ? String(event.entity.id) : "";
        // Événement sans référence marchande (ex. test) : acquitté sans action
        if (!reference) return NextResponse.json({ received: true, reconciled: 0 });

        try {
            if (APPROVED.has(event.name)) {
                const result = await confirmOnlinePayment({
                    reference,
                    provider: "FEDAPAY",
                    receivedAmount: parseProviderAmount(event.entity?.amount, "FEDAPAY"),
                    receivedCurrency: parseProviderCurrency(event.entity?.currency),
                    providerTransactionId: fedapayId || null,
                    paymentAccountId: account.id,
                    source: `FedaPay compte ${account.id} txn ${fedapayId}`,
                });
                logger.info("Webhook FedaPay (compte d'école) : confirmation traitée", { accountId, reference, fedapayId, outcome: result.outcome });
                return NextResponse.json({ received: true, reconciled: result.outcome === "CONFIRMED" ? 1 : 0, outcome: result.outcome });
            }
            if (CANCELLED.has(event.name)) {
                const cancelled = await failOnlinePayment(reference, `webhook FedaPay compte ${account.id}`, {
                    provider: "FEDAPAY",
                    paymentAccountId: account.id,
                });
                return NextResponse.json({ received: true, cancelled });
            }
            // Autres événements (created, pending…) : acquittés sans changement d'état
            return NextResponse.json({ received: true });
        } catch (error) {
            logger.error("Webhook FedaPay (compte d'école) : erreur de traitement", error as Error, { accountId });
            return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
        }
    });
}, { requireAuth: false });
