/**
 * Moteur unique de calcul des moyennes — règles officielles du Bénin.
 *
 *   Moyenne de matière = (MI + D1 + D2 + …) / (1 + nombre de devoirs)
 *     MI = moyenne simple des interrogations (et autres petites évaluations)
 *     Di = devoirs / compositions / examens
 *     → avec 2 devoirs : (MI + D1 + D2) / 3. Sans interrogation : moyenne des
 *       devoirs ; sans devoir : MI.
 *   Moyenne générale = Σ(moyenne matière × coef matière) / Σ coef matière,
 *     sur les seules matières évaluées.
 *   Moyenne annuelle : semestres (S1 + S2) / 2, trimestres (T1 + T2 + T3) / 3 —
 *     on divise par le nombre de périodes de l'année ; tant qu'une période n'a
 *     pas de moyenne, l'annuelle reste PROVISOIRE.
 *
 * Statut d'une note :
 *   - valeur saisie            → comptée (ramenée sur 20)
 *   - absence NON justifiée    → 0, compté (reste modifiable : si l'élève
 *                                recompose, on saisit la note et on retire l'absence)
 *   - absence justifiée / dispense → exclue (la division se fait sur une note de moins)
 *   - note supprimée           → ignorée
 *   - AUCUNE note alors que des camarades sont notés → « NC » : exclue du
 *     calcul tant que le professeur n'a pas tranché (note, absence justifiée →
 *     exclue, absence non justifiée → 0). Rien n'est bloqué.
 *   - matière où des devoirs étaient prévus mais aucun n'est compté → « NC ».
 *   - évaluations antérieures à l'inscription de l'élève dans la classe : ignorées.
 *
 * Précision : fractions EXACTES (BigInt), aucune virgule flottante, un seul
 * arrondi final au centième (demi vers le haut). Rang, mention et décision se
 * fondent sur cette moyenne affichée.
 */

import { Rational, mean, type DecimalLike } from "@/lib/academic/rational";

import { OFFICIAL_ANNUAL_FORMULA, OFFICIAL_SUBJECT_FORMULA, evaluateFormula } from "@/lib/academic/formula";

export { Rational };
export type { DecimalLike };

/** Matière d'une classe pour le calcul : coefficient et, éventuellement, formule de l'enseignant. */
export interface SubjectRef {
    id: string;
    coefficient: DecimalLike;
    /** Formule propre à la matière (choisie par l'enseignant) ; vide = formule de l'école. */
    formula?: string | null;
}

// ─────────────────────────── Nature des évaluations ───────────────────────────

export type EvaluationKind = "INTERROGATION" | "DEVOIR" | "COMPOSITION";

