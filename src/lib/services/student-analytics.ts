import prisma from "@/lib/prisma";
import { normalizeGradeTo20, roundTo } from "@/lib/analytics/helpers";
import { countsInAverage, toDisplay } from "@/lib/academic/average-engine";
import { computeClassPeriod } from "@/lib/academic/class-averages";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { assessRisk, DEFAULT_SCHOOL_PARAMETERS, performanceLevel, type SchoolParameters } from "@/lib/schools/school-parameters";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";


/**
 * Service d'analyse avancée des apprenants
 */

// ============================================
// CALCUL DES PERFORMANCES PAR MATIÈRE
// ============================================

// ============================================
// CALCUL DES PERFORMANCES PAR MATIÈRE
// ============================================

/**
 * Calcule les statistiques d'une série de notes
 */
export function calculateStatistics(grades: number[]) {
  if (grades.length === 0) {
    return {
      min: null,
      max: null,
      average: null,
      standardDev: null,
    };
  }

  const min = Math.min(...grades);
  const max = Math.max(...grades);
  const average = grades.reduce((sum, g) => sum + g, 0) / grades.length;

  // Écart-type
  const squaredDiffs = grades.map((g) => Math.pow(g - average, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / grades.length;
  const standardDev = Math.sqrt(variance);

  return { min, max, average, standardDev };
}

/**
 * Détermine si une matière est un point fort ou une faiblesse
 */
export function analyzeSubjectStrength(
  subjectAverage: number,
  generalAverage: number,
  standardDev: number
): { isStrength: boolean; isWeakness: boolean } {
  // Point fort : > moyenne générale + 0.5 * écart-type
  const isStrength = subjectAverage > generalAverage + 0.5 * standardDev;

  // Point faible : < moyenne générale - 0.5 * écart-type
  const isWeakness = subjectAverage < generalAverage - 0.5 * standardDev;

  return { isStrength, isWeakness };
}

/**
 * Détermine la tendance de performance
 */
export function calculateTrend(
  currentAverage: number,
  previousAverage: number | null,
  perf: SchoolParameters["performance"] = DEFAULT_SCHOOL_PARAMETERS.performance
): "STRONG_INCREASE" | "INCREASE" | "STABLE" | "DECREASE" | "STRONG_DECREASE" | null {
  if (previousAverage === null || previousAverage <= 0) return null;

  const diff = currentAverage - previousAverage;
  const percentChange = (diff / previousAverage) * 100;

  // Seuils d'évolution de l'école (paramètres « Niveaux de performance »)
  if (percentChange >= perf.strongChangePercent) return "STRONG_INCREASE";
  if (percentChange >= perf.changePercent) return "INCREASE";
  if (percentChange > -perf.changePercent) return "STABLE";
  if (percentChange > -perf.strongChangePercent) return "DECREASE";
  return "STRONG_DECREASE";
}

/**
 * Détermine le niveau de performance
 */
export function getPerformanceLevel(
  average: number | null,
  perf: SchoolParameters["performance"] = DEFAULT_SCHOOL_PARAMETERS.performance,
  passingGrade = 10
): "EXCELLENT" | "VERY_GOOD" | "GOOD" | "AVERAGE" | "INSUFFICIENT" | "WEAK" | null {
  // Tranches de l'école ; « moyen » commence au seuil de réussite de l'école
  return performanceLevel(average, perf, passingGrade);
}

/**
 * Calcule le taux de constance (inverse de la variabilité)
 * Plus le taux est élevé, plus l'élève est constant
 */
export function calculateConsistencyRate(standardDev: number, average: number): number {
  if (average === 0) return 100;

  // Coefficient de variation normalisé (inversé pour avoir un taux)
  const cv = standardDev / average;
  const consistency = Math.max(0, 100 - cv * 100);

  return Math.round(consistency * 100) / 100;
}

/**
 * Détermine le niveau de risque
 */
export function assessRiskLevel(
  average: number | null,
  attendanceRate: number,
  incidentsCount: number,
  f: SchoolParameters["followUp"] = DEFAULT_SCHOOL_PARAMETERS.followUp,
  passingGrade = 10
): {
  level: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
} {
  // Calcul unique, partagé avec les écrans (src/lib/schools/school-parameters.ts)
  const { level, factors } = assessRisk(average, attendanceRate, incidentsCount, f, passingGrade);
  return { level, factors };
}

/**
 * Calcule le taux de progression entre deux périodes
 */
export function calculateProgressionRate(
  currentAverage: number,
  previousAverage: number | null
): number | null {
  if (previousAverage === null || previousAverage === 0) return null;

  const progression = ((currentAverage - previousAverage) / previousAverage) * 100;
  return Math.round(progression * 100) / 100;
}

// ============================================
// GÉNÉRATION ANALYTICS COMPLÈTES
// ============================================

/**
 * Génère les analytics complètes pour un élève sur une période
 */
export async function generateStudentAnalytics(
  studentId: string,
  periodId: string,
  academicYearId: string
) {
  const currentPeriod = await prisma.period.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      sequence: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!currentPeriod) {
    throw new Error("Period not found");
  }

  // 1. Récupérer l'enrollment et les notes
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      academicYearId,
      status: "ACTIVE",
    },
    include: {
      class: {
        include: {
          classSubjects: {
            include: {
              subject: true,
              evaluations: {
                where: { periodId },
                include: {
                  type: { select: { code: true, name: true, category: true } },
                  grades: {
                    where: {
                      studentId,
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  // 2. Calculer les moyennes par matière
  const subjectPerformances: Array<{
    subjectId: string;
    average: number | null;
    gradesCount: number;
    min: number | null;
    max: number | null;
    standardDev: number | null;
  }> = [];

  // Calcul de la classe entière (règles de l'école, coefficients et règles gelés
  // par le conseil, notes manquantes, date d'inscription, rang, effectif) :
  // exactement le calcul du bulletin
  const classPeriod = await computeClassPeriod({
    classId: enrollment.classId,
    periodId,
    academicYearId,
    classSubjects: enrollment.class.classSubjects.map((cs) => ({
      id: cs.id,
      subjectId: cs.subjectId,
      coefficient: cs.coefficient,
    })),
  });
  const own = classPeriod.students.get(studentId);
  const show = (v: Parameters<typeof toDisplay>[0]) => toDisplay(v, classPeriod.rules.rounding);

  for (const cs of enrollment.class.classSubjects) {
    const normalizedGrades = cs.evaluations.filter((ev) => countsInAverage(ev.type)).flatMap((ev) =>
      ev.grades
        .filter((g) => g.value !== null && !g.isAbsent && !g.isExcused)
        .map((g) => normalizeGradeTo20(Number(g.value), Number(ev.maxGrade)))
        .filter((value): value is number => value !== null)
    );
    const stats = calculateStatistics(normalizedGrades);
    const subjectAverage = show(own?.averages.subjects.get(cs.id) ?? null);

    if (subjectAverage !== null && stats.average !== null) {
      subjectPerformances.push({
        subjectId: cs.subject.id,
        average: subjectAverage,
        gradesCount: normalizedGrades.length,
        min: stats.min !== null ? roundTo(stats.min) : null,
        max: stats.max !== null ? roundTo(stats.max) : null,
        standardDev: stats.standardDev !== null ? roundTo(stats.standardDev) : null,
      });
    }
  }

  // 3. Moyenne générale, rang de classe et effectif (élèves inscrits actifs)
  const generalAverage = own?.general ?? null;
  const classRank = own?.rank ?? null;
  const classSize = classPeriod.classSize;

  // 5. Calculer taux de constance global
  const allGrades = subjectPerformances
    .map((sp) => sp.average)
    .filter((average): average is number => average !== null);
  const globalStats = calculateStatistics(allGrades);
  const consistencyRate =
    generalAverage !== null && globalStats.standardDev !== null
      ? calculateConsistencyRate(globalStats.standardDev, generalAverage)
      : null;

  // 6. Obtenir l'historique (période précédente)
  const previousPeriod = await prisma.period.findFirst({
    where: {
      academicYearId,
      sequence: {
        lt: currentPeriod.sequence,
      },
    },
    orderBy: { sequence: "desc" },
  });

  let progressionRate: number | null = null;
  let previousAverage: number | null = null;

  if (previousPeriod) {
    const previousAnalytics = await prisma.studentAnalytics.findUnique({
      where: {
        studentId_periodId: {
          studentId,
          periodId: previousPeriod.id,
        },
      },
    });

    previousAverage = previousAnalytics?.generalAverage
      !== null && previousAnalytics?.generalAverage !== undefined
      ? Number(previousAnalytics.generalAverage)
      : null;

    if (generalAverage !== null) {
      progressionRate = calculateProgressionRate(generalAverage, previousAverage);
    }
  }

  // 7. Évaluer le risque
  // Paramètres de l'école : fenêtre d'observation, seuils d'alerte, tranches
  const schoolId = enrollment.class.schoolId;
  const [params, passingGrade] = await Promise.all([getSchoolParameters(schoolId), getPassingGrade(schoolId)]);
  const rollingWindowStart = new Date(
    currentPeriod.endDate.getTime() - params.analysis.attendanceWindowDays * 24 * 60 * 60 * 1000
  );
  const riskWindowStart = new Date(
    Math.max(currentPeriod.startDate.getTime(), rollingWindowStart.getTime())
  );

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      studentId,
      date: {
        gte: riskWindowStart,
        lte: currentPeriod.endDate,
      },
    },
  });

  const attendanceRate =
    attendanceRecords.length > 0
      ? (attendanceRecords.filter((a) => a.status === "PRESENT" || a.status === "LATE").length /
        attendanceRecords.length) *
      100
      : 100;

  const incidents = await prisma.behaviorIncident.findMany({
    where: {
      studentId,
      date: {
        gte: riskWindowStart,
        lte: currentPeriod.endDate,
      },
    },
  });

  const riskAssessment = assessRiskLevel(generalAverage, attendanceRate, incidents.length, params.followUp, passingGrade);

  // 8. Déterminer forces et faiblesses
  const subjectAnalyses = await Promise.all(
    subjectPerformances.map(async (sp) => {
      if (sp.average === null || generalAverage === null || sp.standardDev === null) {
        return {
          ...sp,
          isStrength: false,
          isWeakness: false,
          trend: null,
          progressionRate: null,
        };
      }

      const { isStrength, isWeakness } = analyzeSubjectStrength(
        sp.average,
        generalAverage,
        sp.standardDev
      );

      // Récupérer moyenne précédente pour cette matière
      let subjectTrend = null;
      let subjectProgression = null;

      if (previousPeriod) {
        const prevSubjectPerf = await prisma.subjectPerformance.findFirst({
          where: {
            analytics: {
              studentId,
              periodId: previousPeriod.id,
            },
            subjectId: sp.subjectId,
          },
        });

        if (
          prevSubjectPerf?.average !== null &&
          prevSubjectPerf?.average !== undefined
        ) {
          const prevAvg = Number(prevSubjectPerf.average);
          subjectTrend = calculateTrend(sp.average, prevAvg, params.performance);
          subjectProgression = calculateProgressionRate(sp.average, prevAvg);
        }
      }

      return {
        ...sp,
        isStrength,
        isWeakness,
        trend: subjectTrend,
        progressionRate: subjectProgression,
      };
    })
  );

  return {
    studentId,
    periodId,
    academicYearId,
    generalAverage,
    classRank,
    classSize,
    performanceLevel: getPerformanceLevel(generalAverage, params.performance, passingGrade),
    progressionRate,
    consistencyRate,
    riskLevel: riskAssessment.level,
    riskFactors: riskAssessment.factors,
    subjectPerformances: subjectAnalyses,
  };
}
