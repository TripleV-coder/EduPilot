import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Afficher TOUS les utilisateurs actifs avec leurs vraies coordonnées
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { 
      id: true,
      email: true, 
      firstName: true, 
      lastName: true, 
      role: true,
      schoolId: true
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    take: 20
  });
  
  console.log('='.repeat(70));
  console.log('  📋 LISTE COMPLÈTE DES COMPTES ACTIFS');
  console.log('='.repeat(70));
  
  for (const u of users) {
    console.log(`\n🆔 ${u.id.substring(0, 8)}...`);
    console.log(`   Rôle: ${u.role}`);
    console.log(`   Nom: ${u.firstName} ${u.lastName}`);
    console.log(`   Email: "${u.email}"`);
    console.log(`   SchoolID: ${u.schoolId || 'null'}`);
  }
  
  console.log(`\n📊 Total: ${users.length} comptes affichés`);
  console.log('='.repeat(70));
  
  // Chercher des admins spécifiquement
  console.log('\n🔍 RECHERCHE ADMIN:');
  const admins = await prisma.user.findMany({
    where: { 
      isActive: true,
      OR: [
        { role: 'SUPER_ADMIN' },
        { role: 'SCHOOL_ADMIN' }
      ]
    },
    select: { email: true, firstName: true, lastName: true, role: true },
    orderBy: { email: 'asc' }
  });
  
  admins.forEach((u, i) => {
    console.log(`${i+1}. [${u.role}] ${u.firstName} ${u.lastName}`);
    console.log(`   Email: "${u.email}"`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
