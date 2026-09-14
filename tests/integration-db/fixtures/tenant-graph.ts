import prisma from "../owner-db";
import { uniqueCode } from "../helpers";

/**
 * Une école complète : une ligne de chaque ressource adressée par une route
 * `[id]` de l'API (balayage d'isolation du Lot 4). Valeurs minimales, clés
 * étrangères cohérentes (vérifiées sur le DMMF Prisma).
 */
export type TenantGraph = Awaited<ReturnType<typeof seedTenantGraph>>;

export async function seedTenantGraph(prefix: string) {
  const code = uniqueCode(prefix);
  const day = (d: string) => new Date(`${d}T08:00:00.000Z`);
  const email = (who: string) => `${uniqueCode(`${prefix}-${who}`)}@integration.test`.toLowerCase();

  const school = await prisma.school.create({ data: { name: `École ${code}`, code, level: "SECONDARY_COLLEGE" } });
  const schoolId = school.id;
  const user = (who: string, role: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT") =>
    prisma.user.create({ data: { email: email(who), password: "x", firstName: who, lastName: prefix, role, schoolId } });

  const admin = await user("admin", "SCHOOL_ADMIN");
  const teacherUser = await user("prof", "TEACHER");
  const studentUser = await user("eleve", "STUDENT");
  const parentUser = await user("parent", "PARENT");

  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
  const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, schoolId, matricule: uniqueCode("MAT") } });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id, updatedAt: new Date() } });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: student.id, relationship: "PARENT" } });

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: day("2025-09-01"), endDate: day("2026-07-31"), isCurrent: true },
  });
  const period = await prisma.period.create({
    data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: day("2025-09-01"), endDate: day("2025-12-20"), sequence: 1 },
  });
  const classLevel = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: classLevel.id, name: "6e A" } });
  await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id } });
  const subject = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const classSubject = await prisma.classSubject.create({ data: { classId: klass.id, subjectId: subject.id, teacherId: teacher.id } });
  const evaluationType = await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("DV") } });
  const evaluation = await prisma.evaluation.create({
    data: { classSubjectId: classSubject.id, periodId: period.id, typeId: evaluationType.id, date: day("2025-10-10") },
  });
  const grade = await prisma.grade.create({ data: { evaluationId: evaluation.id, studentId: student.id, value: 12 } });

  const fee = await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 50000 } });
  const payment = await prisma.payment.create({ data: { studentId: student.id, feeId: fee.id, amount: 10000, method: "CASH" } });
  const paymentPlan = await prisma.paymentPlan.create({ data: { studentId: student.id, feeId: fee.id, totalAmount: 50000 } });
  const installment = await prisma.installmentPayment.create({ data: { paymentPlanId: paymentPlan.id, amount: 25000, dueDate: day("2026-01-15") } });
  const scholarship = await prisma.scholarship.create({
    data: { studentId: student.id, name: "Bourse", type: "MERIT", amount: 10000, startDate: day("2025-09-01") },
  });

  const homework = await prisma.homework.create({
    data: { classSubjectId: classSubject.id, title: "Exercices", description: "p. 12", dueDate: day("2025-10-20") },
  });
  const submission = await prisma.homeworkSubmission.create({ data: { homeworkId: homework.id, studentId: student.id } });
  const message = await prisma.message.create({ data: { senderId: teacherUser.id, recipientId: parentUser.id, subject: "Suivi", content: "Bonjour" } });
  const notification = await prisma.notification.create({ data: { userId: admin.id, type: "INFO", title: "Info", message: "Texte" } });
  const resource = await prisma.resource.create({ data: { schoolId, title: "Cours", type: "LESSON", fileUrl: "/x.pdf", fileType: "pdf" } });
  const announcement = await prisma.announcement.create({ data: { schoolId, title: "Réunion", content: "Jeudi" } });
  const certificate = await prisma.certificate.create({ data: { studentId: student.id, type: "ENROLLMENT", certificateNumber: uniqueCode("CERT") } });
  const appointment = await prisma.appointment.create({
    data: { teacherId: teacher.id, parentId: parent.id, studentId: student.id, scheduledAt: day("2026-02-01") },
  });
  const availability = await prisma.teacherAvailability.create({ data: { teacherId: teacher.id, dayOfWeek: 1, startTime: "08:00", endTime: "10:00" } });
  const dataRequest = await prisma.dataAccessRequest.create({ data: { userId: studentUser.id, requestType: "EXPORT" } });
  const incident = await prisma.behaviorIncident.create({
    data: { studentId: student.id, incidentType: "LATE", date: day("2025-11-03"), description: "Retard" },
  });
  const medicalRecord = await prisma.medicalRecord.create({ data: { studentId: student.id } });
  const allergy = await prisma.allergy.create({ data: { medicalRecordId: medicalRecord.id, allergen: "Arachide", severity: "LOW" } });
  const vaccination = await prisma.vaccination.create({ data: { medicalRecordId: medicalRecord.id, vaccineName: "BCG", dateGiven: day("2015-01-01") } });
  const emergencyContact = await prisma.emergencyContact.create({
    data: { medicalRecordId: medicalRecord.id, name: "Tante", relationship: "Tante", phone: "+22997000000" },
  });
  const event = await prisma.schoolEvent.create({ data: { schoolId, title: "Kermesse", startDate: day("2026-05-01") } });
  const examTemplate = await prisma.examTemplate.create({ data: { classSubjectId: classSubject.id, title: "Examen", duration: 60 } });
  const examSession = await prisma.examSession.create({ data: { examTemplateId: examTemplate.id, studentId: student.id, totalPoints: 20 } });
  const course = await prisma.course.create({ data: { classSubjectId: classSubject.id, title: "Algèbre" } });
  const courseModule = await prisma.courseModule.create({ data: { courseId: course.id, title: "Module 1", order: 1 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: courseModule.id, title: "Leçon 1", content: "Contenu", order: 1 } });
  const holiday = await prisma.schoolHoliday.create({
    data: { schoolId, academicYearId: year.id, name: "Noël", type: "CHRISTMAS", startDate: day("2025-12-20"), endDate: day("2026-01-05") },
  });
  const orientation = await prisma.studentOrientation.create({ data: { studentId: student.id, academicYearId: year.id, classLevelId: classLevel.id } });
  const recommendation = await prisma.orientationRecommendation.create({
    data: { orientationId: orientation.id, recommendedSeries: "SERIE_A1", score: 12, justification: "Profil littéraire" },
  });
  const subjectCategory = await prisma.subjectCategory.create({ data: { schoolId, name: "Sciences", code: uniqueCode("SCI") } });
  const configOption = await prisma.configOption.create({ data: { schoolId, category: "room", code: uniqueCode("R"), label: "Salle 1" } });
  const importTemplate = await prisma.importTemplate.create({ data: { schoolId, name: "Modèle", type: "STUDENTS", mappings: {}, createdById: admin.id } });
  const communicationTemplate = await prisma.communicationTemplate.create({ data: { schoolId, name: "Relance", content: "Bonjour" } });
  const cagnotte = await prisma.cagnotte.create({ data: { schoolId, title: "Voyage", targetFcfa: BigInt(100000), deadline: day("2026-06-01") } });
  const wellbeingReport = await prisma.wellbeingReport.create({
    data: { schoolId, tag: "ANONYME", category: "Harcèlement", excerpt: "Signalement", severity: "P0" },
  });
  await prisma.fiscalYear.create({ data: { schoolId, label: uniqueCode("FY"), startDate: day("2026-01-01"), endDate: day("2026-12-31") } });
  const leave = await prisma.leaveRequest.create({ data: { schoolId, userId: teacherUser.id, type: "SICK", startDate: day("2026-02-02"), endDate: day("2026-02-04") } });
  const payroll = await prisma.payrollEntry.create({ data: { schoolId, userId: teacherUser.id, period: "2026-03", baseSalary: 150000, netAmount: 140000 } });
  const signature = await prisma.documentSignature.create({
    data: { schoolId, docType: "REPORT_CARD", docId: student.id, signerName: "Directeur", signerRole: "DIRECTOR", method: "DRAWN", contentHash: "0".repeat(64) },
  });
  const alumni = await prisma.alumni.create({ data: { schoolId, firstName: "Ancien", lastName: prefix, graduationYear: 2020 } });

  return {
    schoolId,
    adminId: admin.id,
    teacherUserId: teacherUser.id,
    teacherEmail: teacherUser.email,
    ids: {
      school: schoolId, subject: subject.id, alumni: alumni.id, class: klass.id, announcement: announcement.id,
      appointment: appointment.id, cagnotte: cagnotte.id, holiday: holiday.id, certificate: certificate.id,
      communicationTemplate: communicationTemplate.id, dataRequest: dataRequest.id, configOption: configOption.id,
      course: course.id, evaluationType: evaluationType.id, event: event.id, examTemplate: examTemplate.id,
      examSession: examSession.id, payment: payment.id, grade: grade.id, homework: homework.id, submission: submission.id,
      importTemplate: importTemplate.id, incident: incident.id, lesson: lesson.id, medicalRecord: medicalRecord.id,
      allergy: allergy.id, vaccination: vaccination.id, emergencyContact: emergencyContact.id, message: message.id,
      courseModule: courseModule.id, notification: notification.id, orientation: orientation.id,
      recommendation: recommendation.id, paymentPlan: paymentPlan.id, installment: installment.id, period: period.id,
      resource: resource.id, scholarship: scholarship.id, signature: signature.id, leave: leave.id, payroll: payroll.id,
      student: student.id, studentUser: studentUser.id, subjectCategory: subjectCategory.id, teacher: teacher.id,
      teacherUser: teacherUser.id, availability: availability.id, wellbeingReport: wellbeingReport.id,
    },
  };
}
