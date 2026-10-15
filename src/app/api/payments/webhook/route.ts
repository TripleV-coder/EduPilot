import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { confirmOnlinePayment, failOnlinePayment, readProviderEvent, type WebhookProvider } from "@/lib/finance/online-payments";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";

/**
 * Vérifie la signature HMAC-SHA256 du webhook Flutterwave.
 * Header envoyé par Flutterwave : "verif-hash"
 * Valeur attendue : HMAC-SHA256(rawBody, FLUTTERWAVE_WEBHOOK_SECRET)
 */
function verifyFlutterwaveSignature(rawBody: string, signature: string): boolean {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secret) {
        logger.error("FLUTTERWAVE_WEBHOOK_SECRET non configuré", new Error("Missing env var"), { module: "api/payments/webhook" });
        return false;
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
        return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
        return false;
    }
}

/**
 * Vérifie la signature du webhook Paystack.
 * Header : "x-paystack-signature"
 * Valeur attendue : HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY)
 */
function verifyPaystackSignature(rawBody: string, signature: string): boolean {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    try {
        return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
        return false;
    }
}

const SYSTEM_REASON = "webhook:payments";

export const POST = createApiHandler(async (req) => {
    try {
        const rawBody = await req.text();

        const flutterwaveSig = req.headers.get("verif-hash");
        const paystackSig = req.headers.get("x-paystack-signature");

        // Le fournisseur est déduit de la signature vérifiée, jamais d'un en-tête libre
        let provider: WebhookProvider;
        let signatureValid: boolean;
        if (flutterwaveSig) {
            provider = "FLUTTERWAVE";
            signatureValid = verifyFlutterwaveSignature(rawBody, flutterwaveSig);
        } else if (paystackSig) {
            provider = "PAYSTACK";
            signatureValid = verifyPaystackSignature(rawBody, paystackSig);
        } else {
            logger.warn("Webhook reçu sans header de signature", { module: "api/payments/webhook" });
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!signatureValid) {
            logger.warn("Signature webhook invalide", { module: "api/payments/webhook", provider });
            return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        const event = readProviderEvent(body, provider);
        if (!event.reference) {
            logger.warn("Webhook received without transaction identifier", {
                module: "api/payments/webhook",
                provider,
                receivedKeys: Object.keys(body)
            });
            return NextResponse.json({ received: true }); // Acknowledge anyway
        }

        // Signature vérifiée : le fournisseur n'a pas de session, les écritures
        // de paiement passent en contexte système déclaré (audit M2).
        if (event.status === "SUCCESS") {
            // Montant et devise contrôlés avant toute validation ; un écart
            // laisse le paiement « à rapprocher » au lieu de le valider.
            const result = await runAsSystem(SYSTEM_REASON, () => confirmOnlinePayment({
                reference: event.reference!,
                provider,
                receivedAmount: event.amount,
                receivedCurrency: event.currency,
                providerTransactionId: event.providerTransactionId,
                source: `webhook ${provider}`,
            }));
            if (result.outcome === "NOT_FOUND") {
                logger.warn("Webhook received for unknown transaction", { module: "api/payments/webhook", reference: event.reference });
            }
        } else if (event.status === "FAILED") {
            await runAsSystem(SYSTEM_REASON, () => failOnlinePayment(event.reference!, `webhook ${provider}`));
        }

        await invalidateByPath(CACHE_PATHS.payments).catch(() => { });
        return NextResponse.json({ received: true });

    } catch (error) {
        logger.error("Webhook processing failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/webhook" });
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}, { requireAuth: false });
