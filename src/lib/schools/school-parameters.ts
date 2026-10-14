/**
 * Paramètres de l'établissement — toutes les valeurs « métier » qui étaient
 * écrites en dur dans l'application (seuils d'alerte, délais, poids des
 * analyses, niveaux de performance…). Définitions pures : utilisables par le
 * serveur ET par les pages (même validation des deux côtés).
 *
 * Principes (identiques aux règles de calcul) :
 *   - chaque paramètre a une valeur par défaut = l'ancien comportement ;
 *   - des bornes de sécurité (jamais de valeur absurde) et des cohérences
 *     (seuil critique < seuil d'alerte, poids qui totalisent 100 %…) ;
 *   - chaque changement est tracé (avant / après).
 * Le seuil de passage et le barème des mentions restent dans leurs écrans
 * (configuration académique, règles de l'établissement) : ils ne sont pas
 * dupliqués ici, les tableaux de bord les lisent directement.
 */
import { z } from "zod";

export const SCHOOL_PARAMETERS_CATEGORY = "SCHOOL_PARAMETERS";
export const SCHOOL_PARAMETERS_CODE = "DEFAULT";

export interface ParameterInfo {
    key: string;
    label: string;
    help?: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    default: number;
}

export interface ParameterSection {
    key: string;
    title: string;
    description: string;
    params: readonly ParameterInfo[];
}

const p = <K extends string>(
    key: K,
    label: string,
    unit: string,
    min: number,
    max: number,
    def: number,
    help?: string,
    step = 1,
) => ({ key, label, unit, min, max, step, default: def, help });

