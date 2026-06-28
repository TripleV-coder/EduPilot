/**
 * FedaPay Payment Provider (agrégateur Bénin/Afrique de l'Ouest).
 *
 * Couvre Mobile Money (MTN, Moov, Celtiis) + cartes via un checkout hébergé.
 * Délègue à `@/lib/payments/fedapay` (SDK officiel, déjà testé). Config-gated :
 * sans FEDAPAY_SECRET_KEY, l'initiation lève une erreur explicite.
 */
import { PaymentProvider } from "../types";
import {
    createFedaPayCheckout,
    retrieveFedaPayTransaction,
    isFedaPayConfigured,
} from "@/lib/payments/fedapay";

function splitName(full: string | undefined): { firstname: string; lastname: string } {
    const parts = (full || "EduPilot Élève").trim().split(/\s+/);
    if (parts.length === 1) return { firstname: parts[0], lastname: "—" };
    return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export class FedaPayProvider implements PaymentProvider {
    readonly name = "FEDAPAY";

    async initiatePayment(
        amount: number,
        _currency: string,
        email: string,
        reference: string,
        metadata: Record<string, unknown>
    ): Promise<{ paymentUrl: string; transactionId: string }> {
        if (!isFedaPayConfigured()) {
            throw new Error("[FedaPay] FEDAPAY_SECRET_KEY non configurée");
        }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const { firstname, lastname } = splitName(metadata?.studentName as string);

        const checkout = await createFedaPayCheckout({
            amount,
            description: (metadata?.description as string) || "Frais scolaires EduPilot",
            reference,
            callbackUrl: `${appUrl}/api/payments/reconcile?ref=${encodeURIComponent(reference)}`,
            customer: {
                firstname,
                lastname,
                email,
                phone: (metadata?.phone as string) || undefined,
            },
        });

        return { paymentUrl: checkout.url, transactionId: checkout.transactionId };
    }

    async verifyPayment(
        transactionId: string
    ): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING"; rawData: unknown }> {
        const { status, raw } = await retrieveFedaPayTransaction(transactionId);
        return { status, rawData: raw };
    }
}
