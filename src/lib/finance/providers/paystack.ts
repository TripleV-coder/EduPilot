/**
 * Paystack Payment Provider
 * Intégration via l'API Paystack v1
 *
 * Variables d'environnement requises :
 *   PAYSTACK_SECRET_KEY   — clé secrète (sk_live_… ou sk_test_…)
 *   NEXT_PUBLIC_APP_URL   — URL de base pour les redirections
 */

import { PaymentProvider } from '../types';
import { logger } from '@/lib/utils/logger';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Paystack attend le montant en kobo (×100 pour XOF/NGN)
        const amountInKobo = Math.round(amount * 100);

        const payload = {
            email,
            amount: amountInKobo,
            currency: currency || 'NGN',
            reference,
            callback_url: `${appUrl}/api/payments/reconcile?ref=${reference}`,
            metadata: {
                ...metadata,
                cancel_action: `${appUrl}/dashboard/finance`,
            },
        };

        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data: PaystackInitResponse = await response.json();

        if (!response.ok || !data.status || !data.data?.authorization_url) {
            logger.error(
                '[Paystack] Échec initiation paiement',
                new Error(data.message),
                { reference, amount, currency }
            );
            throw new Error(`Paystack initiation failed: ${data.message}`);
        }

        return {
            paymentUrl: data.data.authorization_url,
            transactionId: reference,
        };
    }

    async verifyPayment(
        transactionId: string
    ): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; rawData: unknown }> {
        const response = await fetch(
            `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(transactionId)}`,
            {
                method: 'GET',
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
