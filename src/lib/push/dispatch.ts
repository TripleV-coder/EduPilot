import prisma from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";
import { onRecordsCreated, type RecordsCreatedEvent } from "@/lib/db/write-events";
import { enqueueJobs } from "@/lib/jobs/queue";
import { logger } from "@/lib/utils/logger";
import { pushConfig } from "./config";
import { itemsFromNotificationWrite, type PushItem } from "./message";

/**
 * Toute notification de l'application (une trentaine de points de création)
 * part aussi en push vers les appareils abonnés de son destinataire : le
 * client Prisma signale les créations (lib/db/write-events), cet écouteur
 * met l'envoi en file. Aucune route n'a à y penser.
 *
 * - seulement si les clés VAPID sont configurées, et pour les destinataires
 *   qui ont au moins un appareil abonné (pas de tâche inutile) ;
 * - création dans une transaction pas encore validée : envoi différé de 5 s,
 *   et la tâche ignore une notification qui n'existe pas (annulée) ;
 * - tâches sans établissement (un compte peut relever de plusieurs écoles) :
 *   contexte système déclaré.
 */
const ITEMS_PER_JOB = 100;
const IN_TRANSACTION_DELAY_MS = 5_000;
const REGISTERED = Symbol.for("edupilot.push.dispatchRegistered");

export async function queuePushForItems(items: readonly PushItem[], delayed: boolean): Promise<number> {
    if (items.length === 0 || !pushConfig().configured) return 0;
    return runAsSystem("push:notifications", async () => {
        const userIds = [...new Set(items.map((item) => item.userId))];
        const subscribed = new Set(
            (
                await prisma.pushSubscription.findMany({
                    where: { userId: { in: userIds } },
                    select: { userId: true },
                    distinct: ["userId"],
                })
            ).map((s) => s.userId),
        );
        const targeted = items.filter((item) => subscribed.has(item.userId));
        if (targeted.length === 0) return 0;
        const runAt = delayed ? new Date(Date.now() + IN_TRANSACTION_DELAY_MS) : undefined;
        const jobs = [];
        for (let i = 0; i < targeted.length; i += ITEMS_PER_JOB) {
            jobs.push({ type: "push.send" as const, payload: { items: targeted.slice(i, i + ITEMS_PER_JOB) }, runAt, maxAttempts: 3 });
        }
        return enqueueJobs(jobs);
    });
}

function onNotificationCreated(event: RecordsCreatedEvent) {
    if (event.model !== "Notification" || !pushConfig().configured) return;
    const items = itemsFromNotificationWrite(event.operation, event.args, event.result);
    if (items.length === 0) return;
    queuePushForItems(items, event.inTransaction).catch((error) => {
        // L'envoi push est un plus : son échec ne touche jamais la notification
        logger.warn("Mise en file des notifications push impossible", {
            module: "push/dispatch",
            reason: error instanceof Error ? error.message : String(error),
        });
    });
}

/** Inscrit l'écouteur une seule fois par processus (appelé au démarrage). */
export function registerPushDispatch(): () => void {
    const registry = globalThis as unknown as Record<symbol, (() => void) | undefined>;
    const existing = registry[REGISTERED];
    if (existing) return existing;
    const unsubscribe = onRecordsCreated(onNotificationCreated);
    const release = () => {
        unsubscribe();
        registry[REGISTERED] = undefined;
    };
    registry[REGISTERED] = release;
    return release;
}
