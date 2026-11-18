import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { pushConfig } from "@/lib/push/config";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/push/endpoint";

/** Au-delà, les appareils les plus anciens sont oubliés. */
const MAX_DEVICES_PER_USER = 10;

/**
 * Abonnement de CET appareil aux notifications push (Web Push).
 * GET : clé publique VAPID et nombre d'appareils abonnés du compte.
 * POST : enregistre l'abonnement du navigateur (rattaché au compte connecté).
 * DELETE : le retire (désactivation, déconnexion).
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const cfg = pushConfig();
        const devices = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
        return NextResponse.json({ configured: cfg.configured, publicKey: cfg.configured ? cfg.publicKey : null, devices });
    },
    { requireAuth: true },
);

export const POST = createApiHandler(
    async (request, { session }) => {
        if (!pushConfig().configured) {
            return NextResponse.json(
                { error: "Les notifications push ne sont pas encore activées sur cette plateforme.", code: "PUSH_NOT_CONFIGURED" },
                { status: 503 },
            );
        }
        const data = pushSubscriptionSchema.parse(await request.json());
        const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
        // Un navigateur sert le dernier compte qui y active les notifications
        await prisma.pushSubscription.upsert({
            where: { endpoint: data.endpoint },
            create: { userId: session.user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, userAgent },
            update: { userId: session.user.id, p256dh: data.keys.p256dh, auth: data.keys.auth, userAgent, failureCount: 0 },
        });
        const stale = await prisma.pushSubscription.findMany({
            where: { userId: session.user.id },
            orderBy: { updatedAt: "desc" },
            skip: MAX_DEVICES_PER_USER,
            select: { id: true },
        });
        if (stale.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
        return NextResponse.json({ subscribed: true }, { status: 201 });
    },
    { requireAuth: true },
);

export const DELETE = createApiHandler(
    async (request, { session }) => {
        const { endpoint } = pushUnsubscribeSchema.parse(await request.json());
        const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
        return NextResponse.json({ removed: count });
    },
    { requireAuth: true },
);
