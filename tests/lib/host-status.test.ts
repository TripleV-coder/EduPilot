import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { backupStatus, diskStatus, memoryStatus } from "@/lib/system/host-status";

/**
 * Lot 7 — l'exploitant doit pouvoir répondre à trois questions sans ouvrir un
 * terminal : la machine a-t-elle encore de la place et de la mémoire, et la
 * dernière sauvegarde a-t-elle réussi ?
 */
let root: string;

async function writeManifest(name: string, createdAt: Date, sizeBytes: number) {
  const file = path.join(root, `${name}.meta.json`);
  await writeFile(
    file,
    JSON.stringify({
      database: "edupilot",
      createdAt: createdAt.toISOString(),
      checksumSha256: "a".repeat(64),
      sizeBytes,
      rowCounts: { users: 12, schools: 1 },
    }),
  );
  // Archive correspondante : un manifeste sans archive ne prouve rien.
  await writeFile(path.join(root, `${name}.sql.gz.enc`), "x");
  await utimes(file, createdAt, createdAt);
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "edupilot-backup-status-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("mémoire", () => {
  it("rapporte l'empreinte du processus et celle de la machine", () => {
    const memory = memoryStatus();

    expect(memory.rssMb).toBeGreaterThan(0);
    expect(memory.totalMb).toBeGreaterThan(0);
    expect(memory.freeMb).toBeGreaterThanOrEqual(0);
    expect(memory.usedPercent).toBeGreaterThanOrEqual(0);
    expect(memory.usedPercent).toBeLessThanOrEqual(100);
  });
});

describe("espace disque", () => {
  it("rapporte la place restante", async () => {
    const disk = await diskStatus(root);

    expect(disk).not.toBeNull();
    expect(disk!.totalGb).toBeGreaterThan(0);
    expect(disk!.freeGb).toBeGreaterThanOrEqual(0);
    expect(disk!.usedPercent).toBeGreaterThanOrEqual(0);
    expect(disk!.usedPercent).toBeLessThanOrEqual(100);
  });

  it("ne divulgue aucun chemin du serveur (audit L5)", async () => {
    const disk = await diskStatus(root);
    expect(JSON.stringify(disk)).not.toContain(root);
  });

  it("répond null plutôt que d'échouer sur un répertoire absent", async () => {
    expect(await diskStatus(path.join(root, "absent"))).toBeNull();
  });
});

describe("dernière sauvegarde", () => {
  it("signale l'absence de répertoire de sauvegarde", async () => {
    const status = await backupStatus(path.join(root, "jamais-cree"));
    expect(status.status).toBe("unavailable");
    expect(status.lastSuccessAt).toBeNull();
  });

  it("signale un répertoire sans aucune sauvegarde", async () => {
    const vide = path.join(root, "vide");
    await mkdir(vide, { recursive: true });
    const status = await backupStatus(vide);
    expect(status.status).toBe("none");
    expect(status.archives).toBe(0);
  });

  it("rapporte la plus récente, son âge et sa taille", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    await writeManifest("edupilot_20260916", new Date("2026-09-16T02:00:00.000Z"), 1024);
    await writeManifest("edupilot_20260917", new Date("2026-09-17T02:00:00.000Z"), 4096);

    const status = await backupStatus(root, now);

    expect(status.status).toBe("ok");
    expect(status.lastSuccessAt).toBe("2026-09-17T02:00:00.000Z");
    expect(status.ageHours).toBe(10);
    expect(status.sizeBytes).toBe(4096);
    expect(status.archives).toBe(2);
    expect(status.rowCount).toBe(13);
  });

  it("alerte quand la dernière sauvegarde remonte à plus de 48 h", async () => {
    const status = await backupStatus(root, new Date("2026-09-20T12:00:00.000Z"));
    expect(status.status).toBe("stale");
    expect(status.ageHours).toBeGreaterThan(48);
  });

  it("ignore un manifeste illisible sans faire échouer la page", async () => {
    await writeFile(path.join(root, "edupilot_casse.meta.json"), "{ ceci n'est pas du JSON");
    const status = await backupStatus(root, new Date("2026-09-17T12:00:00.000Z"));
    expect(status.status).toBe("ok");
    expect(status.lastSuccessAt).toBe("2026-09-17T02:00:00.000Z");
  });

  it("ne divulgue aucun chemin du serveur (audit L5)", async () => {
    const status = await backupStatus(root, new Date("2026-09-17T12:00:00.000Z"));
    expect(JSON.stringify(status)).not.toContain(root);
  });
});
