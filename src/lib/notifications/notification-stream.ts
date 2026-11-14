/**
 * Flux SSE des notifications d'un compte, révocable (audit MS-01, F2).
 *
 * Une connexion ouverte ne doit pas survivre à la révocation du compte :
 * - `verify()` est rejouée à chaque relève (5 s par défaut) et AVANT de
 *   transmettre tout message poussé : dès qu'elle échoue (compte supprimé,
 *   désactivé, suspendu, mot de passe changé) le flux est fermé et plus rien
 *   n'est envoyé ;
 * - une erreur pendant la vérification (base injoignable) ferme aussi le
 *   flux : aucune donnée privée sans autorisation vérifiée ;
 * - durée de connexion plafonnée (30 min par défaut) : le client se reconnecte
 *   et repasse le contrôle d'authentification normal. Ce plafond n'est pas un
 *   délai de révocation.
 * Minuteries et abonnement sont libérés à toute fermeture, une seule fois.
 *
 * Journalisation sans donnée personnelle (ni compte, ni contenu) : un échec
 * de relève est signalé au premier échec d'une série, puis au rétablissement
 * avec le nombre d'échecs — une panne prolongée ne produit pas un journal
 * toutes les 5 s par connexion.
 */
import { logger } from "@/lib/utils/logger";

const LOG_CONTEXT = { module: "notifications/stream" } as const;

export interface StreamNotification {
    createdAt: Date;
}

export type StreamCloseReason = "revoked" | "check_failed" | "max_duration" | "client_closed";

export interface NotificationStreamOptions<N extends StreamNotification> {
    userId: string;
    /** Vrai si le compte peut toujours recevoir ses notifications. */
    verify: () => Promise<boolean>;
    /** Notifications créées après `since` (mode relève en base). */
    fetchSince?: (since: Date) => Promise<N[]>;
    /** Abonnement poussé (source externe) ; renvoie la fonction de désabonnement. */
    subscribe?: (onMessage: (data: unknown) => void) => () => void;
    checkIntervalMs?: number;
    keepaliveIntervalMs?: number;
    maxDurationMs?: number;
    now?: () => Date;
    onClose?: (reason: StreamCloseReason) => void;
}

export const STREAM_CHECK_INTERVAL_MS = 5_000;
export const STREAM_KEEPALIVE_INTERVAL_MS = 25_000;
export const STREAM_MAX_DURATION_MS = 30 * 60_000;

export function createNotificationStream<N extends StreamNotification>(options: NotificationStreamOptions<N>) {
    const {
        userId,
        verify,
        fetchSince,
        subscribe,
        checkIntervalMs = STREAM_CHECK_INTERVAL_MS,
        keepaliveIntervalMs = STREAM_KEEPALIVE_INTERVAL_MS,
        maxDurationMs = STREAM_MAX_DURATION_MS,
        now = () => new Date(),
        onClose,
    } = options;

    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    let lastSeenAt = now();
    let checkTimer: ReturnType<typeof setInterval> | null = null;
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    // Vérifications et envois sérialisés : jamais d'envoi après une fermeture décidée
    let queue: Promise<void> = Promise.resolve();

    function write(chunk: string) {
        if (closed || !controller) return;
        try {
            controller.enqueue(encoder.encode(chunk));
        } catch {
            // flux déjà fermé côté client
        }
    }
    const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    function close(reason: StreamCloseReason) {
        if (closed) return;
        if (reason !== "client_closed") send("session-ended", { reason });
        closed = true;
        if (checkTimer) clearInterval(checkTimer);
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        if (maxTimer) clearTimeout(maxTimer);
        checkTimer = keepaliveTimer = maxTimer = null;
        if (unsubscribe) {
            try {
                unsubscribe();
            } catch {
                // abonnement déjà libéré
            }
            unsubscribe = null;
        }
        if (reason !== "client_closed") {
            try {
                controller?.close();
            } catch {
                // déjà fermé
            }
        }
        onClose?.(reason);
    }

    /** Vérifie le compte ; ferme le flux et renvoie faux s'il n'est plus autorisé. */
    async function stillAuthorized(): Promise<boolean> {
        if (closed) return false;
        let ok: boolean;
        try {
            ok = await verify();
        } catch (error) {
            logger.error("Flux de notifications fermé : vérification du compte impossible", error, LOG_CONTEXT);
            close("check_failed");
            return false;
        }
        if (closed) return false;
        if (!ok) close("revoked");
        return ok;
    }

    const enqueue = (task: () => Promise<void>) => {
        queue = queue.then(task, task);
        return queue;
    };

    let fetchFailures = 0;

    function tick() {
        return enqueue(async () => {
            if (!(await stillAuthorized()) || !fetchSince) return;
            let notifications: N[];
            try {
                notifications = await fetchSince(lastSeenAt);
            } catch (error) {
                // Rien n'est transmis ; l'autorisation reste revérifiée à chaque relève
                fetchFailures += 1;
                if (fetchFailures === 1) logger.error("Relève des notifications en échec", error, LOG_CONTEXT);
                return;
            }
            if (fetchFailures > 0) {
                logger.warn("Relève des notifications rétablie", { ...LOG_CONTEXT, consecutiveFailures: fetchFailures });
                fetchFailures = 0;
            }
            if (closed || notifications.length === 0) return;
            send("notifications", notifications);
            lastSeenAt = notifications[notifications.length - 1].createdAt;
        });
    }

    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
            send("connected", { userId, timestamp: now().toISOString() });
            checkTimer = setInterval(() => void tick(), checkIntervalMs);
            keepaliveTimer = setInterval(() => write(": keepalive\n\n"), keepaliveIntervalMs);
            maxTimer = setTimeout(() => close("max_duration"), maxDurationMs);
            if (subscribe) {
                unsubscribe = subscribe((data) => {
                    void enqueue(async () => {
                        if (!(await stillAuthorized())) return;
                        const message = data as { REFRESH_REQUIRED?: boolean };
                        if (message && message.REFRESH_REQUIRED) send("refresh", { reload: true });
                        else send("notifications", [data]);
                    });
                });
            }
        },
        cancel() {
            close("client_closed");
        },
    });

    return {
        stream,
        close,
        /** Pour les tests : attend la fin des vérifications et envois en cours. */
        settled: () => queue,
    };
}
