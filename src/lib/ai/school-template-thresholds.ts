/**
 * Seuils des gabarits « IA » pour une école : seuil de passage (règles de
 * l'établissement) + paramètres de l'établissement (niveaux, suivi, risque).
 */
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import type { TemplateThresholds } from "./templates/types";

export async function templateThresholdsForSchool(schoolId: string): Promise<TemplateThresholds> {
  const [passingGrade, params] = await Promise.all([getPassingGrade(schoolId), getSchoolParameters(schoolId)]);
  return {
    passingGrade,
    excellentFrom: params.performance.excellentFrom,
    veryGoodFrom: params.performance.veryGoodFrom,
    goodFrom: params.performance.goodFrom,
    attendanceWarning: params.followUp.attendanceWarning,
    attendanceWindowDays: params.analysis.attendanceWindowDays,
    incidentsWarning: params.followUp.incidentsWarning,
    weakSubjectsAlert: params.analysis.weakSubjectsAlert,
    levelVeryHigh: params.analysis.levelVeryHigh,
    levelHigh: params.analysis.levelHigh,
    levelModerate: params.analysis.levelModerate,
  };
}
