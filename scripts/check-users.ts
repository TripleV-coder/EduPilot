/**
 * Script rapide pour vérifier les utilisateurs dans la base
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true,
        },
    });

    console.log(`\n📊 Total utilisateurs: ${users.length}\n`);

    if (users.length > 0) {
        console.log("Liste des utilisateurs:");
        users.forEach((user, i) => {
            console.log(`${i + 1}. ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`);
        });
    } else {
        console.log("❌ Aucun utilisateur trouvé");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