export const PARAMETER_SECTIONS = [
    {
        key: "performance",
        title: "Niveaux de performance",
        description:
            "Tranches utilisées par les graphiques et les niveaux affichés (excellent, très bien…). Le seuil de réussite est celui de la configuration académique.",
        params: [
            p("excellentFrom", "Excellent à partir de", "/20", 0, 20, 16, undefined, 0.25),
            p("veryGoodFrom", "Très bien à partir de", "/20", 0, 20, 14, undefined, 0.25),
            p("goodFrom", "Bien à partir de", "/20", 0, 20, 12, undefined, 0.25),
            p("weakBelow", "Faible en dessous de", "/20", 0, 20, 8, "Sous ce niveau, la moyenne est « faible » ; entre ce niveau et le seuil de réussite, « insuffisante ».", 0.25),
            p("topStudentsFrom", "Élèves remarquables à partir de", "/20", 0, 20, 15, "Liste des meilleurs élèves des tableaux de bord.", 0.25),
            p("strongChangePercent", "Forte évolution à partir de", "%", 1, 100, 15, "Hausse ou baisse d'une période à l'autre jugée forte."),
            p("changePercent", "Évolution à partir de", "%", 1, 100, 5, "En dessous : moyenne « stable »."),
        ],
    },
    {
        key: "followUp",
        title: "Suivi des élèves et alertes",
        description: "Quand un élève est signalé à surveiller, et à quel niveau de risque.",
        params: [
            p("attendanceWarning", "Assiduité faible en dessous de", "%", 1, 100, 85),
            p("attendanceCritical", "Assiduité critique en dessous de", "%", 1, 100, 70),
            p("averageCritical", "Moyenne critique en dessous de", "/20", 0, 20, 8, undefined, 0.25),
            p("averageVeryLow", "Moyenne très faible en dessous de", "/20", 0, 20, 6, undefined, 0.25),
            p("incidentsWarning", "Plusieurs incidents à partir de", "incidents", 1, 50, 3),
            p("incidentsCritical", "Nombreux incidents à partir de", "incidents", 1, 50, 5),
            p("riskMedium", "Risque moyen à partir de", "points", 1, 100, 20, "Score de risque (notes + assiduité + comportement)."),
            p("riskHigh", "Risque élevé à partir de", "points", 1, 100, 40),
            p("riskCritical", "Risque critique à partir de", "points", 1, 100, 60),
            p("classAbsenceAlert", "Alerte « classe absente » au-delà de", "% d'absences", 1, 100, 15, "La direction est prévenue quand une classe dépasse ce taux d'absences."),
            p("climateExcellentBelow", "Climat de l'école « excellent » sous", "incidents par semaine", 1, 500, 10, "Page Discipline : nombre d'incidents de la semaine pour tout l'établissement."),
            p("climateWatchFrom", "Climat de l'école « à surveiller » à partir de", "incidents par semaine", 1, 500, 20),
        ],
    },
    {
        key: "earlyWarning",
        title: "Alertes précoces",
        description: "Signaux soudains repérés sur une courte période.",
        params: [
            p("windowDays", "Période observée", "jours", 3, 90, 14),
            p("gradeDropPoints", "Chute de moyenne signalée à partir de", "points", 0.5, 20, 3, "Au double, l'alerte est critique.", 0.5),
            p("consecutiveAbsences", "Absences non justifiées d'affilée", "absences", 1, 30, 3),
            p("homeworkStopMinDue", "Devoirs non rendus (minimum)", "devoirs", 1, 30, 2, "Au double, l'alerte est critique."),
            p("behaviorSpikeCount", "Incidents graves sur la période", "incidents", 1, 30, 2),
        ],
    },
    {
        key: "analysis",
        title: "Analyses prédictives",
        description: "Données prises en compte et poids de chaque facteur. Les poids d'un même modèle doivent totaliser 100 %.",
        params: [
            p("attendanceWindowDays", "Assiduité observée sur", "jours", 7, 365, 90),
            p("behaviorWindowDays", "Comportement observé sur", "jours", 7, 365, 180),
            p("homeworkWindowDays", "Devoirs observés sur", "jours", 7, 365, 90),
            p("minHistory", "Périodes minimum pour une prévision", "périodes", 2, 10, 3),
            p("trendDropPoints", "Baisse inquiétante à partir de", "points par période", 0.25, 10, 1, undefined, 0.25),
            p("homeworkCriticalBelow", "Devoirs rendus : critique en dessous de", "%", 1, 100, 50),
            p("homeworkWarningBelow", "Devoirs rendus : faible en dessous de", "%", 1, 100, 70),
            p("weakSubjectsAlert", "Alerte à partir de", "matières faibles", 1, 20, 3),
            p("dropoutWindowDays", "Décrochage : période récente comparée à la précédente", "jours", 7, 120, 30),
            p("signalStrongFrom", "Décrochage : signal « fort » à partir de", "points sur 100", 1, 100, 70),
            p("signalMediumFrom", "Décrochage : signal « moyen » à partir de", "points sur 100", 1, 100, 40),
            p("inactivityDays", "Décrochage : inactivité inquiétante après", "jours", 1, 60, 7),
            p("classRiskUrgentShare", "Classe : intervention urgente au-delà de", "% d'élèves à risque", 1, 100, 30),
            p("classRiskWatchShare", "Classe : surveillance au-delà de", "% d'élèves à risque", 1, 100, 15),
            p("behaviorRecencyDays", "Comportement : incidents pris en compte sur", "jours", 7, 365, 90, "Un incident pèse moins à mesure qu'il vieillit, jusqu'à 20 % de son poids."),
            p("behaviorWeightCritical", "Comportement : poids d'un incident critique", "points", 0, 100, 30),
            p("behaviorWeightHigh", "Comportement : poids d'un incident grave", "points", 0, 100, 15),
            p("behaviorWeightMedium", "Comportement : poids d'un incident moyen", "points", 0, 100, 6),
            p("behaviorWeightLow", "Comportement : poids d'un incident léger", "points", 0, 100, 2),
            p("behaviorLevelHigh", "Comportement : risque élevé à partir de", "%", 1, 100, 70),
            p("behaviorLevelModerate", "Comportement : risque modéré à partir de", "%", 1, 100, 40),
            p("behaviorLevelLow", "Comportement : risque faible à partir de", "%", 1, 100, 20),
            p("failureWeightResults", "Risque d'échec — poids des résultats", "%", 0, 100, 35),
            p("failureWeightAttendance", "Risque d'échec — poids de l'assiduité", "%", 0, 100, 25),
            p("failureWeightBehavior", "Risque d'échec — poids du comportement", "%", 0, 100, 20),
            p("failureWeightHomework", "Risque d'échec — poids des devoirs", "%", 0, 100, 15),
            p("failureWeightWeakSubjects", "Risque d'échec — poids des matières faibles", "%", 0, 100, 5),
            p("dropoutWeightAttendanceTrend", "Décrochage — évolution de l'assiduité", "%", 0, 100, 30),
            p("dropoutWeightConsecutiveAbsences", "Décrochage — absences consécutives", "%", 0, 100, 20),
            p("dropoutWeightHomework", "Décrochage — abandon des devoirs", "%", 0, 100, 20),
            p("dropoutWeightGrades", "Décrochage — effondrement des notes", "%", 0, 100, 15),
            p("dropoutWeightBehavior", "Décrochage — hausse des incidents", "%", 0, 100, 10),
            p("dropoutWeightRecency", "Décrochage — activité récente", "%", 0, 100, 5),
            p("levelVeryHigh", "Niveau « très élevé » à partir de", "%", 1, 100, 75),
            p("levelHigh", "Niveau « élevé » à partir de", "%", 1, 100, 55),
            p("levelModerate", "Niveau « modéré » à partir de", "%", 1, 100, 35),
            p("levelLow", "Niveau « faible » à partir de", "%", 1, 100, 15),
        ],
    },
    {
        key: "exams",
        title: "Examens et orientation",
        description: "Lecture des résultats pour le CEP, le BEPC et l'orientation.",
        params: [
            p("examUncertainty", "Écart habituel entre moyenne de classe et note d'examen", "points", 0.5, 6, 2, "Plus il est grand, plus l'estimation des chances est prudente. À ajuster d'après les résultats passés de l'école.", 0.25),
            p("strongSubjectFrom", "Matière forte à partir de", "/20", 0, 20, 14, "Préparation aux examens.", 0.25),
            p("cepMentionGoodFrom", "CEP : « mention Bien » projetée à partir de", "/20", 0, 20, 14, undefined, 0.25),
            p("examAtRiskBelow", "Candidat à risque en dessous de", "% de réussite estimée", 1, 100, 50),
            p("examConfidentFrom", "Candidat confiant à partir de", "% de réussite estimée", 1, 100, 70),
            p("orientationStrengthFrom", "Orientation : point fort à partir de", "/20", 0, 20, 12, undefined, 0.25),
            p("orientationWeakBelow", "Orientation : point de vigilance en dessous de", "/20", 0, 20, 10, undefined, 0.25),
            p("orientationBelowAdvisedPenalty", "Orientation : retrait si la moyenne générale est sous le niveau conseillé", "points sur 100", 0, 50, 15),
        ],
    },
    {
        key: "competences",
        title: "Compétences",
        description: "Lecture des notes en niveaux de compétence, et valeur de chaque niveau.",
        params: [
            p("acquiredFrom", "Acquis à partir de", "/20", 0, 20, 14, undefined, 0.25),
            p("inProgressFrom", "En cours à partir de", "/20", 0, 20, 10, undefined, 0.25),
            p("scoreAcquired", "Valeur d'un « Acquis »", "/20", 0, 20, 16, undefined, 0.25),
            p("scoreInProgress", "Valeur d'un « En cours »", "/20", 0, 20, 12, undefined, 0.25),
            p("scoreNotAcquired", "Valeur d'un « Non acquis »", "/20", 0, 20, 8, undefined, 0.25),
        ],
    },
    {
        key: "finance",
        title: "Finances",
        description: "Relances de paiement et échéanciers.",
        params: [
            p("reminderLeadDays", "Rappel avant l'échéance", "jours", 0, 60, 7),
            p("criticalOverdueDays", "Retard critique après", "jours", 1, 365, 30),
            p("minInstallmentAmount", "Montant minimum d'une échéance", "FCFA", 1, 10_000_000, 10),
        ],
    },
    {
        key: "services",
        title: "Communication et services",
        description: "Délais du cahier de liaison, des codes parents, de la cantine et de la bibliothèque.",
        params: [
            p("liaisonSignatureDays", "Délai de signature d'un mot du cahier de liaison", "jours", 1, 90, 14),
            p("parentLinkCodeDays", "Validité d'un code de rattachement parent", "jours", 1, 90, 14),
            p("canteenTicketDays", "Validité d'un ticket de cantine", "jours", 1, 365, 30),
            p("libraryLoanDays", "Durée d'un prêt de bibliothèque (proposée)", "jours", 1, 120, 14),
        ],
    },
] as const;

