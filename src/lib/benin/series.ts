/**
 * Référentiel unique des séries du second cycle au Bénin + aide à l'orientation.
 *
 * Intitulés officiels :
 *   Enseignement général : A1 Lettres - Langues · A2 Lettres - Sciences Humaines ·
 *   B Lettres - Sciences Sociales · C Sciences et Techniques (maths, sciences
 *   exactes) · D Biologie - Géologie (sciences expérimentales).
 *   Enseignement technique et professionnel : E Mathématiques et Techniques ·
 *   F1 Construction / Fabrication Mécanique · F2 Électronique · F3 Électrotechnique ·
 *   F4 Génie Civil (BTP) · G1 Techniques Administratives (Secrétariat) ·
 *   G2 Techniques Quantitatives de Gestion · G3 Techniques Commerciales ·
 *   filières DT (Diplôme de Technicien, équivalent du bac) : EA Eau et
 *   Assainissement · MIA Maintenance et Informatique Appliquée · HR Hôtellerie Restauration.
 *
 * L'aide à l'orientation compare les moyennes de l'élève DISCIPLINE PAR
 * DISCIPLINE (maths, physique-chimie, SVT…) aux disciplines clés de chaque série.
 * Les pondérations ci-dessous sont des critères d'aide à la décision : la
 * décision appartient au conseil de classe.
 */
import type { RecommendedSeries } from "@prisma/client";
import { z } from "zod";

export type SeriesTrack = "GENERAL" | "TECHNIQUE";

export interface SeriesInfo {
    code: RecommendedSeries;
    short: string;
    domain: string;
    track: SeriesTrack;
    diploma: "BAC" | "DT";
}

export const OFFICIAL_SERIES: SeriesInfo[] = [
    { code: "SERIE_A1", short: "A1", domain: "Lettres - Langues", track: "GENERAL", diploma: "BAC" },
    { code: "SERIE_A2", short: "A2", domain: "Lettres - Sciences Humaines", track: "GENERAL", diploma: "BAC" },
    { code: "SERIE_B", short: "B", domain: "Lettres - Sciences Sociales", track: "GENERAL", diploma: "BAC" },
    { code: "SERIE_C", short: "C", domain: "Sciences et Techniques", track: "GENERAL", diploma: "BAC" },
    { code: "SERIE_D", short: "D", domain: "Biologie - Géologie", track: "GENERAL", diploma: "BAC" },
    { code: "SERIE_E", short: "E", domain: "Mathématiques et Techniques", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_F1", short: "F1", domain: "Construction / Fabrication Mécanique", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_F2", short: "F2", domain: "Électronique", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_F3", short: "F3", domain: "Électrotechnique", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_F4", short: "F4", domain: "Génie Civil (Bâtiments et Travaux Publics)", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_G1", short: "G1", domain: "Techniques Administratives (Secrétariat)", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_G2", short: "G2", domain: "Techniques Quantitatives de Gestion", track: "TECHNIQUE", diploma: "BAC" },
    { code: "SERIE_G3", short: "G3", domain: "Techniques Commerciales", track: "TECHNIQUE", diploma: "BAC" },
    { code: "EA", short: "EA", domain: "Eau et Assainissement", track: "TECHNIQUE", diploma: "DT" },
    { code: "MIA", short: "MIA", domain: "Maintenance et Informatique Appliquée", track: "TECHNIQUE", diploma: "DT" },
    { code: "HR", short: "HR", domain: "Hôtellerie Restauration", track: "TECHNIQUE", diploma: "DT" },
];

/** Anciennes valeurs encore possibles en base : affichées, jamais proposées. */
const LEGACY_LABELS: Partial<Record<RecommendedSeries, string>> = {
    STI: "STI",
    STA: "STA",
    EFS: "EFS",
    MMV: "MMV",
    TOUR: "Tourisme",
    FORMATION_PRO: "Formation professionnelle",
    APPRENTISSAGE: "Apprentissage",
};

const BY_CODE = new Map(OFFICIAL_SERIES.map((s) => [s.code, s]));

/** Libellé court : « A1 », « EA »… */
export function seriesShortLabel(code: RecommendedSeries | null | undefined): string | null {
    if (!code) return null;
    return BY_CODE.get(code)?.short ?? LEGACY_LABELS[code] ?? code;
}

/** Libellé complet : « Série C — Sciences et Techniques », « DT EA — Eau et Assainissement ». */
export function seriesFullLabel(code: RecommendedSeries): string {
    const info = BY_CODE.get(code);
    if (!info) return LEGACY_LABELS[code] ?? code;
    return info.diploma === "DT" ? `DT ${info.short} — ${info.domain}` : `Série ${info.short} — ${info.domain}`;
}

export type SeriesFamily = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "DT";

/** Famille d'une série pour les répartitions : A1/A2 → A, F1…F4 → F, G1…G3 → G, EA/MIA/HR → DT. */
export function seriesFamily(code: RecommendedSeries | null | undefined): SeriesFamily | null {
    const info = code ? BY_CODE.get(code) : undefined;
    if (!info) return null;
    if (info.diploma === "DT") return "DT";
    return info.short[0] as SeriesFamily;
}

