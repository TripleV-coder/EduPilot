import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Prérequis d'une sauvegarde déclenchée par l'API (2026-10-18) : la route ne
 * lance le script que si tout est réuni. Fichiers temporaires réels ; seuls
 * la présence des outils et le rôle PostgreSQL sont simulés.
 */
const { commandsMock, rlsMock } = vi.hoisted(() => ({ commandsMock: vi.fn(), rlsMock: vi.fn() }));
vi.mock("node:child_process", () => ({
    execFile: (_cmd: string, args: string[], cb: (error: Error | null) => void) =>
        cb(commandsMock(args[1].replace("command -v ", "")) ? null : new Error("absent")),
}));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/db/rls-guard", () => ({ inspectRlsRole: rlsMock }));

import { BACKUP_TOOLS, checkBackupPrerequisites } from "@/lib/system/backup-prerequisites";

let dir: string;
let script: string;
let passphrase: string;
const env = { ...process.env };

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "backup-prereq-"));
    script = path.join(dir, "postgres-backup.sh");
    passphrase = path.join(dir, "backup.key");
    await writeFile(script, "#!/usr/bin/env bash\nexit 0\n");
    await chmod(script, 0o755);
    await writeFile(passphrase, "phrase-synthetique\n");
    await chmod(passphrase, 0o600);
    process.env.BACKUP_PASSPHRASE_FILE = passphrase;
    process.env.BACKUP_DIR = path.join(dir, "archives");
    commandsMock.mockReturnValue(true);
    rlsMock.mockResolvedValue({ status: "bypassed", role: "proprietaire", reason: "superutilisateur" });
});
afterEach(async () => {
    process.env = { ...env };
    await rm(dir, { recursive: true, force: true });
});

describe("checkBackupPrerequisites", () => {
    it("hôte de sauvegarde complet (script, outils, phrase secrète, répertoire, connexion propriétaire) : rien ne manque", async () => {
        expect(await checkBackupPrerequisites(script)).toEqual([]);
    });

    it("conteneur web : script absent, outils absents, pas de phrase secrète, rôle soumis à la RLS", async () => {
        commandsMock.mockImplementation((tool: string) => tool === "node" || tool === "gzip");
        delete process.env.BACKUP_PASSPHRASE_FILE;
        rlsMock.mockResolvedValue({ status: "enforced", role: "edupilot_app" });
        const missing = await checkBackupPrerequisites(path.join(dir, "absent.sh"));
        expect(missing).toEqual(expect.arrayContaining([
            "script de sauvegarde exécutable",
            "outil bash", "outil pg_dump", "outil psql",
            "BACKUP_PASSPHRASE_FILE non définie",
            "rôle PostgreSQL soumis à la RLS (connexion propriétaire requise)",
        ]));
        expect(missing).not.toContain("outil node");
    });

    it("script présent mais non exécutable : refusé", async () => {
        await chmod(script, 0o644);
        expect(await checkBackupPrerequisites(script)).toContain("script de sauvegarde exécutable");
    });

    it("phrase secrète illisible ou répertoire non accessible en écriture : refusés", async () => {
        process.env.BACKUP_PASSPHRASE_FILE = path.join(dir, "absente.key");
        process.env.BACKUP_DIR = "/proc/edupilot-interdit/archives";
        const missing = await checkBackupPrerequisites(script);
        expect(missing).toContain("phrase secrète illisible");
        expect(missing).toContain("répertoire de sauvegarde non accessible en écriture");
    });

    it("rôle indéterminé (base injoignable) : refusé par prudence", async () => {
        rlsMock.mockResolvedValue({ status: "unknown", reason: "connexion refusée" });
        expect(await checkBackupPrerequisites(script)).toEqual(["rôle PostgreSQL soumis à la RLS (connexion propriétaire requise)"]);
    });

    it("la liste ne contient ni chemin ni secret", async () => {
        commandsMock.mockReturnValue(false);
        delete process.env.BACKUP_PASSPHRASE_FILE;
        const missing = await checkBackupPrerequisites(path.join(dir, "absent.sh"));
        expect(JSON.stringify(missing)).not.toContain(dir);
        expect(missing.filter((m) => m.startsWith("outil "))).toHaveLength(BACKUP_TOOLS.length);
    });
});
