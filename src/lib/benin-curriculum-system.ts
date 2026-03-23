/**
 * Architecture de Configuration des Matières - Bénin
 */

export function validateCoefficient(coefficient: unknown): { valid: boolean; error?: string } {
  if (coefficient === null || coefficient === undefined) {
    return { valid: false, error: "Le coefficient ne peut pas être vide" };
  }
  const num = Number(coefficient);
  if (isNaN(num)) return { valid: false, error: "Le coefficient doit être un nombre" };
  if (num <= 0) return { valid: false, error: "Le coefficient doit être > 0" };
  if (num > 1000) return { valid: false, error: "Le coefficient est trop élevé (max 1000)" };
  const decimals = num.toString().split(".")[1];
  if (decimals && decimals.length > 2) return { valid: false, error: "Maximum 2 décimales autorisées" };
  return { valid: true };
}

export function validateGrade(grade: unknown, maxGrade: number = 20): { valid: boolean; error?: string } {
  if (grade === null || grade === undefined) return { valid: true };
  const num = Number(grade);
  if (isNaN(num)) return { valid: false, error: "La note doit être un nombre" };
  if (num < 0) return { valid: false, error: "La note ne peut pas être négative" };
  if (num > maxGrade) return { valid: false, error: `La note ne peut pas dépasser ${maxGrade}` };
  return { valid: true };
}

export function calculateWeightedAverage(grades: { value: number | null; coefficient: number; isOptional?: boolean; }[]): { average: number | null; totalCoefficients: number; hasError: boolean; error?: string } {
  if (!grades || grades.length === 0) return { average: null, totalCoefficients: 0, hasError: true, error: "Aucune note fournie" };
  for (const g of grades) {
    const v = validateCoefficient(g.coefficient);
    if (!v.valid) return { average: null, totalCoefficients: 0, hasError: true, error: v.error };
  }
  const validGrades = grades.filter(g => g.value !== null && g.value !== undefined);
  if (validGrades.length === 0) return { average: null, totalCoefficients: 0, hasError: true, error: "Aucune note" };
  let sum = 0, totalCoeff = 0;
  for (const g of validGrades) {
    sum += (g.value || 0) * g.coefficient;
    totalCoeff += g.coefficient;
  }
  return { average: Number((sum / totalCoeff).toFixed(2)), totalCoefficients: totalCoeff, hasError: false };
}

export function calculateGeneralAverage(subjects: { subjectId: string; subjectName: string; average: number | null; coefficient: number; isEvaluated: boolean; }[]): { average: number | null; totalCoefficients: number; hasError: boolean; error?: string } {
  if (!subjects || subjects.length === 0) return { average: null, totalCoefficients: 0, hasError: true, error: "Aucun sujet fourni" };
  const validSubjects = subjects.filter(s => s.isEvaluated && s.average !== null);
  if (validSubjects.length === 0) return { average: null, totalCoefficients: 0, hasError: true, error: "Aucun sujet évalué" };
  let sum = 0, totalCoeff = 0;
  for (const s of validSubjects) {
    sum += (s.average || 0) * s.coefficient;
    totalCoeff += s.coefficient;
  }
  return { average: Number((sum / totalCoeff).toFixed(2)), totalCoefficients: totalCoeff, hasError: false };
}

export const BENIN_SCHOOL_LEVELS = { PRIMARY: "PRIMARY", SECONDARY_COLLEGE: "SECONDARY_COLLEGE" } as const;
export const BENIN_PRIMARY_GRADES = ["CI", "CP", "CE1", "CE2", "CM1", "CM2"];
export const BENIN_COLLEGE_GRADES = ["6E", "5E", "4E", "3E"];
export const BENIN_ALL_GRADES = [...BENIN_PRIMARY_GRADES, ...BENIN_COLLEGE_GRADES];

export default {
  validateCoefficient,
  validateGrade,
  calculateWeightedAverage,
  calculateGeneralAverage,
  BENIN_SCHOOL_LEVELS,
  BENIN_PRIMARY_GRADES,
  BENIN_COLLEGE_GRADES,
};
