import type { StudentTemplateContext, TemplateAlert } from "./types";

interface AtRiskStudent {
  id: string;
  name: string;
  riskLevel: string;
  averageGrade?: number | null;
  className?: string | null;
}

function riskPriority(level: string): number {
  switch (level) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

/**
 * Alertes individuelles pour un élève à partir de son profil de risque.
 */
export function generateStudentAlerts(ctx: StudentTemplateContext, studentId = "student"): TemplateAlert[] {
  const alerts: TemplateAlert[] = [];
  const name = [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim() || "Élève";
  const level = ctx.riskLevel ?? "LOW";
  const average = ctx.generalAverage;

  if (["CRITICAL", "HIGH"].includes(level)) {
    alerts.push({
      id: `risk_${studentId}`,
      type: level === "CRITICAL" ? "critical" : "warning",
      title: `Risque ${level === "CRITICAL" ? "critique" : "élevé"}`,
      message: `${name} présente un risque ${level.toLowerCase()}${average !== null && average !== undefined ? ` avec une moyenne de ${average.toFixed(2)}/20` : ""}.`,
      targetRoles: ["DIRECTOR", "SCHOOL_ADMIN", "TEACHER"],
      actionRequired: true,
    });
  }

  if (ctx.attendanceRate !== null && ctx.attendanceRate !== undefined && ctx.attendanceRate < 80) {
    alerts.push({
      id: `attendance_${studentId}`,
      type: "warning",
      title: "Assiduité insuffisante",
      message: `${name} affiche un taux de présence de ${ctx.attendanceRate.toFixed(0)} % sur les 90 derniers jours.`,
      targetRoles: ["TEACHER", "SCHOOL_ADMIN"],
      actionRequired: true,
    });
  }

  if ((ctx.incidentCount ?? 0) >= 3) {
    alerts.push({
      id: `behavior_${studentId}`,
      type: "warning",
      title: "Incidents comportementaux répétés",
      message: `${name} a enregistré ${ctx.incidentCount} incident(s) récent(s). Un suivi comportemental est recommandé.`,
      targetRoles: ["DIRECTOR", "TEACHER"],
      actionRequired: true,
    });
  }

  if ((ctx.weaknesses?.length ?? 0) >= 3 && (average ?? 20) < 10) {
    alerts.push({
      id: `academic_${studentId}`,
      type: "error",
      title: "Difficultés scolaires multiples",
      message: `${name} cumule des lacunes en ${ctx.weaknesses!.slice(0, 3).join(", ")}.`,
      targetRoles: ["TEACHER", "DIRECTOR"],
      actionRequired: true,
    });
  }

  return alerts;
}

/**
 * Alertes agrégées pour une liste d'élèves à risque (classe ou établissement).
 */
export function generateAtRiskAlerts(students: AtRiskStudent[]): TemplateAlert[] {
  return students
    .filter((s) => ["CRITICAL", "HIGH", "MEDIUM"].includes(s.riskLevel))
    .sort((a, b) => riskPriority(b.riskLevel) - riskPriority(a.riskLevel))
    .slice(0, 10)
    .map((student) => ({
      id: `risk_${student.id}`,
      type: student.riskLevel === "CRITICAL" ? "critical" as const : student.riskLevel === "HIGH" ? "warning" as const : "info" as const,
      title: `Risque ${student.riskLevel === "CRITICAL" ? "critique" : student.riskLevel === "HIGH" ? "élevé" : "modéré"}`,
      message: `${student.name}${student.className ? ` (${student.className})` : ""} — moyenne ${student.averageGrade?.toFixed(2) ?? "non disponible"}/20.`,
      targetRoles: ["DIRECTOR", "SCHOOL_ADMIN", "TEACHER"],
      actionRequired: ["CRITICAL", "HIGH"].includes(student.riskLevel),
    }));
}
