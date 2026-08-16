import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { calculateWeightedAverage, getRank } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const COUNCIL_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

type Decision =
  | "Tableau d'honneur"
  | "Encouragements"
  | "Aucune"
  | "Avertissement travail"
  | "Avertissement conduite";
type DecisionVariant = "success" | "info" | "neutral" | "warning" | "danger";
type Status = "Validé" | "En discussion" | "À saisir";
type StatusVariant = "success" | "warning" | "neutral";

function pickDecision(avg: number | null, incidents: number): {
  decision: Decision;
  variant: DecisionVariant;
} {
  if (incidents >= 3) return { decision: "Avertissement conduite", variant: "danger" };
  if (avg === null) return { decision: "Aucune", variant: "neutral" };
  if (avg >= 16) return { decision: "Tableau d'honneur", variant: "success" };
  if (avg >= 14) return { decision: "Encouragements", variant: "info" };
  if (avg < 10) return { decision: "Avertissement travail", variant: "warning" };
  return { decision: "Aucune", variant: "neutral" };
}

function pickStatus(
  ratio: number,
  decisionVariant: DecisionVariant
): { status: Status; variant: StatusVariant } {
  if (ratio === 0) return { status: "À saisir", variant: "neutral" };
  if (ratio < 1) return { status: "En discussion", variant: "warning" };
  if (decisionVariant === "warning" || decisionVariant === "danger") {
    return { status: "En discussion", variant: "warning" };
  }
  return { status: "Validé", variant: "success" };
}

