// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11).
// C3 : analyses lues avec les seuls champs utiles (plus d'élève complet ni de
// performances par matière) ; noms chargés pour les seuls élèves à risque.

import prisma from "@/lib/prisma";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { DASHBOARD_ANALYTICS_SELECT, loadAtRiskStudents } from "./queries";

export async function getTeacherDashboardData(userId: string, _schoolId: string, yearId: string) {
  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { userId } });
  if (!teacherProfile) throw new Error("Profil enseignant introuvable");

  const classSubjects = await prisma.classSubject.findMany({
    where: { teacherId: teacherProfile.id },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { name: true } },
    },
  });

  // Today's schedule for this teacher (Schedule.dayOfWeek: 0=Sunday … 6=Saturday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const classSubjectIds = classSubjects.map((cs) => cs.id);
  const todayScheduleRaw = classSubjectIds.length
    ? await prisma.schedule.findMany({
        where: { classSubjectId: { in: classSubjectIds }, dayOfWeek },
        include: {
          class: { select: { name: true } },
          classSubject: {
            select: {
              subject: { select: { name: true } },
            },
          },
        },
        orderBy: { startTime: "asc" },
      })
    : [];

  const parseHHMM = (t: string): number => {
    const [h, m] = t.split(":").map((v) => Number(v) || 0);
    return h * 60 + m;
  };

  const todaySchedule = todayScheduleRaw.map((slot) => {
    const start = parseHHMM(slot.startTime);
    const end = parseHHMM(slot.endTime);
    let state: "done" | "now" | "next" = "next";
    if (currentMinutes >= end) state = "done";
    else if (currentMinutes >= start && currentMinutes < end) state = "now";
    return {
      id: slot.id,
      time: `${slot.startTime} — ${slot.endTime}`,
      className: slot.class.name,
      subjectName: slot.classSubject?.subject.name ?? "Cours",
      room: slot.room ?? "—",
      state,
    };
  });

  const classIds = [...new Set(classSubjects.map(cs => cs.classId))];
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds }, academicYearId: yearId, status: "ACTIVE" },
    select: { studentId: true, classId: true, class: { select: { name: true } } },
  });

  const studentIds = enrollments.map(e => e.studentId);
  const analytics = await prisma.studentAnalytics.findMany({
    where: { academicYearId: yearId, studentId: { in: studentIds } },
    select: DASHBOARD_ANALYTICS_SELECT,
  });

  const currentAnalytics = dedupeLatestAnalyticsByStudent(analytics);
  const scoredCurrentAnalytics = currentAnalytics.filter(item => item.generalAverage !== null);
  const classAverage = scoredCurrentAnalytics.length > 0
    ? scoredCurrentAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / scoredCurrentAnalytics.length
    : 0;

  const classStudentMap: Record<string, { name: string; studentIds: Set<string> }> = {};
  for (const enr of enrollments) {
    if (!classStudentMap[enr.classId]) {
      classStudentMap[enr.classId] = { name: enr.class.name, studentIds: new Set() };
    }
    classStudentMap[enr.classId].studentIds.add(enr.studentId);
  }

  const classPerformance = Object.values(classStudentMap).map(cls => {
    const clsAnalytics = currentAnalytics.filter(a => cls.studentIds.has(a.studentId) && a.generalAverage !== null);
    const avg = clsAnalytics.length > 0
      ? clsAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / clsAnalytics.length
      : 0;
    return { name: cls.name, average: roundTo(avg) };
  });

  const periods = await prisma.period.findMany({
    where: { academicYearId: yearId },
    orderBy: { sequence: "asc" },
  });

  const monthlyTrend = periods.map(period => {
    const periodAnalytics = analytics.filter(a => a.periodId === period.id && a.generalAverage !== null);
    const avg = periodAnalytics.length > 0
      ? periodAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / periodAnalytics.length
      : 0;
    return { name: period.name, value: roundTo(avg) };
  });

  return {
    myClasses: classIds.length,
    myStudents: studentIds.length,
    classAverage: roundTo(classAverage),
    classPerformance,
    monthlyTrend,
    atRiskStudents: await loadAtRiskStudents(currentAnalytics, yearId),
    todaySchedule,
  };
}
