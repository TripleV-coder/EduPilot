/**
 * Moyennes d'une CLASSE (période ou année), calculées une seule fois et de la
 * même façon pour le bulletin, le bulletin PDF, le conseil de classe et les
 * analyses. S'appuie sur le moteur unique (average-engine).
 *
 * Règles appliquées ici (docs/QUESTIONS_NOTES_MOYENNES.md) :
 *   - effectif = élèves inscrits ACTIFS (un abandon n'est plus compté) ;
 *   - rang olympique par classe sur la moyenne affichée ;
 *   - coefficients figés par le conseil de classe validé de la période ;
 *   - notes d'une autre classe de l'établissement rattachées à la matière
 *     identique (changement de classe) ;
 *   - évaluations antérieures à l'inscription dans la classe ignorées ;
 *   - moyennes de l'établissement d'origine pour les périodes non suivies (annuel).
 */
import prisma from "@/lib/prisma";
import {
    OFFICIAL_RULES,
    competitionRank,
    computeAnnualAverages,
    computeStudentAverages,
    gradedEvaluations,
    meanOf,
    remapToClass,
    toDisplay,
    type AnnualAverages,
    type CalculationOptions,
    type GradeRecord,
    type StudentAverages,
} from "@/lib/academic/average-engine";
import { frozenCalculationRules, frozenSubjectFormulas, getGradingSettings } from "@/lib/academic/grading-settings";

type DecimalLike = number | string | { toString(): string };

export interface ClassSubjectRef {
    id: string;
    subjectId: string;
    coefficient: DecimalLike;
}

type RecordWithSubject = GradeRecord & { studentId: string; subjectId: string | null };

const gradeSelect = {
    studentId: true,
    evaluationId: true,
    value: true,
    isAbsent: true,
    isExcused: true,
    excludedReason: true,
    evaluation: {
        select: {
            date: true,
            maxGrade: true,
            periodId: true,
            classSubjectId: true,
            classSubject: { select: { subjectId: true } },
            type: { select: { code: true, name: true, category: true } },
        },
    },
} as const;

interface RawGrade {
    studentId: string;
    evaluationId: string;
    value: DecimalLike | null;
    isAbsent: boolean;
    isExcused: boolean;
    excludedReason?: string | null;
    evaluation: {
        date: Date;
        maxGrade: DecimalLike;
        periodId: string;
        classSubjectId: string;
        classSubject: { subjectId: string } | null;
        type: { code: string; name: string; category: "INTERROGATION" | "DEVOIR" | "COMPOSITION" | "COMPETENCE" } | null;
    };
}

function toRecord(g: RawGrade): RecordWithSubject {
    return {
        studentId: g.studentId,
        evaluationId: g.evaluationId,
        classSubjectId: g.evaluation.classSubjectId,
        subjectId: g.evaluation.classSubject?.subjectId ?? null,
        periodId: g.evaluation.periodId,
        date: g.evaluation.date,
        value: g.value,
        isAbsent: g.isAbsent,
        isExcused: g.isExcused,
        excludedReason: g.excludedReason ?? null,
        maxGrade: g.evaluation.maxGrade,
        type: g.evaluation.type,
    };
}

/**
 * Formules adaptées par l'enseignant pour des élèves précis :
 * periodId → studentId → (classSubjectId → formule).
 */
async function studentFormulasOf(
    classSubjectIds: string[],
    periodIds: string[],
): Promise<Map<string, Map<string, Map<string, string>>>> {
    const out = new Map<string, Map<string, Map<string, string>>>();
    if (classSubjectIds.length === 0 || periodIds.length === 0) return out;
    const rows = await prisma.studentFormula.findMany({
        where: { classSubjectId: { in: classSubjectIds }, periodId: { in: periodIds } },
        select: { classSubjectId: true, periodId: true, studentId: true, formula: true },
    });
    for (const r of rows) {
        const byStudent = out.get(r.periodId) ?? new Map<string, Map<string, string>>();
        const bySubject = byStudent.get(r.studentId) ?? new Map<string, string>();
        bySubject.set(r.classSubjectId, r.formula);
        byStudent.set(r.studentId, bySubject);
        out.set(r.periodId, byStudent);
    }
    return out;
}

/**
 * Règles de calcul applicables à une classe : celles gelées par le conseil
 * validé de la période si elles existent, sinon les règles actuelles de l'école.
 */
async function schoolSettingsForClass(classId: string): Promise<{ calculation: CalculationOptions; teacherFormulas: boolean }> {
    const klass = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!klass?.schoolId) return { calculation: OFFICIAL_RULES, teacherFormulas: true };
    const settings = await getGradingSettings(klass.schoolId);
    return { calculation: settings.calculation, teacherFormulas: settings.teacherFormulas };
}

