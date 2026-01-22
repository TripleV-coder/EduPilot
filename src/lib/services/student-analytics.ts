import prisma from "@/lib/prisma";

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
  previousAverage: number | null
): "STRONG_INCREASE" | "INCREASE" | "STABLE" | "DECREASE" | "STRONG_DECREASE" | null {
  if (previousAverage === null) return null;

  const diff = currentAverage - previousAverage;
  const percentChange = (diff / previousAverage) * 100;

  if (percentChange >= 15) return "STRONG_INCREASE";
  if (percentChange >= 5) return "INCREASE";
  if (percentChange > -5) return "STABLE";
  if (percentChange > -15) return "DECREASE";
  return "STRONG_DECREASE";
}

/**
 * Détermine le niveau de performance
 */
export function getPerformanceLevel(
  average: number | null
): "EXCELLENT" | "VERY_GOOD" | "GOOD" | "AVERAGE" | "INSUFFICIENT" | "WEAK" | null {
  if (average === null) return null;

  if (average >= 16) return "EXCELLENT";
  if (average >= 14) return "VERY_GOOD";
  if (average >= 12) return "GOOD";
  if (average >= 10) return "AVERAGE";
  if (average >= 8) return "INSUFFICIENT";
  return "WEAK";
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
  incidentsCount: number
): {
  level: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
} {
  const factors: string[] = [];
  let riskScore = 0;

  // Facteur notes
  if (average !== null) {
    if (average < 6) {
      riskScore += 40;
      factors.push("Moyenne très faible (< 6)");
    } else if (average < 8) {
      riskScore += 30;
      factors.push("Moyenne faible (< 8)");
    } else if (average < 10) {
      riskScore += 15;
      factors.push("Moyenne insuffisante (< 10)");
    }
  }

  // Facteur assiduité
  if (attendanceRate < 70) {
    riskScore += 30;
    factors.push(`Assiduité très faible (${Math.round(attendanceRate)}%)`);
  } else if (attendanceRate < 85) {
    riskScore += 15;
    factors.push(`Assiduité faible (${Math.round(attendanceRate)}%)`);
  }

  // Facteur comportement
  if (incidentsCount >= 5) {
    riskScore += 20;
    factors.push(`Nombreux incidents (${incidentsCount})`);
  } else if (incidentsCount >= 3) {
    riskScore += 10;
    factors.push(`Plusieurs incidents (${incidentsCount})`);
  }

  // Détermination du niveau
  let level: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (riskScore >= 60) level = "CRITICAL";
  else if (riskScore >= 40) level = "HIGH";
  else if (riskScore >= 20) level = "MEDIUM";
  else if (riskScore > 0) level = "LOW";
  else level = "NONE";

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
                  grades: {
                    where: { studentId },
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

  let totalWeightedSum = 0;
  let totalCoefficients = 0;

  for (const cs of enrollment.class.classSubjects) {
    const grades = cs.evaluations.flatMap((ev) =>
      ev.grades
        .filter((g) => g.value !== null && !g.isAbsent)
        .map((g) => Number(g.value))
    );

    const stats = calculateStatistics(grades);

    if (stats.average !== null) {
      subjectPerformances.push({
        subjectId: cs.subject.id,
        average: stats.average,
        gradesCount: grades.length,
        min: stats.min,
        max: stats.max,
        standardDev: stats.standardDev,
      });

      const coef = Number(cs.coefficient);
      totalWeightedSum += stats.average * coef;
      totalCoefficients += coef;
    }
  }

  // 3. Calculer la moyenne générale
  const generalAverage =
    totalCoefficients > 0 ? totalWeightedSum / totalCoefficients : null;

  // 4. Calculer le rang de classe
  const classStudents = await prisma.enrollment.findMany({
    where: {
      classId: enrollment.classId,
      academicYearId,
      status: "ACTIVE",
    },
    include: {
      student: {
        include: {
          grades: {
            where: {
              evaluation: { periodId },
            },
            include: {
              evaluation: {
                include: {
                  classSubject: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculer les moyennes de tous les élèves
  const classAverages: Array<{ studentId: string; average: number | null }> = [];

  for (const e of classStudents) {
    let studentWeightedSum = 0;
    let studentCoefficients = 0;

    for (const cs of enrollment.class.classSubjects) {
      const studentGrades = e.student.grades
        .filter((g) => g.evaluation.classSubjectId === cs.id && g.value !== null && !g.isAbsent)
        .map((g) => Number(g.value));

      if (studentGrades.length > 0) {
        const avg = studentGrades.reduce((sum, v) => sum + v, 0) / studentGrades.length;
        const coef = Number(cs.coefficient);
        studentWeightedSum += avg * coef;
        studentCoefficients += coef;
      }
    }

    const studentAvg = studentCoefficients > 0 ? studentWeightedSum / studentCoefficients : null;
    classAverages.push({ studentId: e.studentId, average: studentAvg });
  }

  // Tri par moyenne décroissante
  const sortedAverages = classAverages
    .filter((a) => a.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

  const classRank =
    generalAverage !== null
      ? sortedAverages.findIndex((a) => a.studentId === studentId) + 1
      : null;
  const classSize = sortedAverages.length;

  // 5. Calculer taux de constance global
  const allGrades = subjectPerformances.flatMap((sp) => sp.average).filter((a) => a !== null) as number[];
  const globalStats = calculateStatistics(allGrades);
  const consistencyRate =
    generalAverage && globalStats.standardDev
      ? calculateConsistencyRate(globalStats.standardDev, generalAverage)
      : null;

  // 6. Obtenir l'historique (période précédente)
  const previousPeriod = await prisma.period.findFirst({
    where: {
      academicYearId,
      sequence: {
        lt: (
          await prisma.period.findUnique({
            where: { id: periodId },
            select: { sequence: true },
          })
        )?.sequence ?? 0,
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
      ? Number(previousAnalytics.generalAverage)
      : null;

    if (generalAverage !== null) {
      progressionRate = calculateProgressionRate(generalAverage, previousAverage);
    }
  }

  // 7. Évaluer le risque
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      studentId,
      date: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 jours
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
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const riskAssessment = assessRiskLevel(generalAverage, attendanceRate, incidents.length);

  // 8. Déterminer forces et faiblesses
  const subjectAnalyses = await Promise.all(
    subjectPerformances.map(async (sp) => {
      if (!sp.average || !generalAverage || !sp.standardDev) {
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

        if (prevSubjectPerf?.average) {
          const prevAvg = Number(prevSubjectPerf.average);
          subjectTrend = calculateTrend(sp.average, prevAvg);
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
    performanceLevel: getPerformanceLevel(generalAverage),
    progressionRate,
    consistencyRate,
    riskLevel: riskAssessment.level,
    riskFactors: riskAssessment.factors,
    subjectPerformances: subjectAnalyses,
  };
}
