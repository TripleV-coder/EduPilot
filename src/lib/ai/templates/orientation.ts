import type { OrientationTemplateResult, StudentTemplateContext } from "./types";

const SCIENCE_KEYWORDS = ["math", "physique", "chimie", "svt", "sciences"];
const LITERATURE_KEYWORDS = ["français", "philosophie", "histoire", "géo", "lettres", "littérature", "langue"];
const ECONOMY_KEYWORDS = ["économie", "gestion", "comptabilité", "commerce"];

function subjectAverage(
  performances: StudentTemplateContext["subjectPerformances"],
  keywords: string[]
): number | null {
  if (!performances?.length) return null;
  const matches = performances.filter((p) =>
    keywords.some((kw) => p.subjectName.toLowerCase().includes(kw))
  );
  if (matches.length === 0) return null;
  const sum = matches.reduce((acc, p) => acc + (p.average ?? 0), 0);
  return sum / matches.length;
}

function formatName(ctx: StudentTemplateContext): string {
  return [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim() || "L'élève";
}

/**
 * Synthèse d'orientation scolaire (système béninois) à partir des performances réelles.
 */
export function generateOrientationSynthesis(ctx: StudentTemplateContext): OrientationTemplateResult {
  const name = formatName(ctx);
  const generalAverage = ctx.generalAverage ?? 0;
  const performances = ctx.subjectPerformances ?? [];
  const strengths = ctx.strengths ?? [];

  const sciAvg = subjectAverage(performances, SCIENCE_KEYWORDS) ?? 0;
  const litAvg = subjectAverage(performances, LITERATURE_KEYWORDS) ?? 0;
  const ecoAvg = subjectAverage(performances, ECONOMY_KEYWORDS) ?? 0;

  let series: string;
  let justification: string;
  let alternatives: string[];

  if (sciAvg >= 13 && sciAvg >= litAvg) {
    series = "SERIE_C";
    justification = `Profil scientifique solide (moyenne sciences : ${sciAvg.toFixed(1)}/20). La série C convient pour approfondir mathématiques et physique-chimie.`;
    alternatives = ["SERIE_D", "SERIE_E"];
  } else if (sciAvg >= 11 && sciAvg > litAvg) {
    series = "SERIE_D";
    justification = `Bonnes aptitudes en sciences naturelles (${sciAvg.toFixed(1)}/20). La série D permet de valoriser le profil SVT et sciences expérimentales.`;
    alternatives = ["SERIE_C", "SERIE_E"];
  } else if (litAvg >= 13 && litAvg > sciAvg) {
    series = "SERIE_A1";
    justification = `Excellentes performances littéraires (${litAvg.toFixed(1)}/20). La série A1 est adaptée pour les langues, le français et la philosophie.`;
    alternatives = ["SERIE_A2", "SERIE_B"];
  } else if (litAvg >= 11 && litAvg >= sciAvg) {
    series = "SERIE_A2";
    justification = `Profil littéraire et sciences humaines affirmé (${litAvg.toFixed(1)}/20). La série A2 offre une voie équilibrée en histoire-géographie et langues.`;
    alternatives = ["SERIE_A1", "SERIE_B"];
  } else if (ecoAvg >= 11) {
    series = "SERIE_G";
    justification = `Aptitudes en gestion et économie (${ecoAvg.toFixed(1)}/20). Les séries G conviennent pour un parcours tertiaire et commercial.`;
    alternatives = ["SERIE_B", "SERIE_A2"];
  } else if (generalAverage >= 12) {
    series = "SERIE_D";
    justification = `Profil polyvalent avec une moyenne générale de ${generalAverage.toFixed(1)}/20. La série D offre une base scientifique équilibrée.`;
    alternatives = ["SERIE_C", "SERIE_A2"];
  } else {
    series = "SERIE_D";
    justification = `Moyenne générale de ${generalAverage.toFixed(1)}/20. La série D constitue une orientation prudente et polyvalente pour consolider les acquis.`;
    alternatives = ["SERIE_G", "SERIE_A2"];
  }

  const strengthText =
    strengths.length > 0
      ? ` Points forts observés : ${strengths.slice(0, 3).join(", ")}.`
      : "";

  const synthesis = `${name}${ctx.className ? ` (${ctx.className})` : ""} — orientation recommandée : ${series.replace("SERIE_", "Série ")}. ${justification}${strengthText} Alternatives envisageables : ${alternatives.map((s) => s.replace("SERIE_", "Série ")).join(", ")}.`;

  return { series, justification, alternatives, synthesis };
}
