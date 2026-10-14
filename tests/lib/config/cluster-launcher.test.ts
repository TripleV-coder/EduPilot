import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * scripts/server/cluster.cjs (capacité 2026-10-01) : plusieurs processus
 * uniquement avec un magasin partagé, sinon limites et compteurs d'échecs de
 * connexion seraient multipliés par le nombre de processus.
 */
const launcher = path.resolve(__dirname, "../../../scripts/server/cluster.cjs");

function run(env: Record<string, string>) {
    return spawnSync(process.execPath, [launcher, "/nonexistent/server.js"], {
        env: { PATH: process.env.PATH ?? "", ...env },
        encoding: "utf8",
        timeout: 10_000,
    });
}

describe("lanceur multi-processus", () => {
    it("refuse WEB_CONCURRENCY > 1 sans REDIS_URL", () => {
        const result = run({ WEB_CONCURRENCY: "4" });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("REDIS_URL");
    });

    it("WEB_CONCURRENCY=1 : charge directement le serveur dans le processus (pas de refus)", () => {
        const result = run({ WEB_CONCURRENCY: "1" });
        // Le serveur factice est introuvable : l'erreur vient du chargement, pas du garde-fou.
        expect(result.stderr).not.toContain("REFUS");
        expect(result.stderr).toContain("/nonexistent/server.js");
    });
});
