/**
 * Script de seed minimal - Remplissage rapide des données essentielles
 */

import prisma from '../src/lib/prisma';

async function seedMinimalData() {
  console.log('⚡ Seed minimaliste rapide en cours...\n');

  try {
    // 1. Créer quelques évaluations et notes
    console.log('📝 Évaluations et notes...');
    const cls = await prisma.class.findFirst();
    const period = await prisma.period.findFirst();
    const evalType = await prisma.evaluationType.findFirst();
    const students = await prisma.studentProfile.findMany({ take: 20 });

    if (cls && period && evalType) {
      const classSubject = await prisma.classSubject.findFirst({
        where: { classId: cls.id }
      });

      if (classSubject) {
        const evaluation = await prisma.evaluation.create({
          data: {
            classSubjectId: classSubject.id,
            periodId: period.id,
            typeId: evalType.id,
            title: 'Évaluation Test',
            date: new Date(),
            maxGrade: 20,
            coefficient: 1,
          }
        });

        let gradesCreated = 0;
        for (const student of students) {
          try {
            await prisma.grade.create({
              data: {
                evaluationId: evaluation.id,
                studentId: student.id,
                value: Math.floor(Math.random() * 20) + 1,
                isAbsent: false,
              }
            });
            gradesCreated++;
          } catch (e) {
            // Ignorer
          }
        }
        console.log(`   ✅ 1 évaluation + ${gradesCreated} notes\n`);
      }
    }

    // 2. Présences
    console.log('📌 Présences...');
    let attendanceCount = 0;
    const today = new Date();
    
    for (const student of students.slice(0, 10)) {
      const cls = await prisma.class.findFirst();
      if (cls) {
        for (let i = 1; i <= 10; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          
          try {
            await prisma.attendance.create({
              data: {
                studentId: student.id,
                classId: cls.id,
                recordedDate: date,
                status: Math.random() < 0.9 ? 'PRESENT' : 'ABSENT',
              }
            });
            attendanceCount++;
          } catch (e) {
            // Ignorer
          }
        }
      }
    }
    console.log(`   ✅ ${attendanceCount} présences\n`);

    // 3. Paiements
    console.log('💰 Paiements...');
    let paymentCount = 0;
    const fee = await prisma.fee.findFirst();

    if (fee) {
      for (const student of students.slice(0, 15)) {
        try {
          await prisma.payment.create({
            data: {
              studentId: student.id,
              feeId: fee.id,
              amount: fee.amount,
              method: 'CASH',
              status: 'VERIFIED',
              paidAt: new Date(),
              reference: `PAY-${Date.now()}-${Math.random()}`,
            }
          });
          paymentCount++;
        } catch (e) {
          // Ignorer
        }
      }
    }
    console.log(`   ✅ ${paymentCount} paiements\n`);

    // 4. Incidents
    console.log('⚠️ Incidents...');
    let incidentCount = 0;

    for (const student of students.slice(0, 5)) {
      try {
        await prisma.incident.create({
          data: {
            studentId: student.id,
            type: 'ABSENCE',
            description: 'Absence non justifiée',
            severity: 'LOW',
            reportedAt: new Date(),
          }
        });
        incidentCount++;
      } catch (e) {
        // Ignorer
      }
    }
    console.log(`   ✅ ${incidentCount} incidents\n`);

    // 5. Messages
    console.log('💬 Messages...');
    let messageCount = 0;
    const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
    const parent = await prisma.user.findFirst({ where: { role: 'PARENT' } });

    if (teacher && parent) {
      try {
        await prisma.message.create({
          data: {
            senderId: teacher.id,
            recipientId: parent.id,
            subject: 'Suivi académique',
            content: 'Votre enfant progresse bien',
            isRead: false,
          }
        });
        messageCount++;
      } catch (e) {
        // Ignorer
      }
    }
    console.log(`   ✅ ${messageCount} messages\n`);

    // 6. Notifications
    console.log('🔔 Notifications...');
    let notificationCount = 0;

    for (const student of students.slice(0, 10)) {
      try {
        const user = await prisma.user.findFirst({
          where: { studentProfiles: { some: { id: student.id } } }
        });

        if (user) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'GRADE',
              title: 'Nouvelle note',
              message: 'Une note a été enregistrée',
            }
          });
          notificationCount++;
        }
      } catch (e) {
        // Ignorer
      }
    }
    console.log(`   ✅ ${notificationCount} notifications\n`);

    console.log('='.repeat(60));
    console.log('✅ SEED TERMINÉ AVEC SUCCÈS!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedMinimalData();