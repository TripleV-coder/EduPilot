import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Création d'un utilisateur de test...\n");

  // Create a test SUPER_ADMIN
  const superAdminPassword = await hash("Admin123!", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@edupilot.com" },
    update: {},
    create: {
      email: "admin@edupilot.com",
      firstName: "Admin",
      lastName: "EduPilot",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log("✅ SUPER_ADMIN créé:");
  console.log(`   Email: admin@edupilot.com`);
  console.log(`   Password: Admin123!`);
  console.log(`   Role: ${superAdmin.role}\n`);

  // Create a test STUDENT
  const studentPassword = await hash("Student123!", 12);
  const student = await prisma.user.upsert({
    where: { email: "student@edupilot.com" },
    update: {},
    create: {
      email: "student@edupilot.com",
      firstName: "Étudiant",
      lastName: "Test",
      password: studentPassword,
      role: "STUDENT",
      isActive: true,
    },
  });

  console.log("✅ STUDENT créé:");
  console.log(`   Email: student@edupilot.com`);
  console.log(`   Password: Student123!`);
  console.log(`   Role: ${student.role}\n`);

  console.log("🎉 Utilisateurs de test créés avec succès!");
  console.log("\n📝 Vous pouvez maintenant vous connecter sur http://localhost:3000/login");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
