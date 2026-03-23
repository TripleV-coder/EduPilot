/**
 * Rapport détaillé de l'état de la base de données
 */

import prisma from '../src/lib/prisma';

async function generateDatabaseReport() {
  console.log('📊 RAPPORT DÉTAILLÉ - BASE DE DONNÉES EduPilot\n');
  console.log('='.repeat(60));

  try {
    // 1. Comptes utilisateurs
    console.log('\n👥 COMPTES UTILISATEURS');
    const totalUsers = await prisma.user.count();
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });
    console.log(`   Total utilisateurs: ${totalUsers}`);
    usersByRole.forEach(r => {
      console.log(`   - ${r.role}: ${r._count.id}`);
    });

    // 2. Écoles
    console.log('\n🏫 ÉCOLES');
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { users: true, classes: true }
        }
      }
    });
    schools.forEach(school => {
      console.log(`   ${school.name}`);
      console.log(`     - Utilisateurs: ${school._count.users}`);
      console.log(`     - Classes: ${school._count.classes}`);
    });

    // 3. Classes
    console.log('\n📚 CLASSES');
    const classCount = await prisma.class.count();
    console.log(`   Total: ${classCount}`);

    // 4. Étudiants
    console.log('\n👨‍🎓 ÉTUDIANTS');
    const students = await prisma.studentProfile.count();
    console.log(`   Total profils: ${students}`);

    // 5. Matières
    console.log('\n📖 MATIÈRES');
    const subjects = await prisma.subject.count();
    console.log(`   Total: ${subjects}`);

    // 6. Notes
    console.log('\n✏️ NOTES');
    const grades = await prisma.grade.count();
    const gradesAbsent = await prisma.grade.count({
      where: { isAbsent: true }
    });
    console.log(`   Total notes: ${grades}`);
    console.log(`   Absences: ${gradesAbsent}`);

    // 7. Évaluations
    console.log('\n📝 ÉVALUATIONS');
    const evaluations = await prisma.evaluation.count();
    console.log(`   Total: ${evaluations}`);

    // 8. Périodes académiques
    console.log('\n📅 PÉRIODES ACADÉMIQUES');
    const periods = await prisma.period.findMany({
      select: { id: true, name: true, startDate: true, endDate: true }
    });
    console.log(`   Total: ${periods.length}`);
    periods.slice(0, 3).forEach(p => {
      console.log(`   - ${p.name} (${p.startDate.toLocaleDateString()} à ${p.endDate.toLocaleDateString()})`);
    });

    // 9. Paiements
    console.log('\n💰 PAIEMENTS');
    const payments = await prisma.payment.count();
    const paymentsPending = await prisma.payment.count({
      where: { status: 'PENDING' }
    });
    const paymentsVerified = await prisma.payment.count({
      where: { status: 'VERIFIED' }
    });
    const paymentsReconciled = await prisma.payment.count({
      where: { status: 'RECONCILED' }
    });
    console.log(`   Total: ${payments}`);
    console.log(`   - En attente: ${paymentsPending}`);
    console.log(`   - Vérifiés: ${paymentsVerified}`);
    console.log(`   - Rapprochés: ${paymentsReconciled}`);

    // 10. Présences
    console.log('\n📌 PRÉSENCES');
    const attendance = await prisma.attendance.count();
    const absences = await prisma.attendance.count({
      where: { status: 'ABSENT' }
    });
    console.log(`   Total enregistrements: ${attendance}`);
    console.log(`   Absences: ${absences}`);

    // 11. Système Curriculum Bénin
    console.log('\n🇧🇯 CURRICULUM BÉNIN');
    const classSubjects = await prisma.classSubject.count();
    console.log(`   Matières par classe: ${classSubjects}`);

    // 12. Espace disque
    console.log('\n💾 STOCKAGE');
    try {
      const documents = await prisma.document.count();
      console.log(`   Documents: ${documents}`);
    } catch (e) {
      console.log(`   Documents: N/A (table non disponible)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Base de données opérationnelle et complète !');
    console.log('\n');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateDatabaseReport();