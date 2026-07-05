import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getUxAnalytics } from "@/lib/ux/analytics";

/**
 * GET /api/ux/analytics?window=30
 *
 * Couche de lecture de la télémétrie UX : activation, rétention (J1/J7/J30)
 * et événements les plus fréquents. Réservé au SUPER_ADMIN (données produit
 * transverses, non liées à un établissement).
 */
export const GET = createApiHandler(
    async (request) => {
        const url = new URL(request.url);
        const raw = Number(url.searchParams.get("window"));
        const windowDays = [7, 30, 90].includes(raw) ? raw : 30;

        const analytics = await getUxAnalytics(windowDays);
        return NextResponse.json(analytics);
    },
    {
        requireAuth: true,
        allowedRoles: ["SUPER_ADMIN"],
    },
);
