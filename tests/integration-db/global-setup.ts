import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabaseUrl } from "./disposable";
import { setupAppRole } from "../../scripts/db/app-role.mjs";

declare module "vitest" {
  export interface ProvidedContext {
    /** Rôle applicatif, soumis à la RLS (code testé). */
    databaseUrl: string;
    /** Rôle propriétaire (jeux de données, vérifications en base). */
    ownerDatabaseUrl: string;
  }
}

const APP_ROLE = "edupilot_app_it";
const APP_PASSWORD = "integration-app-role-password";

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

  // RLS effective (audit M2) : le code applicatif se connecte avec le rôle
  // applicatif (soumis aux politiques), comme en production ; les jeux de
  // données et les vérifications passent par le propriétaire (tests/integration-db/owner-db.ts).
  const ownerUrl = new URL(databaseUrl);
  const appUrl = new URL(databaseUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  const owner = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await setupAppRole(owner, {
      appRole: APP_ROLE,
      appPassword: APP_PASSWORD,
      ownerRole: decodeURIComponent(ownerUrl.username),
    });
  } finally {
    await owner.$disconnect();
  }

  project.provide("databaseUrl", appUrl.toString());
  project.provide("ownerDatabaseUrl", databaseUrl);

  return async () => {
    if (cluster) await cluster.stop();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  };
}