async function schoolRulesForClass(classId: string): Promise<CalculationOptions> {
    return (await schoolSettingsForClass(classId)).calculation;
}

/**
 * Formules choisies par les enseignants des matières de la classe, lues ici
 * (et non fournies par l'appelant) : aucun écran ne peut les oublier.
 */
async function teacherFormulasOf(classId: string, allowed: boolean): Promise<Map<string, string>> {
    if (!allowed) return new Map();
    const rows = await prisma.classSubject.findMany({
        where: { classId, averageFormula: { not: null } },
        select: { id: true, averageFormula: true },
    });
    return new Map(rows.filter((r) => r.averageFormula?.trim()).map((r) => [r.id, r.averageFormula as string]));
}

function asCoefficientMap(value: unknown): Map<string, DecimalLike> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return new Map(Object.entries(value as Record<string, DecimalLike>));
}

export interface StudentPeriodResult {
    studentId: string;
    enrolledAt: Date | null;
    averages: StudentAverages;
    /** Moyenne générale affichée (centième), null = non classé. */
    general: number | null;
    rank: number | null;
}

export interface ClassPeriodResult {
    students: Map<string, StudentPeriodResult>;
    /** Effectif : inscrits actifs. */
    classSize: number;
    /** Élèves classés (moyenne générale calculable). */
    rankedCount: number;
    classGeneralAverage: number | null;
    subjectStats: Map<string, { average: number | null; min: number | null; max: number | null }>;
    /** Coefficients appliqués (figés si le conseil est validé). */
    coefficients: Map<string, DecimalLike>;
    /** Règles de calcul appliquées (gelées si le conseil est validé). */
    rules: CalculationOptions;
    councilValidated: boolean;
}

/** Moyennes de période de tous les élèves inscrits actifs d'une classe. */
export async function computeClassPeriod(params: {
    classId: string;
    periodId: string;
    academicYearId: string;
    classSubjects: ClassSubjectRef[];
}): Promise<ClassPeriodResult> {
    const { classId, periodId, academicYearId, classSubjects } = params;
    const [enrollments, council] = await Promise.all([
        prisma.enrollment.findMany({
            where: { classId, academicYearId, status: "ACTIVE" },
            select: { studentId: true, enrolledAt: true },
        }),
        prisma.classCouncil.findUnique({
            where: { classId_periodId: { classId, periodId } },
            select: { coefficients: true, rules: true },
        }),
    ]);
    const frozen = council ? asCoefficientMap(council.coefficients) : null;
    const school = await schoolSettingsForClass(classId);
    const rules = frozenCalculationRules(council?.rules) ?? school.calculation;
    const show = (v: Parameters<typeof toDisplay>[0]) => toDisplay(v, rules.rounding);
    const studentIds = enrollments.map((e) => e.studentId);
    const grades = studentIds.length
        ? ((await prisma.grade.findMany({
              where: { studentId: { in: studentIds }, deletedAt: null, evaluation: { periodId } },
              select: gradeSelect,
          })) as unknown as RawGrade[])
        : [];

    const coefficients = new Map(classSubjects.map((cs) => [cs.id, frozen?.get(cs.id) ?? cs.coefficient]));
    // Formule de chaque matière : celle gelée par le conseil, sinon celle de
    // l'enseignant (si l'école le permet), sinon celle de l'école
    const frozenFormulas = council ? frozenSubjectFormulas(council.rules) : null;
    const live = frozenFormulas ? new Map<string, string>() : await teacherFormulasOf(classId, school.teacherFormulas);
    const subjectsWithCoef = classSubjects.map((cs) => ({
        id: cs.id,
        coefficient: coefficients.get(cs.id)!,
        formula: frozenFormulas ? frozenFormulas.get(cs.id) ?? null : live.get(cs.id) ?? null,
    }));
    const records = remapToClass(grades.map(toRecord), classSubjects);
    const expected = gradedEvaluations(records);
    // Calculs adaptés par l'enseignant pour des élèves précis (figés au conseil :
    // ils ne peuvent plus être modifiés une fois la période validée)
    const adapted = (await studentFormulasOf(classSubjects.map((cs) => cs.id), [periodId])).get(periodId);

    const students = new Map<string, StudentPeriodResult>();
    for (const e of enrollments) {
        const averages = computeStudentAverages(
            records.filter((r) => r.studentId === e.studentId),
            subjectsWithCoef,
            expected,
            { enrolledAt: e.enrolledAt, rules, studentFormulas: adapted?.get(e.studentId) },
        );
        students.set(e.studentId, {
            studentId: e.studentId,
            enrolledAt: e.enrolledAt,
            averages,
            general: show(averages.general),
            rank: null,
        });
    }
    const all = Array.from(students.values()).map((s) => s.general);
    for (const s of students.values()) s.rank = competitionRank(s.general, all);

    const subjectStats = new Map<string, { average: number | null; min: number | null; max: number | null }>();
    for (const cs of classSubjects) {
        const exact = Array.from(students.values()).map((s) => s.averages.subjects.get(cs.id) ?? null);
        const shown = exact.map(show).filter((v): v is number => v !== null);
        subjectStats.set(cs.id, {
            average: show(meanOf(exact)),
            min: shown.length ? Math.min(...shown) : null,
            max: shown.length ? Math.max(...shown) : null,
        });
    }

    return {
        students,
        classSize: enrollments.length,
        rankedCount: all.filter((v) => v !== null).length,
        classGeneralAverage: show(meanOf(Array.from(students.values()).map((s) => s.averages.general))),
        subjectStats,
        coefficients,
        rules,
        councilValidated: council !== null,
    };
}

