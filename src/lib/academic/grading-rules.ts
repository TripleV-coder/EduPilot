/**
 * Règles de l'établissement : définitions pures (validation, valeurs par
 * défaut, mentions), sans accès à la base — utilisables aussi dans les pages
 * (même validation côté écran et côté serveur). Lecture / écriture : voir
 * grading-settings.ts.
 */
import { z } from "zod";
import { DEFAULT_SERIES_PROFILES, seriesProfilesSchema, type SeriesProfiles } from "@/lib/benin/series";
import {
    OFFICIAL_ANNUAL_FORMULA,
    OFFICIAL_SUBJECT_FORMULA,
    legacyAnnualFormula,
    legacySubjectFormula,
    validateFormula,
} from "@/lib/academic/formula";

export const GRADING_SETTINGS_CATEGORY = "GRADING_SETTINGS";
export const GRADING_SETTINGS_CODE = "DEFAULT";

// ─────────────────────────── Calcul des moyennes ───────────────────────────

/** Formule d'une matière écrite par l'école ou l'enseignant, vérifiée avant enregistrement. */
export const subjectFormulaSchema = z
    .preprocess(legacySubjectFormula, z.string().trim().min(1, "La formule est vide.").max(300))
    .superRefine((text, ctx) => {
        const check = validateFormula(text, "SUBJECT");
        if (!check.ok) ctx.addIssue({ code: "custom", message: check.error });
    });

/** Formule de la moyenne annuelle (contrôlée ici pour 3 périodes au plus ; l'API la recontrôle selon l'année). */
export const annualFormulaSchema = z
    .string()
    .trim()
    .min(1, "La formule est vide.")
    .max(300)
    .superRefine((text, ctx) => {
        const check = validateFormula(text, "ANNUAL", 3);
        if (!check.ok) ctx.addIssue({ code: "custom", message: check.error });
    });

export const calculationRulesSchema = z.preprocess(
    // Anciennes règles (choix entre options, poids de périodes) → formules
    (raw) => {
        if (typeof raw !== "object" || raw === null) return raw;
        const { periodWeights, ...rest } = raw as Record<string, unknown>;
        return { ...rest, annualFormula: legacyAnnualFormula(rest.annualFormula, periodWeights) };
    },
    z.object({
        /** Formule de la moyenne d'une matière (par défaut : règle officielle du Bénin). */
        subjectFormula: subjectFormulaSchema,
        /** Absence non justifiée à une évaluation : 0, ou retirée du calcul. */
        unjustifiedAbsence: z.enum(["ZERO", "EXCLUDE"]),
        /** Note « NC » que le professeur n'a pas encore tranchée : retirée du calcul, ou 0. */
        unresolvedNc: z.enum(["EXCLUDE", "ZERO"]),
        /** Matière « NC » quand des devoirs étaient prévus mais qu'aucun n'est compté. */
        subjectNcWhenNoDevoir: z.boolean(),
        /** Arrondi final au centième : demi vers le haut, ou troncature. */
        rounding: z.enum(["HALF_UP", "TRUNCATE"]),
        /** Formule de la moyenne annuelle (par défaut : moyenne des périodes). */
        annualFormula: annualFormulaSchema,
    }),
);
export type CalculationRules = z.infer<typeof calculationRulesSchema>;

export const DEFAULT_CALCULATION_RULES: CalculationRules = {
    subjectFormula: OFFICIAL_SUBJECT_FORMULA,
    unjustifiedAbsence: "ZERO",
    unresolvedNc: "EXCLUDE",
    subjectNcWhenNoDevoir: true,
    rounding: "HALF_UP",
    annualFormula: OFFICIAL_ANNUAL_FORMULA,
};

// ─────────────────────────── Mentions ───────────────────────────

const mentionSchema = z.object({
    label: z.string().trim().min(1).max(40),
    /** Moyenne minimale (incluse) pour obtenir la mention. */
    min: z.number().min(0).max(20),
});

export const mentionScaleSchema = z
    .array(mentionSchema)
    .min(2)
    .max(10)
    .refine((list) => list[0]?.min === 0, { message: "La première mention doit commencer à 0." })
    .refine((list) => list.every((m, i) => i === 0 || m.min > list[i - 1].min), {
        message: "Les seuils des mentions doivent être strictement croissants.",
    });
export type MentionScale = z.infer<typeof mentionScaleSchema>;

export const DEFAULT_MENTION_SCALE: MentionScale = [
    { label: "Échec", min: 0 },
    { label: "Passable", min: 10 },
    { label: "Assez bien", min: 12 },
    { label: "Bien", min: 14 },
    { label: "Très bien", min: 16 },
    { label: "Excellent", min: 18 },
];

/** Mention d'une moyenne affichée selon le barème de l'école. */
export function mentionFor(average: number | null, scale: MentionScale = DEFAULT_MENTION_SCALE): string | null {
    if (average === null || !Number.isFinite(average)) return null;
    let label: string | null = null;
    for (const m of scale) if (average >= m.min) label = m.label;
    return label;
}

// ─────────────────────────── Ensemble des règles ───────────────────────────