type Sections = typeof PARAMETER_SECTIONS;
type SectionKey = Sections[number]["key"];
type ParamsOf<K extends SectionKey> = Extract<Sections[number], { key: K }>["params"][number]["key"];
export type SchoolParameters = { [K in SectionKey]: Record<ParamsOf<K>, number> };

function sectionSchema(section: ParameterSection) {
    const shape: Record<string, z.ZodNumber> = {};
    for (const info of section.params) {
        shape[info.key] = z
            .number({ error: `${info.label} : nombre attendu` })
            .min(info.min, `${info.label} : au moins ${info.min}`)
            .max(info.max, `${info.label} : au plus ${info.max}`);
    }
    return z.object(shape);
}

const sum = (...xs: number[]) => xs.reduce((a, b) => a + b, 0);
const decreasing = (values: number[]) => values.every((x, i) => i === 0 || values[i - 1] > x);

/** Cohérences entre paramètres (messages en français). */
function coherenceIssues(v: SchoolParameters): Array<{ message: string; section: string }> {
    const out: Array<{ message: string; section: string }> = [];
    const fail = (message: string, section: string) => out.push({ message, section });
    const perf = v.performance;
    if (!decreasing([perf.excellentFrom, perf.veryGoodFrom, perf.goodFrom, perf.weakBelow])) {
        fail("Niveaux de performance : excellent > très bien > bien > faible.", "performance");
    }
    if (perf.changePercent >= perf.strongChangePercent) fail("L'évolution simple doit être inférieure à la forte évolution.", "performance");
    const f = v.followUp;
    if (f.attendanceCritical >= f.attendanceWarning) fail("L'assiduité critique doit être inférieure à l'assiduité faible.", "followUp");
    if (f.averageVeryLow >= f.averageCritical) fail("La moyenne très faible doit être inférieure à la moyenne critique.", "followUp");
    if (f.incidentsWarning >= f.incidentsCritical) fail("« Plusieurs incidents » doit être inférieur à « nombreux incidents ».", "followUp");
    if (!(f.riskMedium < f.riskHigh && f.riskHigh < f.riskCritical)) fail("Niveaux de risque : moyen < élevé < critique.", "followUp");
    if (f.climateExcellentBelow > f.climateWatchFrom) fail("Climat : le seuil « excellent » ne peut pas dépasser le seuil « à surveiller ».", "followUp");
    const a = v.analysis;
    if (sum(a.failureWeightResults, a.failureWeightAttendance, a.failureWeightBehavior, a.failureWeightHomework, a.failureWeightWeakSubjects) !== 100) {
        fail("Les poids du risque d'échec doivent totaliser 100 %.", "analysis");
    }
    if (
        sum(
            a.dropoutWeightAttendanceTrend,
            a.dropoutWeightConsecutiveAbsences,
            a.dropoutWeightHomework,
            a.dropoutWeightGrades,
            a.dropoutWeightBehavior,
            a.dropoutWeightRecency,
        ) !== 100
    ) {
        fail("Les poids du décrochage doivent totaliser 100 %.", "analysis");
    }
    if (!decreasing([a.behaviorLevelHigh, a.behaviorLevelModerate, a.behaviorLevelLow])) fail("Comportement : risque élevé > modéré > faible.", "analysis");
    if (!(a.behaviorWeightCritical >= a.behaviorWeightHigh && a.behaviorWeightHigh >= a.behaviorWeightMedium && a.behaviorWeightMedium >= a.behaviorWeightLow)) {
        fail("Comportement : un incident plus grave ne peut pas peser moins qu'un incident moins grave.", "analysis");
    }
    if (a.classRiskWatchShare >= a.classRiskUrgentShare) fail("Classe : le seuil de surveillance doit être inférieur au seuil d'intervention.", "analysis");
    if (a.homeworkCriticalBelow >= a.homeworkWarningBelow) fail("Devoirs rendus : le seuil critique doit être inférieur au seuil faible.", "analysis");
    if (a.signalMediumFrom >= a.signalStrongFrom) fail("Décrochage : le signal « moyen » doit commencer avant le signal « fort ».", "analysis");
    if (!decreasing([a.levelVeryHigh, a.levelHigh, a.levelModerate, a.levelLow])) {
        fail("Niveaux de risque prédictif : très élevé > élevé > modéré > faible.", "analysis");
    }
    if (v.exams.orientationWeakBelow > v.exams.orientationStrengthFrom) fail("Orientation : le seuil de vigilance ne peut pas dépasser le seuil de point fort.", "exams");
    if (v.exams.examAtRiskBelow >= v.exams.examConfidentFrom) fail("« Candidat à risque » doit être inférieur à « candidat confiant ».", "exams");
    const c = v.competences;
    if (c.inProgressFrom >= c.acquiredFrom) fail("« En cours » doit commencer avant « Acquis ».", "competences");
    if (!decreasing([c.scoreAcquired, c.scoreInProgress, c.scoreNotAcquired])) fail("Valeurs des niveaux : Acquis > En cours > Non acquis.", "competences");
    // Une compétence enregistrée doit être relue au même niveau dans la grille.
    if (c.scoreAcquired < c.acquiredFrom || c.scoreInProgress < c.inProgressFrom || c.scoreInProgress >= c.acquiredFrom || c.scoreNotAcquired >= c.inProgressFrom)
        fail("Chaque valeur de niveau doit tomber dans sa propre plage (ex. « En cours » entre le seuil « En cours » et le seuil « Acquis »).", "competences");
    return out;
}

