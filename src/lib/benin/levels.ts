import type { SchoolLevel } from "@prisma/client";

/**
 * Référentiel canonique des cycles du système éducatif béninois.
 *
 * Source unique, typée par l'enum `SchoolLevel` (prisma) — évite l'incohérence
 * historique du `levelConfig` (clé "COLLEGE" ≠ enum "SECONDARY_COLLEGE").
 *
 * Cycles RÉELS = PRIMARY / SECONDARY_COLLEGE / SECONDARY_LYCEE.
 * `MIXED` n'est pas un cycle : c'est un méta-niveau d'école multi-cycles —
 * remplacé par `School.offeredLevels` (liste des cycles réellement offerts).
 */

export type RealCycle = "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";
export type FinalExam = "CEP" | "BEPC" | "BAC";

export interface CycleSeries {
  code: string;
  name: string;
}

export interface LevelCycle {
  level: RealCycle;
  label: string;
  shortLabel: string;
  /** Codes des classes-niveaux du cycle (CI…CM2, 6EME…3EME, 2NDE…TLE). */
  grades: string[];
  /** Examen national de fin de cycle. */
  finalExam: FinalExam;
  /** Séries (lycée uniquement). */
  series?: CycleSeries[];
  order: number;
}

// Séries du lycée (second cycle) — codes alignés sur services/orientation.ts
export const LYCEE_SERIES: CycleSeries[] = [
  { code: "SERIE_A1", name: "Série A1 (Littéraire — Lettres et Langues)" },
  { code: "SERIE_A2", name: "Série A2 (Littéraire — Sciences Humaines)" },
  { code: "SERIE_B", name: "Série B (Économique et Social)" },
  { code: "SERIE_C", name: "Série C (Maths-Physique)" },
  { code: "SERIE_D", name: "Série D (Sciences de la Vie)" },
  { code: "SERIE_E", name: "Série E (Maths-Technique)" },
  { code: "SERIE_F1", name: "Série F1 (Fabrication Mécanique)" },
  { code: "SERIE_F2", name: "Série F2 (Électronique)" },
  { code: "SERIE_F3", name: "Série F3 (Électrotechnique)" },
  { code: "SERIE_F4", name: "Série F4 (Génie Civil)" },
  { code: "SERIE_G1", name: "Série G1 (Techniques Administratives)" },
  { code: "SERIE_G2", name: "Série G2 (Techniques Quantitatives de Gestion)" },
  { code: "SERIE_G3", name: "Série G3 (Techniques Commerciales)" },
];

export const LEVEL_CYCLES: Record<RealCycle, LevelCycle> = {
  PRIMARY: {
    level: "PRIMARY",
    label: "Primaire",
    shortLabel: "Primaire",
    grades: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
    finalExam: "CEP",
    order: 1,
  },
  SECONDARY_COLLEGE: {
    level: "SECONDARY_COLLEGE",
    label: "Collège (premier cycle)",
    shortLabel: "Collège",
    grades: ["6EME", "5EME", "4EME", "3EME"],
    finalExam: "BEPC",
    order: 2,
  },
  SECONDARY_LYCEE: {
    level: "SECONDARY_LYCEE",
    label: "Lycée (second cycle)",
    shortLabel: "Lycée",
    grades: ["2NDE", "1ERE", "TLE"],
    finalExam: "BAC",
    series: LYCEE_SERIES,
    order: 3,
  },
};

const REAL_CYCLES: RealCycle[] = ["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE"];

/** Vrai si la valeur d'enum est un cycle réel (≠ MIXED). */
export function isRealCycle(level: SchoolLevel): level is RealCycle {
  return (REAL_CYCLES as string[]).includes(level);
}

/** Les 3 cycles, ordonnés (primaire → collège → lycée). */
export function orderedCycles(): LevelCycle[] {
  return REAL_CYCLES.map((c) => LEVEL_CYCLES[c]);
}

/** Config d'un cycle (null si MIXED ou inconnu). */
export function getCycle(level: SchoolLevel): LevelCycle | null {
  return isRealCycle(level) ? LEVEL_CYCLES[level] : null;
}

export function gradesForLevel(level: SchoolLevel): string[] {
  return getCycle(level)?.grades ?? [];
}

export function examForLevel(level: SchoolLevel): FinalExam | null {
  return getCycle(level)?.finalExam ?? null;
}

export function cycleLabel(level: SchoolLevel): string {
  return getCycle(level)?.label ?? "Multi-cycles";
}

/** Cycle auquel appartient un code de classe-niveau (ex. "3EME" → SECONDARY_COLLEGE). */
export function levelForGrade(gradeCode: string): RealCycle | null {
  const code = gradeCode.trim().toUpperCase();
  for (const cycle of REAL_CYCLES) {
    if (LEVEL_CYCLES[cycle].grades.includes(code)) return cycle;
  }
  return null;
}

/** Examens nationaux offerts par un ensemble de cycles (déduplication ordonnée). */
export function examsForOfferedLevels(offered: SchoolLevel[]): FinalExam[] {
  return orderedCycles()
    .filter((c) => offered.includes(c.level))
    .map((c) => c.finalExam);
}

/** Normalise/ordonne une liste de cycles offerts (filtre MIXED et doublons). */
export function normalizeOfferedLevels(offered: SchoolLevel[]): RealCycle[] {
  return REAL_CYCLES.filter((c) => offered.includes(c));
}
