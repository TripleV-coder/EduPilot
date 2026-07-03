import type { StudentTemplateContext } from "./types";

function formatName(ctx: StudentTemplateContext): string {
  const name = [ctx.firstName, ctx.lastName].filter(Boolean).join(" ").trim();
  return name || "L'élève";
}

function pickProgressionPhrase(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "";
  if (rate > 1.5) return " Une nette progression se dessine sur la période.";
  if (rate > 0.3) return " Des progrès encourageants sont à noter.";
  if (rate < -1.5) return " Une baisse sensible des résultats appelle vigilance.";
  if (rate < -0.3) return " Les résultats marquent un léger recul.";
  return " Les résultats restent globalement stables.";
}

/**
 * Génère une appréciation de bulletin naturelle à partir des données réelles.
 */
export function generateAppreciation(ctx: StudentTemplateContext): string {
  const name = formatName(ctx);
  const average = ctx.generalAverage ?? 0;
  const strengths = ctx.strengths ?? [];
  const weaknesses = ctx.weaknesses ?? [];
  const progression = pickProgressionPhrase(ctx.progressionRate);

  let main: string;

  if (average >= 16) {
    main = `${name} réalise un trimestre remarquable avec une moyenne de ${average.toFixed(2)}/20.`;
    if (strengths.length > 0) {
      main += ` ${name} excelle particulièrement en ${strengths.slice(0, 2).join(" et ")}.`;
    }
    main += " L'implication et la rigueur sont exemplaires ; il convient de maintenir cet élan.";
  } else if (average >= 14) {
    main = `${name} affiche de très bons résultats (${average.toFixed(2)}/20) et fait preuve d'une bonne maîtrise des apprentissages.`;
    if (strengths.length > 0) {
      main += ` Points forts en ${strengths.slice(0, 2).join(" et ")}.`;
    }
    main += " Quelques efforts ciblés permettraient d'atteindre l'excellence.";
  } else if (average >= 12) {
    main = `${name} obtient un trimestre satisfaisant avec ${average.toFixed(2)}/20.`;
    if (weaknesses.length > 0) {
      main += ` Un travail de consolidation est attendu en ${weaknesses.slice(0, 2).join(" et ")}.`;
    } else {
      main += " L'ensemble des matières est correctement maîtrisé.";
    }
    main += " La poursuite des efforts réguliers reste essentielle.";
  } else if (average >= 10) {
    main = `${name} termine la période avec ${average.toFixed(2)}/20, un niveau juste mais fragile.`;
    if (weaknesses.length > 0) {
      main += ` Des lacunes persistent en ${weaknesses.slice(0, 3).join(", ")}.`;
    }
    main += " Une implication plus soutenue et un travail méthodique sont indispensables.";
  } else if (average > 0) {
    main = `${name} traverse une période difficile (${average.toFixed(2)}/20).`;
    if (weaknesses.length > 0) {
      main += ` Les difficultés sont marquées en ${weaknesses.slice(0, 3).join(", ")}.`;
    }
    main += " Un plan de remédiation et un suivi rapproché sont recommandés pour la suite.";
  } else {
    main = `${name} ne dispose pas encore de notes suffisantes pour une appréciation détaillée. Un suivi attentif sera mené dès les premières évaluations.`;
  }

  if (ctx.attendanceRate !== null && ctx.attendanceRate !== undefined && ctx.attendanceRate < 85) {
    main += ` L'assiduité (${ctx.attendanceRate.toFixed(0)} %) mérite également une attention particulière.`;
  }

  return (main + progression).trim();
}
