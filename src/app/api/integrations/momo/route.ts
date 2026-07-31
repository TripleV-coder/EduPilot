import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * GET /api/integrations/momo — statut de l'intégration MTN MoMo.
 *
 * Variables requises pour une intégration active :
 *   MOMO_WEBHOOK_SECRET   — secret HMAC pour valider les webhooks entrants
 *   MOMO_SUBSCRIPTION_KEY — clé d'abonnement MTN MoMo API (Collection/Disbursement)
 *   MOMO_API_USER         — UUID API User (généré via MTN MoMo Developer Portal)
 *   MOMO_API_KEY          — clé API associée à l'API User
 *   MOMO_BASE_URL         — https://proxy.momoapi.mtn.com (production) ou sandbox
 *
 * Webhook URL à enregistrer :
 *   https://votre-domaine.com/api/payments/momo/webhook
 */
export const GET = createApiHandler(
    async () => {
        const configured = Boolean(
            process.env.MOMO_WEBHOOK_SECRET && process.env.MOMO_SUBSCRIPTION_KEY
        );
        const sandbox = process.env.MOMO_BASE_URL?.includes("sandbox") ?? false;

        return NextResponse.json({
            configured,
            sandbox,
            webhookPath: "/api/payments/momo/webhook",
            requiredEnvVars: configured
                ? []
                : [
                      "MOMO_WEBHOOK_SECRET",
                      "MOMO_SUBSCRIPTION_KEY",
                      "MOMO_API_USER",
                      "MOMO_API_KEY",
                      "MOMO_BASE_URL",
                  ],
        });
    },
    { requireAuth: true }
);
