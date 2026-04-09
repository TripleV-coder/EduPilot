import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Session } from "next-auth";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

export type TenantGuardResult = NextResponse | null;

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function requireSchoolContext(session: Session): TenantGuardResult {
  if (session.user.role === "SUPER_ADMIN") return null;
  if (!getActiveSchoolId(session)) {
    return forbidden("Aucun établissement associé à ce compte");
  }
  return null;
}

export function ensureSchoolMatch(session: Session, schoolId: string | null, notFoundMsg = "Ressource introuvable") {
  if (session.user.role === "SUPER_ADMIN") return null;
  if (!schoolId) return notFound(notFoundMsg);
  if (!canAccessSchool(session, schoolId)) return forbidden("Accès refusé à cet établissement");
  return null;
}

// --- Model-specific school ownership lookup ---

async function schoolFromGrade(id: string) {
  const row = await prisma.grade.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromMessage(id: string) {
  const row = await prisma.message.findUnique({
    where: { id },
    select: { sender: { select: { schoolId: true } }, recipient: { select: { schoolId: true } } },
  });
  return row?.sender?.schoolId ?? row?.recipient?.schoolId ?? null;
}

async function schoolFromIncident(id: string) {
  const row = await prisma.behaviorIncident.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromSanction(id: string) {
  const row = await prisma.sanction.findUnique({
    where: { id },
    select: { incident: { select: { student: { select: { schoolId: true } } } } },
  });
  return row?.incident?.student?.schoolId ?? null;
}

async function schoolFromMedicalRecord(id: string) {
  const row = await prisma.medicalRecord.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromAppointment(id: string) {
  const row = await prisma.appointment.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromCertificate(id: string) {
  const row = await prisma.certificate.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromHomework(id: string) {
  const row = await prisma.homework.findUnique({
    where: { id },
    select: { classSubject: { select: { class: { select: { schoolId: true } } } } },
  });
  return row?.classSubject?.class?.schoolId ?? null;
}

async function schoolFromClass(id: string) {
  const row = await prisma.class.findUnique({
    where: { id },
    select: { schoolId: true },
  });
  return row?.schoolId ?? null;
}

async function schoolFromHomeworkSubmission(id: string) {
  const row = await prisma.homeworkSubmission.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromPaymentPlan(id: string) {
  const row = await prisma.paymentPlan.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromInstallmentPayment(id: string) {
  const row = await prisma.installmentPayment.findUnique({
    where: { id },
    select: { paymentPlan: { select: { student: { select: { schoolId: true } } } } },
  });
  return row?.paymentPlan?.student?.schoolId ?? null;
}

async function schoolFromAttendance(id: string) {
  const row = await prisma.attendance.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } }, class: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? row?.class?.schoolId ?? null;
}

async function schoolFromScholarship(id: string) {
  const row = await prisma.scholarship.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromCourse(id: string) {
  const row = await prisma.course.findUnique({
    where: { id },
    select: { classSubject: { select: { class: { select: { schoolId: true } } } } },
  });
  return row?.classSubject?.class?.schoolId ?? null;
}

async function schoolFromLesson(id: string) {
  const row = await prisma.lesson.findUnique({
    where: { id },
    select: { module: { select: { course: { select: { classSubject: { select: { class: { select: { schoolId: true } } } } } } } } },
  });
  return row?.module?.course?.classSubject?.class?.schoolId ?? null;
}

async function schoolFromModule(id: string) {
  const row = await prisma.courseModule.findUnique({
    where: { id },
    select: { course: { select: { classSubject: { select: { class: { select: { schoolId: true } } } } } } },
  });
  return row?.course?.classSubject?.class?.schoolId ?? null;
}

async function schoolFromEvent(id: string) {
  const row = await prisma.schoolEvent.findUnique({
    where: { id },
    select: { schoolId: true },
  });
  return row?.schoolId ?? null;
}

async function schoolFromExam(id: string) {
  const row = await prisma.examSession.findUnique({
    where: { id },
    select: { student: { select: { schoolId: true } } },
  });
  return row?.student?.schoolId ?? null;
}

async function schoolFromExamTemplate(id: string) {
  const row = await prisma.examTemplate.findUnique({
    where: { id },
    select: { classSubject: { select: { class: { select: { schoolId: true } } } } },
  });
  return row?.classSubject?.class?.schoolId ?? null;
}

async function schoolFromResource(id: string) {
  const row = await prisma.resource.findUnique({
    where: { id },
    select: { schoolId: true },
  });
  return row?.schoolId ?? null;
}

async function schoolFromNotification(id: string) {
  const row = await prisma.notification.findUnique({
    where: { id },
    select: { user: { select: { schoolId: true } } },
  });
  return row?.user?.schoolId ?? null;
}

const modelSchoolResolvers: Record<string, (id: string) => Promise<string | null>> = {
  grade: schoolFromGrade,
  message: schoolFromMessage,
  incident: schoolFromIncident,
  sanction: schoolFromSanction,
  medicalRecord: schoolFromMedicalRecord,
  appointment: schoolFromAppointment,
  certificate: schoolFromCertificate,
  homework: schoolFromHomework,
  class: schoolFromClass,
  homeworkSubmission: schoolFromHomeworkSubmission,
  paymentPlan: schoolFromPaymentPlan,
  installmentPayment: schoolFromInstallmentPayment,
  attendance: schoolFromAttendance,
  scholarship: schoolFromScholarship,
  course: schoolFromCourse,
  lesson: schoolFromLesson,
  module: schoolFromModule,
  event: schoolFromEvent,
  examSession: schoolFromExam,
  examTemplate: schoolFromExamTemplate,
  resource: schoolFromResource,
  notification: schoolFromNotification,
};

export async function assertModelAccess(
  session: Session,
  model: keyof typeof modelSchoolResolvers,
  id: string,
  notFoundMsg = "Ressource introuvable"
): Promise<TenantGuardResult> {
  if (session.user.role === "SUPER_ADMIN") return null;
  if (!getActiveSchoolId(session)) return forbidden("Aucun établissement associé à ce compte");

  const resolver = modelSchoolResolvers[model];
  if (!resolver) return forbidden("Accès refusé à cet établissement");

  const schoolId = await resolver(id);
  if (!schoolId) return notFound(notFoundMsg);
  if (!canAccessSchool(session, schoolId)) return forbidden("Accès refusé à cet établissement");
  return null;
}
