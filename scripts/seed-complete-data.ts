/**
 * Script de seed complet - Remplit les données manquantes
 * Run with: npx tsx scripts/seed-complete-data.ts
 */

import prisma from '../src/lib/prisma';

async function seedCompleteData() {
  console.log('🌱 Début du seed complet de données...\n');

  try {
    // 1. Créer les évaluations et notes
    console.log('📝 Création des évaluations et notes...');
    const classes = await prisma.class.findMany({
      include: {
        classSubjects: { include: { subject: true } }
      }
    });

    const periods = await prisma.period.findMany();
    const evaluationTypes = await prisma.evaluationType.findMany();
    const students = await prisma.studentProfile.findMany({ take: 100 });

    let evaluationCount = 0;
    let gradeCount = 0;

    for (const cls of classes) {
      for (const classSubject of cls.classSubjects) {
        for (const period of periods) {
          for (const evalType of evaluationTypes.slice(0, 2)) {
            const evaluation = await prisma.evaluation.create({
              data: {
                classSubjectId: classSubject.id,
                periodId: period.id,
                typeId: evalType.id,
                title: `${evalType.name} - ${period.name}`,
                date: new Date(period.startDate.getTime() + Math.random() * (period.endDate.getTime() - period.startDate.getTime())),
                maxGrade: 20,
                coefficient: 1,
              }
            });

            evaluationCount++;

            // Ajouter des notes pour chaque étudiant
            for (const student of students) {
              const enrollment = await prisma.enrollment.findFirst({
                where: {
                  studentId: student.id,
                  class: { id: cls.id }
                }
              });

              if (enrollment) {
                const isAbsent = Math.random() < 0.1; // 10% absent
                
                await prisma.grade.create({
                  data: {
                    evaluationId: evaluation.id,
                    studentId: student.id,
                    value: isAbsent ? null : Math.floor(Math.random() * 20) + 1,
                    isAbsent: isAbsent,
                    isExcused: isAbsent && Math.random() < 0.3,
                  }
                });

                gradeCount++;
              }
            }
          }
        }
      }
    }

    console.log(`   ✅ ${evaluationCount} évaluations créées`);
    console.log(`   ✅ ${gradeCount} notes créées\n`);

    // 2. Remplir les présences
    console.log('📌 Création des présences...');
    let attendanceCount = 0;

    for (const cls of classes) {
      const enrollments = await prisma.enrollment.findMany({
        where: { classId: cls.id }
      });

      // Créer des présences pour les 180 derniers jours
      const today = new Date();
      for (let daysAgo = 180; daysAgo > 0; daysAgo--) {
        const attendanceDate = new Date(today);
        attendanceDate.setDate(attendanceDate.getDate() - daysAgo);

        // Random day of week (skip weekends sometimes)
        if (attendanceDate.getDay() === 0 || attendanceDate.getDay() === 6) continue;

        for (const enrollment of enrollments) {
          const isAbsent = Math.random() < 0.05; // 5% absent
          const isExcused = isAbsent && Math.random() < 0.4;

          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              studentId: enrollment.studentId,
              recordedDate: attendanceDate,
            }
          });

          if (!existingAttendance) {
            await prisma.attendance.create({
              data: {
                studentId: enrollment.studentId,
                classId: cls.id,
                recordedDate: attendanceDate,
                status: isAbsent ? 'ABSENT' : 'PRESENT',
                justificationNote: isExcused ? 'Congé autorisé' : null,
                recordedBy: null,
              }
            });

            attendanceCount++;
          }
        }
      }
    }

    console.log(`   ✅ ${attendanceCount} enregistrements de présence créés\n`);

    // 3. Créer les paiements
    console.log('💰 Création des paiements...');
    let paymentCount = 0;

    const fees = await prisma.fee.findMany({ take: 5 });
    const students_payment = await prisma.studentProfile.findMany({ take: 100 });

    for (const student of students_payment) {
      for (const fee of fees) {
        const hasPayment = Math.random() < 0.8; // 80% ont payé

        if (hasPayment) {
          const status = Math.random() < 0.7 ? 'VERIFIED' : Math.random() < 0.5 ? 'PENDING' : 'RECONCILED';

          await prisma.payment.create({
            data: {
              studentId: student.id,
              feeId: fee.id,
              amount: fee.amount,
              method: Math.random() < 0.6 ? 'BANK_TRANSFER' : 'CASH',
              reference: `PAY-${Date.now()}-${Math.random()}`,
              status: status as any,
              paidAt: status !== 'PENDING' ? new Date() : null,
              notes: status === 'PENDING' ? 'En attente de confirmation' : undefined,
            }
          });

          paymentCount++;
        }
      }
    }

    console.log(`   ✅ ${paymentCount} paiements créés\n`);

    // 4. Ajouter des incidents et comportements
    console.log('⚠️ Création des incidents...');
    let incidentCount = 0;

    for (const student of students_payment.slice(0, 30)) {
      if (Math.random() < 0.3) { // 30% des étudiants ont des incidents
        const incident = await prisma.incident.create({
          data: {
            studentId: student.id,
            type: ['TARDINESS', 'ABSENCE', 'MISCONDUCT', 'OTHER'][Math.floor(Math.random() * 4)],
            description: 'Incident enregistré',
            severity: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
            reportedAt: new Date(),
            reportedBy: null,
            resolutionNote: Math.random() < 0.5 ? 'Résolu' : undefined,
          }
        });

        incidentCount++;
      }
    }

    console.log(`   ✅ ${incidentCount} incidents créés\n`);

    // 5. Ajouter des devoirs
    console.log('📚 Création des devoirs...');
    let homeworkCount = 0;

    for (const cls of classes) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: cls.id }
      });

      for (const cs of classSubjects.slice(0, 2)) {
        for (let i = 0; i < 3; i++) {
          const homework = await prisma.homework.create({
            data: {
              classSubjectId: cs.id,
              title: `Devoir ${i + 1}`,
              description: 'Description du devoir',
              dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
            }
          });

          homeworkCount++;

          // Ajouter des soumissions
          for (const student of students.slice(0, 30)) {
            const enrollment = await prisma.enrollment.findFirst({
              where: { studentId: student.id, classId: cls.id }
            });

            if (enrollment && Math.random() < 0.7) {
              await prisma.homeworkSubmission.create({
                data: {
                  homeworkId: homework.id,
                  studentId: student.id,
                  submittedAt: new Date(),
                  content: 'Soumission du devoir',
                  grade: Math.floor(Math.random() * 20) + 1,
                  feedback: Math.random() < 0.5 ? 'Bon travail!' : undefined,
                }
              });
            }
          }
        }
      }
    }

    console.log(`   ✅ ${homeworkCount} devoirs créés\n`);

    // 6. Créer des messages
    console.log('💬 Création des messages...');
    let messageCount = 0;

    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER' },
      take: 5
    });

    const parents = await prisma.user.findMany({
      where: { role: 'PARENT' },
      take: 20
    });

    for (const teacher of teachers) {
      for (const parent of parents.slice(0, 5)) {
        const message = await prisma.message.create({
          data: {
            senderId: teacher.id,
            recipientId: parent.id,
            subject: 'Suivi scolaire',
            content: 'Message de suivi pour votre enfant',
            isRead: Math.random() < 0.6,
            readAt: Math.random() < 0.6 ? new Date() : null,
          }
        });

        messageCount++;
      }
    }

    console.log(`   ✅ ${messageCount} messages créés\n`);

    // 7. Créer des notifications
    console.log('🔔 Création des notifications...');
    let notificationCount = 0;

    const users = await prisma.user.findMany({ take: 100 });

    for (const user of users) {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: ['GRADE', 'PAYMENT', 'ATTENDANCE', 'MESSAGE'][Math.floor(Math.random() * 4)],
          title: 'Nouvelle notification',
          message: 'Vous avez une mise à jour',
          isRead: Math.random() < 0.7,
        }
      });

      notificationCount++;
    }

    console.log(`   ✅ ${notificationCount} notifications créées\n`);

    // Rapport final
    console.log('='.repeat(60));
    console.log('✅ SEED COMPLET TERMINÉ AVEC SUCCÈS!\n');
    console.log('📊 RÉSUMÉ:');
    console.log(`   - ${evaluationCount} évaluations`);
    console.log(`   - ${gradeCount} notes`);
    console.log(`   - ${attendanceCount} présences`);
    console.log(`   - ${paymentCount} paiements`);
    console.log(`   - ${incidentCount} incidents`);
    console.log(`   - ${homeworkCount} devoirs`);
    console.log(`   - ${messageCount} messages`);
    console.log(`   - ${notificationCount} notifications`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCompleteData();