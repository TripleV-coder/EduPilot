/**
 * Script simplifié pour créer des utilisateurs de test
 * Compatible avec le schéma actuel de la base de données
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🔧 Création des utilisateurs de test (version simplifiée)...\n");

    const password = await hash("Test123!", 10);

    // 1. Créer une école
    console.log("📚 Création de l'école...");
    const school = await prisma.school.create({
        data: {
            name: "École Test",
            code: "TEST" + Date.now(),
            type: "PUBLIC",
            level: "SECONDARY_COLLEGE",
        },
    });
    console.log(`✅ École: ${school.name}\n`);

    // 2. Super Admin
    console.log("👑 Création des utilisateurs...");
    const superAdmin = await prisma.user.create({
        data: {
            email: "superadmin@test.com",
            password,
            firstName: "Super",
            lastName: "Admin",
            role: "SUPER_ADMIN",
            isActive: true,
        },
    });
    console.log(`  ✅ Super Admin: ${superAdmin.email}`);

    // 3. School Admin
    const schoolAdmin = await prisma.user.create({
        data: {
            email: "admin@test.com",
            password,
            firstName: "Admin",
            lastName: "École",
            role: "SCHOOL_ADMIN",
            schoolId: school.id,
            isActive: true,
        },
    });
    console.log(`  ✅ School Admin: ${schoolAdmin.email}`);

    // 4. Teacher
    const teacherUser = await prisma.user.create({
        data: {
            email: "teacher@test.com",
            password,
            firstName: "Prof",
            lastName: "Test",
            role: "TEACHER",
            schoolId: school.id,
            isActive: true,
        },
    });
    console.log(`  ✅ Teacher: ${teacherUser.email}`);

    // 5. Student
    const studentUser = await prisma.user.create({
        data: {
            email: "student@test.com",
            password,
            firstName: "Élève",
            lastName: "Test",
            role: "STUDENT",
            schoolId: school.id,
            isActive: true,
        },
    });
    console.log(`  ✅ Student: ${studentUser.email}`);

    // 6. Parent
    const parentUser = await prisma.user.create({
        data: {
            email: "parent@test.com",
            password,
            firstName: "Parent",
            lastName: "Test",
            role: "PARENT",
            schoolId: school.id,
            isActive: true,
        },
    });
    console.log(`  ✅ Parent: ${parentUser.email}\n`);

    console.log("=".repeat(60));
    console.log("✅ UTILISATEURS CRÉÉS AVEC SUCCÈS!\n");
    console.log("📋 CONNEXIONS:");
    console.log(`   Super Admin: superadmin@test.com / Test123!`);
    console.log(`   School Admin: admin@test.com / Test123!`);
    console.log(`   Teacher: teacher@test.com / Test123!`);
    console.log(`   Student: student@test.com / Test123!`);
    console.log(`   Parent: parent@test.com / Test123!`);
    console.log("=".repeat(60));
}

main()
    .catch((e) => {
        console.error("❌ Erreur:", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
