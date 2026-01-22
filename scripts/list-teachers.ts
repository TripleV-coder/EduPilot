
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const teachers = await prisma.user.findMany({
        where: { role: 'TEACHER' },
        select: {
            email: true,
            firstName: true,
            lastName: true,
        },
        take: 5
    });
    console.log('Teachers found:', teachers);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
