import type { ActionPlanTemplate, StudentTemplateContext } from "./types";

function formatName(ctx: StudentTemplateContext): string {
  return [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim() || "l'élève";
}

/**
 * Plan d'intervention par gabarits, personnalisé selon le profil réel.
 */
export function generateActionPlan(ctx: StudentTemplateContext): ActionPlanTemplate {
  const name = formatName(ctx);
  const weaknesses = ctx.weaknesses ?? [];
  const average = ctx.generalAverage ?? 0;
  const riskLevel = ctx.riskLevel ?? "LOW";

  const priority: ActionPlanTemplate["priority"] =
    riskLevel === "CRITICAL" || (ctx.failureProbability ?? 0) >= 75
      ? "CRITICAL"
      : riskLevel === "HIGH" || (ctx.failureProbability ?? 0) >= 55
        ? "HIGH"
        : average < 10
          ? "HIGH"
          : "MEDIUM";

  const steps: string[] = [
    `Entretien individuel avec ${name} pour identifier les blocages et fixer des objectifs concrets.`,
  ];

  if (weaknesses.length > 0) {
    steps.push(
      `Mise en place de séances de remédiation hebdomadaires en ${weaknesses.slice(0, 2).join(" et ")}.`
    );
  } else {
    steps.push("Organisation de séances de méthodologie et de travail personnel encadré.");
  }

  if (ctx.attendanceRate !== null && ctx.attendanceRate !== undefined && ctx.attendanceRate < 85) {
    steps.push("Suivi renforcé de l'assiduité avec alerte parents en cas d'absence non justifiée.");
  }

  steps.push("Point de situation avec les parents sous 10 jours ouvrés.");

  if (priority === "CRITICAL" || priority === "HIGH") {
    steps.push("Mobilisation du conseiller d'orientation pour un accompagnement individualisé.");
  }

  return {
    title: `Plan de remédiation — ${name}`,
    description: `Intervention pédagogique ciblée pour ${name}${ctx.className ? ` (${ctx.className})` : ""}. Moyenne actuelle : ${average > 0 ? `${average.toFixed(2)}/20` : "non disponible"}.`,
    priority,
    steps,
    suggestedBy: "EduPilot — moteur par gabarits",
  };
}
