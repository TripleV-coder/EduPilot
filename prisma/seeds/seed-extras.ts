/**
 * Seed Extras — Schedules, Events, LMS, Exams, Communication, Calendar, Analytics, System
 * Sections 18-32 of the original seed.ts
 */

import {
    prisma,
    SeedContext,
    randomDate,
    randomElement,
    randomGrade,
    randomInt,
} from "./utils";

export async function seedExtras(ctx: SeedContext): Promise<void> {
    // 18. Schedules
    console.log("📆 Création des emplois du temps...\n");
    const timeSlots = [
        { start: "07:30", end: "08:30" }, { start: "08:30", end: "09:30" },
        { start: "09:45", end: "10:45" }, { start: "10:45", end: "11:45" },
        { start: "12:00", end: "13:00" }, { start: "15:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
    ];
    let scheduleCount = 0;
    for (const cls of ctx.collegeClasses) {
        const csForClass = ctx.classSubjects.filter((cs: any) => cs.class.id === cls.id);
        for (let day = 1; day <= 5; day++) {
            let idx = 0;
            for (const slot of timeSlots.slice(0, 6)) {
                const cs = csForClass[idx % csForClass.length];
                if (cs) {
                    await prisma.schedule.create({ data: { classId: cls.id, classSubjectId: cs.id, dayOfWeek: day, startTime: slot.start, endTime: slot.end, room: `Salle ${cls.levelName.charAt(0)}${randomInt(1, 5)}` } });
                    scheduleCount++;
                }
                idx++;
            }
        }
    }
    console.log(`   ✅ ${scheduleCount} créneaux d'emploi du temps créés\n`);

    // 19. Teacher Availability
    console.log("🕐 Création des disponibilités enseignants...\n");
    for (const t of ctx.teachers) {
        for (let day = 1; day <= 5; day++) {
            await prisma.teacherAvailability.create({ data: { teacherId: t.profile.id, dayOfWeek: day, startTime: "07:30", endTime: "17:00", isActive: true } });
        }
    }
    console.log("   ✅ Disponibilités enseignants créées\n");

    // 20. Appointments
    console.log("📞 Création des rendez-vous...\n");
    let appointmentCount = 0;
    for (let i = 0; i < 30; i++) {
        const student = randomElement(ctx.students);
        const teacher = randomElement(ctx.teachers);
        await prisma.appointment.create({
            data: { teacherId: teacher.profile.id, parentId: student.parents[0].id, studentId: student.profile.id, scheduledAt: randomDate(new Date(2024, 10, 1), new Date(2025, 1, 28)), duration: randomElement([15, 30, 45]), type: randomElement(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]) as any, status: randomElement(["PENDING", "CONFIRMED", "COMPLETED"]) as any, location: "Bureau des enseignants", notes: randomElement(["Discussion sur les résultats scolaires", "Suivi comportemental", "Orientation scolaire", "Bilan de mi-trimestre", null]), createdById: student.parents[0].userId || teacher.user.id },
        });
        appointmentCount++;
    }
    console.log(`   ✅ ${appointmentCount} rendez-vous créés\n`);

    // 21. School Events
    console.log("🎉 Création des événements scolaires...\n");
    ctx.events = await Promise.all([
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Journée Portes Ouvertes", description: "Venez découvrir notre établissement", type: "GENERAL", startDate: new Date(2024, 11, 15, 9, 0), endDate: new Date(2024, 11, 15, 16, 0), location: "Cour principale", isPublished: true, createdById: ctx.director1.id } }),
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Tournoi Interscolaire de Football", description: "Compétition sportive entre établissements", type: "SPORTS", startDate: new Date(2024, 11, 20, 8, 0), endDate: new Date(2024, 11, 20, 17, 0), location: "Stade municipal", fee: 2000, maxParticipants: 50, requiresPermission: true, isPublished: true, createdById: ctx.director1.id } }),
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Fête de Noël", description: "Spectacle de fin d'année", type: "CULTURAL", startDate: new Date(2024, 11, 22, 14, 0), endDate: new Date(2024, 11, 22, 18, 0), location: "Salle des fêtes", isPublished: true, createdById: ctx.director1.id } }),
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Examen Blanc - BEPC", description: "Préparation aux examens officiels", type: "ACADEMIC", startDate: new Date(2025, 1, 10, 7, 30), endDate: new Date(2025, 1, 14, 12, 0), location: "Salles d'examen", isPublished: true, createdById: ctx.director1.id } }),
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Sortie Pédagogique - Musée d'Abomey", description: "Visite culturelle", type: "FIELD_TRIP", startDate: new Date(2025, 2, 15, 7, 0), endDate: new Date(2025, 2, 15, 18, 0), location: "Abomey", fee: 5000, maxParticipants: 80, requiresPermission: true, isPublished: true, createdById: ctx.director1.id } }),
        prisma.schoolEvent.create({ data: { schoolId: ctx.school1.id, title: "Réunion Parents-Professeurs", description: "Rencontre trimestrielle", type: "PARENT_MEETING", startDate: new Date(2024, 11, 18, 15, 0), endDate: new Date(2024, 11, 18, 18, 0), location: "Salles de classe", isPublished: true, createdById: ctx.director1.id } }),
    ]);

    for (const event of ctx.events) {
        if (event.maxParticipants) {
            const participants = ctx.students.sort(() => Math.random() - 0.5).slice(0, Math.min(event.maxParticipants, randomInt(20, 50)));
            for (const student of participants) {
                await prisma.eventParticipation.create({
                    data: { eventId: event.id, studentId: student.profile.id, status: randomElement(["REGISTERED", "CONFIRMED"]) as any, permissionGiven: event.requiresPermission ? Math.random() < 0.8 : true, permissionBy: student.parents[0].id, paymentStatus: event.fee ? (Math.random() < 0.7 ? "PAID" : "PENDING") : null },
                });
            }
        }
    }
    console.log(`   ✅ ${ctx.events.length} événements créés avec participations\n`);

    // 22-23. LMS Courses & Exams
    console.log("📖 Création des cours en ligne (LMS)...\n");
    const coursesData = [
        { subject: "Mathématiques", title: "Algèbre - Équations du premier degré", modules: [{ title: "Introduction aux équations", lessons: ["Définitions et vocabulaire", "Équivalence d'équations", "Exercices de base"] }, { title: "Résolution d'équations", lessons: ["Méthode de résolution", "Équations avec fractions", "Problèmes concrets"] }, { title: "Applications", lessons: ["Problèmes de la vie courante", "Exercices avancés", "QCM de révision"] }] },
        { subject: "Français", title: "La Dissertation - Méthodologie complète", modules: [{ title: "Comprendre le sujet", lessons: ["Analyse des termes", "Problématique", "Plan détaillé"] }, { title: "Rédiger l'introduction", lessons: ["L'accroche", "Présentation du sujet", "Annonce du plan"] }, { title: "Développer les arguments", lessons: ["Structure d'un paragraphe", "Exemples et citations", "Transitions"] }] },
        { subject: "Physique-Chimie", title: "L'électricité - Circuits électriques", modules: [{ title: "Notions de base", lessons: ["Tension et intensité", "Loi d'Ohm", "Résistances"] }, { title: "Circuits en série et parallèle", lessons: ["Montage en série", "Montage en parallèle", "Mesures électriques"] }] },
        { subject: "Anglais", title: "English Grammar - Tenses", modules: [{ title: "Present Tenses", lessons: ["Simple Present", "Present Continuous", "Practice exercises"] }, { title: "Past Tenses", lessons: ["Simple Past", "Past Continuous", "Present Perfect"] }] },
    ];

    for (const courseData of coursesData) {
        const subject = ctx.subjects.find((s: any) => s.name === courseData.subject);
        const teacher = ctx.teachers.find((t: any) => t.data.subject === courseData.subject);
        if (!subject || !teacher) continue;
        const cs = ctx.classSubjects.find((c: any) => c.subject.id === subject.id);
        if (!cs) continue;

        const course = await prisma.course.create({ data: { classSubjectId: cs.id, title: courseData.title, description: `Cours complet sur ${courseData.title}`, isPublished: true, createdById: teacher.user.id } });
        ctx.courseCount++;

        let moduleOrder = 1;
        for (const moduleData of courseData.modules) {
            const courseModule = await prisma.courseModule.create({ data: { courseId: course.id, title: moduleData.title, order: moduleOrder++ } });
            let lessonOrder = 1;
            for (const lessonTitle of moduleData.lessons) {
                await prisma.lesson.create({ data: { moduleId: courseModule.id, title: lessonTitle, content: `Ce module couvre les aspects essentiels de la leçon : ${lessonTitle}. Les étudiants doivent réviser attentivement ces notions.`, type: randomElement(["TEXT", "VIDEO", "PDF"]) as any, duration: randomInt(15, 45), order: lessonOrder++ } });
            }
        }

        const courseStudents = ctx.students.filter((s: any) => ctx.classSubjects.some((c: any) => c.class.id === s.class.id && c.subject.id === subject.id)).slice(0, 30);
        for (const student of courseStudents) {
            await prisma.courseEnrollment.create({ data: { courseId: course.id, studentId: student.profile.id, progress: randomInt(0, 100), completedAt: Math.random() < 0.2 ? new Date() : null } });
        }
    }
    console.log(`   ✅ ${ctx.courseCount} cours LMS créés avec modules et leçons\n`);

    // 23. Online Exams
    console.log("📝 Création des examens en ligne...\n");
    const examsData = [
        { subject: "Mathématiques", title: "QCM - Équations et Inéquations", questions: [{ q: "Quelle est la solution de 2x + 5 = 11 ?", options: ["x = 2", "x = 3", "x = 4", "x = 5"], correct: "x = 3" }, { q: "Si 3x - 7 = 14, alors x = ?", options: ["5", "6", "7", "8"], correct: "7" }, { q: "Résoudre: x/2 + 3 = 7", options: ["x = 2", "x = 4", "x = 6", "x = 8"], correct: "x = 8" }, { q: "L'équation 5x = 0 a pour solution:", options: ["x = 0", "x = 5", "x = -5", "Pas de solution"], correct: "x = 0" }, { q: "Quel nombre vérifie 2(x+1) = 10 ?", options: ["3", "4", "5", "6"], correct: "4" }] },
        { subject: "Français", title: "QCM - Les figures de style", questions: [{ q: "Une métaphore est:", options: ["Une comparaison avec 'comme'", "Une comparaison sans outil", "Une exagération", "Une répétition"], correct: "Une comparaison sans outil" }, { q: "'Il pleut des cordes' est:", options: ["Une litote", "Une hyperbole", "Une métonymie", "Une personnification"], correct: "Une hyperbole" }, { q: "L'antithèse consiste à:", options: ["Répéter un mot", "Opposer deux idées", "Exagérer", "Comparer"], correct: "Opposer deux idées" }] },
    ];

    for (const examData of examsData) {
        const subject = ctx.subjects.find((s: any) => s.name === examData.subject);
        const teacher = ctx.teachers.find((t: any) => t.data.subject === examData.subject);
        if (!subject || !teacher) continue;
        const cs = ctx.classSubjects.find((c: any) => c.subject.id === subject.id);
        if (!cs) continue;

        const exam = await prisma.examTemplate.create({ data: { classSubjectId: cs.id, title: examData.title, description: `Examen de ${examData.subject}`, duration: 30, totalPoints: examData.questions.length * 4, passingScore: Math.floor(examData.questions.length * 4 * 0.5), isPublished: true, createdById: teacher.user.id } });
        ctx.examCount++;

        let qOrder = 1;
        for (const qData of examData.questions) {
            await prisma.question.create({ data: { examTemplateId: exam.id, type: "MCQ", question: qData.q, options: qData.options, correctAnswer: qData.correct, points: 4, order: qOrder++ } });
        }

        const examStudents = ctx.students.filter((s: any) => ctx.classSubjects.some((c: any) => c.class.id === s.class.id && c.subject.id === subject.id)).slice(0, 20);
        for (const student of examStudents) {
            if (Math.random() < 0.6) {
                const score = randomInt(0, examData.questions.length * 4);
                await prisma.examSession.create({ data: { examTemplateId: exam.id, studentId: student.profile.id, startedAt: randomDate(new Date(2024, 10, 1), new Date(2024, 11, 15)), submittedAt: new Date(), timeSpent: randomInt(600, 1800), score, totalPoints: examData.questions.length * 4, isPassed: score >= Math.floor(examData.questions.length * 4 * 0.5) } });
            }
        }
    }
    console.log(`   ✅ ${ctx.examCount} examens en ligne créés\n`);

    // 24-32: Resources, Certificates, Announcements, Messages, Notifications, Calendar, Analytics, Audit, System
    console.log("📚 Création des ressources pédagogiques...\n");
    const resourcesData = [
        { title: "Cours complet - Équations", subject: "Mathématiques", type: "LESSON" },
        { title: "Exercices corrigés - Algèbre", subject: "Mathématiques", type: "EXERCISE" },
        { title: "Annales BEPC 2023", subject: "Mathématiques", type: "EXAM" },
        { title: "Méthodologie dissertation", subject: "Français", type: "DOCUMENT" },
        { title: "Textes à analyser", subject: "Français", type: "LESSON" },
        { title: "Vidéo - La physique au quotidien", subject: "Physique-Chimie", type: "VIDEO" },
        { title: "TP - Mesures électriques", subject: "Physique-Chimie", type: "EXERCISE" },
        { title: "Grammar Rules - English", subject: "Anglais", type: "DOCUMENT" },
        { title: "Histoire du Bénin - Chronologie", subject: "Histoire-Géographie", type: "DOCUMENT" },
    ];
    for (const resData of resourcesData) {
        const subject = ctx.subjects.find((s: any) => s.name === resData.subject);
        const teacher = ctx.teachers.find((t: any) => t.data.subject === resData.subject);
        if (subject && teacher) {
            await prisma.resource.create({ data: { schoolId: ctx.school1.id, title: resData.title, description: `Ressource pour ${resData.subject}`, type: resData.type as any, category: resData.subject, subjectId: subject.id, fileUrl: `/resources/${resData.title.toLowerCase().replace(/ /g, "-")}.pdf`, fileType: "application/pdf", fileSize: randomInt(100000, 5000000), isPublic: true, uploadedById: teacher.user.id } });
        }
    }
    console.log(`   ✅ ${resourcesData.length} ressources créées\n`);

    // 25. Certificates
    console.log("📜 Création des certificats...\n");
    for (const student of ctx.students.slice(0, 30)) {
        await prisma.certificate.create({ data: { studentId: student.profile.id, type: randomElement(["ENROLLMENT", "ATTENDANCE", "CONDUCT"]) as any, academicYearId: ctx.academicYear1.id, issuedById: ctx.director1.id, certificateNumber: `CERT${ctx.academicYear1.name.replace("-", "")}${String(ctx.certCount + 1).padStart(4, "0")}`, validUntil: new Date(2025, 7, 31) } });
        ctx.certCount++;
    }
    console.log(`   ✅ ${ctx.certCount} certificats créés\n`);

    // 26. Announcements
    console.log("📢 Création des annonces...\n");
    ctx.announcements = [
        { title: "Rentrée scolaire 2024-2025", content: "La rentrée est fixée au lundi 16 septembre 2024 à 7h30.", priority: "HIGH" },
        { title: "Calendrier des compositions", content: "Les compositions du 1er trimestre auront lieu du 9 au 13 décembre 2024.", priority: "HIGH" },
        { title: "Réunion parents-professeurs", content: "Une réunion se tiendra le 18 décembre à 15h.", priority: "NORMAL" },
        { title: "Vacances de Noël", content: "Les vacances de Noël débuteront le 21 décembre.", priority: "NORMAL" },
        { title: "Inscriptions activités parascolaires", content: "Les inscriptions aux activités sont ouvertes.", priority: "LOW" },
    ];
    for (const ann of ctx.announcements) {
        await prisma.announcement.create({ data: { schoolId: ctx.school1.id, title: ann.title, content: ann.content, type: "GENERAL", priority: ann.priority as any, isPublished: true, publishedAt: new Date(), authorId: ctx.director1.id } });
    }
    console.log(`   ✅ ${ctx.announcements.length} annonces créées\n`);

    // 27. Messages
    console.log("💬 Création des messages...\n");
    const messages = [
        { from: ctx.director1.id, to: ctx.teachers[0].user.id, subject: "Réunion pédagogique", content: "Une réunion est programmée pour vendredi à 16h." },
        { from: ctx.teachers[0].user.id, to: ctx.parents[0].user.id, subject: "Suivi de votre enfant", content: "Je souhaite vous rencontrer pour discuter des résultats." },
        { from: ctx.superAdmin.id, to: ctx.schoolAdmin1.id, subject: "Mise à jour système", content: "Une mise à jour sera effectuée ce weekend." },
    ];
    for (const msg of messages) {
        await prisma.message.create({ data: { senderId: msg.from, recipientId: msg.to, subject: msg.subject, content: msg.content, isRead: Math.random() < 0.5 } });
    }
    console.log(`   ✅ ${messages.length} messages créés\n`);

    // 28. Notifications
    console.log("🔔 Création des notifications...\n");
    for (const student of ctx.students.slice(0, 50)) {
        const notifTypes = [
            { type: "GRADE", title: "Nouvelle note", message: "Une nouvelle note a été ajoutée" },
            { type: "ATTENDANCE", title: "Absence signalée", message: "Une absence a été enregistrée" },
            { type: "MESSAGE", title: "Nouveau message", message: "Vous avez un nouveau message" },
        ];
        const notif = randomElement(notifTypes);
        await prisma.notification.create({ data: { userId: student.user.id, type: notif.type as any, title: notif.title, message: notif.message, isRead: Math.random() < 0.3 } });
        ctx.notifCount++;
    }
    console.log(`   ✅ ${ctx.notifCount} notifications créées\n`);

    // 29. Calendar & Holidays
    console.log("📅 Création du calendrier scolaire...\n");
    const publicHolidays = [
        { name: "Fête de l'Indépendance", date: new Date("2024-08-01"), type: "NATIONAL" },
        { name: "Toussaint", date: new Date("2024-11-01"), type: "RELIGIOUS" },
        { name: "Noël", date: new Date("2024-12-25"), type: "RELIGIOUS" },
        { name: "Jour de l'An", date: new Date("2025-01-01"), type: "NATIONAL" },
        { name: "Fête du Travail", date: new Date("2025-05-01"), type: "INTERNATIONAL" },
        { name: "Ascension", date: new Date("2025-05-29"), type: "RELIGIOUS" },
    ];
    for (const h of publicHolidays) {
        await prisma.publicHoliday.create({ data: { name: h.name, date: h.date, type: h.type as any, isRecurring: true } });
    }
    await prisma.schoolHoliday.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Vacances de Noël", type: "CHRISTMAS", startDate: new Date("2024-12-21"), endDate: new Date("2025-01-05") } });
    await prisma.schoolHoliday.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Vacances de Pâques", type: "EASTER", startDate: new Date("2025-04-18"), endDate: new Date("2025-04-28") } });

    const calendarEvents = [
        { name: "Pré-rentrée des enseignants", type: "PRE_RENTREE", date: new Date("2024-09-12") },
        { name: "Rentrée des classes", type: "RENTREE", date: new Date("2024-09-16") },
        { name: "Fin du 1er trimestre", type: "FIN_TRIMESTRE", date: new Date("2024-12-20") },
        { name: "Conseil de classe 1er trimestre", type: "CONSEIL_CLASSE", date: new Date("2024-12-18") },
        { name: "Remise des bulletins", type: "REMISE_BULLETINS", date: new Date("2024-12-21") },
    ];
    for (const ev of calendarEvents) {
        await prisma.schoolCalendarEvent.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: ev.name, type: ev.type as any, startDate: ev.date, isAllDay: true, isPublic: true } });
    }
    console.log("   ✅ Calendrier scolaire créé\n");

    // 30. Analytics & Orientation
    console.log("📈 Création des analytics et données d'orientation...\n");
    for (const student of ctx.students) {
        const grades = ctx.gradesByStudent.get(student.profile.id) || [];
        const avgGrade = grades.length > 0 ? grades.reduce((a: number, b: number) => a + b, 0) / grades.length : randomGrade(student.scenario.gradeRange[0], student.scenario.gradeRange[1]);
        const performanceLevel = avgGrade >= 16 ? "EXCELLENT" : avgGrade >= 14 ? "VERY_GOOD" : avgGrade >= 12 ? "GOOD" : avgGrade >= 10 ? "AVERAGE" : avgGrade >= 8 ? "INSUFFICIENT" : "WEAK";
        const riskLevel = avgGrade >= 12 ? "NONE" : avgGrade >= 10 ? "LOW" : avgGrade >= 8 ? "MEDIUM" : "HIGH";

        const studentAnalytic = await prisma.studentAnalytics.create({ data: { studentId: student.profile.id, periodId: ctx.periods[0].id, academicYearId: ctx.academicYear1.id, generalAverage: avgGrade, classRank: randomInt(1, 30), classSize: 30, performanceLevel: performanceLevel as any, progressionRate: randomInt(-10, 15), consistencyRate: randomInt(60, 95), riskLevel: riskLevel as any, riskFactors: riskLevel !== "NONE" ? ["Notes en baisse", "Absences fréquentes"] : [] } });

        // Create SubjectPerformance for each subject
        for (const subject of ctx.subjects) {
            const variation = (Math.random() - 0.5) * 6;
            const subjectAvg = Math.max(2, Math.min(20, avgGrade + variation));
            await prisma.subjectPerformance.create({
                data: {
                    analyticsId: studentAnalytic.id,
                    subjectId: subject.id,
                    average: Math.round(subjectAvg * 100) / 100,
                    gradesCount: randomInt(3, 8),
                    minGrade: Math.max(0, Math.round((subjectAvg - 3 - Math.random() * 2) * 100) / 100),
                    maxGrade: Math.min(20, Math.round((subjectAvg + 3 + Math.random() * 2) * 100) / 100),
                    standardDev: Math.round((1 + Math.random() * 3) * 100) / 100,
                    isStrength: subjectAvg >= avgGrade + 2,
                    isWeakness: subjectAvg <= avgGrade - 2,
                    trend: randomElement(["INCREASE", "STABLE", "DECREASE", "STRONG_INCREASE"]) as any,
                    progressionRate: Math.round((Math.random() * 20 - 10) * 100) / 100,
                },
            });
        }

        if (student.class.levelName === "3ème") {
            const orientation = await prisma.studentOrientation.create({ data: { studentId: student.profile.id, academicYearId: ctx.academicYear1.id, classLevelId: student.class.level.id, status: randomElement(["PENDING", "ANALYZED", "RECOMMENDED"]) as any } });
            const series = avgGrade >= 14 ? ["SERIE_C", "SERIE_D"] : avgGrade >= 12 ? ["SERIE_D", "SERIE_B"] : ["SERIE_A1", "SERIE_G2"];
            for (let i = 0; i < series.length; i++) {
                await prisma.orientationRecommendation.create({ data: { orientationId: orientation.id, recommendedSeries: series[i] as any, rank: i + 1, score: randomInt(60, 95), justification: "Recommandation basée sur les performances", strengths: ["Bons résultats dans les matières principales"] } });
            }
        }
    }
    console.log("   ✅ Analytics et orientations créés\n");

    // 31. Audit Logs
    console.log("📋 Création des logs d'audit...\n");
    const auditActions = [
        { action: "CREATE", entity: "USER", description: "Création d'un utilisateur" },
        { action: "UPDATE", entity: "GRADE", description: "Modification d'une note" },
        { action: "DELETE", entity: "ATTENDANCE", description: "Suppression d'une présence" },
        { action: "LOGIN", entity: "SESSION", description: "Connexion utilisateur" },
    ];
    for (const log of auditActions) {
        await prisma.auditLog.create({ data: { userId: ctx.superAdmin.id, action: log.action, entity: log.entity, entityId: randomElement(ctx.students).profile.id, ipAddress: `192.168.1.${randomInt(1, 255)}` } });
    }
    console.log("   ✅ Logs d'audit créés\n");

    // 32. System Settings
    console.log("⚙️  Création des paramètres système...\n");
    await prisma.systemSetting.createMany({
        data: [
            { key: "app_name", value: "EduPilot", type: "string" },
            { key: "default_language", value: "fr", type: "string" },
            { key: "academic_year", value: "2024-2025", type: "string" },
            { key: "grading_scale", value: "20", type: "number" },
            { key: "passing_grade", value: "10", type: "number" },
            { key: "session_timeout", value: "3600", type: "number" },
            { key: "enable_sms_notifications", value: "true", type: "boolean" },
            { key: "enable_email_notifications", value: "true", type: "boolean" },
        ],
    });
    console.log("   ✅ Paramètres système créés\n");

    // 33. Library — Books & Borrowings
    console.log("📖 Création de la bibliothèque...\n");
    const booksData = [
        { title: "Mathématiques 6e - Nouveau Programme", author: "Éditions CEDA", category: "Manuels scolaires", isbn: "978-2-218-94851-1" },
        { title: "Mathématiques 5e - Nouveau Programme", author: "Éditions CEDA", category: "Manuels scolaires", isbn: "978-2-218-94852-8" },
        { title: "Mathématiques 4e - Nouveau Programme", author: "Éditions CEDA", category: "Manuels scolaires", isbn: "978-2-218-94853-5" },
        { title: "Mathématiques 3e - Nouveau Programme", author: "Éditions CEDA", category: "Manuels scolaires", isbn: "978-2-218-94854-2" },
        { title: "Français 6e - Grammaire et Expression", author: "Hatier", category: "Manuels scolaires", isbn: "978-2-218-95001-9" },
        { title: "Français 5e - Grammaire et Expression", author: "Hatier", category: "Manuels scolaires", isbn: "978-2-218-95002-6" },
        { title: "Français 4e - Grammaire et Expression", author: "Hatier", category: "Manuels scolaires", isbn: "978-2-218-95003-3" },
        { title: "Français 3e - Grammaire et Expression", author: "Hatier", category: "Manuels scolaires", isbn: "978-2-218-95004-0" },
        { title: "Physique-Chimie Collège", author: "Bordas", category: "Manuels scolaires", isbn: "978-2-047-35621-4" },
        { title: "SVT - Sciences de la Vie et de la Terre", author: "Nathan", category: "Manuels scolaires", isbn: "978-2-091-72345-8" },
        { title: "L'Aventure ambiguë", author: "Cheikh Hamidou Kane", category: "Littérature africaine", isbn: "978-2-264-03619-7" },
        { title: "L'Enfant noir", author: "Camara Laye", category: "Littérature africaine", isbn: "978-2-266-02362-2" },
        { title: "Sous l'orage", author: "Seydou Badian", category: "Littérature africaine", isbn: "978-2-7087-0165-4" },
        { title: "Le Vieux Nègre et la Médaille", author: "Ferdinand Oyono", category: "Littérature africaine", isbn: "978-2-264-04741-4" },
        { title: "Une si longue lettre", author: "Mariama Bâ", category: "Littérature africaine", isbn: "978-2-7236-1180-0" },
        { title: "Les Bouts de bois de Dieu", author: "Ousmane Sembène", category: "Littérature africaine", isbn: "978-2-266-16799-8" },
        { title: "Le Monde s'effondre", author: "Chinua Achebe", category: "Littérature africaine", isbn: "978-2-7427-6443-5" },
        { title: "Atlas du Bénin", author: "Éditions du Flamboyant", category: "Géographie", isbn: "978-2-911541-01-2" },
        { title: "Histoire du Dahomey", author: "Robert Cornevin", category: "Histoire", isbn: "978-2-7068-0423-7" },
        { title: "Dictionnaire Larousse Junior", author: "Larousse", category: "Références", isbn: "978-2-035-86201-5" },
        { title: "English Grammar in Use", author: "Raymond Murphy", category: "Langues", isbn: "978-1-108-45768-2" },
        { title: "Oxford Advanced Learner's Dictionary", author: "Oxford University Press", category: "Références", isbn: "978-0-194-79880-3" },
        { title: "Bescherelle - La conjugaison pour tous", author: "Hatier", category: "Références", isbn: "978-2-218-95192-4" },
        { title: "Philosophie Terminale", author: "Nathan", category: "Manuels scolaires", isbn: "978-2-091-72890-3" },
        { title: "Annales BEPC Bénin 2024", author: "Éditions Star", category: "Annales", isbn: "978-99919-0-456-7" },
    ];

    const books: any[] = [];
    for (const bookData of booksData) {
        const qty = randomInt(3, 15);
        const borrowed = randomInt(0, Math.min(qty - 1, 5));
        const book = await prisma.book.create({
            data: {
                schoolId: ctx.school1.id,
                title: bookData.title,
                author: bookData.author,
                isbn: bookData.isbn,
                category: bookData.category,
                description: `Ouvrage disponible à la bibliothèque du Collège Saint-Michel`,
                quantity: qty,
                available: qty - borrowed,
                location: randomElement(["Étagère A", "Étagère B", "Étagère C", "Étagère D", "Réserve"]),
            },
        });
        books.push(book);
    }

    // Create borrowing records
    let borrowingCount = 0;
    for (const student of ctx.students.slice(0, 80)) {
        const numBorrowings = randomInt(0, 3);
        for (let i = 0; i < numBorrowings; i++) {
            const book = randomElement(books);
            const borrowedAt = randomDate(new Date(2024, 8, 20), new Date(2024, 11, 15));
            const dueDate = new Date(borrowedAt);
            dueDate.setDate(dueDate.getDate() + 14);
            const isReturned = Math.random() < 0.6;

            await prisma.borrowingRecord.create({
                data: {
                    bookId: book.id,
                    studentId: student.profile.id,
                    borrowedAt,
                    dueDate,
                    returnedAt: isReturned ? randomDate(borrowedAt, new Date(Math.min(dueDate.getTime() + 7 * 86400000, Date.now()))) : null,
                    isPending: !isReturned,
                    fine: !isReturned && dueDate < new Date() ? randomInt(500, 2000) : null,
                },
            });
            borrowingCount++;
        }
    }
    console.log(`   ✅ ${books.length} livres et ${borrowingCount} emprunts créés\n`);

    // 34. Canteen Menus
    console.log("🍽️  Création des menus de cantine...\n");
    const mainCourses = ["Riz au gras avec poulet", "Pâte rouge avec sauce tomate", "Riz blanc avec sauce d'arachide", "Igname pilée avec sauce gombo", "Couscous de maïs avec sauce légumes", "Akassa avec sauce poisson", "Riz jollof avec poisson grillé", "Pâte noire avec crincrin", "Spaghetti bolognaise", "Riz cantonnais"];
    const sideDishes = ["Salade verte", "Plantain frit (alloco)", "Légumes sautés", "Haricots verts", "Betteraves râpées", null];
    const desserts = ["Fruit de saison (ananas)", "Yaourt nature", "Beignets sucrés", "Fruit de saison (mangue)", "Gâteau de semoule", null];
    const starters = ["Soupe de légumes", "Salade composée", "Crudités variées", null, null];

    let menuDate = new Date(2024, 8, 16); // Start from September 16
    let menuCount = 0;
    while (menuDate <= new Date(2025, 2, 28)) {
        if (menuDate.getDay() !== 0 && menuDate.getDay() !== 6) {
            const weekNum = Math.ceil((menuDate.getTime() - new Date(2024, 0, 1).getTime()) / (7 * 86400000));
            await prisma.canteenMenu.create({
                data: {
                    schoolId: ctx.school1.id,
                    date: menuDate,
                    weekNumber: weekNum,
                    starterName: randomElement(starters),
                    mainCourse: randomElement(mainCourses),
                    sideDish: randomElement(sideDishes),
                    dessert: randomElement(desserts),
                    vegetarian: Math.random() < 0.15,
                    allergens: Math.random() < 0.3 ? [randomElement(["Arachides", "Gluten", "Lait", "Poisson"])] : [],
                    priceStudent: 500,
                    priceStaff: 750,
                    isPublished: true,
                },
            });
            menuCount++;
        }
        menuDate = new Date(menuDate.getTime() + 86400000);
    }
    console.log(`   ✅ ${menuCount} menus de cantine créés\n`);

    // 35. Achievements & Gamification
    console.log("🏆 Création des achievements et gamification...\n");
    const achievementsData = [
        { code: "FIRST_LOGIN", name: "Première connexion", description: "Se connecter pour la première fois", points: 10, category: "Engagement" },
        { code: "PERFECT_ATTENDANCE_WEEK", name: "Semaine parfaite", description: "Être présent toute la semaine", points: 20, category: "Assiduité" },
        { code: "PERFECT_ATTENDANCE_MONTH", name: "Mois parfait", description: "Être présent tout le mois", points: 50, category: "Assiduité" },
        { code: "TOP_GRADE", name: "Note excellente", description: "Obtenir 18/20 ou plus à une évaluation", points: 30, category: "Académique" },
        { code: "TOP_3_CLASS", name: "Top 3 de la classe", description: "Être dans les 3 premiers de la classe", points: 50, category: "Académique" },
        { code: "HOMEWORK_STREAK_5", name: "5 devoirs rendus", description: "Rendre 5 devoirs consécutifs à temps", points: 25, category: "Travail" },
        { code: "LIBRARY_READER", name: "Lecteur assidu", description: "Emprunter 5 livres dans le trimestre", points: 30, category: "Culture" },
        { code: "GOOD_BEHAVIOR_MONTH", name: "Bon comportement", description: "Aucun incident sur un mois", points: 40, category: "Comportement" },
    ];

    const achievements: any[] = [];
    for (const achData of achievementsData) {
        const ach = await prisma.achievement.create({ data: achData });
        achievements.push(ach);
    }

    // Give some achievements to students
    let achievementCount = 0;
    for (const student of ctx.students) {
        const numAch = student.scenario.type === "excellent" ? randomInt(3, 6) : student.scenario.type === "tres_bon" ? randomInt(2, 4) : randomInt(0, 2);
        const shuffled = [...achievements].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(numAch, shuffled.length); i++) {
            await prisma.userAchievement.create({
                data: { userId: student.user.id, achievementId: shuffled[i].id, unlockedAt: randomDate(new Date(2024, 8, 16), new Date(2024, 11, 20)) },
            });
            achievementCount++;
        }
    }

    // Leaderboard
    let leaderboardCount = 0;
    for (const student of ctx.students) {
        const grades = ctx.gradesByStudent.get(student.profile.id) || [];
        const avgGrade = grades.length > 0 ? grades.reduce((a: number, b: number) => a + b, 0) / grades.length : 10;
        const points = Math.round(avgGrade * 10) + randomInt(0, 50);
        await prisma.leaderboard.create({
            data: { schoolId: ctx.school1.id, userId: student.user.id, points, period: "2024-T1" },
        });
        leaderboardCount++;
    }
    console.log(`   ✅ ${achievements.length} achievements, ${achievementCount} débloqués, ${leaderboardCount} entrées leaderboard\n`);
}
