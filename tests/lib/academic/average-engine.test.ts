import { describe, it, expect } from "vitest";
import {
  Rational,
  evaluationKind,
  countsInAverage,
  subjectAverage,
  generalAverage,
  meanOf,
  toDisplay,
  competitionRank,
  computeStudentAverages,
  computeAnnualAverages,
  gradedEvaluations,
  gradeStatus,
  type AverageGrade,
} from "@/lib/academic/average-engine";

const I = (value: number | null, maxGrade = 20, extra: Partial<AverageGrade> = {}): AverageGrade => ({
  value, maxGrade, isAbsent: false, isExcused: false, kind: "INTERROGATION", ...extra,
});
const D = (value: number | null, maxGrade = 20, extra: Partial<AverageGrade> = {}): AverageGrade => ({
  value, maxGrade, isAbsent: false, isExcused: false, kind: "DEVOIR", ...extra,
});
const show = (r: Rational | null) => toDisplay(r);

describe("Rational", () => {
  it("lit exactement les décimaux (nombre, chaîne, Decimal, exposant)", () => {
    expect(Rational.from("12.35")).toEqual(new Rational(BigInt(247), BigInt(20)));
    expect(Rational.from(0.1).add(Rational.from(0.2))).toEqual(Rational.from("0.3"));
    expect(Rational.from({ toString: () => "15.50" })).toEqual(Rational.from(15.5));
    expect(Rational.from("1e-7")).toEqual(new Rational(BigInt(1), BigInt(10000000)));
    expect(Rational.from("-2.5")).toEqual(new Rational(BigInt(-5), BigInt(2)));
    expect(() => Rational.from("abc")).toThrow(RangeError);
  });

  it("arrondit au centième demi vers le haut, sans erreur binaire", () => {
    expect(show(Rational.from("9.545"))).toBe(9.55); // toFixed(2) donne 9.54
    expect(show(Rational.from("11.495"))).toBe(11.5);
    expect(show(Rational.from("1.005"))).toBe(1.01);
    expect(show(Rational.from("12.344999"))).toBe(12.34);
    expect(show(new Rational(BigInt(2), BigInt(3)))).toBe(0.67);
    expect(show(Rational.from("-1.005"))).toBe(-1.01);
  });
});

describe("evaluationKind", () => {
  it.each([
    [{ code: "DS", name: "Devoir surveillé" }, "DEVOIR"],
    // Composition : catégorie à part (comptée comme un devoir avec la formule officielle)
    [{ code: "COMP", name: "Composition" }, "COMPOSITION"],
    [{ code: "X", name: "Compo", category: "DEVOIR" as const }, "DEVOIR"],
    [{ code: "X1", name: "Devoir n°2" }, "DEVOIR"],
    [{ code: "EXA", name: "Examen blanc" }, "DEVOIR"],
    [{ code: "IE", name: "Interrogation écrite" }, "INTERROGATION"],
    [{ code: "ORAL", name: "Participation orale" }, "INTERROGATION"],
    [{ code: "TP", name: "Travaux pratiques" }, "INTERROGATION"],
    [null, "INTERROGATION"],
  ])("%j → %s", (type, kind) => {
    expect(evaluationKind(type)).toBe(kind);
  });
});

describe("countsInAverage — compétences hors moyenne", () => {
  it("exclut la catégorie COMPETENCE et le code COMPETENCE, garde le reste", () => {
    expect(countsInAverage({ category: "COMPETENCE" })).toBe(false);
    expect(countsInAverage({ code: "COMPETENCE", name: "Compétence" })).toBe(false);
    expect(countsInAverage({ code: "DS", name: "Devoir", category: "DEVOIR" })).toBe(true);
    expect(countsInAverage(null)).toBe(true);
  });

  it("une note de compétence ne change ni la moyenne ni les notes attendues", () => {
    const cs = [{ id: "cs1", coefficient: 1 }];
    const base = [
      { evaluationId: "i1", classSubjectId: "cs1", value: 12, isAbsent: false, isExcused: false, maxGrade: 20, type: { category: "INTERROGATION" as const } },
      { evaluationId: "d1", classSubjectId: "cs1", value: 14, isAbsent: false, isExcused: false, maxGrade: 20, type: { category: "DEVOIR" as const } },
    ];
    const competence = { evaluationId: "c1", classSubjectId: "cs1", value: 8, isAbsent: false, isExcused: false, maxGrade: 20, type: { category: "COMPETENCE" as const } };
    const without = computeStudentAverages(base, cs);
    const withCompetence = computeStudentAverages([...base, competence], cs);
    expect(toDisplay(withCompetence.general)).toBe(toDisplay(without.general));
    expect(toDisplay(without.general)).toBe(13);
    // Un camarade évalué en compétence ne rend pas la note « NC » chez les autres
    expect(gradedEvaluations([competence])).toEqual([]);
  });
});