// ─────────────────────────── Disciplines ───────────────────────────

export type Discipline = "MATH" | "PC" | "SVT" | "FR" | "PHILO" | "HG" | "LV" | "ECO" | "TECH" | "EPS" | "ARTS";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
    MATH: "Mathématiques",
    PC: "Physique-Chimie",
    SVT: "SVT",
    FR: "Français",
    PHILO: "Philosophie",
    HG: "Histoire-Géographie",
    LV: "Langues vivantes",
    ECO: "Économie / gestion",
    TECH: "Technologie",
    EPS: "EPS",
    ARTS: "Arts",
};

function normalize(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Discipline d'une matière d'après son intitulé. L'ordre des tests compte :
 * « Éducation Physique » est de l'EPS (pas de la physique), « Sciences
 * économiques et sociales » de l'économie (pas des sciences), « Dessin
 * technique » de la technologie (pas des arts).
 */
export function disciplineOf(subjectName: string): Discipline | null {
    const n = normalize(subjectName);
    const has = (re: RegExp) => re.test(n);
    if (has(/education physique|\beps\b|\bsports?\b/)) return "EPS";
    if (has(/econom|sciences sociales|\bses\b|comptab|gestion|commerc|\bdroit\b|secretariat/)) return "ECO";
    if (has(/physique|chimie|\bpct?\b/)) return "PC";
    if (has(/\bsvt\b|sciences de la vie|biolog|geolog|sciences naturelles/)) return "SVT";
    if (has(/\bmath/)) return "MATH";
    if (has(/philosoph/)) return "PHILO";
    if (has(/histoire|geograph|\bhge?\b/)) return "HG";
    if (has(/francais|lecture|litterature|expression ecrite|redaction|dictee|grammaire|orthographe/)) return "FR";
    if (has(/anglais|allemand|espagnol|arabe|chinois|portugais|\blangues?\b|\blv\d?\b/)) return "LV";
    if (has(/technolog|dessin technique|informatique|electroni|electrotechn|mecanique|genie civil|electricite|construction/)) return "TECH";
    if (has(/\barts?\b|artistique|musique|\bdessin\b/)) return "ARTS";
    return null;
}

// ─────────────────────────── Profils des séries ───────────────────────────

interface SeriesProfile {
    /** Disciplines indispensables (poids) : une absence de note réduit le score. */
    core: Partial<Record<Discipline, number>>;
    /** Disciplines d'appoint (poids) : comptées si elles sont évaluées, sans pénalité sinon
     *  (ex. la philosophie, non enseignée au collège). */
    extra?: Partial<Record<Discipline, number>>;
    /** Moyenne générale conseillée. */
    minAverage: number;
}

const TECH_PROFILE: SeriesProfile = { core: { TECH: 3, MATH: 2, PC: 2 }, minAverage: 10 };

export const DISCIPLINES = ["MATH", "PC", "SVT", "FR", "PHILO", "HG", "LV", "ECO", "TECH", "EPS", "ARTS"] as const;
const weightsSchema = z.partialRecord(z.enum(DISCIPLINES), z.number().int().min(1).max(10));

/** Critères d'orientation modifiables par l'école : une entrée par série officielle. */
export const seriesProfilesSchema = z
    .record(
        z.string(),
        z.object({
            core: weightsSchema.refine((w) => Object.keys(w).length > 0, {
                message: "Une série doit avoir au moins une discipline indispensable.",
            }),
            extra: weightsSchema.optional(),
            minAverage: z.number().min(0).max(20),
        }),
    )
    .refine((profiles) => OFFICIAL_SERIES.every((s) => profiles[s.code]), {
        message: "Chaque série officielle doit avoir ses critères.",
    });
export type SeriesProfiles = Record<string, SeriesProfile>;

export const DEFAULT_SERIES_PROFILES: SeriesProfiles = {
    SERIE_A1: { core: { FR: 3, LV: 3 }, extra: { PHILO: 1, HG: 1 }, minAverage: 10 },
    SERIE_A2: { core: { FR: 3, HG: 3 }, extra: { PHILO: 2, LV: 1 }, minAverage: 10 },
    SERIE_B: { core: { HG: 3, FR: 2, MATH: 1 }, extra: { ECO: 3 }, minAverage: 10 },
    SERIE_C: { core: { MATH: 4, PC: 3 }, extra: { SVT: 1 }, minAverage: 12 },
    SERIE_D: { core: { SVT: 4, PC: 2, MATH: 2 }, minAverage: 11 },
    SERIE_E: { core: { MATH: 3, PC: 2, TECH: 3 }, minAverage: 11 },
    SERIE_F1: TECH_PROFILE,
    SERIE_F2: TECH_PROFILE,
    SERIE_F3: TECH_PROFILE,
    SERIE_F4: TECH_PROFILE,
    SERIE_G1: { core: { FR: 3, LV: 2, ECO: 1 }, minAverage: 9 },
    SERIE_G2: { core: { MATH: 3, ECO: 2 }, extra: { FR: 1 }, minAverage: 10 },
    SERIE_G3: { core: { LV: 2, FR: 2, ECO: 2 }, extra: { MATH: 1 }, minAverage: 9 },
    EA: { core: { PC: 2, SVT: 2, TECH: 1 }, extra: { MATH: 1 }, minAverage: 9 },
    MIA: { core: { TECH: 3, MATH: 2 }, extra: { PC: 1 }, minAverage: 9 },
    HR: { core: { LV: 3, FR: 2, ECO: 1 }, minAverage: 8 },
};

export interface SeriesScore {
    series: RecommendedSeries;
    name: string;
    description: string;
    /** 0 à 100 : aptitude dans les disciplines clés × part des disciplines évaluées. */
    score: number;
    strengths: string[];
    warnings: string[];
}

const fmt = (v: number) => v.toFixed(2).replace(".", ",");

/** Moyenne de chaque discipline à partir des moyennes par matière (/20). */
export function disciplineAverages(subjects: Array<{ name: string; average: number | null }>): Map<Discipline, number> {
    const buckets = new Map<Discipline, number[]>();
    for (const s of subjects) {
        const discipline = disciplineOf(s.name);
        if (!discipline || s.average === null) continue;
        buckets.set(discipline, [...(buckets.get(discipline) ?? []), s.average]);
    }
    return new Map(Array.from(buckets, ([d, values]) => [d, values.reduce((a, b) => a + b, 0) / values.length]));
}

/**
 * Classe toutes les séries officielles pour un élève. Égalité de score :
 * ordre officiel des séries.
 */
/** Seuils de lecture réglés par l'école (paramètres « Examens et orientation »). */
export interface SeriesReadingThresholds {
    strengthFrom: number;
    weakBelow: number;
    belowAdvisedPenalty: number;
}
export const DEFAULT_SERIES_READING: SeriesReadingThresholds = { strengthFrom: 12, weakBelow: 10, belowAdvisedPenalty: 15 };

/** Seuils de lecture à partir des paramètres « Examens et orientation » de l'école. */
export function seriesReadingFor(exams: {
    orientationStrengthFrom: number;
    orientationWeakBelow: number;
    orientationBelowAdvisedPenalty: number;
}): SeriesReadingThresholds {
    return {
        strengthFrom: exams.orientationStrengthFrom,
        weakBelow: exams.orientationWeakBelow,
        belowAdvisedPenalty: exams.orientationBelowAdvisedPenalty,
    };
}

export function rankSeries(
    averages: Map<Discipline, number>,
    generalAverage: number | null,
    profiles: SeriesProfiles = DEFAULT_SERIES_PROFILES,
    reading: SeriesReadingThresholds = DEFAULT_SERIES_READING,
): SeriesScore[] {
    return OFFICIAL_SERIES.map((info, order) => {
        const profile = profiles[info.code] ?? DEFAULT_SERIES_PROFILES[info.code];
        let weighted = 0;
        let weightUsed = 0;
        let coreTotal = 0;
        let coreAvailable = 0;
        const strengths: string[] = [];
        const warnings: string[] = [];
        const criteria: Array<[Discipline, number, boolean]> = [
            ...(Object.entries(profile.core) as Array<[Discipline, number]>).map(([d, w]): [Discipline, number, boolean] => [d, w, true]),
            ...(Object.entries(profile.extra ?? {}) as Array<[Discipline, number]>).map(([d, w]): [Discipline, number, boolean] => [d, w, false]),
        ];
        for (const [discipline, weight, isCore] of criteria) {
            if (isCore) coreTotal += weight;
            const avg = averages.get(discipline);
            if (avg === undefined) {
                if (isCore) warnings.push(`Aucune note en ${DISCIPLINE_LABELS[discipline]} : critère non évalué`);
                continue;
            }
            if (isCore) coreAvailable += weight;
            weighted += avg * weight;
            weightUsed += weight;
            if (avg >= reading.strengthFrom) strengths.push(`${DISCIPLINE_LABELS[discipline]} : ${fmt(avg)}/20`);
            else if (avg < reading.weakBelow) warnings.push(`${DISCIPLINE_LABELS[discipline]} : ${fmt(avg)}/20`);
        }
        const aptitude = weightUsed > 0 ? weighted / weightUsed : 0;
        let score = aptitude * 5 * (coreAvailable / coreTotal);
        if (generalAverage !== null && generalAverage < profile.minAverage) {
            score -= reading.belowAdvisedPenalty;
            warnings.push(`Moyenne générale ${fmt(generalAverage)}/20 sous le niveau conseillé (${profile.minAverage}/20)`);
        }
        return {
            order,
            series: info.code,
            name: seriesFullLabel(info.code),
            description: info.domain,
            score: Math.max(0, Math.min(100, Math.round(score))),
            strengths,
            warnings,
        };
    })
        .sort((a, b) => b.score - a.score || a.order - b.order)
        .map(({ order: _order, ...rest }) => rest);
}