export const gradingSettingsSchema = z.object({
    calculation: calculationRulesSchema,
    mentions: mentionScaleSchema,
    /** Afficher le rang par promotion (même niveau, toutes classes) en plus du rang de classe. */
    promotionRank: z.boolean(),
    /** Autoriser le rachat (passage sous le seuil), uniquement après conseil de classe validé. */
    rescueAfterCouncil: z.boolean(),
    /** Moyenne retenue pour le pronostic du CEP (à confirmer par l'établissement). */
    cepPassMark: z.number().min(0).max(20),
    /** Moyenne d'admissibilité retenue pour le pronostic du BEPC. */
    bepcPassMark: z.number().min(0).max(20),
    /** Saisie des notes : pas autorisé (0,01 = deux décimales ; 0,25 = quarts de point ; 0,5 ; 1). */
    gradeStep: z.enum(["0.01", "0.25", "0.5", "1"]),
    /** Motif obligatoire pour une absence justifiée. */
    excuseReasonRequired: z.boolean(),
    /** Chaque enseignant peut écrire la formule de sa matière (sinon : formule de l'école partout). */
    teacherFormulas: z.boolean(),
    /** L'enseignant peut adapter le calcul pour un élève (note non comptée, formule particulière). */
    studentAdjustments: z.boolean(),
    /** Critères d'orientation (disciplines indispensables, d'appoint, moyenne conseillée par série). */
    orientation: seriesProfilesSchema,
});

export type GradingSettings = z.infer<typeof gradingSettingsSchema>;

export const DEFAULT_GRADING_SETTINGS: GradingSettings = {
    calculation: DEFAULT_CALCULATION_RULES,
    mentions: DEFAULT_MENTION_SCALE,
    promotionRank: false,
    rescueAfterCouncil: false,
    cepPassMark: 10,
    bepcPassMark: 10,
    gradeStep: "0.01",
    excuseReasonRequired: true,
    teacherFormulas: true,
    studentAdjustments: true,
    orientation: DEFAULT_SERIES_PROFILES,
};

/**
 * Fusionne un réglage enregistré avec les défauts, section par section : une
 * section invalide (donnée ancienne ou corrompue) retombe sur le défaut au lieu
 * de fausser un calcul.
 */
export function resolveGradingSettings(stored: unknown): GradingSettings {
    const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
    const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
        const parsed = schema.safeParse(value);
        return parsed.success ? parsed.data : fallback;
    };
    const calcRaw = (typeof raw.calculation === "object" && raw.calculation !== null ? raw.calculation : {}) as Record<string, unknown>;
    return {
        calculation: pick(calculationRulesSchema, { ...DEFAULT_CALCULATION_RULES, ...calcRaw }, DEFAULT_CALCULATION_RULES),
        mentions: pick(mentionScaleSchema, raw.mentions, DEFAULT_MENTION_SCALE),
        promotionRank: pick(z.boolean(), raw.promotionRank, DEFAULT_GRADING_SETTINGS.promotionRank),
        rescueAfterCouncil: pick(z.boolean(), raw.rescueAfterCouncil, DEFAULT_GRADING_SETTINGS.rescueAfterCouncil),
        cepPassMark: pick(z.number().min(0).max(20), raw.cepPassMark, DEFAULT_GRADING_SETTINGS.cepPassMark),
        bepcPassMark: pick(z.number().min(0).max(20), raw.bepcPassMark, DEFAULT_GRADING_SETTINGS.bepcPassMark),
        gradeStep: pick(gradingSettingsSchema.shape.gradeStep, raw.gradeStep, DEFAULT_GRADING_SETTINGS.gradeStep),
        excuseReasonRequired: pick(z.boolean(), raw.excuseReasonRequired, DEFAULT_GRADING_SETTINGS.excuseReasonRequired),
        teacherFormulas: pick(z.boolean(), raw.teacherFormulas, DEFAULT_GRADING_SETTINGS.teacherFormulas),
        studentAdjustments: pick(z.boolean(), raw.studentAdjustments, DEFAULT_GRADING_SETTINGS.studentAdjustments),
        orientation: pick(seriesProfilesSchema, raw.orientation, DEFAULT_SERIES_PROFILES),
    };
}

/** Règles de calcul gelées par un conseil de classe validé, sinon null. */
export function frozenCalculationRules(stored: unknown): CalculationRules | null {
    if (typeof stored !== "object" || stored === null) return null;
    const parsed = calculationRulesSchema.safeParse((stored as Record<string, unknown>).calculation ?? stored);
    return parsed.success ? parsed.data : null;
}

export type { SeriesProfiles };

/**
 * Formules des matières gelées par un conseil validé (matière → formule
 * effective au moment du conseil), sinon null.
 */
export function frozenSubjectFormulas(stored: unknown): Map<string, string> | null {
    if (typeof stored !== "object" || stored === null) return null;
    const map = (stored as Record<string, unknown>).subjectFormulas;
    if (typeof map !== "object" || map === null) return null;
    const out = new Map<string, string>();
    for (const [id, text] of Object.entries(map as Record<string, unknown>)) {
        if (typeof text === "string" && text.trim()) out.set(id, text);
    }
    return out;
}
