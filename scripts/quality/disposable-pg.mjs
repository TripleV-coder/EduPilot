#!/usr/bin/env node
/**
 * PostgreSQL jetable et persistant pour les mesures de non-régression
 * (base seedée de l'audit, démarrage à vide, tests de baseline).
 *
 *   node scripts/quality/disposable-pg.mjs [base…]
 *
 * Démarre un cluster embedded-postgres (répertoire QUALITY_PG_DIR, défaut
 * .quality-tmp/pg ; port QUALITY_PG_PORT, défaut 5433), crée les bases
 * demandées si besoin, affiche leurs URL et reste au premier plan : Ctrl+C
 * ou SIGTERM arrête proprement le cluster (les données sont conservées).
 * Le port 5432 (base locale du développeur) est refusé.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.QUALITY_PG_DIR || ".quality-tmp/pg");
const port = Number(process.env.QUALITY_PG_PORT || 5433);
const databases = process.argv.slice(2);

if (port === 5432) {
  console.error("Refus : le port 5432 est réservé à la base locale du développeur.");
  process.exit(1);
}

const cluster = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "edupilot",
  password: "edupilot",
  port,
  persistent: true,
  onLog: () => {},
});

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  await cluster.initialise();
}
await cluster.start();

for (const name of databases) {
  try {
    await cluster.createDatabase(name);
  } catch (error) {
    if (!String(error?.message ?? error).includes("already exists")) throw error;
  }
  console.log(`postgresql://edupilot:edupilot@127.0.0.1:${port}/${name}?schema=public`);
}
console.log(`PostgreSQL jetable prêt (port ${port}, données : ${dataDir}).`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await cluster.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
