import { randomUUID } from "node:crypto";
import prisma from "../owner-db";
import { decryptPaymentSecret, encryptPaymentSecret } from "@/lib/payments/secret-box";

/**
 * Compte FedaPay ACTIF (bac à sable) d'une école de test (S7) : sans lui, le
 * paiement en ligne est indisponible pour l'école (aucun repli global). Clés
 * synthétiques, chiffrées comme en production (clé maîtresse de setup.ts).
 * Idempotent : renvoie le compte actif existant s'il y en a un.
 */
export async function activeSchoolAccount(schoolId: string): Promise<{ id: string; webhookSecret: string }> {
    const existing = await prisma.schoolPaymentAccount.findFirst({
        where: { schoolId, provider: "FEDAPAY", environment: "SANDBOX", status: "ACTIVE" },
        select: { id: true, webhookSecretCiphertext: true },
    });
    if (existing) {
        const webhookSecret = decryptPaymentSecret(existing.webhookSecretCiphertext, { schoolId, accountId: existing.id, field: "webhookSecret" });
        return { id: existing.id, webhookSecret: webhookSecret ?? "" };
    }
    const id = randomUUID();
    const secretKey = `sk_sandbox_test_${id.slice(0, 8)}`;
    const webhookSecret = `wh_test_${id.slice(0, 8)}`;
    const key = encryptPaymentSecret(secretKey, { schoolId, accountId: id, field: "secretKey" });
    const hook = encryptPaymentSecret(webhookSecret, { schoolId, accountId: id, field: "webhookSecret" });
    await prisma.schoolPaymentAccount.create({
        data: {
            id, schoolId, provider: "FEDAPAY", environment: "SANDBOX", status: "ACTIVE",
            secretKeyCiphertext: key.ciphertext, webhookSecretCiphertext: hook.ciphertext,
            encryptionKeyVersion: key.version, secretKeyLast4: secretKey.slice(-4),
            lastVerifiedAt: new Date(), activatedAt: new Date(),
        },
    });
    return { id, webhookSecret };
}

export async function ensureActiveSchoolAccount(schoolId: string): Promise<string> {
    return (await activeSchoolAccount(schoolId)).id;
}

/**
 * Remplace le client FedaPay par compte par le double « initiatePayment » d'un
 * test écrit avant S7 (même signature que l'ancien fournisseur global).
 */
export function accountCheckoutFrom(
    initiatePayment: (amount: number, currency: string, email: string, reference: string, metadata: Record<string, unknown>) => Promise<{ paymentUrl: string; transactionId: string }>,
) {
    return async (_credentials: unknown, params: { amount: number; reference: string; customer: { email: string; phone?: string } }) => {
        const result = await initiatePayment(params.amount, "XOF", params.customer.email, params.reference, { phone: params.customer.phone });
        return { url: result.paymentUrl, token: "", transactionId: result.transactionId };
    };
}
