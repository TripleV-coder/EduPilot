/**
 * Script pour initialiser les données de base du système
 * Ce script est obsolète - utiliser prisma/seed.ts à la place
 * Conservé pour référence uniquement
 */

import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabase } from "./lib/disposable-guard.mjs";

const prisma = new PrismaClient();

async function main() {
  // Règle 6 / N17 : données de démonstration — base marquée jetable obligatoire.
  await assertDisposableDatabase(prisma, "scripts/seed-basic-data.ts");
  console.log("⚠️  Ce script est obsolète.");
  console.log("📝 Utilisez plutôt : npm run db:seed");
  console.log("   ou : npx tsx prisma/seed.ts\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
