/**
 * Vérification « à la main » : des jeux de notes construits un par un, le
 * résultat attendu calculé à la main (détail en clair dans chaque cas, fractions
 * exactes), puis les MÊMES notes passées par le calcul du bulletin de
 * l'application (route /api/bulletins, code réel ; seule la base de données est
 * remplacée par ces jeux de notes en mémoire). Aucun écart toléré au centième.
 *
 * Accent mis sur l'élève qui n'a pas composé : il ne doit jamais recevoir un 0
 * par erreur. Seule une absence NON justifiée vaut 0 (règle officielle,
 * réglable) ; tout le reste (case vide, absence justifiée, note écartée,
 * évaluation pas encore corrigée, élève arrivé après) est retiré du calcul.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
    const fn = () => vi.fn();
    return {
        default: {
            studentProfile: { findUnique: fn() },
            period: { findUnique: fn(), findFirst: fn(), findMany: fn() },
            school: { findUnique: fn() },
            class: { findUnique: fn() },
            classCouncil: { findUnique: fn(), findMany: fn() },
            configOption: { findFirst: fn() },
            academicConfig: { findUnique: fn() },
            enrollment: { findMany: fn() },
            grade: { findMany: fn() },
            externalPeriodAverage: { findMany: fn() },
            classSubject: { findMany: fn() },
            studentFormula: { findMany: fn() },
            attendance: { count: fn() },
            behaviorIncident: { count: fn() },
        },
    };
});

// ─────────────────────────── Monde de test ───────────────────────────

const SCHOOL = "cschoolhand0000000000000";
const CLASS = "cclasshand00000000000000";
const YEAR = "cyearhand000000000000000";
type Kind = "I" | "D" | "C";
type GradeInput = number | "ABS" | "ABS-J" | "VIDE";
const TYPE = {
    I: { name: "Interrogation", code: "IE", category: "INTERROGATION" },
    D: { name: "Devoir", code: "DS", category: "DEVOIR" },
    C: { name: "Composition", code: "COMP", category: "COMPOSITION" },
};

interface World {
    periods: string[];
    subjects: Array<{ cs: string; name: string; coef: number; formula?: string }>;
    evals: Array<{ id: string; cs: string; period: string; kind: Kind; max?: number; date: string }>;
    students: Array<{ id: string; enrolledAt?: string }>;
    /** [évaluation, élève, note | "ABS" (non justifiée) | "ABS-J" (justifiée) | "VIDE", motif si la note est écartée] */
    grades: Array<[string, string, GradeInput, string?]>;
    rules?: Record<string, unknown>;
    studentFormulas?: Array<{ cs: string; period: string; student: string; formula: string }>;
}

let W: World;
let currentPeriod = "";
type Mock = ReturnType<typeof vi.fn>;
const P = () => prisma as unknown as Record<string, Record<string, Mock>>;
const dec = (x: number | null) => (x === null ? null : new Decimal(x));
const periodRow = (id: string) => {
    const seq = W.periods.indexOf(id) + 1;
    return {
        id,
        name: `Trimestre ${seq}`,
        sequence: seq,
        academicYearId: YEAR,
        startDate: new Date(`2026-0${seq}-01`),
        endDate: new Date(`2026-0${seq}-28`),
    };
};
const gradeRows = () =>
    W.grades.map(([evalId, studentId, v, excluded], i) => ({
        id: `g${i}`,
        evaluationId: evalId,
        studentId,
        value: typeof v === "number" ? dec(v) : null,
        isAbsent: v === "ABS" || v === "ABS-J",
        isExcused: v === "ABS-J",
        excludedReason: excluded ?? null,
        deletedAt: null,
        comment: null,
        excuseReason: v === "ABS-J" ? "billet" : null,
    }));
const evalOf = (id: string) => W.evals.find((e) => e.id === id)!;

