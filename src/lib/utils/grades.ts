/**
 * Libellés d'appréciation. Les moyennes et rangs se calculent avec le moteur
 * unique `@/lib/academic/average-engine` (formule officielle, calcul exact).
 */
export function getAppreciation(average: number | null, maxGrade: number = 20): string {
  if (average === null) return "Non évalué";

  const percentage = (average / maxGrade) * 100;

  if (percentage >= 90) return "Excellent";
  if (percentage >= 80) return "Très bien";
  if (percentage >= 70) return "Bien";
  if (percentage >= 60) return "Assez bien";
  if (percentage >= 50) return "Passable";
  // Barème officiel retenu (décision E6) : sous 10/20 → « Échec »
  return "Échec";
}

export function getPerformanceLevel(
  average: number | null,
  passingGrade: number = 10,
  maxGrade: number = 20
): "excellent" | "good" | "average" | "at_risk" | "failing" | null {
  if (average === null) return null;

  const percentage = (average / maxGrade) * 100;
  const passingPercentage = (passingGrade / maxGrade) * 100;

  if (percentage >= 80) return "excellent";
  if (percentage >= 65) return "good";
  if (percentage >= passingPercentage) return "average";
  if (percentage >= passingPercentage - 10) return "at_risk";
  return "failing";
}
