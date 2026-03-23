/**
 * EduPilot Database Seed — Orchestrator
 *
 * This file orchestrates the seeding process by calling focused modules in sequence.
 * Each module populates its section of the shared SeedContext.
 *
 * Module structure:
 * ├── seed.ts                    — This orchestrator
 * ├── seed-reference-data.ts     — Benin reference data (existing)
 * └── seeds/
 *     ├── utils.ts               — Shared utilities, data constants, SeedContext
 *     ├── seed-foundation.ts     — Cleanup, schools, admins, academic config
 *     ├── seed-people.ts         — Teachers, class-subject assignments, families
 *     ├── seed-academic-data.ts  — Grades, attendance, homework, behavior, medical, finance
 *     └── seed-extras.ts         — Schedules, events, LMS, communication, calendar, analytics
 */

import { prisma, createEmptyContext } from "./seeds/utils";
import { seedCleanup, seedFoundation } from "./seeds/seed-foundation";
import { seedPeople } from "./seeds/seed-people";
import { seedAcademicData } from "./seeds/seed-academic-data";
import { seedExtras } from "./seeds/seed-extras";

import { appEnv } from "../src/lib/config/env";

async function main() {
  if (appEnv.isProduction) {
    console.error("❌ Le script de seed complet ne doit jamais être exécuté en production.");
    process.exit(1);
  }
  console.log("\n" + "=".repeat(60));
  console.log("🌱 EDUPILOT - GÉNÉRATION DE DONNÉES DE TEST COMPLÈTES");
  console.log("=".repeat(60) + "\n");

  const ctx = createEmptyContext();

  // Phase 1: Cleanup & Foundation
  await seedCleanup();
  await seedFoundation(ctx);

  // Phase 2: People
  await seedPeople(ctx);

  // Phase 3: Academic Data
  await seedAcademicData(ctx);

  // Phase 4: Extras
  await seedExtras(ctx);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 GÉNÉRATION DES DONNÉES TERMINÉE AVEC SUCCÈS!");
  console.log("=".repeat(60));

  console.log("\n📊 RÉSUMÉ DES DONNÉES CRÉÉES:");
  console.log("─".repeat(40));
  console.log(`   🏫 Établissements:        3`);
  console.log(`   👤 Super Admin:           1`);
  console.log(`   👔 Administrateurs:       5`);
  console.log(`   👨‍🏫 Enseignants:           ${ctx.teachers.length}`);
  console.log(`   👨‍👩‍👧‍👦 Parents:              ${ctx.parents.length}`);
  console.log(`   👨‍🎓 Élèves:                ${ctx.students.length}`);
  console.log(`   🏛️  Classes:               ${ctx.collegeClasses.length}`);
  console.log(`   📚 Matières:              ${ctx.subjects.length}`);
  console.log(`   📝 Notes:                 ${ctx.totalGrades}`);
  console.log(`   💰 Paiements:             ${ctx.paymentCount}`);
  console.log(`   📖 Cours LMS:             ${ctx.courseCount}`);
  console.log(`   📝 Examens en ligne:      ${ctx.examCount}`);
  console.log(`   🏥 Dossiers médicaux:     ${ctx.medicalCount}`);
  console.log(`   🎉 Événements:            ${ctx.events.length}`);
  console.log(`   📜 Certificats:           ${ctx.certCount}`);

  console.log("\n🔐 COMPTES DE TEST:");
  console.log("─".repeat(40));
  console.log("   📌 Super Admin (dev uniquement):");
  console.log("      Email: admin@edupilot.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Admin École Saint-Michel (dev uniquement):");
  console.log("      Email: admin@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Directeur (dev uniquement):");
  console.log("      Email: directeur@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Enseignant (dev uniquement):");
  console.log("      Email: m.agbossou@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   ⚠️ Ces comptes sont réservés au développement local et ne doivent pas exister en production.");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
