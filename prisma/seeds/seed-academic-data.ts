/**
 * Seed Academic Data — Grades, Attendance, Homework, Behavior, Medical, Finance
 * Sections 12-17 of the original seed.ts
 */

import {
    prisma,
    SeedContext,
    randomDate,
    randomElement,
    randomGrade,
    randomInt,
    generatePhone,
} from "./utils";

export async function seedAcademicData(ctx: SeedContext): Promise<void> {
    // 12. Evaluations & Grades
    console.log("📊 Création des évaluations et notes...\n");

    for (const cs of ctx.classSubjects) {
        const classStudents = ctx.students.filter((s: any) => s.class.id === cs.class.id);

        for (const period of ctx.periods) {
            const evaluationsForPeriod = [
                { title: `Composition ${cs.subject.name} - ${period.name}`, type: ctx.evalTypes[1], weight: 3 },
                { title: `DS 1 ${cs.subject.name}`, type: ctx.evalTypes[0], weight: 1 },
                { title: `DS 2 ${cs.subject.name}`, type: ctx.evalTypes[0], weight: 1 },
                { title: `IE ${cs.subject.name}`, type: ctx.evalTypes[2], weight: 0.5 },
            ];

            for (const evalData of evaluationsForPeriod) {
                const evaluation = await prisma.evaluation.create({
                    data: {
                        classSubjectId: cs.id,
                        periodId: period.id,
                        typeId: evalData.type.id,
                        title: evalData.title,
                        date: randomDate(new Date(period.startDate), new Date(period.endDate)),
                        maxGrade: 20,
                        coefficient: evalData.weight,
                    },
                });

                for (const student of classStudents) {
                    const [minGrade, maxGrade] = student.scenario.gradeRange;
                    let gradeValue = randomGrade(minGrade, maxGrade);

                    if (Math.random() < 0.1) gradeValue = Math.max(0, gradeValue - randomInt(2, 4));
                    else if (Math.random() < 0.1) gradeValue = Math.min(20, gradeValue + randomInt(1, 3));

                    const isAbsent = Math.random() < (100 - student.scenario.attendanceRate) / 100 * 0.1;

                    await prisma.grade.create({
                        data: {
                            evaluationId: evaluation.id,
                            studentId: student.profile.id,
                            value: isAbsent ? null : gradeValue,
                            isAbsent,
                            isExcused: isAbsent && Math.random() < 0.5,
                            comment: gradeValue >= 16 ? "Excellent travail" :
                                gradeValue >= 14 ? "Très bien" :
                                    gradeValue >= 12 ? "Bon travail" :
                                        gradeValue < 8 ? "Des efforts à fournir" : null,
                        },
                    });

                    if (!isAbsent) {
                        const existing = ctx.gradesByStudent.get(student.profile.id) || [];
                        existing.push(gradeValue);
                        ctx.gradesByStudent.set(student.profile.id, existing);
                    }
                    ctx.totalGrades++;
                }
            }
        }
    }
    console.log(`   ✅ ${ctx.totalGrades} notes créées\n`);

    // 13. Attendance
    console.log("📅 Création des enregistrements de présence...\n");
    let totalAttendance = 0;
    const schoolDays: Date[] = [];
    for (let d = new Date(2024, 8, 16); d <= new Date(2024, 11, 20); d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) schoolDays.push(new Date(d));
    }

    for (const student of ctx.students) {
        const absenceRate = (100 - student.scenario.attendanceRate) / 100;
        const absenceDays = schoolDays.sort(() => Math.random() - 0.5).slice(0, Math.floor(schoolDays.length * absenceRate));

        for (const day of absenceDays) {
            const status = Math.random() < 0.3 ? "LATE" : "ABSENT";
            const isExcused = Math.random() < 0.4;
            await prisma.attendance.create({
                data: {
                    studentId: student.profile.id,
                    classId: student.class.id,
                    date: day,
                    status: isExcused ? "EXCUSED" : status as any,
                    reason: isExcused ? randomElement(["Maladie", "Rendez-vous médical", "Raison familiale", "Transport"]) : null,
                    recordedById: ctx.teachers[0].user.id,
                },
            });
            totalAttendance++;
        }
    }
    console.log(`   ✅ ${totalAttendance} enregistrements de présence créés\n`);

    // 14. Homework
    console.log("📝 Création des devoirs...\n");
    const homeworks: any[] = [];
    for (const cs of ctx.classSubjects.slice(0, 20)) {
        const hw = await prisma.homework.create({
            data: {
                classSubjectId: cs.id,
                title: `Devoir: ${randomElement(["Exercices du chapitre", "Dissertation", "Analyse de document", "Problèmes de révision", "Exposé à préparer", "Recherche documentaire", "Questions de cours"])}`,
                description: `Travail à rendre sur le thème ${cs.subject.name}.`,
                dueDate: randomDate(new Date(2024, 10, 1), new Date(2024, 11, 30)),
                maxGrade: 20,
                createdById: cs.teacher.user.id,
                isPublished: true,
            },
        });
        homeworks.push(hw);

        for (const student of ctx.students.filter((s: any) => s.class.id === cs.class.id)) {
            if (Math.random() < 0.7) {
                const [minG, maxG] = student.scenario.gradeRange;
                await prisma.homeworkSubmission.create({
                    data: {
                        homeworkId: hw.id,
                        studentId: student.profile.id,
                        content: "Veuillez trouver ci-joint mon travail pour ce devoir. J'ai essayé de développer au maximum les points demandés.",
                        submittedAt: new Date(),
                        grade: randomGrade(minG, maxG),
                        feedback: randomElement(["Bon travail", "À améliorer", "Excellent", "Bien", null]),
                        gradedAt: new Date(),
                        gradedById: cs.teacher.user.id,
                    },
                });
            }
        }
    }
    console.log(`   ✅ ${homeworks.length} devoirs créés avec soumissions\n`);

    // 15. Behavior Incidents & Sanctions
    console.log("⚠️  Création des incidents de comportement...\n");
    const incidentTypes = ["LATE", "ABSENCE_UNEXCUSED", "DISRUPTION", "DISRESPECT", "CHEATING", "DRESS_CODE"];
    const incidentSeverities = ["LOW", "MEDIUM", "HIGH"];
    let incidentCount = 0;

    for (const student of ctx.students) {
        const prob = (100 - student.scenario.behaviorScore) / 100;
        const numIncidents = Math.floor(Math.random() * 3 * prob);

        for (let i = 0; i < numIncidents; i++) {
            const incident = await prisma.behaviorIncident.create({
                data: {
                    studentId: student.profile.id,
                    incidentType: randomElement(incidentTypes) as any,
                    severity: randomElement(incidentSeverities) as any,
                    description: randomElement(["Retard répété en classe", "Bavardage pendant le cours", "Non-respect du règlement intérieur", "Perturbation du cours", "Oubli répété du matériel scolaire", "Comportement inapproprié en classe"]),
                    date: randomDate(new Date(2024, 8, 16), new Date(2024, 11, 20)),
                    location: randomElement(["Salle de classe", "Cour de récréation", "Cantine", "Couloir"]),
                    reportedById: randomElement(ctx.teachers).user.id,
                    isResolved: Math.random() < 0.7,
                    resolvedAt: Math.random() < 0.7 ? new Date() : null,
                },
            });
            incidentCount++;

            if (Math.random() < 0.5) {
                await prisma.sanction.create({
                    data: {
                        incidentId: incident.id,
                        type: randomElement(["WARNING", "DETENTION", "PARENT_CONFERENCE", "COUNSELING"]) as any,
                        description: "Suite à l'incident signalé",
                        startDate: new Date(),
                        isServed: Math.random() < 0.8,
                        assignedById: ctx.director1.id,
                    },
                });
            }
        }
    }
    console.log(`   ✅ ${incidentCount} incidents de comportement créés\n`);

    // 16. Medical Records
    console.log("🏥 Création des dossiers médicaux...\n");
    const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const allergens = ["Arachides", "Lait", "Oeufs", "Gluten", "Poussière", "Pollen", "Pénicilline"];
    const vaccines = ["BCG", "Polio", "DTC", "Rougeole", "Fièvre jaune", "Hépatite B", "Méningite"];

    for (const student of ctx.students) {
        if (Math.random() < 0.6) {
            const medicalRecord = await prisma.medicalRecord.create({
                data: {
                    studentId: student.profile.id,
                    bloodType: randomElement(bloodTypes),
                    medicalHistory: Math.random() < 0.3 ? randomElement(["Asthme léger", "Porteur de lunettes", "Diabète type 1", "Aucun antécédent particulier"]) : null,
                    medications: Math.random() < 0.2 ? [randomElement(["Ventoline", "Insuline", "Antihistaminique"])] : [],
                    notes: "Dossier médical à jour",
                },
            });
            ctx.medicalCount++;

            if (Math.random() < 0.2) {
                await prisma.allergy.create({
                    data: { medicalRecordId: medicalRecord.id, allergen: randomElement(allergens), severity: randomElement(["MILD", "MODERATE", "SEVERE"]), reaction: randomElement(["Éruption cutanée", "Difficultés respiratoires", "Gonflement"]), treatment: "Antihistaminique en cas de réaction" },
                });
            }

            for (let i = 0; i < randomInt(3, 7); i++) {
                await prisma.vaccination.create({
                    data: { medicalRecordId: medicalRecord.id, vaccineName: vaccines[i % vaccines.length], dateGiven: randomDate(new Date(2010, 0, 1), new Date(2024, 0, 1)), administeredBy: "Centre de santé communal", batchNumber: `VAC${randomInt(1000, 9999)}` },
                });
            }

            for (const parent of student.parents) {
                await prisma.emergencyContact.create({
                    data: { medicalRecordId: medicalRecord.id, name: `${parent.userId}`, relationship: parent === student.parents[0] ? "Père" : "Mère", phone: await generatePhone(), isPrimary: parent === student.parents[0] },
                });
            }
        }
    }
    console.log(`   ✅ ${ctx.medicalCount} dossiers médicaux créés\n`);

    // 17. Fees & Payments
    console.log("💰 Création des frais et paiements...\n");
    const fees = await Promise.all([
        prisma.fee.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Scolarité Annuelle", description: "Frais de scolarité pour l'année 2024-2025", amount: 150000, dueDate: new Date(2024, 9, 31), isRequired: true } }),
        prisma.fee.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Frais d'Inscription", description: "Frais d'inscription nouveaux élèves", amount: 25000, dueDate: new Date(2024, 8, 15), isRequired: true } }),
        prisma.fee.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Frais de Bibliothèque", description: "Accès à la bibliothèque", amount: 5000, dueDate: new Date(2024, 9, 31), isRequired: false } }),
        prisma.fee.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Frais d'Examen", description: "Frais pour les examens officiels", amount: 10000, dueDate: new Date(2025, 3, 30), isRequired: true } }),
        prisma.fee.create({ data: { schoolId: ctx.school1.id, academicYearId: ctx.academicYear1.id, name: "Tenue Sportive", description: "Kit sportif de l'école", amount: 15000, dueDate: new Date(2024, 9, 31), isRequired: false } }),
    ]);

    for (let sIdx = 0; sIdx < ctx.students.length; sIdx++) {
        const student = ctx.students[sIdx];
        for (let fIdx = 0; fIdx < fees.length; fIdx++) {
            const fee = fees[fIdx];
            const hasPaid = fee.isRequired ? Math.random() < 0.8 : Math.random() < 0.5;
            if (hasPaid) {
                await prisma.payment.create({
                    data: { studentId: student.profile.id, feeId: fee.id, amount: fee.amount, paidAt: randomDate(new Date(2024, 8, 1), new Date(2024, 10, 30)), method: randomElement(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER"]) as any, status: "VERIFIED", reference: `PAY-${sIdx}-${fIdx}-${randomInt(10000, 99999)}` },
                });
                ctx.paymentCount++;
            }
        }
    }

    const excellentStudents = ctx.students.filter((s: any) => s.scenario.type === "excellent");
    for (const student of excellentStudents.slice(0, 5)) {
        await prisma.scholarship.create({
            data: { studentId: student.profile.id, name: "Bourse d'excellence", type: "MERIT", amount: 50000, percentage: 30, startDate: new Date(2024, 8, 16), endDate: new Date(2025, 7, 15), isActive: true, notes: "Attribuée pour excellents résultats académiques" },
        });
    }
    console.log(`   ✅ ${fees.length} frais et ${ctx.paymentCount} paiements créés\n`);
}