function normalizeLabel(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export interface EvaluationTypeLike {
    code?: string | null;
    name?: string | null;
    /** Réglage explicite de l'établissement : il prime toujours. */
    category?: EvaluationKind | "COMPETENCE" | null;
}

/**
 * Une évaluation de compétence (Acquis / En cours / Non acquis) alimente la
 * grille de compétences mais ne compte JAMAIS dans les moyennes.
 */
export function countsInAverage(type: EvaluationTypeLike | null | undefined): boolean {
    return type?.category !== "COMPETENCE" && normalizeLabel(type?.code) !== "competence";
}

/**
 * Rôle d'une évaluation dans la moyenne. Le réglage explicite du type
 * (« Interrogation » / « Devoir ») fait foi ; à défaut (anciennes données),
 * devoir / DS / composition / examen = devoir, tout le reste = interrogation.
 */
export function evaluationKind(type: EvaluationTypeLike | null | undefined): EvaluationKind {
    if (type?.category === "DEVOIR" || type?.category === "INTERROGATION" || type?.category === "COMPOSITION") {
        return type.category;
    }
    const code = normalizeLabel(type?.code);
    const name = normalizeLabel(type?.name);
    if (["comp", "compo", "composition"].includes(code) || /\bcompositions?\b/.test(name)) return "COMPOSITION";
    if (["ds", "dev", "devoir", "exam", "examen"].includes(code)) return "DEVOIR";
    if (/\b(devoirs?|examens?)\b/.test(name)) return "DEVOIR";
    return "INTERROGATION";
}

// ─────────────────────────── Règles de calcul ───────────────────────────

/**
 * Options de calcul réglables par l'établissement (voir grading-settings) ;
 * les valeurs par défaut sont les règles officielles du Bénin.
 */
export interface CalculationOptions {
    /** Formule de la moyenne d'une matière, écrite par l'école (voir formula.ts). */
    subjectFormula: string;
    unjustifiedAbsence: "ZERO" | "EXCLUDE";
    unresolvedNc: "EXCLUDE" | "ZERO";
    subjectNcWhenNoDevoir: boolean;
    rounding: "HALF_UP" | "TRUNCATE";
    /** Formule de la moyenne annuelle (P1, P2, P3, PERIODES). */
    annualFormula: string;
}

export const OFFICIAL_RULES: CalculationOptions = {
    subjectFormula: OFFICIAL_SUBJECT_FORMULA,
    unjustifiedAbsence: "ZERO",
    unresolvedNc: "EXCLUDE",
    subjectNcWhenNoDevoir: true,
    rounding: "HALF_UP",
    annualFormula: OFFICIAL_ANNUAL_FORMULA,
};

// ─────────────────────────── Calculs ───────────────────────────

export interface AverageGrade {
    value: DecimalLike | null;
    maxGrade: DecimalLike;
    isAbsent: boolean;
    isExcused: boolean;
    deletedAt?: Date | null;
    kind: EvaluationKind;
    /** Note que l'enseignant ne compte pas pour cet élève (décision motivée). */
    excluded?: boolean;
    /** Clé de tri (date puis évaluation) : sert à nommer les notes I1, D1, C1… */
    order?: string;
}

const TWENTY = Rational.int(20);

/**
 * Statut d'une note pour le calcul :
 *   GRADED             note saisie                       → comptée
 *   ABSENT_UNJUSTIFIED absence sans justificatif         → 0
 *   EXCUSED            absence justifiée / dispense      → exclue
 *   EMPTY              « NC » : pas encore tranché       → exclue (décision du professeur)
 *   DELETED            note supprimée                    → ignorée
 */
export type GradeStatus = "GRADED" | "ABSENT_UNJUSTIFIED" | "EXCUSED" | "EXCLUDED" | "EMPTY" | "DELETED";

export function gradeStatus(
    grade: Pick<AverageGrade, "value" | "isAbsent" | "isExcused" | "deletedAt"> & { excluded?: boolean; excludedReason?: string | null },
): GradeStatus {
    if (grade.deletedAt) return "DELETED";
    // Note écartée par l'enseignant pour cet élève : ni comptée, ni « NC »
    if (grade.excluded || (grade.excludedReason ?? "").trim()) return "EXCLUDED";
    if (grade.isExcused) return "EXCUSED";
    if (grade.isAbsent) return "ABSENT_UNJUSTIFIED";
    if (grade.value === null || grade.value === undefined) return "EMPTY";
    return "GRADED";
}

/** Note ramenée sur 20, ou null si elle ne compte pas dans la moyenne. */
function countedOn20(grade: AverageGrade, rules: CalculationOptions): Rational | null {
    const max = Rational.from(grade.maxGrade);
    if (!max.isPositive()) return null;
    switch (gradeStatus(grade)) {
        case "GRADED":
            return Rational.from(grade.value!).div(max).mul(TWENTY);
        case "ABSENT_UNJUSTIFIED":
            return rules.unjustifiedAbsence === "ZERO" ? Rational.ZERO : null;
        // Case vide : jamais comptée ici. Avec la règle « NC = 0 », le 0 n'est
        // ajouté (computeStudentAverages) que si l'évaluation a été corrigée
        // chez les camarades — une évaluation pas encore corrigée ne vaut pas 0.
        default:
            return null;
    }
}

export interface SubjectBreakdown {
    /** Moyenne des interrogations (null s'il n'y en a aucune comptée). */
    mi: Rational | null;
    /** Devoirs comptés, ramenés sur 20. */
    devoirs: Rational[];
    /** Compositions comptées, ramenées sur 20. */
    compositions: Rational[];
    /** Moyenne de la matière, ou null = « NC » (non classé). */
    average: Rational | null;
}

/**
 * Détail exact d'une matière : les notes sont ramenées sur 20 et rangées
 * (interrogations, devoirs, compositions), puis la FORMULE de la matière (celle
 * de l'enseignant si elle existe, sinon celle de l'école) est calculée.
 * `plannedDevoirs` = devoirs (ou compositions) prévus mais sans ligne de note :
 * si des devoirs étaient prévus mais qu'AUCUN n'est compté, la matière est « NC »
 * (règle réglable).
 */
export function subjectBreakdown(
    grades: AverageGrade[],
    plannedDevoirs = 0,
    rules: CalculationOptions = OFFICIAL_RULES,
    formula: string = rules.subjectFormula,
): SubjectBreakdown {
    const interrogations: Rational[] = [];
    const devoirs: Rational[] = [];
    const compositions: Rational[] = [];
    let planned = plannedDevoirs;
    const named = nameGrades(grades, rules);
    for (const grade of grades) {
        // Devoir prévu (une note écartée par l'enseignant ne compte pas comme prévue)
        const status = gradeStatus(grade);
        if (grade.kind !== "INTERROGATION" && status !== "DELETED" && status !== "EXCLUDED") planned += 1;
        const on20 = countedOn20(grade, rules);
        if (on20 === null) continue;
        if (grade.kind === "INTERROGATION") interrogations.push(on20);
        else if (grade.kind === "COMPOSITION") compositions.push(on20);
        else devoirs.push(on20);
    }
    const mi = mean(interrogations);
    if (rules.subjectNcWhenNoDevoir && planned > 0 && devoirs.length === 0 && compositions.length === 0) {
        return { mi, devoirs, compositions, average: null };
    }
    const average = evaluateFormula(formula, {
        ...named,
        MI: mi,
        MD: mean(devoirs),
        MC: mean(compositions),
        INTERROS: interrogations,
        DEVOIRS: devoirs,
        COMPOS: compositions,
    });
    // Garde-fou : une moyenne hors de 0 à 20 n'est jamais imprimée (« NC »)
    if (average !== null && (average.cmp(Rational.ZERO) < 0 || average.cmp(TWENTY) > 0)) {
        return { mi, devoirs, compositions, average: null };
    }
    return { mi, devoirs, compositions, average };
}

const KIND_LETTER: Record<EvaluationKind, "I" | "D" | "C"> = { INTERROGATION: "I", DEVOIR: "D", COMPOSITION: "C" };

function orderKey(date: Date | string | null | undefined, evaluationId: string | undefined): string {
    const d = date ? new Date(date).toISOString() : "";
    return `${d}|${evaluationId ?? ""}`;
}

/**
 * Nom de chaque note de l'élève dans la matière, par famille et par date :
 * I1, I2… (interrogations), D1, D2… (devoirs), C1… (compositions). Une note
 * qui ne compte pas (absence justifiée, note écartée, case vide) garde son nom
 * mais est « vide ». Sert aux formules adaptées pour un élève.
 */
export function gradeLabels<T extends AverageGrade>(grades: T[]): Array<{ grade: T; label: string }> {
    const counters = { I: 0, D: 0, C: 0 };
    return grades
        .filter((g) => gradeStatus(g) !== "DELETED")
        .map((g, i) => ({ g, i }))
        .sort((a, b) => (a.g.order ?? "").localeCompare(b.g.order ?? "") || a.i - b.i)
        .map(({ g }) => {
            const letter = KIND_LETTER[g.kind];
            counters[letter] += 1;
            return { grade: g, label: `${letter}${counters[letter]}` };
        });
}

function nameGrades(grades: AverageGrade[], rules: CalculationOptions): Record<string, Rational | null> {
    const out: Record<string, Rational | null> = {};
    for (const { grade, label } of gradeLabels(grades)) out[label] = countedOn20(grade, rules);
    return out;
}

/** Moyenne exacte d'une matière (voir `subjectBreakdown`). */
export function subjectAverage(
    grades: AverageGrade[],
    plannedDevoirs = 0,
    rules: CalculationOptions = OFFICIAL_RULES,
    formula?: string,
): Rational | null {
    return subjectBreakdown(grades, plannedDevoirs, rules, formula).average;
}

/** Moyenne générale exacte, pondérée par les coefficients de matière. */
export function generalAverage(subjects: Array<{ average: Rational | null; coefficient: DecimalLike }>): Rational | null {
    let weighted = Rational.ZERO;
    let totalCoefficient = Rational.ZERO;
    for (const subject of subjects) {
        if (subject.average === null) continue;
        const coefficient = Rational.from(subject.coefficient);
        if (!coefficient.isPositive()) continue;
        weighted = weighted.add(subject.average.mul(coefficient));
        totalCoefficient = totalCoefficient.add(coefficient);
    }
    return totalCoefficient.isPositive() ? weighted.div(totalCoefficient) : null;
}

/** Moyenne simple exacte des valeurs non nulles (ex. moyenne de la classe). */
export function meanOf(values: Array<Rational | null>): Rational | null {
    return mean(values.filter((v): v is Rational => v !== null));
}

/** Valeur affichée : arrondi unique au centième (demi vers le haut, ou troncature selon l'école). */
export function toDisplay(average: Rational | null, rounding: CalculationOptions["rounding"] = "HALF_UP"): number | null {
    return average === null ? null : Number(average.toCents(rounding)) / 100;
}

/**
 * Rang « olympique » sur la moyenne affichée : 1 + nombre d'élèves dont la
 * moyenne affichée est strictement supérieure ; ex aequo = même rang.
 */
export function competitionRank(displayed: number | null, allDisplayed: Array<number | null>): number | null {
    if (displayed === null) return null;
    const cents = Math.round(displayed * 100);
    return 1 + allDisplayed.filter((v) => v !== null && Math.round(v * 100) > cents).length;
}

// ─────────────────────────── Agrégation par élève ───────────────────────────

export interface GradeRecord {
    classSubjectId: string;
    periodId?: string;
    /** Requis pour détecter les notes « NC ». */
    evaluationId?: string;
    /** Date de l'évaluation (évaluations antérieures à l'inscription ignorées). */
    date?: Date | string | null;
    value: DecimalLike | null;
    isAbsent: boolean;
    isExcused: boolean;
    deletedAt?: Date | null;
    /** Motif si l'enseignant ne compte pas cette note pour l'élève. */
    excludedReason?: string | null;
    maxGrade: DecimalLike;
    type?: EvaluationTypeLike | null;
}

/** Évaluation corrigée dans la classe mais sans note tranchée pour l'élève (« NC »). */
export interface MissingGrade {
    evaluationId: string;
    classSubjectId: string;
    periodId?: string;
    date?: Date | string | null;
    kind?: EvaluationKind;
}

export interface StudentAverages {
    /** Moyennes exactes par classSubjectId (null = « NC », matière non classée). */
    subjects: Map<string, Rational | null>;
    /** Moyenne des interrogations par classSubjectId (colonne MI du bulletin). */
    interrogations: Map<string, Rational | null>;
    general: Rational | null;
    /** Notes « NC » (non tranchées par le professeur) : exclues du calcul, sans rien bloquer. */
    missing: MissingGrade[];
    complete: boolean;
}

export interface AverageOptions {
    /** Date d'inscription de l'élève dans la classe : les évaluations antérieures sont ignorées. */
    enrolledAt?: Date | string | null;
    /** Règles de calcul de l'établissement (défaut : règles officielles). */
    rules?: CalculationOptions;
    /** Formules adaptées pour CET élève par l'enseignant : classSubjectId → formule. */
    studentFormulas?: Map<string, string>;
}

/** Une note « tranchée » : saisie, absence (justifiée ou non) — pas une case vide. */
function isResolved(grade: GradeRecord): boolean {
    const status = gradeStatus(grade);
    return status === "GRADED" || status === "ABSENT_UNJUSTIFIED" || status === "EXCUSED" || status === "EXCLUDED";
}

function dayOf(value: Date | string): number {
    const d = new Date(value);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Évaluation antérieure à l'inscription (jour d'inscription inclus = postérieure). */
function beforeEnrollment(date: Date | string | null | undefined, enrolledAt: Date | string | null | undefined): boolean {
    if (!date || !enrolledAt) return false;
    return dayOf(date) < dayOf(enrolledAt);
}

/**
 * Évaluations déjà corrigées dans la classe (au moins une note tranchée) :
 * c'est l'ensemble des notes que chaque élève devrait avoir.
 */
export function gradedEvaluations(classGrades: GradeRecord[]): MissingGrade[] {
    const seen = new Map<string, MissingGrade>();
    for (const grade of classGrades) {
        if (!grade.evaluationId || !isResolved(grade) || seen.has(grade.evaluationId)) continue;
        if (!countsInAverage(grade.type)) continue;
        seen.set(grade.evaluationId, {
            evaluationId: grade.evaluationId,
            classSubjectId: grade.classSubjectId,
            periodId: grade.periodId,
            date: grade.date,
            kind: evaluationKind(grade.type),
        });
    }
    return Array.from(seen.values());
}

/**
 * Notes d'un élève venues d'une autre classe de l'établissement (changement de
 * classe en cours d'année) : rattachées à la matière identique de la classe
 * actuelle ; les matières absentes de la classe actuelle sont écartées.
 */
export function remapToClass<T extends GradeRecord & { subjectId?: string | null }>(
    records: T[],
    classSubjects: Array<{ id: string; subjectId?: string | null }>,
): T[] {
    const ids = new Set(classSubjects.map((cs) => cs.id));
    const bySubject = new Map(classSubjects.filter((cs) => cs.subjectId).map((cs) => [cs.subjectId as string, cs.id]));
    const out: T[] = [];
    for (const r of records) {
        if (ids.has(r.classSubjectId)) out.push(r);
        else if (r.subjectId && bySubject.has(r.subjectId)) out.push({ ...r, classSubjectId: bySubject.get(r.subjectId)! });
    }
    return out;
}

/**
 * Moyennes d'un élève sur les notes d'UNE période. `expected` (souvent
 * `gradedEvaluations(notes de toute la classe)`) permet de repérer les notes
 * « NC » ; elles sont exclues du calcul, sans rien bloquer.
 */
export function computeStudentAverages(
    grades: GradeRecord[],
    classSubjects: SubjectRef[],
    expected: MissingGrade[] = [],
    options: AverageOptions = {},
): StudentAverages {
    const byClassSubject = new Map<string, AverageGrade[]>();
    const resolved = new Set<string>();
    for (const grade of grades) {
        // Avant l'arrivée de l'élève, seule une note réellement saisie compte
        // (notes de l'ancienne classe rattachées, élèves importés en cours
        // d'année) : une absence ou une case vide de cette époque ne vaut pas 0.
        if (beforeEnrollment(grade.date, options.enrolledAt) && gradeStatus(grade) !== "GRADED") continue;
        if (!countsInAverage(grade.type)) continue;
        if (grade.evaluationId && isResolved(grade)) resolved.add(grade.evaluationId);
        const list = byClassSubject.get(grade.classSubjectId) ?? [];
        list.push({
            value: grade.value,
            maxGrade: grade.maxGrade,
            isAbsent: grade.isAbsent,
            isExcused: grade.isExcused,
            deletedAt: grade.deletedAt,
            excluded: Boolean((grade.excludedReason ?? "").trim()),
            kind: evaluationKind(grade.type),
            order: orderKey(grade.date, grade.evaluationId),
        });
        byClassSubject.set(grade.classSubjectId, list);
    }
    const subjectIds = new Set(classSubjects.map((cs) => cs.id));
    const ownEvaluations = new Set(grades.map((g) => g.evaluationId).filter(Boolean));
    const missing = expected.filter(
        (e) =>
            subjectIds.has(e.classSubjectId) &&
            !resolved.has(e.evaluationId) &&
            !beforeEnrollment(e.date, options.enrolledAt),
    );
    const subjects = new Map<string, Rational | null>();
    const interrogations = new Map<string, Rational | null>();
    const rules = options.rules ?? OFFICIAL_RULES;
    for (const cs of classSubjects) {
        const missingHere = missing.filter((m) => m.classSubjectId === cs.id && !ownEvaluations.has(m.evaluationId));
        const list = [...(byClassSubject.get(cs.id) ?? [])];
        let missingDevoirs = 0;
        if (rules.unresolvedNc === "ZERO") {
            // Règle « NC = 0 » : chaque note attendue non tranchée (absente, ou case
            // vide) compte 0, à sa place (interrogation, devoir…)
            for (const m of missing.filter((x) => x.classSubjectId === cs.id)) {
                list.push({
                    value: 0,
                    maxGrade: 20,
                    isAbsent: false,
                    isExcused: false,
                    kind: m.kind ?? "INTERROGATION",
                    order: orderKey(m.date, m.evaluationId),
                });
            }
        } else {
            // Devoirs manquants sans aucune ligne de note : comptés comme prévus (règle « NC »)
            missingDevoirs = missingHere.filter((m) => m.kind !== undefined && m.kind !== "INTERROGATION").length;
        }
        // Formule adaptée pour cet élève, sinon celle de l'enseignant pour sa
        // matière, sinon celle de l'école
        const formula = options.studentFormulas?.get(cs.id) || cs.formula || rules.subjectFormula;
        const detail = subjectBreakdown(list, missingDevoirs, rules, formula);
        subjects.set(cs.id, detail.average);
        interrogations.set(cs.id, detail.mi);
    }
    return {
        subjects,
        interrogations,
        general: generalAverage(classSubjects.map((cs) => ({ average: subjects.get(cs.id) ?? null, coefficient: cs.coefficient }))),
        missing,
        complete: missing.length === 0,
    };
}

export type PeriodSystem = "TRIMESTER" | "SEMESTER" | "HYBRID";

export interface AnnualAverages {
    /** Moyennes annuelles par matière (null si une période manque). */
    subjects: Map<string, Rational | null>;
    /** Moyennes provisoires par matière : moyenne des périodes où la matière est évaluée. */
    provisionalSubjects: Map<string, Rational | null>;
    /** Moyenne annuelle officielle : null tant qu'une période n'a pas de moyenne. */
    general: Rational | null;
    /** Moyenne provisoire : moyenne des périodes déjà évaluées (pour suivre l'année en cours). */
    provisional: Rational | null;
    periodsExpected: number;
    periodsWithAverage: number;
    missing: MissingGrade[];
    complete: boolean;
}

export interface AnnualOptions extends AverageOptions {
    /** Coefficients figés par période (conseil de classe validé) : periodId → (classSubjectId → coef). */
    coefficientsByPeriod?: Map<string, Map<string, DecimalLike>>;
    /** Formules des matières figées par période (conseil validé) : periodId → (classSubjectId → formule). */
    formulasByPeriod?: Map<string, Map<string, string>>;
    /** Formules adaptées pour cet élève, par période : periodId → (classSubjectId → formule). */
    studentFormulasByPeriod?: Map<string, Map<string, string>>;
    /** Moyennes générales obtenues dans l'établissement d'origine (élève transféré) : periodId → moyenne. */
    externalGenerals?: Map<string, DecimalLike>;
    /** Règles gelées par le conseil de chaque période validée : periodId → règles. */
    rulesByPeriod?: Map<string, CalculationOptions>;
}

/**
 * Moyennes annuelles : (S1 + S2) / 2 en semestres, (T1 + T2 + T3) / 3 en
 * trimestres — le diviseur est le nombre de périodes de l'année (`periods`).
 * Chaque période est calculée séparément avec le moteur ; une période suivie
 * dans l'établissement d'origine prend la moyenne saisie depuis le bulletin de transfert.
 */
export function computeAnnualAverages(
    grades: GradeRecord[],
    classSubjects: SubjectRef[],
    periods: Array<{ id: string }>,
    expected: MissingGrade[] = [],
    options: AnnualOptions = {},
): AnnualAverages {
    const perPeriod = periods.map((period) => {
        const frozen = options.coefficientsByPeriod?.get(period.id);
        const frozenFormulas = options.formulasByPeriod?.get(period.id);
        const subjectsForPeriod = classSubjects.map((cs) => ({
            ...cs,
            coefficient: frozen?.get(cs.id) ?? cs.coefficient,
            formula: frozenFormulas ? frozenFormulas.get(cs.id) ?? null : cs.formula,
        }));
        const computed = computeStudentAverages(
            grades.filter((g) => g.periodId === period.id),
            subjectsForPeriod,
            expected.filter((e) => e.periodId === period.id),
            {
                ...options,
                rules: options.rulesByPeriod?.get(period.id) ?? options.rules,
                studentFormulas: options.studentFormulasByPeriod?.get(period.id),
            },
        );
        const external = options.externalGenerals?.get(period.id);
        if (computed.general === null && external !== undefined && external !== null) {
            return { ...computed, general: Rational.from(external) };
        }
        return computed;
    });
    // Moyenne annuelle : formule de l'école (P1, P2, P3, PERIODES), calculée
    // seulement quand chaque période a sa moyenne ; sinon elle reste provisoire
    const rules = options.rules ?? OFFICIAL_RULES;
    const fullMean = (values: Array<Rational | null>): Rational | null => {
        if (values.length === 0 || values.some((v) => v === null)) return null;
        const known = values as Rational[];
        const vars: Record<string, Rational | Rational[]> = { PERIODES: known };
        known.forEach((v, i) => (vars[`P${i + 1}`] = v));
        const annual = evaluateFormula(rules.annualFormula, vars);
        // Même garde-fou que pour une matière : la validation de la formule ne
        // l'essaie que sur des cas types ; un résultat hors de 0 à 20 n'est
        // jamais publié (« NC »).
        if (annual !== null && (annual.cmp(Rational.ZERO) < 0 || annual.cmp(TWENTY) > 0)) return null;
        return annual;
    };

    const subjects = new Map<string, Rational | null>();
    const provisionalSubjects = new Map<string, Rational | null>();
    for (const cs of classSubjects) {
        const values = perPeriod.map((p) => p.subjects.get(cs.id) ?? null);
        subjects.set(cs.id, fullMean(values));
        provisionalSubjects.set(cs.id, meanOf(values));
    }
    const generals = perPeriod.map((p) => p.general);
    const missing = perPeriod.flatMap((p) => p.missing);
    return {
        subjects,
        provisionalSubjects,
        general: fullMean(generals),
        provisional: meanOf(generals),
        periodsExpected: periods.length,
        periodsWithAverage: generals.filter((g) => g !== null).length,
        missing,
        complete: missing.length === 0 && generals.every((g) => g !== null),
    };
}

/** Nombre de périodes attendu pour un système : 2 semestres, 3 trimestres. */
export function expectedPeriodCount(system: PeriodSystem): number | null {
    if (system === "SEMESTER") return 2;
    if (system === "TRIMESTER") return 3;
    return null;
}