/** Validation complète : bornes de chaque paramètre et cohérences entre paramètres. */
export const schoolParametersSchema = z
    .object(Object.fromEntries(PARAMETER_SECTIONS.map((s) => [s.key, sectionSchema(s)])))
    .superRefine((raw, ctx) => {
        for (const issue of coherenceIssues(raw as unknown as SchoolParameters)) {
            ctx.addIssue({ code: "custom", message: issue.message, path: [issue.section] });
        }
    });

export const DEFAULT_SCHOOL_PARAMETERS = Object.fromEntries(
    PARAMETER_SECTIONS.map((s) => [s.key, Object.fromEntries(s.params.map((info) => [info.key, info.default]))]),
) as SchoolParameters;

/**
 * Fusionne un réglage enregistré avec les défauts, paramètre par paramètre :
 * une valeur absente ou hors bornes retombe sur la valeur par défaut. Si les
 * cohérences ne tiennent plus (donnée ancienne), la section entière revient
 * au défaut plutôt que de produire des alertes incohérentes.
 */
export function resolveSchoolParameters(stored: unknown): SchoolParameters {
    const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, Record<string, unknown> | undefined>;
    const merged: Record<string, Record<string, number>> = {};
    for (const section of PARAMETER_SECTIONS) {
        const values: Record<string, number> = {};
        for (const info of section.params) {
            const value = raw[section.key]?.[info.key];
            values[info.key] =
                typeof value === "number" && Number.isFinite(value) && value >= info.min && value <= info.max ? value : info.default;
        }
        merged[section.key] = values;
    }
    const defaults = DEFAULT_SCHOOL_PARAMETERS as unknown as Record<string, Record<string, number>>;
    for (const issue of coherenceIssues(merged as unknown as SchoolParameters)) {
        merged[issue.section] = { ...defaults[issue.section] };
    }
    return merged as unknown as SchoolParameters;
}