function wire() {
    const p = P();
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: SCHOOL }) as never);
    p.studentProfile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        userId: `u-${where.id}`,
        schoolId: SCHOOL,
        matricule: "000001",
        dateOfBirth: new Date("2012-01-01"),
        user: { firstName: where.id, lastName: "Test" },
        enrollments: [
            {
                classId: CLASS,
                academicYearId: YEAR,
                status: "ACTIVE",
                academicYear: { name: "2025-2026" },
                class: {
                    id: CLASS,
                    name: "3e A",
                    schoolId: SCHOOL,
                    classLevelId: "lvl",
                    classLevel: { name: "Troisième" },
                    classSubjects: W.subjects.map((s) => ({
                        id: s.cs,
                        subjectId: `s-${s.cs}`,
                        coefficient: dec(s.coef),
                        averageFormula: s.formula ?? null,
                        subject: { id: `s-${s.cs}`, name: s.name },
                        evaluations: W.evals
                            .filter((e) => e.cs === s.cs && e.period === currentPeriod)
                            .map((e) => ({
                                id: e.id,
                                title: e.id,
                                date: new Date(e.date),
                                maxGrade: dec(e.max ?? 20),
                                coefficient: dec(1),
                                type: TYPE[e.kind],
                                grades: gradeRows().filter((g) => g.evaluationId === e.id && g.studentId === where.id),
                            })),
                    })),
                },
            },
        ],
    }));
    p.period.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => periodRow(where.id));
    p.period.findFirst.mockImplementation(async ({ where }: { where: { sequence: { lt?: number; gt?: number } } }) => {
        const rows = W.periods.map(periodRow);
        if (where.sequence.lt !== undefined) return rows.filter((r) => r.sequence < where.sequence.lt!).pop() ?? null;
        return rows.find((r) => r.sequence > where.sequence.gt!) ?? null;
    });
    p.period.findMany.mockImplementation(async () => W.periods.map((id) => ({ id })));
    p.school.findUnique.mockResolvedValue(null);
    p.class.findUnique.mockResolvedValue({ schoolId: SCHOOL });
    p.classCouncil.findUnique.mockResolvedValue(null);
    p.classCouncil.findMany.mockResolvedValue([]);
    p.configOption.findFirst.mockImplementation(async (args: { where?: { category?: string } }) =>
        args?.where?.category === "GRADING_SETTINGS" && W.rules ? { metadata: { calculation: W.rules } } : null,
    );
    p.academicConfig.findUnique.mockResolvedValue(null);
    p.enrollment.findMany.mockImplementation(async () =>
        W.students.map((s) => ({ studentId: s.id, enrolledAt: s.enrolledAt ? new Date(s.enrolledAt) : null })),
    );
    p.grade.findMany.mockImplementation(
        async ({ where }: { where: { studentId: { in: string[] }; evaluation: { periodId?: string } } }) =>
            gradeRows()
                .filter((g) => where.studentId.in.includes(g.studentId))
                .filter((g) => !where.evaluation.periodId || evalOf(g.evaluationId).period === where.evaluation.periodId)
                .map((g) => {
                    const e = evalOf(g.evaluationId);
                    return {
                        ...g,
                        evaluation: {
                            date: new Date(e.date),
                            maxGrade: dec(e.max ?? 20),
                            periodId: e.period,
                            classSubjectId: e.cs,
                            classSubject: { subjectId: `s-${e.cs}` },
                            type: TYPE[e.kind],
                        },
                    };
                }),
    );
    p.externalPeriodAverage.findMany.mockResolvedValue([]);
    p.classSubject.findMany.mockImplementation(async () =>
        W.subjects.filter((s) => s.formula).map((s) => ({ id: s.cs, averageFormula: s.formula })),
    );
    p.studentFormula.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        (W.studentFormulas ?? [])
            .filter((f) => where.studentId === undefined || where.studentId === f.student)
            .filter((f) => {
                const pw = where.periodId as string | { in: string[] } | undefined;
                return pw === undefined || pw === f.period || (typeof pw === "object" && pw.in.includes(f.period));
            })
            .map((f) => ({ classSubjectId: f.cs, periodId: f.period, studentId: f.student, formula: f.formula, reason: "test" })),
    );
    p.attendance.count.mockResolvedValue(0);
    p.behaviorIncident.count.mockResolvedValue(0);
}

