import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prismaBase: {} }));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { HUB_BATCH, HUB_OVERLAP_MS, HUB_POLL_MS, NotificationHub, type FetchRecent, type HubNotification } from "@/lib/notifications/realtime-hub";
import { logger } from "@/lib/utils/logger";

let clock = 1_000_000;
const now = () => clock;
let seq = 0;
const notif = (userId: string, at = clock): HubNotification => ({
    id: `n${++seq}`,
    userId,
    type: "MESSAGE",
    title: "Nouveau message",
    message: "…",
    link: "/dashboard/messages",
    isRead: false,
    createdAt: new Date(at),
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clock = 1_000_000;
});
afterEach(() => vi.useRealTimers());

describe("NotificationHub — un relevé commun pour tous les connectés", () => {
    it("une seule requête par relevé, quel que soit le nombre de comptes connectés", async () => {
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([]);
        const hub = new NotificationHub(fetchRecent, now);
        for (let i = 0; i < 300; i++) hub.subscribe(`u${i}`, () => {});
        await vi.advanceTimersByTimeAsync(HUB_POLL_MS);
        expect(fetchRecent).toHaveBeenCalledTimes(1);
        expect(fetchRecent.mock.calls[0][0]).toHaveLength(300);
    });

    it("chaque compte ne reçoit que ses notifications, chaque onglet les reçoit", async () => {
        const forA = notif("A");
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([forA, notif("B")]);
        const hub = new NotificationHub(fetchRecent, now);
        const tab1 = vi.fn();
        const tab2 = vi.fn();
        hub.subscribe("A", tab1);
        hub.subscribe("A", tab2);
        await hub.poll();
        expect(tab1).toHaveBeenCalledExactlyOnceWith(forA);
        expect(tab2).toHaveBeenCalledExactlyOnceWith(forA);
    });

    it("publish livre aussitôt, et le relevé suivant ne la relivre pas", async () => {
        const n = notif("A");
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([n]);
        const hub = new NotificationHub(fetchRecent, now);
        const listener = vi.fn();
        hub.subscribe("A", listener);
        hub.publish(n);
        expect(listener).toHaveBeenCalledTimes(1);
        await hub.poll();
        await hub.poll();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("le relevé repart avant le précédent : une insertion validée en retard n'est pas perdue", async () => {
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([]);
        const hub = new NotificationHub(fetchRecent, now);
        hub.subscribe("A", () => {});
        clock += HUB_POLL_MS;
        await hub.poll();
        const firstPollAt = clock;
        clock += HUB_POLL_MS;
        await hub.poll();
        expect(fetchRecent.mock.calls[1][1].getTime()).toBe(firstPollAt - HUB_OVERLAP_MS);
    });

    it("relevé en échec : rien de livré, curseur inchangé, un seul journal pour la série", async () => {
        const fetchRecent = vi.fn<FetchRecent>().mockRejectedValue(new Error("base injoignable"));
        const hub = new NotificationHub(fetchRecent, now);
        hub.subscribe("A", () => {});
        await hub.poll();
        clock += 10_000;
        await hub.poll();
        expect(fetchRecent.mock.calls[0][1]).toEqual(fetchRecent.mock.calls[1][1]);
        expect(logger.error).toHaveBeenCalledTimes(1);
        fetchRecent.mockResolvedValue([]);
        await hub.poll();
        expect(logger.warn).toHaveBeenCalledWith("Relève des notifications rétablie", expect.objectContaining({ consecutiveFailures: 2 }));
    });

    it("lot plein : le relevé suivant reprend à la dernière ligne reçue", async () => {
        const last = clock - 5_000;
        const rows = Array.from({ length: HUB_BATCH }, (_, i) => notif("A", last - (HUB_BATCH - 1 - i)));
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValueOnce(rows).mockResolvedValue([]);
        const hub = new NotificationHub(fetchRecent, now);
        hub.subscribe("A", () => {});
        await hub.poll();
        await hub.poll();
        expect(fetchRecent.mock.calls[1][1].getTime()).toBe(last - 1);
    });

    it("plus aucun abonné : le relevé s'arrête", async () => {
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([]);
        const hub = new NotificationHub(fetchRecent, now);
        const off = hub.subscribe("A", () => {});
        await vi.advanceTimersByTimeAsync(HUB_POLL_MS);
        off();
        await vi.advanceTimersByTimeAsync(HUB_POLL_MS * 5);
        expect(fetchRecent).toHaveBeenCalledTimes(1);
        expect(hub.connectedUsers()).toBe(0);
    });

    it("changement de page : l'ancienne connexion encore ouverte ne prive pas la nouvelle", async () => {
        const hub = new NotificationHub(vi.fn<FetchRecent>().mockResolvedValue([]), now);
        const oldPage = vi.fn();
        const newPage = vi.fn();
        hub.subscribe("A", oldPage);
        hub.subscribe("A", newPage);
        const n = notif("A");
        hub.publish(n);
        await hub.poll();
        expect(oldPage).toHaveBeenCalledExactlyOnceWith(n);
        expect(newPage).toHaveBeenCalledExactlyOnceWith(n);
    });

    it("une connexion ne reçoit pas les notifications antérieures à son ouverture (pas d'alerte rejouée)", async () => {
        const earlier = notif("A", clock - 5_000);
        const fetchRecent = vi.fn<FetchRecent>().mockResolvedValue([earlier]);
        const hub = new NotificationHub(fetchRecent, now);
        const openedBefore = vi.fn();
        clock -= 6_000;
        hub.subscribe("A", openedBefore);
        clock += 6_000;
        const openedAfter = vi.fn();
        hub.subscribe("A", openedAfter);
        await hub.poll();
        expect(openedBefore).toHaveBeenCalledExactlyOnceWith(earlier);
        expect(openedAfter).not.toHaveBeenCalled();
    });

    it("un abonné défaillant n'empêche pas les autres", async () => {
        const n = notif("A");
        const hub = new NotificationHub(vi.fn<FetchRecent>().mockResolvedValue([]), now);
        const ok = vi.fn();
        hub.subscribe("A", () => {
            throw new Error("onglet fermé");
        });
        hub.subscribe("A", ok);
        hub.publish(n);
        expect(ok).toHaveBeenCalledWith(n);
    });
});
