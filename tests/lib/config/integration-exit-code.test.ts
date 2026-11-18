import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Correction S0 : `embedded-postgres` enregistre dès son import un
 * gestionnaire `beforeExit` qui appelait `process.exit(0)` et écrasait le code
 * d'échec posé par vitest (`process.exitCode = 1`, sans sortie forcée). Une
 * suite d'intégration en échec sortait avec 0, en local comme en CI.
 */
const root = path.resolve(__dirname, "../../..");
const loader = path.join(root, "tests/integration-db/embedded-cluster.ts");
const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "edupilot-exit-code-"));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Processus distinct qui charge PostgreSQL embarqué comme le setup global, puis se termine seul. */
function exitCodeAfterLoading(exitCode: number | null) {
    const probe = path.join(dir, `probe-${exitCode ?? "none"}.mts`);
    writeFileSync(
        probe,
        `import { loadEmbeddedPostgres } from ${JSON.stringify(loader)};\n` +
            `await loadEmbeddedPostgres();\n` +
            (exitCode === null ? "" : `process.exitCode = ${exitCode};\n`),
    );
    const result = spawnSync(process.execPath, [tsx, probe], { cwd: root, encoding: "utf8", timeout: 60_000 });
    return { status: result.status, stderr: result.stderr };
}

describe("code de sortie de la suite d'intégration", () => {
    it("un échec signalé par vitest (process.exitCode = 1) reste un échec après chargement de PostgreSQL embarqué", () => {
        const { status, stderr } = exitCodeAfterLoading(1);
        expect(stderr).toBe("");
        expect(status).toBe(1);
    });

    it("une suite réussie sort toujours avec 0", () => {
        const { status, stderr } = exitCodeAfterLoading(null);
        expect(stderr).toBe("");
        expect(status).toBe(0);
    });

    it("le setup global n'importe jamais embedded-postgres de façon statique (CI avec TEST_DATABASE_URL)", () => {
        const setup = readFileSync(path.join(root, "tests/integration-db/global-setup.ts"), "utf8");
        expect(setup).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+["']embedded-postgres["']/m);
        expect(setup).not.toMatch(/^import\s+["']embedded-postgres["']/m);
    });
});