async function bulletin(studentId: string, periodId: string) {
    currentPeriod = periodId;
    const { GET } = await import("@/app/api/bulletins/route");
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${studentId}&periodId=${periodId}`), {
        session: makeSession("DIRECTOR", { schoolId: SCHOOL }),
    } as never);
    expect(res.status).toBe(200);
    return (await res.json()) as Record<string, unknown>;
}

// ─────────────────────────── Jeu de base ───────────────────────────
// Élève A (celui qu'on observe), élève B (camarade qui a toutes ses notes, pour
// que les évaluations soient « corrigées dans la classe »).
// Mathématiques, coefficient 3, trimestre 1 :
//   I1 = 12, I2 = 14 (interrogations) → MI = 13
//   D1 = 10, D2 = 15 (devoirs)
//   C1 = composition, selon le cas
const MATHS = { cs: "cs-maths", name: "Mathématiques", coef: 3 };
const T1 = "cperiodt1000000000000000";
const T2 = "cperiodt2000000000000000";
const T3 = "cperiodt3000000000000000";

function base(compoA: GradeInput | null, opts: { excludeCompo?: boolean; compoForB?: boolean } = {}): World {
    const grades: World["grades"] = [
        ["i1", "A", 12],
        ["i2", "A", 14],
        ["d1", "A", 10],
        ["d2", "A", 15],
        ["i1", "B", 10],
        ["i2", "B", 10],
        ["d1", "B", 10],
        ["d2", "B", 10],
    ];
    if (compoA !== null) grades.push(["c1", "A", compoA, opts.excludeCompo ? "copie perdue par l'école" : undefined]);
    if (opts.compoForB !== false) grades.push(["c1", "B", 10]);
    return {
        periods: [T1],
        subjects: [MATHS],
        evals: [
            { id: "i1", cs: "cs-maths", period: T1, kind: "I", date: "2026-01-05" },
            { id: "i2", cs: "cs-maths", period: T1, kind: "I", date: "2026-01-12" },
            { id: "d1", cs: "cs-maths", period: T1, kind: "D", date: "2026-01-15" },
            { id: "d2", cs: "cs-maths", period: T1, kind: "D", date: "2026-01-22" },
            { id: "c1", cs: "cs-maths", period: T1, kind: "C", date: "2026-01-27" },
        ],
        students: [{ id: "A" }, { id: "B" }],
        grades,
    };
}

const absentToAllDevoirs = (w: World): World => ({
    ...w,
    grades: w.grades.map((g): World["grades"][number] =>
        g[1] === "A" && (g[0] === "d1" || g[0] === "d2") ? [g[0], "A", "ABS-J"] : g,
    ),
});

interface Case {
    name: string;
    situation: string;
    calcul: string;
    expected: number | null;
    world: () => World;
    read?: (body: Record<string, unknown>) => number | null;
    period?: string;
}

const mathsAverage = (b: Record<string, unknown>) =>
    (b.subjects as Array<{ subjectId: string; average: number | null }>).find((s) => s.subjectId === "s-cs-maths")?.average ?? null;
const annual = (b: Record<string, unknown>) => (b.annual as { average: number | null } | null)?.average ?? null;
const general = (b: Record<string, unknown>) => b.generalAverage as number | null;

function yearWorld(t3: number | null, rules?: Record<string, unknown>): World {
    const grades: World["grades"] = [
        ["y1", "A", 11.5],
        ["y2", "A", 12.25],
    ];
    if (t3 !== null) grades.push(["y3", "A", t3]);
    return {
        periods: [T1, T2, T3],
        subjects: [MATHS],
        evals: [
            { id: "y1", cs: "cs-maths", period: T1, kind: "D", date: "2026-01-10" },
            { id: "y2", cs: "cs-maths", period: T2, kind: "D", date: "2026-02-10" },
            { id: "y3", cs: "cs-maths", period: T3, kind: "D", date: "2026-03-10" },
        ],
        students: [{ id: "A" }],
        grades,
        rules,
    };
}

const halfCentWorld = (rules?: Record<string, unknown>): World => ({
    periods: [T1],
    subjects: [MATHS],
    evals: [
        { id: "i1", cs: "cs-maths", period: T1, kind: "I", date: "2026-01-05" },
        { id: "d1", cs: "cs-maths", period: T1, kind: "D", date: "2026-01-15" },
    ],
    students: [{ id: "A" }],
    grades: [
        ["i1", "A", 12.01],
        ["d1", "A", 12],
    ],
    rules,
});

const CASES: Case[] = [
    {
        name: "1. Toutes les notes",
        situation: "A a toutes ses notes, composition 13",
        calcul: "(MI 13 + D1 10 + D2 15 + C 13) ÷ 4 = 51 ÷ 4 = 12,75",
        expected: 12.75,
        world: () => base(13),
    },
    {
        name: "2. N'a pas composé — rien de saisi",
        situation: "A n'a aucune note à la composition, B est noté",
        calcul: "note « NC », retirée : (13 + 10 + 15) ÷ 3 = 38 ÷ 3 = 12,666… → 12,67 (pas de 0)",
        expected: 12.67,
        world: () => base(null),
    },
    {
        name: "3. N'a pas composé — absence justifiée",
        situation: "A absent à la composition, absence justifiée",
        calcul: "retirée : (13 + 10 + 15) ÷ 3 = 12,67 (pas de 0)",
        expected: 12.67,
        world: () => base("ABS-J"),
    },
    {
        name: "4. Note écartée par le professeur",
        situation: "Composition saisie 2, le professeur ne la compte pas (copie perdue)",
        calcul: "retirée : (13 + 10 + 15) ÷ 3 = 12,67 (ni 2, ni 0)",
        expected: 12.67,
        world: () => base(2, { excludeCompo: true }),
    },
    {
        name: "5. Composition pas encore corrigée pour personne",
        situation: "Ni A ni B n'ont de note à la composition",
        calcul: "évaluation pas encore corrigée : ignorée, (13 + 10 + 15) ÷ 3 = 12,67",
        expected: 12.67,
        world: () => base(null, { compoForB: false }),
    },
    {
        name: "6. Absence NON justifiée (règle officielle)",
        situation: "A absent à la composition, sans justificatif",
        calcul: "0 compté (règle officielle) : (13 + 10 + 15 + 0) ÷ 4 = 38 ÷ 4 = 9,50",
        expected: 9.5,
        world: () => base("ABS"),
    },
    {
        name: "7. Absence non justifiée, école réglée sur « ne compte pas »",
        situation: "Même absence ; l'école a choisi de ne pas compter les absences non justifiées",
        calcul: "retirée : 12,67",
        expected: 12.67,
        world: () => ({ ...base("ABS"), rules: { unjustifiedAbsence: "EXCLUDE" } }),
    },
    {
        name: "8. Rien de saisi, école réglée sur « NC compte 0 »",
        situation: "A sans note à la composition, B noté ; l'école compte 0 les notes non tranchées",
        calcul: "0 compté (choix de l'école) : (13 + 10 + 15 + 0) ÷ 4 = 9,50",
        expected: 9.5,
        world: () => ({ ...base(null), rules: { unresolvedNc: "ZERO" } }),
    },
    {
        name: "9. « NC compte 0 » mais composition pas encore corrigée",
        situation: "Même réglage, mais personne n'a encore de note à la composition",
        calcul: "aucun 0 tant que la composition n'est corrigée pour personne : 12,67",
        expected: 12.67,
        world: () => ({ ...base(null, { compoForB: false }), rules: { unresolvedNc: "ZERO" } }),
    },
    {
        name: "10. Élève arrivé en cours de période",
        situation: "A inscrit le 20 janvier : I1, I2 et D1 ont eu lieu avant son arrivée ; il a I3 = 13, D2 = 15, C1 = 13",
        calcul: "évaluations antérieures ignorées (pas de 0) : (13 + 15 + 13) ÷ 3 = 41 ÷ 3 = 13,666… → 13,67",
        expected: 13.67,
        world: () => {
            const w = base(13);
            w.students = [{ id: "A", enrolledAt: "2026-01-20" }, { id: "B" }];
            w.grades = w.grades.filter(([e, s]) => !(s === "A" && (e === "i1" || e === "i2" || e === "d1")));
            w.grades.push(["i3", "A", 13], ["i3", "B", 10]);
            w.evals.push({ id: "i3", cs: "cs-maths", period: T1, kind: "I", date: "2026-01-21" });
            return w;
        },
    },
    {
        name: "11. Composition notée sur 40",
        situation: "Composition 26 / 40",
        calcul: "26 / 40 = 13 / 20 → (13 + 10 + 15 + 13) ÷ 4 = 12,75",
        expected: 12.75,
        world: () => {
            const w = base(26);
            w.evals.find((e) => e.id === "c1")!.max = 40;
            return w;
        },
    },
    {
        name: "12. Formule particulière pour A : (MI + D1) / 2",
        situation: "Le professeur adapte le calcul de A seul",
        calcul: "(13 + 10) ÷ 2 = 11,50",
        expected: 11.5,
        world: () => ({ ...base(13), studentFormulas: [{ cs: "cs-maths", period: T1, student: "A", formula: "(MI + D1) / 2" }] }),
    },
    {
        name: "13. Formule du professeur (MI + MD + 2×MC) / 4",
        situation: "Toutes les notes ; MD = (10 + 15) ÷ 2 = 12,5",
        calcul: "(13 + 12,5 + 2 × 13) ÷ 4 = 51,5 ÷ 4 = 12,875 → 12,88 (au plus proche)",
        expected: 12.88,
        world: () => ({ ...base(13), subjects: [{ ...MATHS, formula: "(MI + MD + 2*MC) / 4" }] }),
    },
    {
        name: "14. Même formule, arrondi par troncature",
        situation: "L'école tronque au centième",
        calcul: "12,875 → 12,87",
        expected: 12.87,
        world: () => ({ ...base(13), subjects: [{ ...MATHS, formula: "(MI + MD + 2*MC) / 4" }], rules: { rounding: "TRUNCATE" } }),
    },
    {
        name: "15. Même formule, composition manquante",
        situation: "Formule à poids fixes, A sans composition",
        calcul: "MC est vide : le calcul ne peut pas se faire → « NC » (et non 0)",
        expected: null,
        world: () => ({ ...base(null), subjects: [{ ...MATHS, formula: "(MI + MD + 2*MC) / 4" }] }),
    },
    {
        name: "16. Absences justifiées à tous les devoirs",
        situation: "D1, D2 et C1 : absences justifiées ; seules les interrogations restent",
        calcul: "devoirs prévus mais aucun compté → matière « NC » (règle officielle)",
        expected: null,
        world: () => absentToAllDevoirs(base("ABS-J")),
    },
    {
        name: "17. Même cas, école réglée sur « matière jamais NC »",
        situation: "Seules les interrogations comptent",
        calcul: "MI = (12 + 14) ÷ 2 = 13,00",
        expected: 13,
        world: () => ({ ...absentToAllDevoirs(base("ABS-J")), rules: { subjectNcWhenNoDevoir: false } }),
    },
    {
        name: "18. Arrondi d'un demi-centième",
        situation: "Une interrogation 12,01 et un devoir 12,00",
        calcul: "(12,01 + 12,00) ÷ 2 = 12,005 → 12,01 au plus proche",
        expected: 12.01,
        world: () => halfCentWorld(),
    },
    {
        name: "19. Même arrondi, école en troncature",
        situation: "Mêmes notes",
        calcul: "12,005 → 12,00",
        expected: 12,
        world: () => halfCentWorld({ rounding: "TRUNCATE" }),
    },
    {
        name: "20. Moyenne générale avec coefficients et une matière NC",
        situation: "Maths (coef 3) sans composition = 38/3 ; Français (coef 2) : une interrogation 14 ; Anglais (coef 2) : seul devoir en absence justifiée → NC",
        calcul: "(38/3 × 3 + 14 × 2) ÷ (3 + 2) = (38 + 28) ÷ 5 = 13,20 (l'anglais NC ne compte pas)",
        expected: 13.2,
        read: general,
        world: () => {
            const w = base(null);
            w.subjects = [MATHS, { cs: "cs-fr", name: "Français", coef: 2 }, { cs: "cs-en", name: "Anglais", coef: 2 }];
            w.evals.push(
                { id: "f1", cs: "cs-fr", period: T1, kind: "I", date: "2026-01-06" },
                { id: "e1", cs: "cs-en", period: T1, kind: "D", date: "2026-01-07" },
            );
            w.grades.push(["f1", "A", 14], ["f1", "B", 10], ["e1", "A", "ABS-J"], ["e1", "B", 10]);
            return w;
        },
    },
    {
        name: "21. Moyenne annuelle (T1 + T2 + T3) ÷ 3",
        situation: "T1 = 11,50 ; T2 = 12,25 ; T3 = 14,00",
        calcul: "(11,5 + 12,25 + 14) ÷ 3 = 37,75 ÷ 3 = 12,5833… → 12,58",
        expected: 12.58,
        read: annual,
        period: T3,
        world: () => yearWorld(14),
    },
    {
        name: "22. Moyenne annuelle provisoire (T3 sans note)",
        situation: "T3 pas encore évalué",
        calcul: "provisoire : (11,5 + 12,25) ÷ 2 = 11,875 → 11,88 (T3 n'est pas compté 0)",
        expected: 11.88,
        read: annual,
        period: T3,
        world: () => yearWorld(null),
    },
    {
        name: "23. Moyenne annuelle libre (T1 + T2 + 2×T3) ÷ 4",
        situation: "Formule de l'école, dernier trimestre double",
        calcul: "(11,5 + 12,25 + 28) ÷ 4 = 51,75 ÷ 4 = 12,9375 → 12,94",
        expected: 12.94,
        read: annual,
        period: T3,
        world: () => yearWorld(14, { annualFormula: "(T1 + T2 + 2*T3) / 4" }),
    },
];

// ─────────────────────────── Exécution ───────────────────────────

const REPORT: Array<{ cas: string; situation: string; calcul: string; attendu: number | null | string; application: number | null | string; ecart: string }> = [];

beforeEach(() => {
    vi.clearAllMocks();
});

afterAll(() => {
    mkdirSync(".quality-tmp", { recursive: true });
    writeFileSync(".quality-tmp/hand-scenarios.json", JSON.stringify(REPORT, null, 2));
});

describe("Jeux de notes construits à la main vs calcul de l'application", () => {
    for (const c of CASES) {
        it(c.name, async () => {
            W = c.world();
            // Règles de l'école : règles officielles, plus le réglage propre au cas
            if (W.rules) {
                W.rules = {
                    subjectFormula: "moyenne(MI ; DEVOIRS ; COMPOS)",
                    unjustifiedAbsence: "ZERO",
                    unresolvedNc: "EXCLUDE",
                    subjectNcWhenNoDevoir: true,
                    rounding: "HALF_UP",
                    annualFormula: "moyenne(PERIODES)",
                    ...W.rules,
                };
            }
            wire();
            const body = await bulletin("A", c.period ?? T1);
            const app = (c.read ?? mathsAverage)(body);
            REPORT.push({
                cas: c.name,
                situation: c.situation,
                calcul: c.calcul,
                attendu: c.expected,
                application: app,
                ecart: app === c.expected ? "0" : app === null || c.expected === null ? "différent" : (app - c.expected).toFixed(2),
            });
            expect(app, `${c.name} — attendu ${c.expected}, application ${app}`).toBe(c.expected);
        });
    }

    it("24. Rang : deux élèves à égalité ont le même rang, le suivant est sauté", async () => {
        W = base(13);
        W.students.push({ id: "C" });
        // C a exactement les notes de A → 12,75 ; B a 10 partout → 10
        W.grades.push(["i1", "C", 12], ["i2", "C", 14], ["d1", "C", 10], ["d2", "C", 15], ["c1", "C", 13]);
        wire();
        const ranks: unknown[] = [];
        for (const s of ["A", "B", "C"]) ranks.push((await bulletin(s, T1)).rank);
        REPORT.push({
            cas: "24. Rang ex aequo",
            situation: "A et C à 12,75 ; B à 10",
            calcul: "A : 1er, C : 1er, B : 3e",
            attendu: "1 / 3 / 1",
            application: ranks.join(" / "),
            ecart: ranks.join(" / ") === "1 / 3 / 1" ? "0" : "différent",
        });
        expect(ranks).toEqual([1, 3, 1]);
    });
});
