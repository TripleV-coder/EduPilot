import { Decimal } from "@prisma/client/runtime/library";

interface GradeData {
  value: Decimal | number | null;
  coefficient: Decimal | number;
  isAbsent: boolean;
  isExcused: boolean;
  studentId?: string;
}

interface EvaluationWithGrades {
  coefficient: Decimal | number;
  grades: GradeData[];
}

export function calculateWeightedAverage(grades: GradeData[]): number | null {
  const validGrades = grades.filter(
    (g) => g.value !== null && !g.isAbsent && !g.isExcused
  );

  if (validGrades.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const grade of validGrades) {
    const value = Number(grade.value);
    const coefficient = Number(grade.coefficient);
    weightedSum += value * coefficient;
    totalWeight += coefficient;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

export function calculateSubjectAverage(
  evaluations: EvaluationWithGrades[],
  studentId: string
): number | null {
  const studentGrades: GradeData[] = [];

  for (const evaluation of evaluations) {
    const studentGrade = evaluation.grades.find(
      (g) => g.studentId === studentId
    );
    if (studentGrade) {
      studentGrades.push({
        ...studentGrade,
        coefficient: evaluation.coefficient,
      });
    }
  }

  return calculateWeightedAverage(studentGrades);
}

export function calculateGeneralAverage(
  subjectAverages: { average: number | null; coefficient: number }[]
): number | null {
  const validAverages = subjectAverages.filter((s) => s.average !== null);

  if (validAverages.length === 0) return null;

  let totalCoefficient = 0;
  let weightedSum = 0;

  for (const subject of validAverages) {
    weightedSum += subject.average! * subject.coefficient;
    totalCoefficient += subject.coefficient;
  }

  return totalCoefficient > 0 ? weightedSum / totalCoefficient : null;
}

export function getRank(
  studentAverage: number | null,
  allAverages: (number | null)[]
): number | null {
  if (studentAverage === null) return null;

  const validAverages = allAverages
    .filter((a): a is number => a !== null)
    .sort((a, b) => b - a);

  const rank = validAverages.indexOf(studentAverage) + 1;
  return rank > 0 ? rank : null;
}

export function getAppreciation(average: number | null, maxGrade: number = 20): string {
  if (average === null) return "Non évalué";

  const percentage = (average / maxGrade) * 100;

  if (percentage >= 90) return "Excellent";
  if (percentage >= 80) return "Très bien";
  if (percentage >= 70) return "Bien";
  if (percentage >= 60) return "Assez bien";
  if (percentage >= 50) return "Passable";
  if (percentage >= 40) return "Insuffisant";
  return "Très insuffisant";
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
