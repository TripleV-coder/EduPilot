/**
 * GET /api/notifications/stream
 *
 * Endpoint Server-Sent Events (SSE) pour les notifications temps réel.
 * Remplace la dépendance socket.io-client/socket.io qui n'avait pas de serveur.
 *
 * Fonctionnement :
 * - Le client ouvre une connexion SSE persistante (EventSource).
 * - Les notifications arrivent par le relevé commun du processus
 *   (`realtime-hub` : une requête toutes les 2 s pour tous les connectés,
 *   livraison immédiate de celles créées sur ce processus).
 * - Le compte est revérifié toutes les 5 secondes et avant chaque message
 *   poussé : compte supprimé, désactivé, suspendu ou mot de passe changé
 *   depuis l'ouverture → flux fermé (audit MS-01, F2). Connexion plafonnée à
 *   30 minutes ; le client se reconnecte via le contrôle d'authentification.
 */

import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getUserStatus } from "@/lib/auth/user-status-cache";
import { isBlockedBySchoolSuspension } from "@/lib/auth/school-suspension";
import { createNotificationStream } from "@/lib/notifications/notification-stream";
import { notificationHub } from "@/lib/notifications/realtime-hub";

export const GET = createApiHandler(
    async (req: NextRequest, { session }) => {
        const userId = session.user.id;
        // La session était valide à l'ouverture : un mot de passe changé
        // ensuite l'invalide, comme dans le callback `jwt`.
        const openedAt = new Date();

        const verify = async () => {
            const status = await getUserStatus(userId);
            if (!status || !status.isActive || isBlockedBySchoolSuspension(status)) return false;
            return !(status.passwordChangedAt && status.passwordChangedAt > openedAt);
        };

        // Relevé commun au processus (un seul pour tous les connectés) ; le
        // flux revérifie le compte toutes les 5 s et avant chaque envoi.
        const { stream, close } = createNotificationStream({
            userId,
            verify,
            subscribe: (onMessage) => notificationHub.subscribe(userId, onMessage),
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
