import type { RiskSummaryResult, StudentTemplateContext } from "./types";

function formatName(ctx: StudentTemplateContext): string {
  const name = [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim();
  return name || "Cet élève";
}

function resolvePriority(ctx: StudentTemplateContext): RiskSummaryResult["priority"] {
  const probability = ctx.failureProbability ?? 0;
  if (probability >= 75 || ctx.riskLevel === "CRITICAL") return "CRITICAL";
  if (probability >= 55 || ctx.riskLevel === "HIGH") return "HIGH";
  if (probability >= 35 || ctx.riskLevel === "MEDIUM") return "MEDIUM";
  return "LOW";
}

/**
 * Synthèse narrative du profil de risque, alimentée par le moteur prédictif.
 */
export function generateRiskSummary(ctx: StudentTemplateContext): RiskSummaryResult {
  const name = formatName(ctx);
  const priority = resolvePriority(ctx);
  const probability = ctx.failureProbability ?? 0;
  const factors = ctx.riskFactors ?? [];
  const weaknesses = ctx.weaknesses ?? [];

  const levelLabel =
    priority === "CRITICAL"
      ? "critique"
      : priority === "HIGH"
        ? "élevé"
        : priority === "MEDIUM"
          ? "modéré"
          : "faible";

  let summary = `${name} présente un risque d'échec ${levelLabel}`;
  if (probability > 0) {
    summary += ` (probabilité estimée : ${Math.round(probability)} %)`;
  }
  summary += ".";

  if (factors.length > 0) {
    summary += ` Facteurs identifiés : ${factors.slice(0, 4).join(", ")}.`;
  }

  if (ctx.generalAverage !== null && ctx.generalAverage !== undefined) {
    summary += ` Moyenne actuelle : ${ctx.generalAverage.toFixed(2)}/20.`;
  }

  if (ctx.attendanceRate !== null && ctx.attendanceRate !== undefined && ctx.attendanceRate < 85) {
    summary += ` Assiduité insuffisante (${ctx.attendanceRate.toFixed(0)} %).`;
  }

  if (weaknesses.length > 0) {
    summary += ` Matières à surveiller : ${weaknesses.slice(0, 3).join(", ")}.`;
  }

  const recommendations: string[] = [
    ...(ctx.failureRecommendations ?? []),
  ];

  if (priority === "CRITICAL" || priority === "HIGH") {
    recommendations.push("Organiser un entretien tripartite (élève, parents, équipe pédagogique) sous 7 jours.");
    recommendations.push("Mettre en place un tutorat ciblé sur les matières en difficulté.");
  } else if (priority === "MEDIUM") {
    recommendations.push("Renforcer le suivi hebdomadaire des devoirs et des évaluations.");
  } else {
    recommendations.push("Maintenir l'encouragement et le suivi habituel.");
  }

  const uniqueRecommendations = Array.from(new Set(recommendations)).slice(0, 6);

  const suggestedActions: RiskSummaryResult["suggestedActions"] = [];

  if (weaknesses.length > 0) {
    suggestedActions.push({
      title: "Renforcement académique",
      description: `Tutorat ou séances de remédiation en ${weaknesses.slice(0, 2).join(" et ")}.`,
      type: "Pédagogique",
    });
  }

  if (ctx.attendanceRate !== null && ctx.attendanceRate !== undefined && ctx.attendanceRate < 85) {
    suggestedActions.push({
      title: "Suivi de l'assiduité",
      description: "Contrôle quotidien des présences et alerte immédiate des parents en cas d'absence non justifiée.",
      type: "Suivi",
    });
  }

  if (priority === "CRITICAL" || priority === "HIGH") {
    suggestedActions.push({
      title: "Accompagnement personnalisé",
      description: "Entretien avec le conseiller d'orientation et élaboration d'un plan d'intervention individualisé.",
      type: "Orientation",
    });
  }

  if (suggestedActions.length === 0) {
    suggestedActions.push({
      title: "Suivi régulier",
      description: "Poursuivre le suivi pédagogique habituel et valoriser les points forts observés.",
      type: "Suivi",
    });
  }

  return {
    summary,
    priority,
    recommendations: uniqueRecommendations,
    suggestedActions,
  };
}
