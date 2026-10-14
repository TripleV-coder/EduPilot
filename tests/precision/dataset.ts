/**
 * Jeu de données synthétique réaliste (graine fixe) : une classe de 4ème
 * béninoise, 2 semestres sur l'année courante + 1 semestre de l'année
 * précédente. Contient volontairement les cas qui piègent les calculs :
 * barèmes /10 et /40, absences, dispenses, notes supprimées (saisies erronées),
 * note de 0, ex aequo, élève sans aucune note, matière sans note valide.
 */

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export const SCHOOL_ID = "cschoola".padEnd(25, "0");
export const CLASS_ID = "cclass4a".padEnd(25, "0");
export const YEAR_ID = "cyear2026".padEnd(25, "0");
const PREV_YEAR_ID = "cyear2025".padEnd(25, "0");

export interface DSubject { id: string; csId: string; name: string; code: string; coef: number }
export interface DPeriod { id: string; sequence: number; academicYearId: string; name: string; startDate: Date; endDate: Date }
export interface DEval { id: string; csId: string; periodId: string; maxGrade: number; coef: number; typeName: string; title: string; date: Date }
export interface DStudent { id: string; userId: string; firstName: string; lastName: string }
export interface DGrade {
  id: string; evaluationId: string; studentId: string; value: number | null;
  isAbsent: boolean; isExcused: boolean; deletedAt: Date | null; comment: string | null;
}

export const SUBJECTS: DSubject[] = [
  { id: "s-mat", csId: "cs-mat", name: "Mathématiques", code: "MAT", coef: 3 },
  { id: "s-fra", csId: "cs-fra", name: "Français", code: "FRA", coef: 2 },
  { id: "s-ang", csId: "cs-ang", name: "Anglais", code: "ANG", coef: 2 },
  { id: "s-svt", csId: "cs-svt", name: "Sciences de la Vie et de la Terre", code: "SVT", coef: 2 },
  { id: "s-pct", csId: "cs-pct", name: "Physique-Chimie-Technologie", code: "PCT", coef: 2 },
  { id: "s-hge", csId: "cs-hge", name: "Histoire-Géographie", code: "HGE", coef: 2 },
  { id: "s-eps", csId: "cs-eps", name: "Éducation Physique et Sportive", code: "EPS", coef: 1 },
];

export const PERIODS: DPeriod[] = [
  { id: "cperprev".padEnd(25, "0"), sequence: 2, academicYearId: PREV_YEAR_ID, name: "S2 2024-2025", startDate: new Date("2025-02-01"), endDate: new Date("2025-06-30") },
  { id: "cpers10000000000000000000".slice(0, 25), sequence: 1, academicYearId: YEAR_ID, name: "Semestre 1", startDate: new Date("2025-10-01"), endDate: new Date("2026-01-31") },
  { id: "cpers20000000000000000000".slice(0, 25), sequence: 2, academicYearId: YEAR_ID, name: "Semestre 2", startDate: new Date("2026-02-01"), endDate: new Date("2026-06-30") },
];
export const [P_PREV, P1, P2] = PERIODS;

export interface Dataset {
  students: DStudent[];
  evaluations: DEval[];
  grades: DGrade[];
  /** Élèves volontairement ex aequo (mêmes notes). */
  tiedPair: [string, string];
  /** Élève inscrit sans aucune note. */
  emptyStudent: string;
  /** Élève dont une note attendue manque (camarades notés). */
  missingStudent: string;
  missingEvaluation: string;
}

