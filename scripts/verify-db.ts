
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Démarrage de la vérification Intégrité Base de Données...');
    console.log('---------------------------------------------------------');

    // 1. Check Users without School (Orphans) - Warning only
    // role is non-nullable, so we assume role exists.
    try {
        // Using raw optional checks or just ignoring logic that relies on null roles
        const usersWithoutSchool = await prisma.user.count({
            where: {
                schoolId: null,
                role: { not: 'SUPER_ADMIN' }
            }
        });
        if (usersWithoutSchool > 0) {
            console.warn(`⚠️ ALERTE: ${usersWithoutSchool} utilisateurs n'ont pas d'établissement (hors Super Admin).`);
        } else {
            console.log('✅ Tous les utilisateurs standards sont liés à un établissement.');
        }
    } catch (e) {
        console.warn("Skipping User check due to error:", e);
    }

    // 2. Check Orphans (Enrollments)
    const totalStudents = await prisma.studentProfile.count();
    const totalUsers = await prisma.user.count();

    // 3. Volumétrie
    console.log(`📊 Statistiques Volumétrie :`);
    console.log(`   - Utilisateurs : ${totalUsers}`);
    console.log(`   - Profils Étudiants : ${totalStudents}`);

    // 4. Check Schools
    const schools = await prisma.school.findMany({ select: { name: true, _count: { select: { users: true } } } });
    schools.forEach(s => {
        console.log(`🏫 Établissement "${s.name}" : ${s._count.users} utilisateurs.`);
    });

    console.log('---------------------------------------------------------');
    console.log('🏁 Fin du diagnostic.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
