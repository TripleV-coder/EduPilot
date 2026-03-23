/**
 * Notifications temps réel via Server-Sent Events (SSE)
 *
 * Remplace l'ancienne dépendance socket.io-client (qui n'avait pas de serveur socket.io).
 * Utilise l'API EventSource native du navigateur + /api/notifications/stream.
 *
 * Usage (React) :
 *   import { useNotificationStream } from "@/lib/socket";
 *
 *   const { notifications, unreadCount } = useNotificationStream();
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StreamNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    isRead: boolean;
    createdAt: string;
}

interface UseNotificationStreamOptions {
    /** Appelé à chaque nouvelle notification reçue */
    onNotification?: (notifications: StreamNotification[]) => void;
    /** Désactive le stream (ex: utilisateur non connecté) */
    enabled?: boolean;
}

/**
 * Hook React pour recevoir les notifications en temps réel via SSE.
 */
export function useNotificationStream({
    onNotification,
    enabled = true,
}: UseNotificationStreamOptions = {}) {
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState<StreamNotification[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectDelay = useRef(1_000); // backoff exponentiel

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        let es: EventSource | null = null;

        function connect() {
            // Fermer la connexion existante avant de rouvrir
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            es = new EventSource("/api/notifications/stream");
            eventSourceRef.current = es;

            es.addEventListener("connected", () => {
                setIsConnected(true);
                reconnectDelay.current = 1_000; // réinitialiser le backoff
            });

            es.addEventListener("notifications", (e: MessageEvent) => {
                try {
                    const newItems: StreamNotification[] = JSON.parse(e.data);
                    setNotifications((prev) => {
                        // Déduplique par id
                        const ids = new Set(prev.map((n) => n.id));
                        const deduped = newItems.filter((n) => !ids.has(n.id));
                        return [...deduped, ...prev].slice(0, 100); // garder les 100 dernières
                    });
                    onNotification?.(newItems);
                } catch {
                    // JSON invalide — ignoré
                }
            });

            es.onerror = () => {
                setIsConnected(false);
                es?.close();
                eventSourceRef.current = null;

                // Reconnexion avec backoff exponentiel (max 30 s)
                const delay = Math.min(reconnectDelay.current, 30_000);
                reconnectDelay.current = delay * 2;
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            };
        }

        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [enabled, onNotification]);

    const markAsRead = useCallback((notificationId: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return { isConnected, notifications, unreadCount, markAsRead, clearAll };
}

// Compat stubs — conservés pour éviter les erreurs d'import si du code référençait les anciennes fonctions
/** @deprecated Utiliser useNotificationStream() à la place */
export const getSocket = () => {
    console.warn("[EduPilot] getSocket() est déprécié. Utiliser useNotificationStream().");
    return null;
};

/** @deprecated Utiliser useNotificationStream() à la place */
export const connectSocket = () => {
    console.warn("[EduPilot] connectSocket() est déprécié. Utiliser useNotificationStream().");
    return null;
};

/** @deprecated */
export const disconnectSocket = () => {
    console.warn("[EduPilot] disconnectSocket() est déprécié.");
};