export function buildDataset(seed = 20261001, nStudents = 40): Dataset {
  const rng = seeded(seed);
  const students: DStudent[] = Array.from({ length: nStudents }, (_, i) => ({
    id: `cstu${String(i).padStart(21, "0")}`,
    userId: `cusr${String(i).padStart(21, "0")}`,
    firstName: `Élève${i}`,
    lastName: `Nom${i}`,
  }));

  const evaluations: DEval[] = [];
  PERIODS.forEach((p, pi) => {
    for (const s of SUBJECTS) {
      const plan =
        s.code === "EPS"
          ? [{ typeName: "Pratique", maxGrade: 20, coef: 1 }]
          : [
              { typeName: "Interrogation", maxGrade: 10, coef: 1 },
              { typeName: "Interrogation", maxGrade: 20, coef: 1 },
              { typeName: "Devoir", maxGrade: 20, coef: 2 },
              { typeName: "Composition", maxGrade: s.code === "FRA" ? 40 : 20, coef: 3 },
            ];
      plan.forEach((e, k) =>
        evaluations.push({
          id: `cev${pi}${s.code.toLowerCase()}${k}`.padEnd(25, "0"),
          csId: s.csId,
          periodId: p.id,
          maxGrade: e.maxGrade,
          coef: e.coef,
          typeName: e.typeName,
          title: `${e.typeName} ${k + 1}`,
          date: new Date(p.startDate.getTime() + (k + 1) * 20 * 86400000),
        }),
      );
    }
  });

  const ability = students.map(() => Math.min(18, Math.max(4, 11 + 3 * gauss(rng))));
  const affinity = students.map(() => Object.fromEntries(SUBJECTS.map((s) => [s.code, 1.8 * gauss(rng)])));
  const grades: DGrade[] = [];
  let gid = 0;
  const emptyStudent = students[nStudents - 1].id;
  let missingStudent = "";

  for (const [si, st] of students.entries()) {
    if (st.id === emptyStudent) continue;
    for (const ev of evaluations) {
      const subj = SUBJECTS.find((s) => s.csId === ev.csId)!;
      const on20 = Math.min(20, Math.max(0, ability[si] + affinity[si][subj.code] + 2.5 * gauss(rng)));
      // Saisie réaliste : quarts de point, 8 % de saisies au centième.
      const step = rng() < 0.08 ? 0.01 : 0.25;
      let value: number | null = Math.round((on20 * ev.maxGrade) / 20 / step) * step;
      value = Math.round(value * 100) / 100;
      const r = rng();
      // 2 % absences non justifiées (0), 1,5 % absences justifiées, 1 % dispenses
      const isAbsent = r < 0.035;
      const isExcused = (r >= 0.02 && r < 0.035) || (r >= 0.035 && r < 0.045);
      if (isAbsent || isExcused) value = null;
      grades.push({ id: `cgr${String(gid++).padStart(22, "0")}`, evaluationId: ev.id, studentId: st.id, value, isAbsent, isExcused, deletedAt: null, comment: null });
    }
  }

  // Notes supprimées : saisie erronée (0 ou barème max) annulée par suppression logique.
  for (const g of grades) {
    if (g.value !== null && rng() < 0.015) {
      const ev = evaluations.find((e) => e.id === g.evaluationId)!;
      g.deletedAt = new Date("2026-03-01");
      g.value = rng() < 0.5 ? 0 : ev.maxGrade;
    }
  }

  // Une vraie note de 0 (copie blanche) pour l'élève 2 en Maths S2.
  const zeroEval = evaluations.find((e) => e.periodId === P2.id && e.csId === "cs-mat" && e.typeName === "Devoir")!;
  const zg = grades.find((g) => g.studentId === students[2].id && g.evaluationId === zeroEval.id)!;
  Object.assign(zg, { value: 0, isAbsent: false, isExcused: false, deletedAt: null });

  // Élève 3 : absences justifiées à toutes les évaluations d'Anglais au S2 (matière non évaluée).
  for (const g of grades) {
    const ev = evaluations.find((e) => e.id === g.evaluationId)!;
    if (g.studentId === students[3].id && ev.periodId === P2.id && ev.csId === "cs-ang") {
      Object.assign(g, { value: null, isAbsent: true, isExcused: true, deletedAt: null });
    }
  }

  // Ex aequo : l'élève 5 recopie exactement les notes de l'élève 4.
  const tiedPair: [string, string] = [students[4].id, students[5].id];
  const g4 = new Map(grades.filter((g) => g.studentId === tiedPair[0]).map((g) => [g.evaluationId, g]));
  for (const g of grades.filter((x) => x.studentId === tiedPair[1])) {
    const src = g4.get(g.evaluationId)!;
    Object.assign(g, { value: src.value, isAbsent: src.isAbsent, isExcused: src.isExcused, deletedAt: src.deletedAt });
  }

  // Élève 6 : AUCUNE note au devoir de Maths du S2 alors que la classe est notée
  // (la ligne n'existe pas) → note « à justifier », moyenne provisoire.
  const missingEval = evaluations.find((e) => e.periodId === P2.id && e.csId === "cs-mat" && e.typeName === "Devoir")!;
  const missingIdx = grades.findIndex((g) => g.studentId === students[6].id && g.evaluationId === missingEval.id);
  grades.splice(missingIdx, 1);
  missingStudent = students[6].id;

  // L'ordre de restitution n'est pas garanti par la base : on mélange.
  for (let i = grades.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [grades[i], grades[j]] = [grades[j], grades[i]];
  }

  return { students, evaluations, grades, tiedPair, emptyStudent, missingStudent, missingEvaluation: missingEval.id };
}
