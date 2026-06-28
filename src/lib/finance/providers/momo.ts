/**
 * MTN MoMo — Collection API (requestToPay).
 *
 * Intégration directe MTN Mobile Money pour les écoles disposant d'un compte
 * marchand MoMo (sandbox ou production). Le rapprochement automatique est
 * assuré par le webhook `/api/payments/momo/webhook` déjà présent.
 *
 * Contrairement à un checkout hébergé, requestToPay envoie une demande push sur
 * le téléphone du payeur : `paymentUrl` est donc vide et le statut se confirme
 * via `verifyPayment` (polling) ou le webhook. Le numéro du payeur (MSISDN) est
 * requis et passé via `metadata.phone`.
 *
 * Variables d'environnement :
 *   MOMO_BASE_URL            — défaut https://sandbox.momodeveloper.mtn.com
 *   MOMO_SUBSCRIPTION_KEY    — clé d'abonnement Collection (Ocp-Apim-…)
 *   MOMO_API_USER            — identifiant API (UUID)
 *   MOMO_API_KEY             — clé API
 *   MOMO_TARGET_ENVIRONMENT  — "sandbox" | "mtnbenin" | … (défaut sandbox)
 *   MOMO_CURRENCY            — devise (défaut XOF ; EUR en sandbox)
 */
import { PaymentProvider } from "../types";
import { logger } from "@/lib/utils/logger";

const DEFAULT_BASE = "https://sandbox.momodeveloper.mtn.com";

export function isMomoConfigured(): boolean {
    return Boolean(
        process.env.MOMO_SUBSCRIPTION_KEY &&
            process.env.MOMO_API_USER &&
            process.env.MOMO_API_KEY
    );
}

function baseUrl(): string {
    return process.env.MOMO_BASE_URL || DEFAULT_BASE;
}

function targetEnv(): string {
    return process.env.MOMO_TARGET_ENVIRONMENT || "sandbox";
}

interface TokenCache {
    token: string;
    expiresAt: number;
}
let tokenCache: TokenCache | null = null;

export class MomoProvider implements PaymentProvider {
    readonly name = "MOMO";

    private requireConfig(): void {
        if (!isMomoConfigured()) {
            throw new Error("[MoMo] Intégration MTN MoMo non configurée (MOMO_SUBSCRIPTION_KEY/API_USER/API_KEY)");
        }
    }

    /** Jeton OAuth Collection (mis en cache jusqu'à ~60s avant expiration). */
    private async getToken(): Promise<string> {
        if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

        const basic = Buffer.from(
            `${process.env.MOMO_API_USER}:${process.env.MOMO_API_KEY}`
        ).toString("base64");

        const res = await fetch(`${baseUrl()}/collection/token/`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${basic}`,
                "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
            },
        });

        if (!res.ok) {
            throw new Error(`[MoMo] Échec d'authentification (${res.status})`);
        }
        const data = (await res.json()) as { access_token: string; expires_in?: number };
        const ttl = (data.expires_in ?? 3600) * 1000;
        tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl - 60_000 };
        return data.access_token;
    }

    async initiatePayment(
        amount: number,
        currency: string,
        _email: string,
        reference: string,
        metadata: Record<string, unknown>
    ): Promise<{ paymentUrl: string; transactionId: string }> {
        this.requireConfig();

        const msisdn = (metadata?.phone as string)?.replace(/[\s+]/g, "");
        if (!msisdn) {
            throw new Error("[MoMo] Numéro du payeur requis (metadata.phone) pour requestToPay");
        }

        const token = await this.getToken();
        const referenceId = globalThis.crypto.randomUUID();

        const res = await fetch(`${baseUrl()}/collection/v1_0/requesttopay`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "X-Reference-Id": referenceId,
                "X-Target-Environment": targetEnv(),
                "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: String(Math.round(amount)),
                currency: currency || process.env.MOMO_CURRENCY || "XOF",
                externalId: reference,
                payer: { partyIdType: "MSISDN", partyId: msisdn },
                payerMessage: (metadata?.description as string) || "Frais scolaires EduPilot",
                payeeNote: "EduPilot",
            }),
        });

        // 202 Accepted = demande poussée sur le téléphone du payeur.
        if (res.status !== 202) {
            const text = await res.text().catch(() => "");
            logger.error("[MoMo] requestToPay échec", new Error(`status ${res.status}`), {
                reference,
                body: text.slice(0, 300),
            });
            throw new Error(`[MoMo] requestToPay refusé (${res.status})`);
        }

        return { paymentUrl: "", transactionId: referenceId };
    }

    async verifyPayment(
        transactionId: string
    ): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING"; rawData: unknown }> {
        this.requireConfig();
        const token = await this.getToken();

        const res = await fetch(
            `${baseUrl()}/collection/v1_0/requesttopay/${transactionId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Target-Environment": targetEnv(),
                    "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
                },
            }
        );

        if (!res.ok) {
            return { status: "PENDING", rawData: { httpStatus: res.status } };
        }

        const data = (await res.json()) as { status?: string };
        const s = (data.status || "").toUpperCase();
        const status: "SUCCESS" | "FAILED" | "PENDING" =
            s === "SUCCESSFUL" ? "SUCCESS" : s === "FAILED" ? "FAILED" : "PENDING";
        return { status, rawData: data };
    }
}
