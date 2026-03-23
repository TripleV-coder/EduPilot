/**
 * Seed Foundation — Cleanup, Schools, Admins, Academic Config
 * Sections 1-8 of the original seed.ts
 */

import {
    prisma,
    SeedContext,
    generatePhone,
    createUser,
    randomInt,
} from "./utils";
import { seedBeninReferenceData } from "../seed-reference-data";

/**
 * Clean the entire database (reverse dependency order)
 */
export async function seedCleanup(): Promise<void> {
    console.log("🗑️  Suppression des données existantes...");

    // Library
    await prisma.borrowingRecord.deleteMany();
    await prisma.book.deleteMany();
    // Canteen
    await prisma.mealTicket.deleteMany();
    await prisma.canteenMenu.deleteMany();
    // Gamification
    await prisma.leaderboard.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.achievement.deleteMany();
    // Import templates
    await prisma.importTemplate.deleteMany();
    // Config & Reference
    await prisma.configOption.deleteMany();
    await prisma.subjectCategory.deleteMany();
    await prisma.nationality.deleteMany();
    await prisma.profession.deleteMany();
    await prisma.city.deleteMany();
    // Exams & LMS
    await prisma.examAnswer.deleteMany();
    await prisma.examSession.deleteMany();
    await prisma.question.deleteMany();
    await prisma.examTemplate.deleteMany();
    await prisma.lessonCompletion.deleteMany();
    await prisma.courseEnrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.courseModule.deleteMany();
    await prisma.course.deleteMany();
    // Grades
    await prisma.grade.deleteMany();
    await prisma.evaluation.deleteMany();
    await prisma.evaluationType.deleteMany();
    // Attendance & Homework
    await prisma.attendance.deleteMany();
    await prisma.homeworkSubmission.deleteMany();
    await prisma.homework.deleteMany();
    // Analytics
    await prisma.gradeHistory.deleteMany();
    await prisma.subjectPerformance.deleteMany();
    await prisma.studentAnalytics.deleteMany();
    // Resources & Certs
    await prisma.resource.deleteMany();
    await prisma.certificate.deleteMany();
    // Events
    await prisma.eventParticipation.deleteMany();
    await prisma.schoolEvent.deleteMany();
    // Communication
    await prisma.appointment.deleteMany();
    await prisma.message.deleteMany();
    await prisma.notification.deleteMany();
    // Behavior & Medical
    await prisma.sanction.deleteMany();
    await prisma.behaviorIncident.deleteMany();
    await prisma.emergencyContact.deleteMany();
    await prisma.vaccination.deleteMany();
    await prisma.allergy.deleteMany();
    await prisma.medicalRecord.deleteMany();
    // Finance
    await prisma.payment.deleteMany();
    await prisma.installmentPayment.deleteMany();
    await prisma.paymentPlan.deleteMany();
    await prisma.scholarship.deleteMany();
    await prisma.fee.deleteMany();
    // Schedules
    await prisma.schedule.deleteMany();
    await prisma.teacherAvailability.deleteMany();
    // Calendar
    await prisma.schoolCalendarEvent.deleteMany();
    await prisma.publicHoliday.deleteMany();
    await prisma.schoolHoliday.deleteMany();
    // GDPR
    await prisma.dataAccessRequest.deleteMany();
    await prisma.dataRetentionPolicy.deleteMany();
    await prisma.dataConsent.deleteMany();
    // Orientation
    await prisma.orientationRecommendation.deleteMany();
    await prisma.subjectGroupAnalysis.deleteMany();
    await prisma.studentOrientation.deleteMany();
    // Core
    await prisma.auditLog.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.classSubject.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.parentStudent.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.parentProfile.deleteMany();
    await prisma.teacherProfile.deleteMany();
    await prisma.subject.deleteMany();
    await prisma.class.deleteMany();
    await prisma.classLevel.deleteMany();
    await prisma.period.deleteMany();
    await prisma.academicYear.deleteMany();
    await prisma.academicConfig.deleteMany();
    // Subscriptions
    await prisma.subscriptionPlan.deleteMany();
    // Auth & System
    await prisma.systemSetting.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.firstLoginToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.school.deleteMany();

    console.log("✅ Base de données nettoyée\n");
}

/**
 * Seed reference data + schools + admins + academic config + subjects + classes
 */
