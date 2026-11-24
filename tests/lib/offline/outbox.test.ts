import { describe, expect, it, vi } from "vitest";
import { classifyResponse, enqueue, flushOutbox, memoryStore, pendingFor, type OutboxOp, type SendOutcome } from "@/lib/offline/outbox";

/** OFF-01 (2026-11-24) — file d'attente hors ligne : ordre, reprise, refus, cloisonnement. */
const op = (id: string, userId = "u1") => ({ id, userId, schoolId: "s1", kind: "attendance" as const, label: `Appel ${id}`, payload: { id } });

describe("flushOutbox", () => {
    it("envoie dans l'ordre de saisie et retire chaque opération acceptée", async () => {
        const store = memoryStore();
        await enqueue(store, op("a"));
        await new Promise((r) => setTimeout(r, 2));
        await enqueue(store, op("b"));
        const seen: string[] = [];
        const result = await flushOutbox(store, "u1", async (o) => (seen.push(o.id), "done"));
        expect(seen).toEqual(["a", "b"]);
        expect(result).toEqual({ sent: 2, rejected: 0, remaining: 0 });
    });

    it("réseau encore absent : s'arrête au premier échec réseau, rien n'est perdu, essai compté", async () => {
        const store = memoryStore();
        await enqueue(store, op("a"));
        await enqueue(store, op("b"));
        const send = vi.fn(async (): Promise<SendOutcome> => {
            throw new TypeError("Failed to fetch");
        });
        const result = await flushOutbox(store, "u1", send);
        expect(send).toHaveBeenCalledTimes(1);
        expect(result.remaining).toBe(2);
        expect((await pendingFor(store, "u1")).map((o) => [o.status, o.attempts])).toContainEqual(["queued", 1]);
    });

    it("refus définitif : gardé « refusé » avec le message, jamais renvoyé en boucle, la suite continue", async () => {
        const store = memoryStore();
        await enqueue(store, op("a"));
        await new Promise((r) => setTimeout(r, 2));
        await enqueue(store, op("b"));
        const send = vi.fn(async (o: OutboxOp): Promise<SendOutcome> => (o.id === "a" ? { rejected: "Année clôturée" } : "done"));
        expect(await flushOutbox(store, "u1", send)).toEqual({ sent: 1, rejected: 1, remaining: 1 });
        const [left] = await pendingFor(store, "u1");
        expect(left).toMatchObject({ id: "a", status: "rejected", lastError: "Année clôturée" });
        await flushOutbox(store, "u1", send);
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("cloisonnement : seules les saisies de l'utilisateur connecté sont envoyées", async () => {
        const store = memoryStore();
        await enqueue(store, op("mine", "u1"));
        await enqueue(store, op("other", "u2"));
        const seen: string[] = [];
        await flushOutbox(store, "u1", async (o) => (seen.push(o.id), "done"));
        expect(seen).toEqual(["mine"]);
        expect((await store.all()).map((o) => o.id)).toEqual(["other"]);
    });
});

describe("classifyResponse", () => {
    const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
    it("2xx : envoyé ; 5xx, 401, 408, 429 : à réessayer ; autre 4xx : refusé avec le message du serveur", async () => {
        expect(await classifyResponse(res(200))).toBe("done");
        for (const status of [500, 503, 401, 408, 429]) expect(await classifyResponse(res(status)), String(status)).toBe("retry");
        expect(await classifyResponse(res(403, { error: "Accès refusé" }))).toEqual({ rejected: "Accès refusé" });
        expect(await classifyResponse(res(400))).toEqual({ rejected: "Refusé (400)" });
    });
});
