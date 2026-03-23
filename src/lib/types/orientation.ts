/**
 * Types pour le module d'Orientation Scolaire
 */

export type OrientationStatus =
  | "PENDING"
  | "ANALYZED"
  | "RECOMMENDED"
  | "VALIDATED"
  | "ACCEPTED"
  | "REJECTED";

export type RecommendedSeries =
  | "SERIE_A" // Littéraire
  | "SERIE_B" // Économique et Social
  | "SERIE_C" // Mathématiques et Sciences Physiques
  | "SERIE_D" // Sciences de la Vie et de la Terre
  | "SERIE_E" // Mathématiques et Technique
  | "SERIE_F1" // Fabrication Mécanique
  | "SERIE_F2" // Électronique
  | "SERIE_F3" // Électrotechnique
  | "SERIE_F4" // Génie Civil
  | "SERIE_G1" // Techniques Administratives
  | "SERIE_G2" // Techniques Quantitatives de Gestion
  | "SERIE_G3" // Techniques Commerciales
  | "FORMATION_PRO" // Formation professionnelle
  | "APPRENTISSAGE"; // Apprentissage

export type SubjectGroup =
  | "LITTERAIRE"
  | "SCIENTIFIQUE"
  | "ECONOMIQUE"
  | "TECHNIQUE"
  | "LANGUES"
  | "ARTS"
  | "SPORT";

export type PerformanceTrend =
  | "STRONG_INCREASE"
  | "INCREASE"
  | "STABLE"
  | "DECREASE"
  | "STRONG_DECREASE";

export interface OrientationRecommendation {
  id: string;
  recommendedSeries: RecommendedSeries;
  rank: number;
  score: number;
  justification: string;
  strengths: string[];
  warnings: string[];
  isValidated: boolean;
  validatedAt: string | null;
}

export interface SubjectGroupAnalysis {
  id: string;
  subjectGroup: SubjectGroup;
  averageScore: number;
  trend: PerformanceTrend;
  consistency: number;
  gradesCount: number;
  minGrade: number | null;
  maxGrade: number | null;
  analysis: string | null;
}

export interface StudentOrientation {
  id: string;
  studentId: string;
  academicYearId: string;
  classLevelId: string;
  status: OrientationStatus;
  recommendations: OrientationRecommendation[];
  subjectAnalyses: SubjectGroupAnalysis[];
  createdAt: string;
  updatedAt: string;
}

export function getSeriesLabel(series: RecommendedSeries): string {
  const labels: Record<RecommendedSeries, string> = {
    SERIE_A: "Série A - Littéraire",
    SERIE_B: "Série B - Économique et Social",
    SERIE_C: "Série C - Mathématiques et Sciences Physiques",
    SERIE_D: "Série D - Sciences de la Vie et de la Terre",
    SERIE_E: "Série E - Mathématiques et Technique",
    SERIE_F1: "Série F1 - Fabrication Mécanique",
    SERIE_F2: "Série F2 - Électronique",
    SERIE_F3: "Série F3 - Électrotechnique",
    SERIE_F4: "Série F4 - Génie Civil",
    SERIE_G1: "Série G1 - Techniques Administratives",
    SERIE_G2: "Série G2 - Techniques Quantitatives de Gestion",
    SERIE_G3: "Série G3 - Techniques Commerciales",
    FORMATION_PRO: "Formation Professionnelle",
    APPRENTISSAGE: "Apprentissage",
  };
  return labels[series];
}

export function getSubjectGroupLabel(group: SubjectGroup): string {
  const labels: Record<SubjectGroup, string> = {
    LITTERAIRE: "Littéraire",
    SCIENTIFIQUE: "Scientifique",
    ECONOMIQUE: "Économique",
    TECHNIQUE: "Technique",
    LANGUES: "Langues",
    ARTS: "Arts",
    SPORT: "Sport",
  };
  return labels[group];
}

export function getOrientationStatusLabel(status: OrientationStatus): string {
  const labels: Record<OrientationStatus, string> = {
    PENDING: "En attente",
    ANALYZED: "Analysé",
    RECOMMENDED: "Recommandations émises",
    VALIDATED: "Validé",
    ACCEPTED: "Accepté",
    REJECTED: "Rejeté",
  };
  return labels[status];
}

export function getOrientationStatusColor(status: OrientationStatus): string {
  const colors: Record<OrientationStatus, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    ANALYZED: "bg-blue-100 text-blue-700",
    RECOMMENDED: "bg-purple-100 text-purple-700",
    VALIDATED: "bg-green-100 text-green-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return colors[status];
}
