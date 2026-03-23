import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkCounts() {
  try {
    const [schools, users, students, grades, attendance, payments] = await Promise.all([
      prisma.school.count(),
      prisma.user.count(),
      prisma.studentProfile.count(),
      prisma.grade.count(),
      prisma.attendance.count(),
      prisma.payment.count(),
    ]);

    console.log("📊 État actuel de la base de données :");
    console.log(`🏫 Établissements : ${schools}`);
    console.log(`👤 Utilisateurs : ${users}`);
    console.log(`👨‍🎓 Élèves : ${students}`);
    console.log(`📝 Notes : ${grades}`);
    console.log(`📅 Présences : ${attendance}`);
    console.log(`💰 Paiements : ${payments}`);
  } catch (error) {
    console.error("Erreur lors de la vérification :", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCounts();
