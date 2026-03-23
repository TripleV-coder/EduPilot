/**
 * Script pour initialiser les données de base du système
 * Ce script est obsolète - utiliser prisma/seed.ts à la place
 * Conservé pour référence uniquement
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