export async function seedFoundation(ctx: SeedContext): Promise<void> {
    // 1.1 Reference data
    await seedBeninReferenceData();

    // 2. Super Admin
    console.log("👤 Création du Super Admin...");
    ctx.superAdmin = await createUser("admin@edupilot.bj", "Super", "Administrateur", "SUPER_ADMIN", null);
    console.log("   ✅ Super Admin créé: admin@edupilot.bj\n");

    // 3. Schools
    console.log("🏫 Création des établissements scolaires...\n");
    ctx.school1 = await prisma.school.create({
        data: { name: "Collège d'Excellence Saint-Michel", code: "CESM", type: "PRIVATE", level: "SECONDARY_COLLEGE", city: "Cotonou", address: "Quartier Akpakpa, Rue 112, Lot 456", phone: await generatePhone(), email: "contact@saintmichel.bj" },
    });
    ctx.school2 = await prisma.school.create({
        data: { name: "Lycée National Béhanzin", code: "LNB", type: "PUBLIC", level: "SECONDARY_LYCEE", city: "Porto-Novo", address: "Avenue du Gouverneur, BP 2345", phone: await generatePhone(), email: "direction@lycee-behanzin.bj" },
    });
    ctx.school3 = await prisma.school.create({
        data: { name: "École Primaire Les Étoiles Brillantes", code: "EPEB", type: "PRIVATE", level: "PRIMARY", city: "Abomey-Calavi", address: "Quartier Togoudo, Carré 234", phone: await generatePhone(), email: "contact@etoilesbrillantes.bj" },
    });
    console.log("   ✅ 3 établissements créés\n");

    // 4. School Admins
    console.log("👔 Création des administrateurs d'école...\n");
    ctx.schoolAdmin1 = await createUser("admin@saintmichel.bj", "Robert", "Agbossou", "SCHOOL_ADMIN", ctx.school1.id);
    ctx.director1 = await createUser("directeur@saintmichel.bj", "François", "Hounkpatin", "DIRECTOR", ctx.school1.id);
    await createUser("comptable@saintmichel.bj", "Félicité", "Dossou", "ACCOUNTANT", ctx.school1.id);
    await createUser("admin@lycee-behanzin.bj", "Germain", "Togan", "SCHOOL_ADMIN", ctx.school2.id);
    await createUser("directeur@lycee-behanzin.bj", "Honorine", "Zinsou", "DIRECTOR", ctx.school2.id);
    console.log("   ✅ Administrateurs créés\n");

    // 5. Academic config
    console.log("📅 Configuration académique...\n");
    ctx.academicYear1 = await prisma.academicYear.create({
        data: { schoolId: ctx.school1.id, name: "2024-2025", startDate: new Date("2024-09-16"), endDate: new Date("2025-07-15"), isCurrent: true },
    });
    await prisma.academicConfig.create({
        data: { schoolId: ctx.school1.id, periodType: "TRIMESTER", periodsCount: 3, maxGrade: 20, passingGrade: 10 },
    });
    ctx.periods = await Promise.all([
        prisma.period.create({ data: { academicYearId: ctx.academicYear1.id, name: "1er Trimestre", type: "TRIMESTER", startDate: new Date("2024-09-16"), endDate: new Date("2024-12-20"), sequence: 1 } }),
        prisma.period.create({ data: { academicYearId: ctx.academicYear1.id, name: "2ème Trimestre", type: "TRIMESTER", startDate: new Date("2025-01-06"), endDate: new Date("2025-03-28"), sequence: 2 } }),
        prisma.period.create({ data: { academicYearId: ctx.academicYear1.id, name: "3ème Trimestre", type: "TRIMESTER", startDate: new Date("2025-04-14"), endDate: new Date("2025-07-15"), sequence: 3 } }),
    ]);
    // School 2 & 3 config
    await prisma.academicYear.create({ data: { schoolId: ctx.school2.id, name: "2024-2025", startDate: new Date("2024-09-16"), endDate: new Date("2025-07-15"), isCurrent: true } });
    await prisma.academicConfig.create({ data: { schoolId: ctx.school2.id, periodType: "SEMESTER", periodsCount: 2, maxGrade: 20, passingGrade: 10 } });
    await prisma.academicYear.create({ data: { schoolId: ctx.school3.id, name: "2024-2025", startDate: new Date("2024-09-16"), endDate: new Date("2025-07-15"), isCurrent: true } });
    await prisma.academicConfig.create({ data: { schoolId: ctx.school3.id, periodType: "TRIMESTER", periodsCount: 3, maxGrade: 20, passingGrade: 10 } });
    console.log("   ✅ Configuration académique terminée\n");

    // 6. Evaluation types
    console.log("📋 Création des types d'évaluations...\n");
    ctx.evalTypes = await Promise.all([
        prisma.evaluationType.create({ data: { schoolId: ctx.school1.id, name: "Devoir surveillé", code: "DS", weight: 1, maxCount: 5 } }),
        prisma.evaluationType.create({ data: { schoolId: ctx.school1.id, name: "Composition", code: "COMP", weight: 3, maxCount: 1 } }),
        prisma.evaluationType.create({ data: { schoolId: ctx.school1.id, name: "Interrogation écrite", code: "IE", weight: 0.5, maxCount: 8 } }),
        prisma.evaluationType.create({ data: { schoolId: ctx.school1.id, name: "Participation orale", code: "ORAL", weight: 0.5, maxCount: 4 } }),
        prisma.evaluationType.create({ data: { schoolId: ctx.school1.id, name: "Travaux pratiques", code: "TP", weight: 1, maxCount: 3 } }),
    ]);
    console.log("   ✅ Types d'évaluations créés\n");

    // 7. Subjects
    console.log("📚 Création des matières...\n");
    ctx.subjectsData = [
        { name: "Français", code: "FR", category: "Langues", coef: 4 },
        { name: "Mathématiques", code: "MATH", category: "Sciences", coef: 4 },
        { name: "Physique-Chimie", code: "PC", category: "Sciences", coef: 3 },
        { name: "Sciences de la Vie et de la Terre", code: "SVT", category: "Sciences", coef: 3 },
        { name: "Anglais", code: "ANG", category: "Langues", coef: 3 },
        { name: "Histoire-Géographie", code: "HG", category: "Humanités", coef: 2 },
        { name: "Éducation Civique et Morale", code: "ECM", category: "Humanités", coef: 1 },
        { name: "Philosophie", code: "PHILO", category: "Humanités", coef: 2 },
        { name: "Éducation Physique et Sportive", code: "EPS", category: "Sport", coef: 2 },
        { name: "Informatique", code: "INFO", category: "Sciences", coef: 1 },
        { name: "Arts Plastiques", code: "ART", category: "Arts", coef: 1 },
    ];
    ctx.subjects = await Promise.all(
        ctx.subjectsData.map((s: any) => prisma.subject.create({
            data: { schoolId: ctx.school1.id, name: s.name, code: s.code, category: s.category }
        }))
    );
    console.log(`   ✅ ${ctx.subjects.length} matières créées\n`);

    // 8. Levels and Classes
    console.log("🏛️  Création des niveaux et classes...\n");
    ctx.collegeLevels = [
        { name: "6e", code: "6EME", sequence: 1 },
        { name: "5e", code: "5EME", sequence: 2 },
        { name: "4e", code: "4EME", sequence: 3 },
        { name: "3e", code: "3EME", sequence: 4 },
        { name: "2nde", code: "2NDE", sequence: 5 },
        { name: "1ère", code: "1ERE", sequence: 6 },
        { name: "Tle", code: "TLE", sequence: 7 },
    ];

    for (const level of ctx.collegeLevels) {
        const levelRecord = await prisma.classLevel.create({
            data: { schoolId: ctx.school1.id, name: level.name, code: level.code, sequence: level.sequence, level: level.sequence > 4 ? "SECONDARY_LYCEE" as any : "SECONDARY_COLLEGE" as any }
        });
        ctx.classLevelRecords.push(levelRecord);

        // create A, B, C, D sections for each level
        for (const section of ["A", "B", "C", "D"]) {
            const className = `${level.name} ${section}`; // Format: "6e A", "Tle D", etc.
            const cls = await prisma.class.create({
                data: { schoolId: ctx.school1.id, classLevelId: levelRecord.id, name: className, capacity: randomInt(30, 45) },
            });
            ctx.collegeClasses.push({ ...cls, level: levelRecord, levelName: level.name });
        }
    }
    console.log(`   ✅ ${ctx.collegeLevels.length} niveaux et ${ctx.collegeClasses.length} classes créés\n`);
}