describe("subjectAverage — formule officielle (MI + D1 + D2) / 3", () => {
  it("applique (MI + D1 + D2) / 3", () => {
    // MI = (12 + 14 + 16) / 3 = 14 ; (14 + 10 + 13) / 3 = 37/3 = 12,333… → 12,33
    const avg = subjectAverage([I(12), I(14), I(16), D(10), D(13)]);
    expect(avg).toEqual(new Rational(BigInt(37), BigInt(3)));
    expect(show(avg)).toBe(12.33);
  });

  it("ramène chaque note sur 20 avant calcul", () => {
    // 8/10 → 16 ; 30/40 → 15 ; 12/20 → 12 : MI = 16, (16 + 15 + 12) / 3 = 14,333…
    expect(show(subjectAverage([I(8, 10), D(30, 40), D(12)]))).toBe(14.33);
  });

  it("sans interrogation : moyenne des devoirs ; sans devoir : MI", () => {
    expect(show(subjectAverage([D(10), D(15)]))).toBe(12.5);
    expect(show(subjectAverage([I(9), I(10)]))).toBe(9.5);
  });

  it("absence NON justifiée = 0 ; justifiée, dispense, case vide, note supprimée ou barème nul = exclues", () => {
    const avg = subjectAverage([
      I(12),
      I(null, 20, { isAbsent: true }), // non justifiée → 0
      I(null, 20, { isAbsent: true, isExcused: true }), // justifiée → exclue
      I(18, 20, { isExcused: true }), // dispense → exclue
      I(null), // case vide → exclue (signalée à part)
      I(20, 20, { deletedAt: new Date() }),
      I(20, 0),
      D(12),
    ]);
    // MI = (12 + 0) / 2 = 6 ; (6 + 12) / 2 = 9
    expect(show(avg)).toBe(9);
    expect(subjectAverage([I(null, 20, { isAbsent: true, isExcused: true })])).toBeNull();
    expect(show(subjectAverage([D(null, 20, { isAbsent: true })]))).toBe(0);
  });

  it("devoir manqué : justifié → divisé par 2, non justifié → compté 0 et divisé par 3", () => {
    const base = [I(14), D(10)];
    expect(show(subjectAverage([...base, D(null, 20, { isAbsent: true, isExcused: true })]))).toBe(12); // (14 + 10) / 2
    expect(show(subjectAverage([...base, D(null, 20, { isAbsent: true })]))).toBe(8); // (14 + 10 + 0) / 3
  });
});

