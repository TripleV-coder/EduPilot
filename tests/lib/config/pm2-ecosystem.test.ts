import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Décision du 2026-09-12 : sans magasin partagé, le rate-limit, le compteur
 * d'échecs de connexion et le cache sont en mémoire — exacts avec UN SEUL
 * processus. Analyse de capacité du 2026-10-01 : un processus n'utilise qu'un
 * cœur ; plusieurs processus (WEB_CONCURRENCY) sont permis, mais SEULEMENT
 * avec REDIS_URL, sinon les limites seraient multipliées par processus.
 * Le serveur doit aussi charger le préchargement de l'IP client (H3).
 */
const require = createRequire(import.meta.url);
const configPath = path.resolve(__dirname, "../../../ecosystem.config.js");

function loadApp(env: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string);
    delete require.cache[configPath];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ecosystem = require(configPath) as { apps: Array<Record<string, unknown>> };
    return ecosystem.apps.find((a) => a.name === "edupilot")!;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("ecosystem.config.js (PM2)", () => {
    it("sans REDIS_URL : un seul processus, même si WEB_CONCURRENCY en demande plus", () => {
        const app = loadApp({ REDIS_URL: "", UPSTASH_REDIS_REST_URL: "", WEB_CONCURRENCY: "8" });
        expect(app.instances).toBe(1);
        expect(app.exec_mode).toBe("cluster");
    });

    it("avec REDIS_URL : WEB_CONCURRENCY processus (nombre ou « max »)", () => {
        expect(loadApp({ REDIS_URL: "redis://r:6379", WEB_CONCURRENCY: "4" }).instances).toBe(4);
        expect(loadApp({ REDIS_URL: "redis://r:6379", WEB_CONCURRENCY: "max" }).instances).toBe("max");
    });

    it("démarre le serveur standalone avec le préchargement de l'IP client", () => {
        const app = loadApp({});
        expect(app.script).toBe(".next/standalone/server.js");
        expect(String(app.node_args)).toContain("client-ip-preload.cjs");
    });
});
