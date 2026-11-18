/**
 * Distribution des notifications aux flux SSE ouverts sur CE processus.
 *
 * Avant (2026-11-08) : chaque onglet ouvert relevait la base toutes les 5 s
 * — 1 000 onglets = 200 requêtes/s, et une notification attendait jusqu'à 5 s.
 * Désormais, un seul relevé par processus pour tous les comptes connectés :
 *  - une requête toutes les 2 s (`HUB_POLL_MS`), seulement tant qu'au moins
 *    un flux est ouvert, quel que soit le nombre de connectés ;
 *  - une notification créée par `createNotification` sur ce processus est
 *    livrée aussitôt (`publish`) ; celles créées ailleurs (autre processus,
 *    autre instance, `createMany`) arrivent au relevé suivant ;
 *  - le relevé repart `HUB_OVERLAP_MS` avant le précédent : une insertion
 *    validée en retard ou un léger écart d'horloge entre instances ne fait
 *    rien perdre ;
 *  - la livraison est suivie PAR CONNEXION : chacune reçoit une notification
 *    une seule fois, et seulement si elle a été créée après son ouverture
 *    (à `HUB_SKEW_MS` près) — ce qui précède est relu par la page à la
 *    connexion. Une connexion qui se ferme (changement de page) ne « consomme »
 *    donc pas la notification de celle qui s'ouvre.
 * Aucune donnée sur disque ni service externe : la base reste la source.
 *
 * L'autorisation n'est PAS vérifiée ici : chaque flux revérifie le compte
 * avant tout envoi (`createNotificationStream`, audit MS-01).
 */
import type { Notification } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const HUB_POLL_MS = 2_000;
export const HUB_OVERLAP_MS = 10_000;
/** Tolérance d'horloge entre instances pour la date d'ouverture d'une connexion. */
export const HUB_SKEW_MS = 1_000;
/** Plafond d'un relevé : au-delà, le relevé suivant reprend la suite. */
export const HUB_BATCH = 500;

export type HubNotification = Pick<Notification, "id" | "userId" | "type" | "title" | "message" | "link" | "isRead" | "createdAt">;
type Listener = (notification: HubNotification) => void;
export type FetchRecent = (userIds: string[], since: Date, take: number) => Promise<HubNotification[]>;

const LOG_CONTEXT = { module: "notifications/hub" } as const;

interface Subscription {
    listener: Listener;
    /** Date d'ouverture : les notifications antérieures ne sont pas livrées. */
    since: number;
    /** Identifiant → date de création des notifications déjà livrées ici. */
    seen: Map<string, number>;
}

export class NotificationHub {
    private readonly subscriptions = new Map<string, Set<Subscription>>();
    private cursor = 0;
    private timer: ReturnType<typeof setInterval> | null = null;
    private polling = false;
    private failures = 0;

    constructor(
        private readonly fetchRecent: FetchRecent,
        private readonly now: () => number = Date.now,
        private readonly pollMs = HUB_POLL_MS,
    ) {}

    /** Écoute les notifications d'un compte ; renvoie la fonction de désabonnement. */
    subscribe(userId: string, listener: Listener): () => void {
        let set = this.subscriptions.get(userId);
        if (!set) {
            set = new Set();
            this.subscriptions.set(userId, set);
        }
        const subscription: Subscription = { listener, since: this.now() - HUB_SKEW_MS, seen: new Map() };
        set.add(subscription);
        if (!this.timer) {
            this.cursor = this.now();
            this.timer = setInterval(() => void this.poll(), this.pollMs);
            this.timer.unref?.();
        }
        return () => {
            const current = this.subscriptions.get(userId);
            if (!current) return;
            current.delete(subscription);
            if (current.size === 0) this.subscriptions.delete(userId);
            if (this.subscriptions.size === 0 && this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        };
    }

    /** Notification créée sur ce processus : livrée sans attendre le relevé. */
    publish(notification: HubNotification): void {
        this.deliver(notification);
    }

    /** Comptes ayant au moins un flux ouvert ici. */
    connectedUsers(): number {
        return this.subscriptions.size;
    }

    private deliver(notification: HubNotification): void {
        const set = this.subscriptions.get(notification.userId);
        if (!set) return;
        const createdAt = notification.createdAt.getTime();
        for (const subscription of [...set]) {
            if (createdAt < subscription.since || subscription.seen.has(notification.id)) continue;
            subscription.seen.set(notification.id, createdAt);
            try {
                subscription.listener(notification);
            } catch (error) {
                logger.error("Livraison d'une notification en échec", error, LOG_CONTEXT);
            }
        }
    }

    /** Un relevé (public pour les tests) ; jamais deux à la fois. */
    async poll(): Promise<void> {
        if (this.polling || this.subscriptions.size === 0) return;
        this.polling = true;
        const startedAt = this.now();
        const since = new Date(this.cursor - HUB_OVERLAP_MS);
        try {
            const rows = await this.fetchRecent([...this.subscriptions.keys()], since, HUB_BATCH);
            if (this.failures > 0) {
                logger.warn("Relève des notifications rétablie", { ...LOG_CONTEXT, consecutiveFailures: this.failures });
                this.failures = 0;
            }
            for (const row of rows) this.deliver(row);
            // Lot plein : on reprend à la dernière ligne reçue (incluse ;
            // celles déjà livrées sont ignorées)
            this.cursor = rows.length >= HUB_BATCH ? rows[rows.length - 1].createdAt.getTime() - 1 + HUB_OVERLAP_MS : startedAt;
            // Hors de la fenêtre du prochain relevé : inutile de s'en souvenir
            const forgetBefore = this.cursor - 2 * HUB_OVERLAP_MS;
            for (const set of this.subscriptions.values()) {
                for (const { seen } of set) for (const [id, createdAt] of seen) if (createdAt < forgetBefore) seen.delete(id);
            }
        } catch (error) {
            // Rien n'est livré ; le curseur ne bouge pas, le relevé suivant reprend
            this.failures += 1;
            if (this.failures === 1) logger.error("Relève des notifications en échec", error, LOG_CONTEXT);
        } finally {
            this.polling = false;
        }
    }
}

const fetchRecentFromDb: FetchRecent = (userIds, since, take) =>
    prismaBase.notification.findMany({
        where: { userId: { in: userIds }, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        take,
        select: { id: true, userId: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true },
    });

// Partagé par toutes les routes du processus (chaque route a son propre
// paquet de modules) : la création dans /api/messages atteint le flux.
const globalForHub = globalThis as unknown as { __edupilotNotificationHub?: NotificationHub };
export const notificationHub = (globalForHub.__edupilotNotificationHub ??= new NotificationHub(fetchRecentFromDb));
