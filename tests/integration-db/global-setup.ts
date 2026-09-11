import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { assertDisposableDatabaseUrl } from "./disposable";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Port libre introuvable"));
      });
    });
  });
}

/**
 * Prépare une base PostgreSQL jetable, y applique les migrations versionnées
 * (`prisma migrate deploy`, exactement comme en production) et la fournit aux
 * tests via `inject("databaseUrl")`.
 */
export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let cluster: EmbeddedPostgres | undefined;
  let dataDir: string | undefined;

  if (databaseUrl) {
    assertDisposableDatabaseUrl(databaseUrl);
  } else {
    dataDir = mkdtempSync(path.join(tmpdir(), "edupilot-it-"));
    const port = await findFreePort();
    cluster = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "edupilot",
      password: "edupilot",
      port,
      persistent: false,
      onLog: () => {},
      onError: () => {},
    });
    await cluster.initialise();
    await cluster.start();
    await cluster.createDatabase("edupilot_it");
    databaseUrl = `postgresql://edupilot:edupilot@127.0.0.1:${port}/edupilot_it?schema=public`;
    assertDisposableDatabaseUrl(databaseUrl);
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  project.provide("databaseUrl", databaseUrl);

  return async () => {
    if (cluster) await cluster.stop();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  };
}
