import type { OrientationTemplateResult, StudentTemplateContext } from "./types";
import { disciplineAverages, rankSeries, type SeriesProfiles, type SeriesReadingThresholds } from "@/lib/benin/series";

function formatName(ctx: StudentTemplateContext): string {
  return [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim() || "L'élève";
}

/**
 * Synthèse d'orientation scolaire (système béninois) à partir des performances réelles.
 */
export function generateOrientationSynthesis(
  ctx: StudentTemplateContext,
  profiles?: SeriesProfiles,
  reading?: SeriesReadingThresholds
): OrientationTemplateResult {
  const name = formatName(ctx);
  const generalAverage = ctx.generalAverage ?? 0;
  const performances = ctx.subjectPerformances ?? [];
  const strengths = ctx.strengths ?? [];

  // Même aide à l'orientation que partout ailleurs : disciplines réelles
  // (maths, physique-chimie, SVT…) comparées aux disciplines clés des séries officielles.
  const ranking = rankSeries(
    disciplineAverages(performances.map((p) => ({ name: p.subjectName, average: p.average ?? null }))),
    ctx.generalAverage ?? null,
    profiles,
    reading
  );
  const [top, ...others] = ranking;
  const series = top.series as string;
  const alternatives = others.slice(0, 2).map((r) => r.series as string);
  const justification =
    `${top.name} (adéquation ${top.score}/100, moyenne générale ${generalAverage.toFixed(2).replace(".", ",")}/20).` +
    (top.strengths.length > 0 ? ` Atouts : ${top.strengths.join(", ")}.` : "") +
    (top.warnings.length > 0 ? ` Points de vigilance : ${top.warnings.join(" ; ")}.` : "");

  const strengthText =
    strengths.length > 0
      ? ` Points forts observés : ${strengths.slice(0, 3).join(", ")}.`
      : "";

  const synthesis = `${name}${ctx.className ? ` (${ctx.className})` : ""} — orientation recommandée : ${top.name}. ${justification}${strengthText} Alternatives envisageables : ${others.slice(0, 2).map((r) => r.name).join(", ")}.`;

  return { series, score: top.score, justification, alternatives, synthesis };
}
