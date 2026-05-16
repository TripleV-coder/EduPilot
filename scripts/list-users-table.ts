import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { 
      email: true, 
      firstName: true, 
      lastName: true, 
      role: true 
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    take: 15
  });
  
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     COMPTES DE TEST - MOT DE PASSE: Test123456!                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
  
  let currentRole = '';
  
  for (const u of users) {
    if (u.role !== currentRole) {
      currentRole = u.role;
      console.log(`\n📌 ${currentRole}`);
      console.log('─'.repeat(80));
    }
    console.log(`  ${u.firstName.padEnd(15)} ${u.lastName.padEnd(20)} | ${u.email}`);
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('💡 Pour se connecter: http://localhost:3000/login');
  console.log('═'.repeat(80) + '\n');
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
