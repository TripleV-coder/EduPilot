/**
 * Script de seed rapide - Remplit les données essentielles
 * Version optimisée pour performance
 */

import prisma from '../src/lib/prisma';

async function seedEssentialData() {
  console.log('⚡ Début du seed rapide des données essentielles...\n');

  try {
    // 1. Évaluations et notes (rapide)
    console.log('📝 Création des évaluations et notes...');
    const classes = await prisma.class.findMany({ take: 5 }); // Seulement 5 classes
    const periods = await prisma.period.findMany();
    const evaluationTypes = await prisma.evaluationType.findMany({ take: 2 });
    const students = await prisma.studentProfile.findMany({ take: 50 }); // Seulement 50 étudiants

    let evaluationCount = 0;
    let gradeCount = 0;

    for (const cls of classes) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: cls.id },
        take: 3 // Seulement 3 matières par classe
      });

      for (const classSubject of classSubjects) {
        for (const period of periods) {
          for (const evalType of evaluationTypes) {
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
              const isAbsent = Math.random() < 0.1;
              
              try {
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
              } catch (e) {
                // L'étudiant n'est pas inscrit dans cette classe, ignorer
              }
            }
          }
        }
      }
    }

    console.log(`   ✅ ${evaluationCount} évaluations créées`);
    console.log(`   ✅ ${gradeCount} notes créées\n`);

    // 2. Présences (rapide)
    console.log('📌 Création des présences...');
    let attendanceCount = 0;
    const today = new Date();

    for (const cls of classes) {
      const enrollments = await prisma.enrollment.findMany({
        where: { classId: cls.id },
        take: 30
      });

      // Créer des présences pour les 30 derniers jours
      for (let daysAgo = 30; daysAgo > 0; daysAgo--) {
        const attendanceDate = new Date(today);
        attendanceDate.setDate(attendanceDate.getDate() - daysAgo);

        // Skip weekends
        if (attendanceDate.getDay() === 0 || attendanceDate.getDay() === 6) continue;

        for (const enrollment of enrollments) {
          const isAbsent = Math.random() < 0.05;
          const isExcused = isAbsent && Math.random() < 0.4;

          try {
            await prisma.attendance.create({
              data: {
                studentId: enrollment.studentId,
                classId: cls.id,
                recordedDate: attendanceDate,
                status: isAbsent ? 'ABSENT' : 'PRESENT',
                justificationNote: isExcused ? 'Congé autorisé' : null,
              }
            });

            attendanceCount++;
          } catch (e) {
            // Ignorer les doublons
          }
        }
      }
    }

    console.log(`   ✅ ${attendanceCount} enregistrements de présence créés\n`);

    // 3. Paiements (rapide)
    console.log('💰 Création des paiements...');
    let paymentCount = 0;

    const fees = await prisma.fee.findMany({ take: 3 });
    const students_payment = await prisma.studentProfile.findMany({ take: 50 });

    for (const student of students_payment) {
      for (const fee of fees) {
        if (Math.random() < 0.8) {
          const status = ['PENDING', 'VERIFIED', 'RECONCILED'][Math.floor(Math.random() * 3)];

          try {
            await prisma.payment.create({
              data: {
                studentId: student.id,
                feeId: fee.id,
                amount: fee.amount,
                method: Math.random() < 0.6 ? 'BANK_TRANSFER' : 'CASH',
                reference: `PAY-${Date.now()}-${Math.random()}`,
                status: status as any,
                paidAt: status !== 'PENDING' ? new Date() : null,
              }
            });

            paymentCount++;
          } catch (e) {
            // Ignorer
          }
        }
      }
    }

    console.log(`   ✅ ${paymentCount} paiements créés\n`);

    // 4. Incidents (rapide)
    console.log('⚠️ Création des incidents...');
    let incidentCount = 0;

    for (const student of students_payment.slice(0, 20)) {
      if (Math.random() < 0.4) {
        try {
          await prisma.incident.create({
            data: {
              studentId: student.id,
              type: ['TARDINESS', 'ABSENCE', 'MISCONDUCT'][Math.floor(Math.random() * 3)],
              description: 'Incident enregistré',
              severity: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
              reportedAt: new Date(),
            }
          });

          incidentCount++;
        } catch (e) {
          // Ignorer
        }
      }
    }

    console.log(`   ✅ ${incidentCount} incidents créés\n`);

    // 5. Messages (rapide)
    console.log('💬 Création des messages...');
    let messageCount = 0;

    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER' },
      take: 3
    });

    const parents = await prisma.user.findMany({
      where: { role: 'PARENT' },
      take: 10
    });

    for (const teacher of teachers) {
      for (const parent of parents.slice(0, 3)) {
        try {
          await prisma.message.create({
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
        } catch (e) {
          // Ignorer
        }
      }
    }

    console.log(`   ✅ ${messageCount} messages créés\n`);

    // 6. Notifications (rapide)
    console.log('🔔 Création des notifications...');
    let notificationCount = 0;

    const users = await prisma.user.findMany({ take: 50 });

    for (const user of users) {
      try {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: ['GRADE', 'PAYMENT', 'ATTENDANCE', 'MESSAGE'][Math.floor(Math.random() * 4)],
            title: 'Nouvelle notification',
            message: 'Vous avez une mise à jour',
            isRead: Math.random() < 0.7,
          }
        });

        notificationCount++;
      } catch (e) {
        // Ignorer
      }
    }

    console.log(`   ✅ ${notificationCount} notifications créées\n`);

    // Rapport final
    console.log('='.repeat(60));
    console.log('✅ SEED RAPIDE TERMINÉ AVEC SUCCÈS!\n');
    console.log('📊 RÉSUMÉ:');
    console.log(`   - ${evaluationCount} évaluations`);
    console.log(`   - ${gradeCount} notes`);
    console.log(`   - ${attendanceCount} présences`);
    console.log(`   - ${paymentCount} paiements`);
    console.log(`   - ${incidentCount} incidents`);
    console.log(`   - ${messageCount} messages`);
    console.log(`   - ${notificationCount} notifications`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedEssentialData();