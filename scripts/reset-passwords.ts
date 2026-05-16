import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const testPassword = 'Test123456!';
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  
  console.log('🔐 Hash généré:', hashedPassword.substring(0, 50) + '...');
  
  // Vérifier que le hash fonctionne
  const isMatch = await bcrypt.compare(testPassword, hashedPassword);
  console.log('✅ Vérification bcrypt:', isMatch);
  
  // Mettre à jour tous les utilisateurs actifs
  const result = await prisma.user.updateMany({
    where: { isActive: true },
    data: { 
      password: hashedPassword,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date()
    }
  });
  
  console.log('✅ Mots de passe mis à jour:', result.count, 'comptes');
  
  // Afficher un utilisateur de test
  const user = await prisma.user.findFirst({
    where: { isActive: true, role: 'SCHOOL_ADMIN' },
    select: { email: true, firstName: true, lastName: true, role: true }
  });
  
  if (user) {
    console.log('\n📋 Compte test:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Nom: ${user.firstName} ${user.lastName}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Mot de passe: Test123456!`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
