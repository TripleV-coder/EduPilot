import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationStream, STREAM_MAX_DURATION_MS } from "@/lib/notifications/notification-stream";
import { logger } from "@/lib/utils/logger";

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

/**
 * Mécanique du flux de notifications (audit MS-01, F2), horloge simulée :
 * plafond de 30 min, panne pendant la vérification, nettoyage des ressources,
 * aucun envoi après une révocation, messages poussés vérifiés un par un.
 */
type N = { id: string; createdAt: Date };

function harness(options: Partial<Parameters<typeof createNotificationStream<N>>[0]> = {}) {
    const onClose = vi.fn();
    const handle = createNotificationStream<N>({ userId: "u1", verify: async () => true, onClose, ...options });
    const reader = handle.stream.getReader();
    const chunks: string[] = [];
    let ended = false;
    const decoder = new TextDecoder();
    void (async () => {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
        }
        ended = true;
    })();
    return { handle, reader, onClose, text: () => chunks.join(""), ended: () => ended };
}
/** Avance l'horloge puis laisse s'exécuter vérifications et envois en attente. */
async function advance(ms: number, h: ReturnType<typeof harness>) {
    await vi.advanceTimersByTimeAsync(ms);
    await h.handle.settled();
    await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.warn).mockClear();
});
afterEach(() => vi.useRealTimers());

describe("createNotificationStream", () => {
    it("compte autorisé : notifications relevées et transmises, flux ouvert", async () => {
        const fetchSince = vi.fn().mockResolvedValueOnce([{ id: "n1", createdAt: new Date() }]).mockResolvedValue([]);
        const h = harness({ fetchSince });
        await advance(5_000, h);
        expect(h.text()).toContain("\"n1\"");
        expect(h.ended()).toBe(false);
        h.handle.close("client_closed");
    });

    it("révocation détectée : fermeture, événement de fin, plus aucune relève ni envoi", async () => {
        let allowed = true;
        const fetchSince = vi.fn().mockResolvedValue([{ id: "secret", createdAt: new Date() }]);
        const h = harness({ verify: async () => allowed, fetchSince });
        allowed = false;
        await advance(5_000, h);
        expect(h.onClose).toHaveBeenCalledWith("revoked");
        expect(fetchSince).not.toHaveBeenCalled();
        expect(h.text()).toContain("session-ended");
        expect(h.text()).not.toContain("secret");
        await advance(60_000, h);
        expect(fetchSince).not.toHaveBeenCalled();
        expect(h.ended()).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("base injoignable pendant la vérification : flux fermé, rien de transmis", async () => {
        const fetchSince = vi.fn().mockResolvedValue([{ id: "secret", createdAt: new Date() }]);
        const h = harness({ verify: async () => { throw new Error("ECONNREFUSED"); }, fetchSince });
        await advance(5_000, h);
        expect(h.onClose).toHaveBeenCalledWith("check_failed");
        expect(fetchSince).not.toHaveBeenCalled();
        expect(h.text()).not.toContain("secret");
        expect(h.ended()).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("relève en échec : signalée une fois par panne, sans donnée personnelle ; rien transmis ; autorisation toujours revérifiée", async () => {
        const verify = vi.fn().mockResolvedValue(true);
        const fetchSince = vi
            .fn()
            .mockRejectedValueOnce(new Error("relation unavailable"))
            .mockRejectedValueOnce(new Error("relation unavailable"))
            .mockRejectedValueOnce(new Error("relation unavailable"))
            .mockResolvedValueOnce([{ id: "n-apres-panne", createdAt: new Date() }])
            .mockResolvedValue([]);
        const h = harness({ verify, fetchSince });

        await advance(15_000, h); // 3 relèves en échec
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith("Relève des notifications en échec", expect.any(Error), { module: "notifications/stream" });
        expect(verify).toHaveBeenCalledTimes(3);
        expect(h.text()).not.toContain("notifications\n");
        expect(h.ended()).toBe(false);

        await advance(5_000, h); // rétablissement
        expect(logger.warn).toHaveBeenCalledWith("Relève des notifications rétablie", { module: "notifications/stream", consecutiveFailures: 3 });
        expect(h.text()).toContain("\"n-apres-panne\"");
        expect(JSON.stringify([vi.mocked(logger.error).mock.calls, vi.mocked(logger.warn).mock.calls])).not.toContain("u1");
        h.handle.close("client_closed");
    });

    it("vérification impossible : journalisée une fois, flux fermé", async () => {
        const h = harness({ verify: async () => { throw new Error("ECONNREFUSED"); } });
        await advance(15_000, h);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith("Flux de notifications fermé : vérification du compte impossible", expect.any(Error), { module: "notifications/stream" });
        expect(h.ended()).toBe(true);
    });

    it("durée maximale de 30 min : fermeture même si le compte reste autorisé", async () => {
        const verify = vi.fn().mockResolvedValue(true);
        const h = harness({ verify, fetchSince: async () => [] });
        await advance(STREAM_MAX_DURATION_MS - 1_000, h);
        expect(h.ended()).toBe(false);
        await advance(1_000, h);
        expect(h.onClose).toHaveBeenCalledWith("max_duration");
        expect(h.ended()).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
        // 30 min à une vérification toutes les 5 s
        expect(verify.mock.calls.length).toBeGreaterThanOrEqual(359);
    });

    it("déconnexion du client : désabonnement et minuteries libérés, une seule fois", async () => {
        const unsubscribe = vi.fn();
        const h = harness({ subscribe: () => unsubscribe });
        await h.reader.cancel();
        expect(h.onClose).toHaveBeenCalledWith("client_closed");
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
        h.handle.close("revoked");
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(h.onClose).toHaveBeenCalledTimes(1);
    });

    it("message poussé (Redis) : vérifié avant transmission, refusé après révocation", async () => {
        let push: (data: unknown) => void = () => {};
        let allowed = true;
        const h = harness({ verify: async () => allowed, subscribe: (onMessage) => { push = onMessage; return () => {}; } });
        push({ id: "avant", createdAt: new Date() });
        await advance(0, h);
        expect(h.text()).toContain("\"avant\"");
        allowed = false;
        push({ id: "apres", createdAt: new Date() });
        await advance(0, h);
        expect(h.text()).not.toContain("\"apres\"");
        expect(h.onClose).toHaveBeenCalledWith("revoked");
        expect(vi.getTimerCount()).toBe(0);
    });
});
