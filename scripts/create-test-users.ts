/**
 * Script pour créer des utilisateurs de test pour chaque rôle
 * Usage: npx tsx scripts/create-test-users.ts
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🔧 Création des utilisateurs de test...\n");

    // Mot de passe commun pour tous les utilisateurs de test
    const password = await hash("Test123!", 10);

    // 1. Créer une école de test
    console.log("📚 Création de l'école de test...");
    const school = await prisma.school.create({
        data: {
            name: "École Test EduPilot",
            code: "TEST001",
            address: "123 Rue de Test, 75001 Paris",
            phone: "0123456789",
            email: "contact@ecole-test.fr",
            type: "PUBLIC",
            level: "SECONDARY_COLLEGE",
        },
    });
    console.log(`✅ École créée: ${school.name} (ID: ${school.id})\n`);

    // 2. Super Admin
    console.log("👑 Création du Super Admin...");
    const superAdmin = await prisma.user.create({
        data: {
            email: "superadmin@edupilot.test",
            password,
            firstName: "Super",
            lastName: "Admin",
            role: "SUPER_ADMIN",
            isActive: true,
            emailVerified: new Date(),
        },
    });
    console.log(`✅ Super Admin créé: ${superAdmin.email}\n`);

    // 3. School Admin
    console.log("🏫 Création du School Admin...");
    const schoolAdmin = await prisma.user.create({
        data: {
            email: "admin@ecole-test.fr",
            password,
            firstName: "Jean",
            lastName: "Directeur",
            role: "SCHOOL_ADMIN",
            schoolId: school.id,
            isActive: true,
            emailVerified: new Date(),
        },
    });
    console.log(`✅ School Admin créé: ${schoolAdmin.email}\n`);

    // 4. Enseignants
    console.log("👨‍🏫 Création des enseignants...");
    const teachers = [];

    const teacherData = [
        { firstName: "Marie", lastName: "Dupont", email: "marie.dupont@ecole-test.fr", specialization: "Mathématiques" },
        { firstName: "Pierre", lastName: "Martin", email: "pierre.martin@ecole-test.fr", specialization: "Français" },
        { firstName: "Sophie", lastName: "Bernard", email: "sophie.bernard@ecole-test.fr", specialization: "Histoire-Géographie" },
    ];

    for (const data of teacherData) {
        const user = await prisma.user.create({
            data: {
                email: data.email,
                password,
                firstName: data.firstName,
                lastName: data.lastName,
                role: "TEACHER",
                schoolId: school.id,
                isActive: true,
                emailVerified: new Date(),
            },
        });

        const teacher = await prisma.teacherProfile.create({
            data: {
                userId: user.id,
                schoolId: school.id,
                specialization: data.specialization,
            },
        });

        teachers.push({ user, teacher });
        console.log(`  ✅ ${data.firstName} ${data.lastName} - ${data.specialization}`);
    }
    console.log();

    // 5. Créer des classes
    console.log("🎓 Création des classes...");
    const classes = [];

    const classLevels = [
        { name: "Sixième", code: "6EME", level: "SECONDARY_COLLEGE", sequence: 1 },
        { name: "Cinquième", code: "5EME", level: "SECONDARY_COLLEGE", sequence: 2 },
        { name: "Quatrième", code: "4EME", level: "SECONDARY_COLLEGE", sequence: 3 },
    ];

    const createdLevels = [];
    for (const levelData of classLevels) {
        const level = await prisma.classLevel.create({
            data: {
                schoolId: school.id,
                name: levelData.name,
                code: levelData.code,
                level: levelData.level as any,
                sequence: levelData.sequence,
            },
        });
        createdLevels.push(level);
    }

    const classData = [
        { name: "6ème A", classLevelId: createdLevels[0].id, mainTeacherId: teachers[0].teacher.id },
        { name: "5ème B", classLevelId: createdLevels[1].id, mainTeacherId: teachers[1].teacher.id },
        { name: "4ème C", classLevelId: createdLevels[2].id, mainTeacherId: teachers[2].teacher.id },
    ];

    for (const data of classData) {
        const classe = await prisma.class.create({
            data: {
                name: data.name,
                classLevelId: data.classLevelId,
                schoolId: school.id,
                mainTeacherId: data.mainTeacherId,
                capacity: 30,
            },
        });
        classes.push(classe);
        console.log(`  ✅ ${data.name}`);
    }
    console.log();

    // 6. Parents et Élèves
    console.log("👨‍👩‍👧‍👦 Création des parents et élèves...");

    const familyData = [
        {
            parent: { firstName: "Robert", lastName: "Dubois", email: "robert.dubois@parent.test", phone: "0612345678" },
            students: [
                { firstName: "Alice", lastName: "Dubois", gender: "F", classId: classes[0].id },
                { firstName: "Lucas", lastName: "Dubois", gender: "M", classId: classes[1].id },
            ],
        },
        {
            parent: { firstName: "Christine", lastName: "Moreau", email: "christine.moreau@parent.test", phone: "0623456789" },
            students: [
                { firstName: "Emma", lastName: "Moreau", gender: "F", classId: classes[0].id },
            ],
        },
        {
            parent: { firstName: "Michel", lastName: "Laurent", email: "michel.laurent@parent.test", phone: "0634567890" },
            students: [
                { firstName: "Thomas", lastName: "Laurent", gender: "M", classId: classes[2].id },
            ],
        },
    ];

    for (const family of familyData) {
        // Créer le parent
        const parentUser = await prisma.user.create({
            data: {
                email: family.parent.email,
                password,
                firstName: family.parent.firstName,
                lastName: family.parent.lastName,
                role: "PARENT",
                schoolId: school.id,
                phone: family.parent.phone,
                isActive: true,
                emailVerified: new Date(),
            },
        });

        const parent = await prisma.parentProfile.create({
            data: {
                userId: parentUser.id,
                profession: "Parent",
            },
        });

        console.log(`  👨‍👩 ${family.parent.firstName} ${family.parent.lastName}`);

        // Créer les élèves
        for (const studentData of family.students) {
            const studentUser = await prisma.user.create({
                data: {
                    email: `${studentData.firstName.toLowerCase()}.${studentData.lastName.toLowerCase()}@student.test`,
                    password,
                    firstName: studentData.firstName,
                    lastName: studentData.lastName,
                    role: "STUDENT",
                    schoolId: school.id,
                    isActive: true,
                    emailVerified: new Date(),
                },
            });

            const student = await prisma.studentProfile.create({
                data: {
                    userId: studentUser.id,
                    schoolId: school.id,
                    gender: studentData.gender === "M" ? "MALE" : "FEMALE",
                    matricule: `STU${Date.now()}${Math.random().toString(36).substring(7)}`,
                },
            });

            // Lier parent et élève
            await prisma.parentStudent.create({
                data: {
                    parentId: parent.id,
                    studentId: student.id,
                    relationship: "PARENT",
                },
            });

            console.log(`    👦 ${studentData.firstName} ${studentData.lastName} - ${classes.find(c => c.id === studentData.classId)?.name || 'N/A'}`);
        }
    }
    console.log();

    // 7. Créer une année académique et inscrire les élèves
    console.log("📅 Création de l'année académique...");
    const academicYear = await prisma.academicYear.create({
        data: {
            schoolId: school.id,
            name: "2024-2025",
            startDate: new Date("2024-09-01"),
            endDate: new Date("2025-06-30"),
            isCurrent: true,
        },
    });
    console.log(`✅ Année académique créée: ${academicYear.name}\n`);

    // Inscrire tous les élèves
    const allStudents = await prisma.studentProfile.findMany({
        where: { schoolId: school.id },
    });

    for (const student of allStudents) {
        const studentClass = classes.find(c => {
            // Find which class this student should be in based on parent-student relationship
            return true; // For now, just enroll in first class
        });

        if (studentClass) {
            await prisma.enrollment.create({
                data: {
                    studentId: student.id,
                    classId: studentClass.id,
                    academicYearId: academicYear.id,
                    status: "ACTIVE",
                },
            });
        }
    }
    console.log(`✅ ${allStudents.length} élèves inscrits\n`);

    // Résumé
    console.log("=".repeat(60));
    console.log("✅ UTILISATEURS DE TEST CRÉÉS AVEC SUCCÈS!\n");
    console.log("📋 RÉSUMÉ:");
    console.log(`   École: ${school.name}`);
    console.log(`   Super Admin: superadmin@edupilot.test`);
    console.log(`   School Admin: admin@ecole-test.fr`);
    console.log(`   Enseignants: ${teachers.length}`);
    console.log(`   Classes: ${classes.length}`);
    console.log(`   Parents: ${familyData.length}`);
    console.log(`   Élèves: ${familyData.reduce((acc, f) => acc + f.students.length, 0)}`);
    console.log();
    console.log("🔑 MOT DE PASSE POUR TOUS: Test123!");
    console.log("=".repeat(60));
}

main()
    .catch((e) => {
        console.error("❌ Erreur:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
