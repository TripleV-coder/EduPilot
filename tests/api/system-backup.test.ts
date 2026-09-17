import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest, makeSession } from "./test-helpers";

const {
  accessMock,
  readdirMock,
  statMock,
  readFileMock,
  execAsyncMock,
  authMock,
} = vi.hoisted(() => ({
  accessMock: vi.fn(),
  readdirMock: vi.fn(),
  statMock: vi.fn(),
  readFileMock: vi.fn(),
  execAsyncMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("util", () => ({
  promisify: () => execAsyncMock,
}));
vi.mock("fs/promises", () => ({
  default: {
    access: accessMock,
    readdir: readdirMock,
    stat: statMock,
    readFile: readFileMock,
  },
}));

vi.mock("@/lib/config/env", () => ({
  appEnv: {
    allowBackupApi: true,
  },
}));

import { GET, POST } from "@/app/api/system/backup/route";

describe("GET/POST /api/system/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 404 si le script de sauvegarde est absent", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));
    accessMock.mockRejectedValue(new Error("missing"));

    const response = await POST(
      makeRequest("http://localhost:3000/api/system/backup", { method: "POST" }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Script de sauvegarde");
  });

  it("déclenche la sauvegarde et parse la taille et le checksum", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));
    accessMock.mockResolvedValue(undefined);
    execAsyncMock.mockResolvedValue({
      stdout: "Taille de la sauvegarde: 14 MB\nChecksum SHA256: abc123\n",
    });

    const response = await POST(
      makeRequest("http://localhost:3000/api/system/backup", { method: "POST" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      size: "14 MB",
      checksum: "abc123",
    });
  });

  it("liste les sauvegardes triées avec checksum facultatif", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));
    readdirMock.mockResolvedValue(["old.sql.gz", "new.sql.gz", "ignored.txt"]);
    statMock
      .mockResolvedValueOnce({
        size: 5 * 1024 * 1024,
        birthtime: new Date("2026-01-01T10:00:00Z"),
        mtime: new Date("2026-01-01T10:00:00Z"),
      })
      .mockResolvedValueOnce({
        size: 2 * 1024 * 1024,
        birthtime: new Date("2026-02-01T10:00:00Z"),
        mtime: new Date("2026-02-01T10:00:00Z"),
      });
    readFileMock
      .mockRejectedValueOnce(new Error("no checksum"))
      .mockResolvedValueOnce("sha256-new");

    const response = await GET(makeRequest("http://localhost:3000/api/system/backup"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.totalSize).toBe(7 * 1024 * 1024);
    expect(body.backups[0]).toMatchObject({
      filename: "new.sql.gz",
      checksum: "sha256-new",
    });
    expect(body.backups[1]).toMatchObject({
      filename: "old.sql.gz",
      checksum: null,
    });
  });

  // L5 (audit) — la réponse ne doit rien dire de l'arborescence du serveur ni
  // de la sortie des commandes : c'est du renseignement offert à un compte
  // compromis, et la sortie d'un script de sauvegarde cite des chemins, des
  // noms de base et parfois des identifiants de connexion.
  it("n'expose ni chemin du serveur ni sortie de commande", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));

    accessMock.mockRejectedValue(new Error("missing"));
    const missing = await (await POST(makeRequest("http://localhost:3000/api/system/backup", { method: "POST" }))).json();
    expect(JSON.stringify(missing)).not.toMatch(/\/(var|home|app|usr)\//);
    expect(missing).not.toHaveProperty("path");

    accessMock.mockResolvedValue(undefined);
    execAsyncMock.mockResolvedValue({
      stdout: "pg_dump: connexion postgresql://edupilot:motdepasse@db/edupilot\nTaille de la sauvegarde: 14 MB\nChecksum SHA256: abc123\n",
    });
    const created = await (await POST(makeRequest("http://localhost:3000/api/system/backup", { method: "POST" }))).json();
    expect(created).toMatchObject({ success: true, size: "14 MB", checksum: "abc123" });
    expect(created).not.toHaveProperty("logs");
    expect(JSON.stringify(created)).not.toContain("motdepasse");

    execAsyncMock.mockRejectedValue(new Error("pg_dump: /var/backups/edupilot/postgres : permission refusée"));
    const failed = await POST(makeRequest("http://localhost:3000/api/system/backup", { method: "POST" }));
    const failedBody = await failed.json();
    expect(failed.status).toBe(500);
    expect(failedBody).not.toHaveProperty("details");
    expect(JSON.stringify(failedBody)).not.toMatch(/\/(var|home|app|usr)\//);
  });

  it("la liste des sauvegardes ne donne pas le chemin des fichiers", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));
    readdirMock.mockResolvedValue(["new.sql.gz"]);
    statMock.mockResolvedValue({
      size: 2 * 1024 * 1024,
      birthtime: new Date("2026-02-01T10:00:00Z"),
      mtime: new Date("2026-02-01T10:00:00Z"),
    });
    readFileMock.mockResolvedValue("sha256-new");

    const body = await (await GET(makeRequest("http://localhost:3000/api/system/backup"))).json();
    expect(body.backups[0]).toMatchObject({ filename: "new.sql.gz", checksum: "sha256-new" });
    expect(body.backups[0]).not.toHaveProperty("path");
    expect(JSON.stringify(body)).not.toMatch(/\/(var|home|app|usr)\//);
  });

  it("retourne un état vide si le répertoire n'existe pas", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN"));
    readdirMock.mockRejectedValue(new Error("ENOENT"));

    const response = await GET(makeRequest("http://localhost:3000/api/system/backup"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      backups: [],
      count: 0,
    });
  });
});
