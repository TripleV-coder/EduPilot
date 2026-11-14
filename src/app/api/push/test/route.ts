import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { pushConfig } from "@/lib/push/config";
import { deliverPushItems } from "@/lib/push/deliver";

/**
 * POST /api/push/test — notification d'essai vers les appareils abonnés du
 * compte connecté, envoyée tout de suite : la personne vérifie que son
 * téléphone la reçoit (écran verrouillé, mode économie d'énergie…).
 */
export const POST = createApiHandler(
    async (_request, { session }) => {
        if (!pushConfig().configured) {
            return NextResponse.json(
                { error: "Les notifications push ne sont pas encore activées sur cette plateforme.", code: "PUSH_NOT_CONFIGURED" },
                { status: 503 },
            );
        }
        const result = await deliverPushItems([
            {
                userId: session.user.id,
                title: "EduPilot — notification d'essai",
                body: "Les notifications de l'établissement arriveront ainsi sur cet appareil.",
                link: "/dashboard/settings/notifications",
                notificationId: null,
            },
        ]);
        if (result.sent === 0) {
            return NextResponse.json(
                { error: "Aucun appareil n'a reçu la notification : réactivez les notifications sur cet appareil.", ...result },
                { status: 409 },
            );
        }
        return NextResponse.json(result);
    },
    { requireAuth: true, rateLimitCount: 10 },
);