export interface StudentAnnualResult {
    studentId: string;
    annual: AnnualAverages;
    /** Moyenne annuelle officielle affichée (null tant qu'une période manque). */
    general: number | null;
    /** Moyenne provisoire affichée (périodes déjà évaluées). */
    provisional: number | null;
    rank: number | null;
}

/**
 * Moyennes annuelles de tous les élèves inscrits actifs d'une classe :
 * (S1 + S2) / 2 ou (T1 + T2 + T3) / 3, rang sur la moyenne annuelle.
 */
export async function computeClassAnnual(params: {
    classId: string;
    academicYearId: string;
    classSubjects: ClassSubjectRef[];
}): Promise<{ students: Map<string, StudentAnnualResult>; classSize: number; periods: Array<{ id: string }> }> {
    const { classId, academicYearId, classSubjects } = params;
    const [enrollments, periods, councils] = await Promise.all([
        prisma.enrollment.findMany({
            where: { classId, academicYearId, status: "ACTIVE" },
            select: { studentId: true, enrolledAt: true },
        }),
        prisma.period.findMany({ where: { academicYearId }, select: { id: true }, orderBy: { sequence: "asc" } }),
        prisma.classCouncil.findMany({ where: { classId }, select: { periodId: true, coefficients: true, rules: true } }),
    ]);
    const school = await schoolSettingsForClass(classId);
    const rules = school.calculation;
    const rulesByPeriod = new Map<string, CalculationOptions>();
    const formulasByPeriod = new Map<string, Map<string, string>>();
    for (const c of councils) {
        const frozenRules = frozenCalculationRules(c.rules);
        if (frozenRules) rulesByPeriod.set(c.periodId, frozenRules);
        const frozenFormulas = frozenSubjectFormulas(c.rules);
        if (frozenFormulas) formulasByPeriod.set(c.periodId, frozenFormulas);
    }
    const live = await teacherFormulasOf(classId, school.teacherFormulas);
    const subjectsWithFormula = classSubjects.map((cs) => ({ ...cs, formula: live.get(cs.id) ?? null }));
    const studentIds = enrollments.map((e) => e.studentId);
    const grades = studentIds.length
        ? ((await prisma.grade.findMany({
              where: { studentId: { in: studentIds }, deletedAt: null, evaluation: { period: { academicYearId } } },
              select: gradeSelect,
          })) as unknown as RawGrade[])
        : [];
    const externals = studentIds.length
        ? await prisma.externalPeriodAverage.findMany({
              where: { studentId: { in: studentIds }, period: { academicYearId } },
              select: { studentId: true, periodId: true, average: true },
          })
        : [];

    const coefficientsByPeriod = new Map<string, Map<string, DecimalLike>>();
    for (const c of councils) {
        const map = asCoefficientMap(c.coefficients);
        if (map) coefficientsByPeriod.set(c.periodId, map);
    }
    const records = remapToClass(grades.map(toRecord), classSubjects);
    const expected = gradedEvaluations(records);
    const adapted = await studentFormulasOf(
        classSubjects.map((cs) => cs.id),
        periods.map((p) => p.id),
    );

    const students = new Map<string, StudentAnnualResult>();
    for (const e of enrollments) {
        const studentFormulasByPeriod = new Map<string, Map<string, string>>();
        for (const [periodId, byStudent] of adapted) {
            const mine = byStudent.get(e.studentId);
            if (mine) studentFormulasByPeriod.set(periodId, mine);
        }
        const annual = computeAnnualAverages(
            records.filter((r) => r.studentId === e.studentId),
            subjectsWithFormula,
            periods,
            expected,
            {
                enrolledAt: e.enrolledAt,
                rules,
                rulesByPeriod,
                coefficientsByPeriod,
                formulasByPeriod,
                studentFormulasByPeriod,
                externalGenerals: new Map(
                    externals.filter((x) => x.studentId === e.studentId).map((x) => [x.periodId, x.average]),
                ),
            },
        );
        students.set(e.studentId, {
            studentId: e.studentId,
            annual,
            general: toDisplay(annual.general, rules.rounding),
            provisional: toDisplay(annual.provisional, rules.rounding),
            rank: null,
        });
    }
    const all = Array.from(students.values()).map((s) => s.general);
    for (const s of students.values()) s.rank = competitionRank(s.general, all);
    return { students, classSize: enrollments.length, periods };
}

