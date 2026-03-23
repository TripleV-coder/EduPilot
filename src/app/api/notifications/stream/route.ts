/**
 * GET /api/notifications/stream
 *
 * Endpoint Server-Sent Events (SSE) pour les notifications temps réel.
 * Remplace la dépendance socket.io-client/socket.io qui n'avait pas de serveur.
 *
 * Fonctionnement :
 * - Le client ouvre une connexion SSE persistante (EventSource).
 * - Le serveur poll les nouvelles notifications en DB toutes les 5 secondes
 *   et les pousse au client si de nouvelles sont arrivées.
 * - La connexion se ferme automatiquement côté client si signal AbortController.
 *
 * Évolution future : remplacer le polling par Redis Pub/Sub pour du push immédiat.
 */

import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import Redis from "ioredis";

const KEEPALIVE_INTERVAL_MS = 25_000; // ping toutes les 25 s pour éviter les timeouts proxies
const POLLING_INTERVAL_MS = 5_000;

export const GET = createApiHandler(
    async (req: NextRequest, { session }) => {
        const userId = session.user.id;
        const redisUrl = process.env.REDIS_URL;

        const encoder = new TextEncoder();
        let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;
        let subscriber: Redis | null = null;
        let lastSeenAt = new Date();
        let isPolling = false;

        const stream = new ReadableStream({
            start(controller) {
                function send(event: string, data: unknown) {
                    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    try {
                        controller.enqueue(encoder.encode(payload));
                    } catch {
                        // Controller fermé
                    }
                }

                // Message de connexion initial
                send("connected", { userId, timestamp: new Date().toISOString() });

                // Subscribe to Redis if configured, otherwise fallback to DB polling
                if (redisUrl) {
                    try {
                        subscriber = new Redis(redisUrl);
                        const channel = `notifications:${userId}`;

                        subscriber.subscribe(channel, (err) => {
                            if (err) logger.error("Redis Subscribe error", err as Error);
                        });

                        subscriber.on("message", (ch, message) => {
                            if (ch === channel) {
                                try {
                                    const data = JSON.parse(message);
                                    if (data.REFRESH_REQUIRED) {
                                        send("refresh", { reload: true });
                                    } else {
                                        send("notifications", [data]);
                                    }
                                } catch (err) {
                                    logger.error("Redis parse error", err as Error);
                                }
                            }
                        });
                    } catch (error) {
                        logger.error("Redis connection error", error as Error);
                    }
                } else {
                    // Fallback: poll DB for new notifications
                    pollingTimer = setInterval(async () => {
                        if (isPolling) return;
                        isPolling = true;
                        try {
                            const notifications = await prisma.notification.findMany({
                                where: {
                                    userId,
                                    createdAt: { gt: lastSeenAt },
                                },
                                orderBy: { createdAt: "asc" },
                                take: 50,
                            });

                            if (notifications.length > 0) {
                                send("notifications", notifications);
                                lastSeenAt = notifications[notifications.length - 1].createdAt;
                            }
                        } catch (error) {
                            logger.error("Notification polling error", error as Error);
                        } finally {
                            isPolling = false;
                        }
                    }, POLLING_INTERVAL_MS);
                }

                // Keepalive pour éviter les timeouts des proxies/load balancers
                keepaliveTimer = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(": keepalive\n\n"));
                    } catch {
                        // Controller fermé
                    }
                }, KEEPALIVE_INTERVAL_MS);
            },

            cancel() {
                if (keepaliveTimer) clearInterval(keepaliveTimer);
                if (pollingTimer) clearInterval(pollingTimer);
                if (subscriber) {
                    subscriber.unsubscribe();
                    subscriber.quit();
                }
            },
        });

        // Fermeture propre si le client déconnecte
        req.signal.addEventListener("abort", () => {
            if (keepaliveTimer) clearInterval(keepaliveTimer);
            if (pollingTimer) clearInterval(pollingTimer);
            if (subscriber) {
                subscriber.unsubscribe();
                subscriber.quit();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no", // Désactive le buffering nginx
            },
        });
    });