/** Niveau de performance d'une moyenne selon les tranches de l'école. */
export function performanceLevel(
    average: number | null,
    perf: SchoolParameters["performance"],
    passingGrade: number,
): "EXCELLENT" | "VERY_GOOD" | "GOOD" | "AVERAGE" | "INSUFFICIENT" | "WEAK" | null {
    if (average === null || !Number.isFinite(average)) return null;
    if (average >= perf.excellentFrom) return "EXCELLENT";
    if (average >= perf.veryGoodFrom) return "VERY_GOOD";
    if (average >= perf.goodFrom) return "GOOD";
    if (average >= passingGrade) return "AVERAGE";
    if (average >= perf.weakBelow) return "INSUFFICIENT";
    return "WEAK";
}

const fmtNumber = (x: number) => String(x).replace(".", ",");

export type OfficialRiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Niveau de risque OFFICIEL d'un élève (le même partout : analyses
 * enregistrées, tableaux de bord, écrans de risques). Grille de points :
 * moyenne (40 / 30 / 15), assiduité (30 / 15), incidents (20 / 10), puis
 * niveaux aux seuils réglés par l'école. Une donnée absente (pas de moyenne,
 * pas d'appel) n'ajoute aucun point : elle n'est jamais lue comme 0.
 */
export function assessRisk(
    average: number | null,
    attendanceRate: number | null,
    incidentsCount: number,
    f: SchoolParameters["followUp"] = DEFAULT_SCHOOL_PARAMETERS.followUp,
    passingGrade = 10,
): { level: OfficialRiskLevel; score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    if (average !== null && Number.isFinite(average)) {
        if (average < f.averageVeryLow) {
            score += 40;
            factors.push(`Moyenne très faible (< ${fmtNumber(f.averageVeryLow)})`);
        } else if (average < f.averageCritical) {
            score += 30;
            factors.push(`Moyenne faible (< ${fmtNumber(f.averageCritical)})`);
        } else if (average < passingGrade) {
            score += 15;
            factors.push(`Moyenne insuffisante (< ${fmtNumber(passingGrade)})`);
        }
    }

    if (attendanceRate !== null && Number.isFinite(attendanceRate)) {
        if (attendanceRate < f.attendanceCritical) {
            score += 30;
            factors.push(`Assiduité très faible (${Math.round(attendanceRate)}%)`);
        } else if (attendanceRate < f.attendanceWarning) {
            score += 15;
            factors.push(`Assiduité faible (${Math.round(attendanceRate)}%)`);
        }
    }

    if (incidentsCount >= f.incidentsCritical) {
        score += 20;
        factors.push(`Nombreux incidents (${incidentsCount})`);
    } else if (incidentsCount >= f.incidentsWarning) {
        score += 10;
        factors.push(`Plusieurs incidents (${incidentsCount})`);
    }

    let level: OfficialRiskLevel;
    if (score >= f.riskCritical) level = "CRITICAL";
    else if (score >= f.riskHigh) level = "HIGH";
    else if (score >= f.riskMedium) level = "MEDIUM";
    else if (score > 0) level = "LOW";
    else level = "NONE";

    return { level, score, factors };
}