/**
 * Rang par promotion (option de l'établissement) : tous les élèves inscrits
 * actifs des classes d'un même niveau, sur leur moyenne de période (ou leur
 * moyenne annuelle si `periodId` est omis). Effectif = élèves classés.
 */
export async function computePromotionRanks(params: {
    schoolId: string;
    classLevelId: string;
    academicYearId: string;
    periodId?: string;
}): Promise<{ ranks: Map<string, number | null>; size: number }> {
    const classes = await prisma.class.findMany({
        where: { schoolId: params.schoolId, classLevelId: params.classLevelId, deletedAt: null },
        select: { id: true, classSubjects: { select: { id: true, subjectId: true, coefficient: true } } },
    });
    const averages: Array<{ studentId: string; average: number | null }> = [];
    for (const klass of classes) {
        if (params.periodId) {
            const result = await computeClassPeriod({
                classId: klass.id,
                periodId: params.periodId,
                academicYearId: params.academicYearId,
                classSubjects: klass.classSubjects,
            });
            for (const s of result.students.values()) averages.push({ studentId: s.studentId, average: s.general });
        } else {
            const result = await computeClassAnnual({
                classId: klass.id,
                academicYearId: params.academicYearId,
                classSubjects: klass.classSubjects,
            });
            for (const s of result.students.values()) averages.push({ studentId: s.studentId, average: s.general });
        }
    }
    const all = averages.map((a) => a.average);
    return {
        ranks: new Map(averages.map((a) => [a.studentId, competitionRank(a.average, all)])),
        size: all.filter((v) => v !== null).length,
    };
}

export interface StudentAveragesSummary {
    /** Par période : moyenne générale et moyennes de matières affichées (classSubjectId → moyenne). */
    periods: Record<string, { general: number | null; subjects: Record<string, number | null> }>;
    /** Année : moyenne officielle, moyenne provisoire (période manquante) et matières. */
    annual: { general: number | null; provisional: number | null; subjects: Record<string, number | null> };
}

/**
 * Moyennes d'UN élève, exactement celles du bulletin (classe actuelle, règles
 * de l'école, coefficients et règles gelés par les conseils). Sert aux vues
 * élève / parent, qui ne recalculent plus rien elles-mêmes.
 */
export async function studentAveragesSummary(studentId: string): Promise<StudentAveragesSummary | null> {
    const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        select: {
            classId: true,
            academicYearId: true,
            class: { select: { classSubjects: { select: { id: true, subjectId: true, coefficient: true } } } },
        },
    });
    if (!enrollment) return null;
    const classSubjects = enrollment.class.classSubjects;
    const annual = await computeClassAnnual({
        classId: enrollment.classId,
        academicYearId: enrollment.academicYearId,
        classSubjects,
    });
    const periods: StudentAveragesSummary["periods"] = {};
    for (const period of annual.periods) {
        const result = await computeClassPeriod({
            classId: enrollment.classId,
            periodId: period.id,
            academicYearId: enrollment.academicYearId,
            classSubjects,
        });
        const own = result.students.get(studentId);
        periods[period.id] = {
            general: own?.general ?? null,
            subjects: Object.fromEntries(
                classSubjects.map((cs) => [cs.id, toDisplay(own?.averages.subjects.get(cs.id) ?? null, result.rules.rounding)]),
            ),
        };
    }
    const ownAnnual = annual.students.get(studentId);
    const rounding = (await schoolRulesForClass(enrollment.classId)).rounding;
    return {
        periods,
        annual: {
            general: ownAnnual?.general ?? null,
            provisional: ownAnnual?.provisional ?? null,
            subjects: Object.fromEntries(
                classSubjects.map((cs) => [
                    cs.id,
                    toDisplay(ownAnnual?.annual.subjects.get(cs.id) ?? ownAnnual?.annual.provisionalSubjects.get(cs.id) ?? null, rounding),
                ]),
            ),
        },
    };
}
