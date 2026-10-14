import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { competitionRank, meanOf, Rational, toDisplay } from "@/lib/academic/average-engine";
import { computeClassPeriod } from "@/lib/academic/class-averages";
import { getGradingSettings, getPassingGrade } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { getCouncilRules, pickDecision, type CouncilDecisionVariant } from "@/lib/academic/council-rules";

const COUNCIL_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

type DecisionVariant = CouncilDecisionVariant;
type Status = "Validé" | "En discussion" | "À saisir";
type StatusVariant = "success" | "warning" | "neutral";

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

    const [period, councilRules, schoolParams, passingGrade] = await Promise.all([
      prisma.period.findUnique({ where: { id: periodId } }),
      getCouncilRules(klass.schoolId),
      getSchoolParameters(klass.schoolId),
      getPassingGrade(klass.schoolId),
    ]);
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

    // Moyennes de la classe : module unique (formule officielle, coefficients
    // figés si le conseil est validé, notes « NC » exclues sans rien bloquer)
    const classPeriod = await computeClassPeriod({
      classId,
      periodId,
      academicYearId: period.academicYearId,
      classSubjects: klass.classSubjects.map((cs) => ({ id: cs.id, subjectId: cs.subjectId, coefficient: cs.coefficient })),
    });
    const studentRows = enrollments.map((e) => {
      const result = classPeriod.students.get(e.student.id);
      const generalAverage = result?.general ?? null;
      const totalSubjects = klass.classSubjects.length || 1;
      const subjectsWithGrades = klass.classSubjects.filter(
        (cs) => (result?.averages.subjects.get(cs.id) ?? null) !== null
      ).length;
      const completionRatio = subjectsWithGrades / totalSubjects;
      const incidents = e.student.behaviorIncidents.length;

      const decision = pickDecision(generalAverage, incidents, councilRules);
      const status = pickStatus(completionRatio, decision.variant);

      return {
        studentId: e.student.id,
        name: `${e.student.user.firstName} ${e.student.user.lastName}`,
        generalAverage,
        incidents,
        completionRatio,
        // Notes « NC » : information pour le professeur, sans blocage
        ncGrades: result?.averages.missing.length ?? 0,
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
        rank: classPeriod.students.get(row.studentId)?.rank ?? competitionRank(row.generalAverage, allAverages),
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

    // Statistiques de classe : moyenne, médiane, part au niveau « Très bien »
    // et part sous la moyenne de passage (seuils réglés par l'école)
    const highFrom = schoolParams.performance.veryGoodFrom;
    const avg = classPeriod.classGeneralAverage;
    let median: number | null = null;
    if (validAverages.length > 0) {
      const sorted = [...validAverages].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median =
        sorted.length % 2 === 0
          ? toDisplay(meanOf([Rational.from(sorted[mid - 1]), Rational.from(sorted[mid])]))
          : sorted[mid];
    }
    const pctAbove14 =
      totalCount > 0
        ? (validAverages.filter((v) => v >= highFrom).length / totalCount) * 100
        : 0;
    const pctBelow10 =
      totalCount > 0
        ? (validAverages.filter((v) => v < passingGrade).length / totalCount) * 100
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
        highFrom,
        passingGrade,
      },
      participants,
      participantsExpected: participants.length,
      nextCouncilEvent,
      pendingDecisions,
      // Conseil validé : notes figées (sauf réclamation approuvée), coefficients gelés
      councilValidated: classPeriod.councilValidated,
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

/** Validation du conseil de classe d'une période : réservée à la direction. */
const VALIDATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * POST /api/grades/councils — valide le conseil d'une classe pour une période.
 * Effets : les notes de la période sont figées (seule une réclamation approuvée
 * par le directeur des études peut encore les modifier) et les coefficients
 * appliqués sont gelés pour cette période.
 */
export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const body = (await request.json().catch(() => ({}))) as { classId?: unknown; periodId?: unknown };
    const classId = typeof body.classId === "string" ? body.classId : null;
    const periodId = typeof body.periodId === "string" ? body.periodId : null;
    if (!classId || !periodId) {
      return NextResponse.json({ error: "classId et periodId sont requis" }, { status: 400 });
    }
    const klass = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true, classSubjects: { select: { id: true, coefficient: true, averageFormula: true } } },
    });
    if (!klass) return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    if (session.user.role !== "SUPER_ADMIN" && klass.schoolId !== getActiveSchoolId(session)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const period = await prisma.period.findUnique({ where: { id: periodId }, select: { id: true } });
    if (!period) return NextResponse.json({ error: "Période non trouvée" }, { status: 404 });

    const existing = await prisma.classCouncil.findUnique({
      where: { classId_periodId: { classId, periodId } },
      select: { validatedAt: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Le conseil de cette période est déjà validé.", validatedAt: existing.validatedAt },
        { status: 409 }
      );
    }
    const council = await prisma.classCouncil.create({
      data: {
        classId,
        periodId,
        validatedById: session.user.id,
        coefficients: Object.fromEntries(klass.classSubjects.map((cs) => [cs.id, cs.coefficient.toString()])),
        // Règles de l'établissement et formules des enseignants en vigueur :
        // gelées pour cette période (un changement ultérieur ne la modifie pas)
        rules: await (async () => {
          const settings = await getGradingSettings(klass.schoolId);
          const subjectFormulas = settings.teacherFormulas
            ? Object.fromEntries(
                klass.classSubjects
                  .filter((cs) => cs.averageFormula?.trim())
                  .map((cs) => [cs.id, cs.averageFormula as string]),
              )
            : {};
          return { ...settings, subjectFormulas };
        })(),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        schoolId: klass.schoolId,
        action: "COUNCIL_VALIDATED",
        entity: "ClassCouncil",
        entityId: council.id,
        newValues: { classId, periodId },
      },
    });
    return NextResponse.json({ councilValidated: true, validatedAt: council.validatedAt }, { status: 201 });
  },
  { allowedRoles: VALIDATE_ROLES },
);