export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const periodId = searchParams.get("periodId");

    if (!classId || !periodId) {
      return NextResponse.json(
        { error: "classId et periodId sont requis" },
        { status: 400 }
      );
    }

    // Class context (school, level, subjects, main teacher)
    const klass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        classLevel: true,
        mainTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        classSubjects: {
          include: {
            subject: true,
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    if (!klass) {
      return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    }
    if (
      session.user.role !== "SUPER_ADMIN" &&
      klass.schoolId !== getActiveSchoolId(session)
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) {
      return NextResponse.json({ error: "Période non trouvée" }, { status: 404 });
    }

    // Roster (active enrollments) with grades for this period + incidents
    const enrollments = await prisma.enrollment.findMany({
      where: {
        classId,
        academicYearId: period.academicYearId,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            grades: {
              where: { evaluation: { periodId } },
              include: { evaluation: { include: { classSubject: true } } },
            },
            behaviorIncidents: {
              where: {
                date: { gte: period.startDate, lte: period.endDate },
              },
              select: { id: true, severity: true },
            },
          },
        },
      },
    });

    // Compute per-student averages + ranks
    const studentRows = enrollments.map((e) => {
      const studentGrades = e.student.grades;
      const subjectAverages: { csId: string; coefficient: number; average: number | null }[] = [];
      let subjectsWithGrades = 0;

      klass.classSubjects.forEach((cs) => {
        const subjectGrades = studentGrades.filter(
          (g) => g.evaluation.classSubjectId === cs.id
        );
        if (subjectGrades.length > 0) subjectsWithGrades += 1;
        const gradesData = subjectGrades.map((g) => ({
          value: g.value,
          coefficient: g.evaluation.coefficient,
          isAbsent: g.isAbsent,
          isExcused: g.isExcused,
        }));
        const avg = calculateWeightedAverage(gradesData);
        subjectAverages.push({
          csId: cs.id,
          coefficient: Number(cs.coefficient),
          average: avg,
        });
      });

      const valid = subjectAverages.filter((s) => s.average !== null);
      const generalAverage =
        valid.length > 0
          ? valid.reduce((sum, s) => sum + s.average! * s.coefficient, 0) /
            valid.reduce((sum, s) => sum + s.coefficient, 0)
          : null;

      const totalSubjects = klass.classSubjects.length || 1;
      const completionRatio = subjectsWithGrades / totalSubjects;
      const incidents = e.student.behaviorIncidents.length;

      const decision = pickDecision(generalAverage, incidents);
      const status = pickStatus(completionRatio, decision.variant);

      return {
        studentId: e.student.id,
        name: `${e.student.user.firstName} ${e.student.user.lastName}`,
        generalAverage,
        incidents,
        completionRatio,
        decision: decision.decision,
        decisionVariant: decision.variant,
        status: status.status,
        statusVariant: status.variant,
      };
    });

    const allAverages = studentRows.map((s) => s.generalAverage);
    const rankedRows = studentRows
      .map((row) => ({
        ...row,
        rank: getRank(row.generalAverage, allAverages),
      }))
      .sort((a, b) => {
        if (a.generalAverage === null) return 1;
        if (b.generalAverage === null) return -1;
        return b.generalAverage - a.generalAverage;
      });

    // Metrics
    const validAverages = allAverages.filter((a): a is number => a !== null);
    const totalCount = rankedRows.length;
    const bulletinsReady = rankedRows.filter(
      (r) => r.completionRatio === 1 && r.statusVariant === "success"
    ).length;
    const honors = rankedRows.filter(
      (r) => r.decision === "Tableau d'honneur"
    ).length;
    const encouragements = rankedRows.filter(
      (r) => r.decision === "Encouragements"
    ).length;
    const warnings = rankedRows.filter((r) =>
      r.decision.startsWith("Avertissement")
    ).length;

    // Class stats: avg, median, % ≥ 14, % < 10
    const avg =
      validAverages.length > 0
        ? validAverages.reduce((s, v) => s + v, 0) / validAverages.length
        : null;
    let median: number | null = null;
    if (validAverages.length > 0) {
      const sorted = [...validAverages].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median =
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    const pctAbove14 =
      totalCount > 0
        ? (validAverages.filter((v) => v >= 14).length / totalCount) * 100
        : 0;
    const pctBelow10 =
      totalCount > 0
        ? (validAverages.filter((v) => v < 10).length / totalCount) * 100
        : 0;

    // Participants: mainTeacher + distinct teachers of classSubjects
    const teacherMap = new Map<string, string>();
    if (klass.mainTeacher) {
      teacherMap.set(
        klass.mainTeacher.id,
        `${klass.mainTeacher.user.firstName} ${klass.mainTeacher.user.lastName}`
      );
    }
    klass.classSubjects.forEach((cs) => {
      if (cs.teacher) {
        teacherMap.set(
          cs.teacher.id,
          `${cs.teacher.user.firstName} ${cs.teacher.user.lastName}`
        );
      }
    });
    const participants = Array.from(teacherMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    // Upcoming council event (CalendarEventType CONSEIL_CLASSE) — schoolwide
    const nextCouncilEvent = await prisma.schoolCalendarEvent.findFirst({
      where: {
        schoolId: klass.schoolId,
        academicYearId: period.academicYearId,
        type: "CONSEIL_CLASSE",
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        description: true,
      },
    });

    // Decisions en attente: rows not validated
    const pendingDecisions = rankedRows
      .filter((r) => r.statusVariant !== "success")
      .map((r) => {
        let note = "Décision à saisir";
        if (r.status === "En discussion") {
          if (r.decision === "Avertissement conduite")
            note = "Entretien parents recommandé";
          else if (r.decision === "Avertissement travail")
            note = "Plan de remédiation à arrêter";
          else if (r.decision === "Encouragements")
            note = "Encouragements à confirmer après vote";
          else note = "Décision à finaliser";
        }
        return { studentId: r.studentId, name: r.name, note };
      });

    return NextResponse.json({
      class: {
        id: klass.id,
        name: klass.name,
        level: klass.classLevel.name,
        size: totalCount,
      },
      period: { id: period.id, name: period.name, sequence: period.sequence },
      metrics: {
        bulletinsReady,
        bulletinsTotal: totalCount,
        honors,
        encouragements,
        warnings,
      },
      stats: {
        average: avg,
        median,
        pctAbove14,
        pctBelow10,
      },
      participants,
      participantsExpected: participants.length,
      nextCouncilEvent,
      pendingDecisions,
      students: rankedRows,
    });
  } catch (error) {
    logger.error("generating class council:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du calcul du conseil de classe" },
      { status: 500 }
    );
  }

  },
  { allowedRoles: COUNCIL_ROLES },
);
