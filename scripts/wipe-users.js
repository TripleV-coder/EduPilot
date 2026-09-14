/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Règle 6 / N17 : supprime des comptes — base marquée jetable obligatoire.
  const { assertDisposableDatabase } = await import("./lib/disposable-guard.mjs");
  await assertDisposableDatabase(prisma, "scripts/wipe-users.js");
    console.log('Deleting all users...');
    const { count } = await prisma.user.deleteMany({});
    console.log(`Deleted ${count} users.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
