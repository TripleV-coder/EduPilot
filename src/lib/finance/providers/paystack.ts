/**
 * Paystack Payment Provider
 * Intégration via l'API Paystack v1
 *
 * Variables d'environnement requises :
 *   PAYSTACK_SECRET_KEY   — clé secrète (sk_live_… ou sk_test_…)
 *   NEXT_PUBLIC_APP_URL   — URL de base pour les redirections
 */

import { publicBaseUrl } from "@/lib/system/platform";
import { PaymentProvider } from '../types';
import { logger } from '@/lib/utils/logger';
import { CIRCUITS, circuitFetch } from '@/lib/resilience/circuit-breaker';
import { ProviderInitError, outcomeForHttpStatus, outcomeForSendError } from './init-error';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_TIMEOUT_MS = 20_000;

interface PaystackInitResponse {
    status: boolean;
    message: string;
    data?: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

interface PaystackVerifyResponse {
    status: boolean;
    message: string;
    data?: {
        id: number;
        reference: string;
        status: 'success' | 'failed' | 'abandoned' | 'pending';
        amount: number; // en kobo (centimes)
        currency: string;
        customer: {
            email: string;
        };
        metadata?: Record<string, unknown>;
    };
}

export class PaystackProvider implements PaymentProvider {
    readonly name = 'PAYSTACK';

    private get secretKey(): string {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) throw new Error('[Paystack] PAYSTACK_SECRET_KEY non configurée');
        return key;
    }

    async initiatePayment(
        amount: number,
        currency: string,
        email: string,
        reference: string,
        metadata: Record<string, unknown>
    ): Promise<{ paymentUrl: string; transactionId: string }> {
        const appUrl = (publicBaseUrl() ?? "http://localhost:3000");

        // Paystack attend le montant en kobo (×100 pour XOF/NGN)
        const amountInKobo = Math.round(amount * 100);

        const payload = {
            email,
            amount: amountInKobo,
            currency: currency || 'NGN',
            reference,
            callback_url: `${appUrl}/dashboard/finance/retour-paiement?ref=${encodeURIComponent(reference)}`,
            metadata: {
                ...metadata,
                cancel_action: `${appUrl}/dashboard/finance`,
            },
        };

        // Notre référence marchande sert d'identifiant à la vérification : si la
        // création reste incertaine, elle permet d'interroger Paystack plus tard
        let response: Response;
        try {
            response = await circuitFetch(CIRCUITS.paystack, `${PAYSTACK_BASE_URL}/transaction/initialize`, {
                method: 'POST',
                signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            const outcome = outcomeForSendError(error);
            throw new ProviderInitError(`Paystack initiation failed: ${(error as Error).message}`, outcome, outcome === 'UNKNOWN' ? reference : undefined, { cause: error });
        }

        const data = (await response.json().catch(() => null)) as PaystackInitResponse | null;
        if (!data) {
            const outcome = response.ok ? 'UNKNOWN' : outcomeForHttpStatus(response.status);
            throw new ProviderInitError(`Paystack initiation failed: réponse illisible (${response.status})`, outcome, outcome === 'UNKNOWN' ? reference : undefined);
        }

        if (!response.ok || !data.status || !data.data?.authorization_url) {
            logger.error(
                '[Paystack] Échec initiation paiement',
                new Error(data.message),
                { reference, amount, currency }
            );
            // Refus explicite (4xx) : aucune transaction ; sinon (5xx, réponse incomplète) : inconnu
            const outcome = response.ok ? 'UNKNOWN' : outcomeForHttpStatus(response.status);
            throw new ProviderInitError(`Paystack initiation failed: ${data.message}`, outcome, outcome === 'UNKNOWN' ? reference : undefined);
        }

        return {
            paymentUrl: data.data.authorization_url,
            transactionId: reference,
        };
    }

    async verifyPayment(
        transactionId: string
    ): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; rawData: unknown }> {
        const response = await circuitFetch(
            CIRCUITS.paystack,
            `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(transactionId)}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
                headers: { Authorization: `Bearer ${this.secretKey}` },
            }
        );

        const data: PaystackVerifyResponse = await response.json();

        if (!response.ok || !data.status) {
            logger.warn('[Paystack] Vérification paiement échouée', {
                transactionId,
                message: data.message,
            });
            return { status: 'PENDING', rawData: data };
        }

        const psStatus = data.data?.status;

        let status: 'SUCCESS' | 'FAILED' | 'PENDING';
        if (psStatus === 'success') {
            status = 'SUCCESS';
        } else if (psStatus === 'failed' || psStatus === 'abandoned') {
            status = 'FAILED';
        } else {
            status = 'PENDING';
        }

        return { status, rawData: data.data };
    }
}
