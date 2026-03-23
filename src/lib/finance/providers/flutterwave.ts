/**
 * Flutterwave Payment Provider
 * Intégration complète via l'API Flutterwave v3
 *
 * Variables d'environnement requises :
 *   FLUTTERWAVE_SECRET_KEY   — clé secrète (FLWSECK-…)
 *   FLUTTERWAVE_PUBLIC_KEY   — clé publique (FLWPUBK-…)
 *   FLUTTERWAVE_WEBHOOK_SECRET — secret pour valider les webhooks HMAC
 *   NEXT_PUBLIC_APP_URL       — URL de base pour construire les redirect_url
 */

import { PaymentProvider } from '../types';
import { logger } from '@/lib/utils/logger';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

interface FlwInitiateResponse {
    status: string;
    message: string;
    data?: {
        link: string;
    };
}

interface FlwVerifyResponse {
    status: string;
    message: string;
    data?: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        status: 'successful' | 'failed' | 'pending';
        amount: number;
        currency: string;
        customer: {
            email: string;
            name: string;
        };
        meta?: Record<string, unknown>;
    };
}

export class FlutterwaveProvider implements PaymentProvider {
    readonly name = 'FLUTTERWAVE';

    private get secretKey(): string {
        const key = process.env.FLUTTERWAVE_SECRET_KEY;
        if (!key) throw new Error('[Flutterwave] FLUTTERWAVE_SECRET_KEY non configurée');
        return key;
    }

    /**
     * Initier un paiement Flutterwave — retourne une URL de paiement hébergée
     */
    async initiatePayment(
        amount: number,
        currency: string,
        email: string,
        reference: string,
        metadata: Record<string, unknown>
    ): Promise<{ paymentUrl: string; transactionId: string }> {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const payload = {
            tx_ref: reference,
            amount,
            currency: currency || 'XOF',
            redirect_url: `${appUrl}/api/payments/reconcile?ref=${reference}`,
            customer: {
                email,
                name: (metadata?.studentName as string) || 'EduPilot Student',
                phonenumber: (metadata?.phone as string) || undefined,
            },
            customizations: {
                title: 'EduPilot — Paiement scolaire',
                description: (metadata?.description as string) || 'Paiement des frais scolaires',
                logo: `${appUrl}/logo.png`,
            },
            meta: metadata,
        };

        const response = await fetch(`${FLW_BASE_URL}/payments`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data: FlwInitiateResponse = await response.json();

        if (!response.ok || data.status !== 'success' || !data.data?.link) {
            logger.error(
                '[Flutterwave] Échec initiation paiement',
                new Error(data.message),
                { reference, amount, currency }
            );
            throw new Error(`Flutterwave initiation failed: ${data.message}`);
        }

        // L'ID de transaction Flutterwave n'est pas disponible avant la redirection ;
        // on utilise tx_ref comme identifiant côté notre système.
        return {
            paymentUrl: data.data.link,
            transactionId: reference,
        };
    }

    /**
     * Vérifier le statut d'un paiement via l'API Flutterwave
     * @param transactionId — tx_ref ou flw_ref (on supporte les deux)
     */
    async verifyPayment(
        transactionId: string
    ): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; rawData: unknown }> {
        // Flutterwave expose deux endpoints : par flw_ref ou par tx_ref
        // On cherche par tx_ref en premier (correspond à notre reference interne)
        const url = `${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionId)}`;

        let response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${this.secretKey}` },
        });

        // Fallback : chercher par ID numérique si transactionId est un nombre
        if (!response.ok && /^\d+$/.test(transactionId)) {
            response = await fetch(`${FLW_BASE_URL}/transactions/${transactionId}/verify`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${this.secretKey}` },
            });
        }

        const data: FlwVerifyResponse = await response.json();

        if (!response.ok || data.status !== 'success') {
            logger.warn('[Flutterwave] Vérification paiement échouée', {
                transactionId,
                message: data.message,
            });
            return { status: 'PENDING', rawData: data };
        }

        const flwStatus = data.data?.status;

        let status: 'SUCCESS' | 'FAILED' | 'PENDING';
        if (flwStatus === 'successful') {
            status = 'SUCCESS';
        } else if (flwStatus === 'failed') {
            status = 'FAILED';
        } else {
            status = 'PENDING';
        }

        return { status, rawData: data.data };
    }
}
