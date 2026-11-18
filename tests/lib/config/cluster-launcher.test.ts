import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * scripts/server/cluster.cjs (capacité 2026-10-01) : plusieurs processus
 * partagent le port. Depuis le 2026-11-07, limites et compteurs d'échecs de
 * connexion sont communs à tous via PostgreSQL : aucun magasin à exiger.
 */
const launcher = path.resolve(__dirname, "../../../scripts/server/cluster.cjs");

function run(env: Record<string, string>, timeout = 10_000) {
    return spawnSync(process.execPath, [launcher, "/nonexistent/server.js"], {
        env: { PATH: process.env.PATH ?? "", ...env },
        encoding: "utf8",
        timeout,
    });
}

describe("lanceur multi-processus", () => {
    it("WEB_CONCURRENCY > 1 sans aucun service supplémentaire : démarre les processus, sans refus", () => {
        // Les processus échouent (serveur factice) et sont relancés : on arrête au bout de 3 s.
        const result = run({ WEB_CONCURRENCY: "2" }, 3_000);
        expect(`${result.stdout}${result.stderr}`).not.toContain("REFUS");
        expect(result.stdout).toContain("[cluster]");
    });

    it("WEB_CONCURRENCY=1 : charge directement le serveur dans le processus (pas de refus)", () => {
        const result = run({ WEB_CONCURRENCY: "1" });
        // Le serveur factice est introuvable : l'erreur vient du chargement, pas du garde-fou.
        expect(result.stderr).not.toContain("REFUS");
        expect(result.stderr).toContain("/nonexistent/server.js");
    });
});
