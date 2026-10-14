/**
 * Seuils de lecture des notes à l'écran (définitions pures, utilisables par
 * les pages) : seuil de passage, niveaux de performance, seuils de suivi,
 * barème des mentions, moyennes d'admission, seuils du conseil de classe.
 * Servis par GET /api/config/thresholds ; lus par le hook useSchoolThresholds.
 * Les valeurs par défaut reproduisent l'ancien comportement (10 / 12 / 14 / 16…).
 */
import { DEFAULT_MENTION_SCALE, type MentionScale } from "@/lib/academic/grading-rules";
import { DEFAULT_SCHOOL_PARAMETERS, type SchoolParameters } from "@/lib/schools/school-parameters";

export interface SchoolThresholds {
    passingGrade: number;
    performance: SchoolParameters["performance"];
    followUp: SchoolParameters["followUp"];
    mentions: MentionScale;
    cepPassMark: number;
    bepcPassMark: number;
    /** Conseil de classe : tableau d'honneur, encouragements, avertissement de travail. */
    council: { honorMin: number; encouragementMin: number; workWarningBelow: number };
}

export const DEFAULT_SCHOOL_THRESHOLDS: SchoolThresholds = {
    passingGrade: 10,
    performance: DEFAULT_SCHOOL_PARAMETERS.performance,
    followUp: DEFAULT_SCHOOL_PARAMETERS.followUp,
    mentions: DEFAULT_MENTION_SCALE,
    cepPassMark: 10,
    bepcPassMark: 10,
    council: { honorMin: 16, encouragementMin: 14, workWarningBelow: 10 },
};

/** Tranche d'une moyenne /20 aux seuils de l'école (null : pas de moyenne). */
export type GradeBand = "excellent" | "veryGood" | "good" | "pass" | "weak" | "fail";

export function gradeBand(average: number | null | undefined, t: SchoolThresholds): GradeBand | null {
    if (average === null || average === undefined || !Number.isFinite(average)) return null;
    if (average >= t.performance.excellentFrom) return "excellent";
    if (average >= t.performance.veryGoodFrom) return "veryGood";
    if (average >= t.performance.goodFrom) return "good";
    if (average >= t.passingGrade) return "pass";
    if (average >= t.performance.weakBelow) return "weak";
    return "fail";
}

/** Assiduité (%) aux seuils de suivi de l'école. */
export function attendanceBand(rate: number | null | undefined, t: SchoolThresholds): "ok" | "warning" | "critical" | null {
    if (rate === null || rate === undefined || !Number.isFinite(rate)) return null;
    if (rate < t.followUp.attendanceCritical) return "critical";
    if (rate < t.followUp.attendanceWarning) return "warning";
    return "ok";
}

/** Nombre au format français, sans décimales inutiles (14 ; 13,5). */
export function fmtThreshold(n: number): string {
    return String(n).replace(".", ",");
}
