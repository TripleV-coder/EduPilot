import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";

/** Champs commerciaux publiables : jamais le nombre d'écoles abonnées. */
const PUBLIC_SELECT = {
    id: true,
    code: true,
    name: true,
    description: true,
    maxStudents: true,
    maxTeachers: true,
    maxStorageGB: true,
    features: true,
    priceMonthly: true,
    priceYearly: true,
    isFeatured: true,
    priceOnRequest: true,
} satisfies Prisma.SubscriptionPlanSelect;

/**
 * GET /api/public/plans — grille tarifaire publique (aucune authentification).
 * Source unique : les plans configurés par le super-administrateur
 * (/dashboard/root-control/plans). Seuls les plans actifs sont exposés, et un
 * plan « sur devis » ne publie pas ses prix.
 */
export const GET = createApiHandler(
    async () => {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            select: PUBLIC_SELECT,
            orderBy: { priceMonthly: "asc" },
        });

        const data = plans.map((plan) => ({
            ...plan,
            priceMonthly: plan.priceOnRequest ? null : Number(plan.priceMonthly),
            priceYearly: plan.priceOnRequest ? null : Number(plan.priceYearly),
        }));

        return NextResponse.json(
            { data },
            // Les tarifs changent rarement : cache court côté CDN, jamais privé.
            { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
        );
    },
    { requireAuth: false },
);
