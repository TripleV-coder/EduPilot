import prisma from "@/lib/prisma";
import type { PerformanceTrend } from "@prisma/client";
import { toDisplay } from "@/lib/academic/average-engine";
import { computeClassAnnual } from "@/lib/academic/class-averages";
import { disciplineAverages, rankSeries,
  seriesReadingFor, type SeriesScore } from "@/lib/benin/series";
import { DEFAULT_GRADING_SETTINGS, getGradingSettings } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";

/**
 * Service d'orientation scolaire
 * Analyse les performances et recommande des séries
 */

// ============================================
// TENDANCE DE PERFORMANCE (chronologique)
// ============================================

type DatedGrade = { date: Date; value: number };

/**
 * Calcule la tendance d'un groupe de matières en comparant la moyenne de la
 * première moitié des notes (dans le temps) à celle de la seconde moitié.
 *
 * Il faut au moins 4 notes pour dégager une tendance fiable ; en-deçà on reste
 * STABLE. Les seuils (en points sur 20) : ±0,5 = variation, ±2 = forte variation.
 */
export function computePerformanceTrend(grades: DatedGrade[]): PerformanceTrend {
  if (grades.length < 4) return "STABLE";

  const sorted = [...grades].sort((a, b) => a.date.getTime() - b.date.getTime());
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(sorted.length - mid);

  const mean = (list: DatedGrade[]) =>
    list.reduce((sum, g) => sum + g.value, 0) / list.length;

  const delta = mean(secondHalf) - mean(firstHalf);

  if (delta >= 2) return "STRONG_INCREASE";
  if (delta >= 0.5) return "INCREASE";
  if (delta <= -2) return "STRONG_DECREASE";
  if (delta <= -0.5) return "DECREASE";
  return "STABLE";
}

// ============================================
// RECOMMANDATIONS INDICATIVES (sans dossier)
// ============================================

export type IndicativeRecommendation = SeriesScore;

/**
 * Recommandations indicatives à partir des notes réelles de l'élève sur
 * l'année, SANS créer de dossier d'orientation (aperçu personnel en attendant
 * l'avis du conseil). Moyennes : moteur unique (formule officielle, calcul
 * exact) ; en cours d'année, moyenne provisoire sur les périodes déjà évaluées.
 * Séries : référentiel unique (src/lib/benin/series.ts).
 */
export async function computeIndicativeRecommendations(
  studentId: string,
  academicYearId: string
): Promise<{ recommendations: IndicativeRecommendation[]; generalAverage: number | null }> {
  // Critères d'orientation et règles de calcul de l'école
  const studentSchool = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  const schoolRules = studentSchool ? await getGradingSettings(studentSchool.schoolId) : DEFAULT_GRADING_SETTINGS;
  const schoolParams = await getSchoolParameters(studentSchool?.schoolId);

  // Moyennes annuelles exactement comme au bulletin : classe actuelle de l'élève,
  // règles de l'école, coefficients et règles gelés par les conseils validés
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, academicYearId, status: "ACTIVE" },
    select: {
      classId: true,
      class: { select: { classSubjects: { select: { id: true, subjectId: true, coefficient: true, subject: { select: { name: true } } } } } },
    },
  });
  if (!enrollment) return { recommendations: [], generalAverage: null };
  const classSubjects = enrollment.class.classSubjects;
  const annualResult = await computeClassAnnual({
    classId: enrollment.classId,
    academicYearId,
    classSubjects: classSubjects.map((cs) => ({ id: cs.id, subjectId: cs.subjectId, coefficient: cs.coefficient })),
  });
  const own = annualResult.students.get(studentId);
  const generalAverage = own ? own.general ?? own.provisional : null;
  if (!own || generalAverage === null) {
    return { recommendations: [], generalAverage: null };
  }
  const rounding = schoolRules.calculation.rounding;
  const averages = disciplineAverages(
    classSubjects.map((cs) => ({
      name: cs.subject.name,
      average: toDisplay(own.annual.subjects.get(cs.id) ?? own.annual.provisionalSubjects.get(cs.id) ?? null, rounding),
    }))
  );

  return {
    recommendations: rankSeries(averages, generalAverage, schoolRules.orientation, seriesReadingFor(schoolParams.exams)).slice(0, 3),
    generalAverage,
  };
}
