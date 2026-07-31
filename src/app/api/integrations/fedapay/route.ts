import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isFedaPayConfigured, getFedaPayMode, FEDAPAY_REQUIRED_ENV } from "@/lib/payments/fedapay";

/**
 * GET /api/integrations/fedapay — statut de l'intégration FedaPay.
 *
 * Renvoie l'état de configuration (sans jamais exposer les clés). Le front
 * affiche une bannière de configuration tant que `configured=false`.
 */
export const GET = createApiHandler(
    async () => {
        const configured = isFedaPayConfigured();
        const webhookConfigured = Boolean(process.env.FEDAPAY_WEBHOOK_SECRET);

        return NextResponse.json({
            configured,
            mode: getFedaPayMode(),
            webhookConfigured,
            webhookPath: "/api/payments/fedapay/webhook",
            initiatePath: "/api/payments/fedapay/initiate",
            requiredEnvVars: configured
                ? webhookConfigured
                    ? []
                    : ["FEDAPAY_WEBHOOK_SECRET"]
                : [...FEDAPAY_REQUIRED_ENV],
        });
    },
    { requireAuth: true }
);
