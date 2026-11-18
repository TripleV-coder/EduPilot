import webpush from "web-push";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { pushConfig } from "./config";
import { isAllowedPushEndpoint } from "./endpoint";
import { buildPushMessage, type PushItem, type PushMessage } from "./message";

/** Un abonnement en échec 5 fois de suite est abandonné (navigateur désinstallé…). */
export const MAX_PUSH_FAILURES = 5;
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const PUSH_TIMEOUT_MS = 10_000;
const PUSH_CONCURRENCY = 8;

export type PushOutcome = "sent" | "gone" | "failed";

interface StoredSubscription {
    id: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

/** Envoi chiffré (RFC 8291) et signé VAPID (RFC 8292) vers le service push du navigateur. */
export async function sendPushToSubscription(subscription: StoredSubscription, message: PushMessage): Promise<PushOutcome> {
    const cfg = pushConfig();
    if (!cfg.configured || !cfg.publicKey || !cfg.privateKey || !cfg.subject) return "failed";
    // Défense en profondeur : jamais d'appel vers une adresse hors services push
    if (!isAllowedPushEndpoint(subscription.endpoint)) return "gone";
    try {
        await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            JSON.stringify(message),
            {
                TTL: PUSH_TTL_SECONDS,
                urgency: "normal",
                timeout: PUSH_TIMEOUT_MS,
                vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
            },
        );
        return "sent";
    } catch (error) {
        const status = (error as { statusCode?: unknown }).statusCode;
        // 404/410 : abonnement expiré ou révoqué par la personne
        if (status === 404 || status === 410) return "gone";
        logger.warn("Notification push refusée par le service du navigateur", {
            module: "push/deliver",
            status: typeof status === "number" ? status : null,
        });
        return "failed";
    }
}

async function recordOutcome(subscription: StoredSubscription, outcome: PushOutcome) {
    if (outcome === "sent") {
        await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: 0, lastSuccessAt: new Date() } });
        return;
    }
    if (outcome === "gone") {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        return;
    }
    const updated = await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } });
    if (updated.failureCount >= MAX_PUSH_FAILURES) await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
}

/**
 * Tâche « push.send » : envoie les notifications aux appareils abonnés de
 * leurs destinataires (comptes actifs seulement). Une notification annulée
 * avec sa transaction (identifiant introuvable) n'est pas envoyée. Les échecs
 * d'un appareil n'échouent pas la tâche : rejouer renverrait aux autres.
 */
export async function deliverPushItems(items: readonly PushItem[]): Promise<{ sent: number; failed: number; removed: number }> {
    const summary = { sent: 0, failed: 0, removed: 0 };
    if (items.length === 0 || !pushConfig().configured) return summary;

    const ids = items.map((item) => item.notificationId).filter((id): id is string => Boolean(id));
    const existing = ids.length
        ? new Set((await prisma.notification.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((n) => n.id))
        : null;
    const kept = items.filter((item) => !item.notificationId || existing?.has(item.notificationId));

    const byUser = new Map<string, PushItem[]>();
    for (const item of kept) byUser.set(item.userId, [...(byUser.get(item.userId) ?? []), item]);
    if (byUser.size === 0) return summary;

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: { in: [...byUser.keys()] }, user: { isActive: true } },
        select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    });

    for (let i = 0; i < subscriptions.length; i += PUSH_CONCURRENCY) {
        const batch = subscriptions.slice(i, i + PUSH_CONCURRENCY);
        await Promise.all(
            batch.map(async (subscription) => {
                const message = buildPushMessage(byUser.get(subscription.userId) ?? []);
                if (!message) return;
                const outcome = await sendPushToSubscription(subscription, message);
                if (outcome === "sent") summary.sent += 1;
                else if (outcome === "gone") summary.removed += 1;
                else summary.failed += 1;
                await recordOutcome(subscription, outcome);
            }),
        );
    }
    return summary;
}
