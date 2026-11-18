import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Analyse de capacité du 2026-10-01 : un processus n'utilise qu'un cœur ;
 * WEB_CONCURRENCY règle le nombre de processus. Depuis le 2026-11-07, limites
 * et compteurs d'échecs de connexion sont communs via PostgreSQL : plus aucune
 * condition (Redis) pour en lancer plusieurs.
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
    it("par défaut : un seul processus, en mode cluster", () => {
        const app = loadApp({ WEB_CONCURRENCY: undefined });
        expect(app.instances).toBe(1);
        expect(app.exec_mode).toBe("cluster");
    });

    it("WEB_CONCURRENCY processus (nombre ou « max »), sans autre condition", () => {
        expect(loadApp({ WEB_CONCURRENCY: "4" }).instances).toBe(4);
        expect(loadApp({ WEB_CONCURRENCY: "max" }).instances).toBe("max");
        expect(loadApp({ WEB_CONCURRENCY: "n'importe quoi" }).instances).toBe(1);
    });

    it("démarre le serveur standalone avec le préchargement de l'IP client", () => {
        const app = loadApp({});
        expect(app.script).toBe(".next/standalone/server.js");
        expect(String(app.node_args)).toContain("client-ip-preload.cjs");
    });
});
