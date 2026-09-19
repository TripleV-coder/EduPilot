import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Décision du propriétaire (2026-09-12) : pas d'Upstash ; le rate-limit, le
 * compteur d'échecs de connexion et le cache restent en mémoire. Ce n'est
 * correct qu'avec UN SEUL processus : en cluster, chaque processus aurait ses
 * propres compteurs et les limites seraient multipliées par le nombre de cœurs.
 * Le serveur doit aussi charger le préchargement de l'IP client (H3).
 */
const require = createRequire(import.meta.url);
const ecosystem = require(path.resolve(__dirname, "../../../ecosystem.config.js")) as {
    apps: Array<Record<string, unknown>>;
};
const app = ecosystem.apps.find((a) => a.name === "edupilot")!;

describe("ecosystem.config.js (PM2)", () => {
    it("lance un seul processus en mode fork", () => {
        expect(app.exec_mode).toBe("fork");
        expect(app.instances).toBe(1);
    });

    it("démarre le serveur standalone avec le préchargement de l'IP client", () => {
        expect(app.script).toBe(".next/standalone/server.js");
        expect(String(app.node_args)).toContain("client-ip-preload.cjs");
    });
});
