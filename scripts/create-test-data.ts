import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function createTestData() {
  console.log('🚀 Création des données de test...\n');

  try {
    // 1. Create or get Subscription Plan
    let plan = await prisma.subscriptionPlan.findUnique({
      where: { code: 'TEST' },
    });

    if (!plan) {
      plan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Plan de Test',
          code: 'TEST',
          description: 'Plan de test pour développement',
          maxStudents: 500,
          maxTeachers: 50,
          maxStorageGB: 10,
          priceMonthly: 0,
          priceYearly: 0,
          features: ['import', 'export', 'analytics'],
          isActive: true,
        },
      });
      console.log('✅ Plan d\'abonnement créé:', plan.name);
    } else {
      console.log('✅ Plan d\'abonnement existant trouvé:', plan.name);
    }

    // 2. Create School
    const school = await prisma.school.create({
      data: {
        name: 'École de Test',
        code: 'TEST001',
        type: 'PRIVATE',
        level: 'SECONDARY_COLLEGE',
        address: '123 Rue de Test',
        city: 'Paris',
        phone: '+33123456789',
        email: 'contact@ecoletest.fr',
        isActive: true,
        planId: plan.id,
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log('✅ École créée:', school.name);

    // 3. Create Academic Year
    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        name: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-06-30'),
        isCurrent: true,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Année académique créée:', academicYear.name);

    // 4. Create Admin User
    const hashedPassword = await hash('admin123', 10);
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@edupilot.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Test',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        schoolId: school.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('✅ Utilisateur admin créé:', adminUser.email);
    console.log('   🔑 Mot de passe: admin123');

    // 5. Create School Admin
    const schoolAdminPassword = await hash('school123', 10);
    const schoolAdmin = await prisma.user.create({
      data: {
        email: 'schooladmin@edupilot.com',
        password: schoolAdminPassword,
        firstName: 'School',
        lastName: 'Admin',
        role: 'SCHOOL_ADMIN',
        roles: ['SCHOOL_ADMIN'],
        schoolId: school.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('✅ Administrateur d\'école créé:', schoolAdmin.email);
    console.log('   🔑 Mot de passe: school123');

    // 6. Create a test class
    const classLevel = await prisma.classLevel.create({
      data: {
        schoolId: school.id,
        name: '6ème',
        code: '6EME',
        sequence: 1,
        level: 'SECONDARY_COLLEGE',
      },
    });

    const testClass = await prisma.class.create({
      data: {
        schoolId: school.id,
        classLevelId: classLevel.id,
        name: '6ème A',
        capacity: 30,
      },
    });
    console.log('✅ Classe créée:', testClass.name);

    console.log('\n🎉 Données de test créées avec succès!');
    console.log('\n📝 Informations de connexion:');
    console.log('  Super Admin: admin@edupilot.com / admin123');
    console.log('  School Admin: schooladmin@edupilot.com / school123');
    console.log('  École: ' + school.name + ' (ID: ' + school.id + ')');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
