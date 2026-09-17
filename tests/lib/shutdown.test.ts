import { afterEach, describe, expect, it } from "vitest";
import { inflightRequests, isShuttingDown, registerShutdownTask } from "@/lib/system/shutdown";

/**
 * Arrêt propre (Lot 7) — côté application. Le préchargement du serveur
 * (scripts/server/graceful-shutdown.cjs) pose l'état global ; ce module le lit.
 * Sans préchargement (développement, tests unitaires), tout est inoffensif.
 */
type State = { shuttingDown: boolean; inflight: number; tasks: Array<() => Promise<void>> };
const g = globalThis as { __edupilotShutdown?: State };

afterEach(() => {
    delete g.__edupilotShutdown;
});

describe("arrêt propre — état partagé avec le préchargement", () => {
    it("sans préchargement, rien ne casse et rien ne s'arrête", () => {
        expect(isShuttingDown()).toBe(false);
        expect(inflightRequests()).toBe(0);
        expect(() => registerShutdownTask(async () => {})).not.toThrow();
    });

    it("les fermetures déclarées par l'application sont transmises au préchargement", () => {
        g.__edupilotShutdown = { shuttingDown: false, inflight: 0, tasks: [] };
        const task = async () => {};
        registerShutdownTask(task);
        expect(g.__edupilotShutdown.tasks).toEqual([task]);
    });

    it("l'arrêt en cours et les requêtes en vol sont lisibles par /api/health", () => {
        g.__edupilotShutdown = { shuttingDown: true, inflight: 3, tasks: [] };
        expect(isShuttingDown()).toBe(true);
        expect(inflightRequests()).toBe(3);
    });
});