describe("moyenne générale, annuelle, rang", () => {
  it("pondère par les coefficients de matière et ignore les matières non évaluées", () => {
    const g = generalAverage([
      { average: Rational.from(12), coefficient: 3 },
      { average: Rational.from(15), coefficient: "2.00" },
      { average: null, coefficient: 4 },
    ]);
    expect(show(g)).toBe(13.2);
    expect(generalAverage([{ average: null, coefficient: 2 }])).toBeNull();
  });

  const g = (classSubjectId: string, periodId: string, value: number, code = "DS") => ({
    classSubjectId, periodId, value, isAbsent: false, isExcused: false, maxGrade: 20, type: { code },
  });
  const subjects = [{ id: "m", coefficient: 3 }, { id: "f", coefficient: 1 }];

  it("semestres : moyenne annuelle = (S1 + S2) / 2", () => {
    const grades = [g("m", "s1", 10), g("m", "s2", 15), g("f", "s2", 9, "IE")];
    // S1 : 10 ; S2 : (15×3 + 9) / 4 = 13,5 → (10 + 13,5) / 2 = 11,75
    const annual = computeAnnualAverages(grades, subjects, [{ id: "s1" }, { id: "s2" }]);
    expect(show(annual.general)).toBe(11.75);
    expect(annual.complete).toBe(true);
    expect(show(computeStudentAverages(grades.filter((x) => x.periodId === "s2"), subjects).general)).toBe(13.5);
    expect(show(meanOf([Rational.from(10), null, Rational.from(13)]))).toBe(11.5);
  });

  it("trimestres : (T1 + T2 + T3) / 3, provisoire tant que T3 n'a pas de moyenne", () => {
    const periods = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
    const partial = computeAnnualAverages([g("m", "t1", 9), g("m", "t2", 12)], subjects, periods);
    expect(partial.general).toBeNull(); // T3 manquant : pas de moyenne annuelle officielle
    expect(show(partial.provisional)).toBe(10.5);
    expect(partial.periodsWithAverage).toBe(2);
    expect(partial.periodsExpected).toBe(3);
    expect(partial.complete).toBe(false);
    const full = computeAnnualAverages([g("m", "t1", 9), g("m", "t2", 12), g("m", "t3", 13)], subjects, periods);
    expect(show(full.general)).toBe(11.33); // 34 / 3
    expect(show(full.subjects.get("m") ?? null)).toBe(11.33);
    expect(full.subjects.get("f")).toBeNull();
    expect(full.provisionalSubjects.get("f")).toBeNull();
  });

  it("note manquante alors que les camarades sont notés : signalée, moyenne incomplète", () => {
    const classGrades = [
      { evaluationId: "e1", classSubjectId: "m", value: 12, isAbsent: false, isExcused: false, maxGrade: 20, type: { code: "DS" } },
      { evaluationId: "e2", classSubjectId: "m", value: 15, isAbsent: false, isExcused: false, maxGrade: 20, type: { code: "DS" } },
      { evaluationId: "e3", classSubjectId: "m", value: null, isAbsent: false, isExcused: false, maxGrade: 20, type: { code: "DS" } }, // pas encore corrigée
    ];
    const expected = gradedEvaluations(classGrades);
    expect(expected.map((e) => e.evaluationId).sort()).toEqual(["e1", "e2"]);
    // L'élève n'a que e1 : e2 est à justifier
    const mine = computeStudentAverages([classGrades[0]], subjects, expected);
    expect(mine.complete).toBe(false);
    expect(mine.missing.map((m) => m.evaluationId)).toEqual(["e2"]);
    // Absence justifiée saisie pour e2 : tranché, la moyenne est complète
    const resolved = computeStudentAverages(
      [classGrades[0], { ...classGrades[1], value: null, isAbsent: true, isExcused: true }],
      subjects,
      expected
    );
    expect(resolved.complete).toBe(true);
    expect(show(resolved.subjects.get("m") ?? null)).toBe(12);
  });

  it("élève arrivé en cours de période : une note saisie avant l'inscription compte, une absence non", () => {
    const at = (evaluationId: string, date: string, value: number | null, isAbsent = false) => ({
      evaluationId, classSubjectId: "m", date: new Date(date), value, isAbsent, isExcused: false, maxGrade: 20, type: { code: "DS" },
    });
    const enrolledAt = new Date("2026-01-20");
    // Note de l'ancienne classe (rattachée) ou saisie avant l'import : 8 compte
    const imported = computeStudentAverages([at("e1", "2026-01-10", 8), at("e2", "2026-02-01", 14)], subjects, [], { enrolledAt });
    expect(show(imported.subjects.get("m") ?? null)).toBe(11);
    // Absence cochée pour une évaluation antérieure à son arrivée : ne vaut pas 0
    const absent = computeStudentAverages([at("e1", "2026-01-10", null, true), at("e2", "2026-02-01", 14)], subjects, [], { enrolledAt });
    expect(show(absent.subjects.get("m") ?? null)).toBe(14);
  });

  it("statut d'une note", () => {
    expect(gradeStatus({ value: 12, isAbsent: false, isExcused: false })).toBe("GRADED");
    expect(gradeStatus({ value: null, isAbsent: true, isExcused: false })).toBe("ABSENT_UNJUSTIFIED");
    expect(gradeStatus({ value: null, isAbsent: true, isExcused: true })).toBe("EXCUSED");
    expect(gradeStatus({ value: null, isAbsent: false, isExcused: false })).toBe("EMPTY");
    expect(gradeStatus({ value: 12, isAbsent: false, isExcused: false, deletedAt: new Date() })).toBe("DELETED");
  });

  it("classe en rang olympique sur la moyenne affichée", () => {
    const all = [15.5, 12.35, 12.35, 9, null];
    expect(competitionRank(15.5, all)).toBe(1);
    expect(competitionRank(12.35, all)).toBe(2);
    expect(competitionRank(9, all)).toBe(4);
    expect(competitionRank(null, all)).toBeNull();
  });
});
