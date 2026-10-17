/**
 * GET /api/notifications/stream
 *
 * Endpoint Server-Sent Events (SSE) pour les notifications temps réel.
 * Remplace la dépendance socket.io-client/socket.io qui n'avait pas de serveur.
 *
 * Fonctionnement :
 * - Le client ouvre une connexion SSE persistante (EventSource).
 * - Redis Pub/Sub si REDIS_URL est configuré (push immédiat), sinon le serveur
 *   relève les nouvelles notifications en base toutes les 5 secondes.
 * - Le compte est revérifié toutes les 5 secondes et avant chaque message
 *   poussé : compte supprimé, désactivé, suspendu ou mot de passe changé
 *   depuis l'ouverture → flux fermé (audit MS-01, F2). Connexion plafonnée à
 *   30 minutes ; le client se reconnecte via le contrôle d'authentification.
 */

import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getUserStatus } from "@/lib/auth/user-status-cache";
import { isBlockedBySchoolSuspension } from "@/lib/auth/school-suspension";
import { createNotificationStream } from "@/lib/notifications/notification-stream";
import Redis from "ioredis";

export const GET = createApiHandler(
    async (req: NextRequest, { session }) => {
        const userId = session.user.id;
        const redisUrl = process.env.REDIS_URL;
        // La session était valide à l'ouverture : un mot de passe changé
        // ensuite l'invalide, comme dans le callback `jwt`.
        const openedAt = new Date();

        const verify = async () => {
            const status = await getUserStatus(userId);
            if (!status || !status.isActive || isBlockedBySchoolSuspension(status)) return false;
            return !(status.passwordChangedAt && status.passwordChangedAt > openedAt);
        };

        const subscribe = redisUrl
            ? (onMessage: (data: unknown) => void) => {
                  const subscriber = new Redis(redisUrl);
                  const channel = `notifications:${userId}`;
                  subscriber.subscribe(channel, (err) => {
                      if (err) logger.error("Redis Subscribe error", err as Error);
                  });
                  subscriber.on("message", (ch, message) => {
                      if (ch !== channel) return;
                      try {
                          onMessage(JSON.parse(message));
                      } catch (err) {
                          logger.error("Redis parse error", err as Error);
                      }
                  });
                  // Chaque libération est tentée même si l'autre échoue
                  return () => {
                      Promise.resolve().then(() => subscriber.unsubscribe()).catch(() => {});
                      Promise.resolve().then(() => subscriber.quit()).catch(() => {});
                  };
              }
            : undefined;

        const { stream, close } = createNotificationStream({
            userId,
            verify,
            subscribe,
            fetchSince: subscribe
                ? undefined
                : (since) =>
                      prisma.notification.findMany({
                          where: { userId, createdAt: { gt: since } },
                          orderBy: { createdAt: "asc" },
                          take: 50,
                      }),
        });

        // Fermeture propre si le client déconnecte
        req.signal.addEventListener("abort", () => close("client_closed"));

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no", // Désactive le buffering nginx
            },
        });
    });
