import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { SupportedProvider } from "@/lib/finance/types";
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

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const provider = req.headers.get("x-payment-provider") as SupportedProvider;

        // --- Vérification de signature selon le provider ---
        let signatureValid = false;

        const flutterwaveSig = req.headers.get("verif-hash");
        const paystackSig = req.headers.get("x-paystack-signature");

        if (flutterwaveSig) {
            signatureValid = verifyFlutterwaveSignature(rawBody, flutterwaveSig);
        } else if (paystackSig) {
            signatureValid = verifyPaystackSignature(rawBody, paystackSig);
        } else {
            // Aucun header de signature — refus
            logger.warn("Webhook reçu sans header de signature", { module: "api/payments/webhook", provider });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!signatureValid) {
            logger.warn("Signature webhook invalide", { module: "api/payments/webhook", provider });
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const body = JSON.parse(rawBody);

        // Simplification: In real world, each provider has different payload structure
        // We assume the provider sends transactionId map-able data
        const transactionId = body.id || body.transaction_id;
        const status = body.status; // "successful", "failed"

        if (!transactionId) {
            logger.warn("Webhook received without transaction identifier", {
                module: "api/payments/webhook",
                provider,
                receivedKeys: Object.keys(body)
            });
            return NextResponse.json({ received: true }); // Acknowledge anyway
        }

        const payment = await prisma.payment.findFirst({
            where: { reference: String(transactionId) }
        });

        if (!payment) {
            logger.warn("Webhook received for unknown transaction", { module: "api/payments/webhook", transactionId });
            return NextResponse.json({ received: true });
        }

        // Idempotency : ignorer si le paiement est déjà dans un état terminal
        if (payment.status === 'VERIFIED' || payment.status === 'CANCELLED') {
            logger.info("Webhook idempotent — paiement déjà traité", { module: "api/payments/webhook", transactionId, status: payment.status });
            return NextResponse.json({ received: true });
        }

        if (status === 'successful') {
            // ANTI FRAUD CHECK: Verify amount matches the DB record
            const amountPaid = body.amount || body.data?.amount;
            if (amountPaid !== undefined && Number(amountPaid) < Number(payment.amount)) {
                logger.error("Fraud attempt: Webhook amount paid is less than DB amount", {
                    module: "api/payments/webhook",
                    transactionId,
                    expected: payment.amount,
                    received: amountPaid
                });
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: 'CANCELLED' } // Reject partial/fraudulent payment
                });
                return NextResponse.json({ received: true });
            }

            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'VERIFIED',
                    paidAt: new Date()
                }
            });
        } else if (status === 'failed') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'CANCELLED'
                }
            });
        }

        await invalidateByPath(CACHE_PATHS.payments).catch(() => { });
        return NextResponse.json({ received: true });

    } catch (error) {
        logger.error("Webhook processing failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/webhook" });
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
