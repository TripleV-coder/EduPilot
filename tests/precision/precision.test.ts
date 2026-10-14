/**
 * Banc de PRÉCISION des calculs d'EduPilot.
 *
 * Principe : un jeu de données réaliste (dataset.ts) est servi aux VRAIES routes
 * et fonctions de l'application via un Prisma simulé qui applique fidèlement les
 * filtres `where` que chaque route demande (un filtre non reconnu fait échouer
 * le test, pour ne jamais « arranger » les données). Les sorties sont comparées
 * à un oracle indépendant en fractions exactes (oracle.ts).
 *
 * Moyennes, rangs, mentions et décisions : écart EXIGÉ = 0 avec la valeur
 * officielle arrondie au centième (section A). Les autres sections mesurent
 * et consignent les écarts dans .quality-tmp/precision-results.json.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "../api/test-helpers";
import {
  buildDataset, SUBJECTS, PERIODS, P1, P2, SCHOOL_ID, CLASS_ID, YEAR_ID,
  seeded, gauss, type Dataset, type DGrade, type DEval,
} from "./dataset";
import {
  Frac, beninSubjectAverage, generalAverage, competitionRank, mentionOf, mean,
  exactLinear, exactQuadratic, type OGrade,
  configuredSubjectAverage, roundWith, weightedAnnual, type ORules,
} from "./oracle";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const fn = () => vi.fn();
  return {
    default: {
      // Calculs adaptés pour un élève : aucun par défaut
      studentFormula: { findMany: vi.fn().mockResolvedValue([]) },
      studentProfile: { findUnique: fn(), findFirst: fn() },
      parentProfile: { findUnique: fn(), findFirst: fn() },
      parentStudent: { findUnique: fn() },
      period: { findUnique: fn(), findFirst: fn(), findMany: fn() },
      school: { findUnique: fn() },
      enrollment: { findMany: fn(), findFirst: fn() },
      grade: { findMany: fn() },
      attendance: { count: fn(), findMany: fn() },
      behaviorIncident: { count: fn() },
      class: { findUnique: fn() },
      configOption: { findFirst: fn() },
      schoolCalendarEvent: { findFirst: fn() },
      gradeHistory: { findMany: fn() },
      academicYear: { findUnique: fn(), findFirst: fn() },
      studentOrientation: { findFirst: fn() },
      classCouncil: { findUnique: fn(), findMany: fn() },
      externalPeriodAverage: { findMany: fn() },
      academicConfig: { findUnique: fn() },
      classSubject: { findMany: fn() },
    },
  };
});

// ───────────────────────────── outillage de mesure ─────────────────────────────

type Mock = ReturnType<typeof vi.fn>;
const P = () => prisma as unknown as Record<string, Record<string, Mock>>;
const RESULTS: Record<string, unknown> = {};
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Exige l'égalité EXACTE avec la valeur officielle arrondie au centième. */
function expectExact(m: { label: string; n: number; maxAbsErr: number; visible: number; mentionMismatch: number; notes: string[] }) {
  expect(m.n, m.label).toBeGreaterThan(0);
  expect(m.notes, m.label).toEqual([]);
  expect(m.maxAbsErr, m.label).toBe(0);
  expect(m.mentionMismatch, m.label).toBe(0);
}

function metric(label: string, pairs: Array<[number | null, Frac | null]>) {
  let max = 0, sum = 0, visible = 0, n = 0, mention = 0;
  const notes: string[] = [];
  for (const [app, ref] of pairs) {
    if (app === null || ref === null) {
      if (app !== ref) notes.push(`null-mismatch app=${app} ref=${ref?.toNumber() ?? null}`);
      continue;
    }
    // Les deux côtés sont des centièmes exacts convertis de la même façon : égalité stricte attendue.
    const err = Math.abs(app - ref.round2().toNumber());
    max = Math.max(max, err);
    sum += err;
    n++;
    if (err >= 0.005) visible++;
    if (mentionOf(Frac.dec(app)) !== mentionOf(ref.round2())) mention++;
  }
  return { label, n, maxAbsErr: round(max), meanAbsErr: round(n ? sum / n : 0), visible, mentionMismatch: mention, notes: notes.slice(0, 5) };
}

// ───────────────────────────── données + Prisma simulé ─────────────────────────────

let D: Dataset;
let EV: Map<string, DEval>;
const dec = (x: number | null) => (x === null ? null : new Decimal(x));
const periodOf = (id: string) => PERIODS.find((p) => p.id === id)!;

function csShape(csId: string) {
  const s = SUBJECTS.find((x) => x.csId === csId)!;
  return {
    id: s.csId, classId: CLASS_ID, subjectId: s.id, coefficient: dec(s.coef), teacherId: null, teacher: null,
    subject: { id: s.id, name: s.name, code: s.code },
  };
}
function evalShape(e: DEval) {
  return {
    id: e.id, title: e.title, date: e.date, maxGrade: dec(e.maxGrade), coefficient: dec(e.coef),
    periodId: e.periodId, classSubjectId: e.csId, typeId: e.typeName,
    type: { name: e.typeName }, classSubject: csShape(e.csId), period: periodOf(e.periodId),
  };
}
function gradeShape(g: DGrade) {
  return { ...g, value: dec(g.value), evaluation: evalShape(EV.get(g.evaluationId)!) };
}

/** Évalue fidèlement un `where` Prisma sur une évaluation ; refuse tout filtre inconnu. */
function matchEval(e: DEval, w: Record<string, unknown> | undefined): boolean {
  if (!w) return true;
  for (const [k, v] of Object.entries(w)) {
    if (k === "periodId") { if (e.periodId !== v) return false; }
    else if (k === "classSubjectId") { if (e.csId !== v) return false; }
    else if (k === "classSubject") {
      const cw = v as Record<string, unknown>;
      for (const ck of Object.keys(cw)) if (ck !== "classId") throw new Error(`filtre classSubject.${ck} non géré`);
      if (cw.classId !== undefined && cw.classId !== CLASS_ID) return false;
    } else if (k === "period") {
      const pw = v as Record<string, unknown>;
      for (const pk of Object.keys(pw)) if (pk !== "academicYearId") throw new Error(`filtre period.${pk} non géré`);
      if (periodOf(e.periodId).academicYearId !== pw.academicYearId) return false;
    } else throw new Error(`filtre evaluation.${k} non géré`);
  }
  return true;
}
function matchGrade(g: DGrade, w: Record<string, unknown> | undefined): boolean {
  if (!w) return true;
  for (const [k, v] of Object.entries(w)) {
    if (k === "studentId") {
      if (typeof v === "string") { if (g.studentId !== v) return false; }
      else if (!(v as { in: string[] }).in.includes(g.studentId)) return false;
    } else if (k === "deletedAt") { if (v !== null) throw new Error("deletedAt≠null"); if (g.deletedAt !== null) return false; }
    else if (k === "value") { if ((v as { not: unknown }).not !== null) throw new Error("value filter"); if (g.value === null) return false; }
    else if (k === "isAbsent" || k === "isExcused") { if (g[k] !== v) return false; }
    else if (k === "evaluation") { if (!matchEval(EV.get(g.evaluationId)!, v as Record<string, unknown>)) return false; }
    else throw new Error(`filtre grade.${k} non géré`);
  }
  return true;
}
const gradesWhere = (w: Record<string, unknown> | undefined) => D.grades.filter((g) => matchGrade(g, w));

function studentShape(sId: string) {
  const s = D.students.find((x) => x.id === sId)!;
  return { id: s.id, userId: s.userId, schoolId: SCHOOL_ID, matricule: s.id.slice(-6), dateOfBirth: new Date("2012-01-01"), user: { firstName: s.firstName, lastName: s.lastName } };
}

const CLASS_SHAPE = () => ({
  id: CLASS_ID, schoolId: SCHOOL_ID, name: "4ème A", classLevel: { name: "4ème", code: "4EME", level: "COLLEGE" }, mainTeacher: null,
  classSubjects: SUBJECTS.map((s) => csShape(s.csId)),
});

function wirePrisma() {
  const p = P();
  vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: SCHOOL_ID }) as never);
  p.school.findUnique.mockResolvedValue({ name: "CEG Test", address: "Cotonou", city: "Cotonou", phone: null, email: null, logo: null, motto: null, mempCode: null, code: "T1" });
  p.period.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => periodOf(where.id));
  p.period.findMany.mockImplementation(async ({ where }: { where: { academicYearId: string } }) =>
    PERIODS.filter((x) => x.academicYearId === where.academicYearId).sort((a, b) => a.sequence - b.sequence).map((x) => ({ id: x.id })));
  p.period.findFirst.mockImplementation(async ({ where }: { where: { academicYearId: string; sequence: { lt: number } } }) =>
    PERIODS.filter((x) => x.academicYearId === where.academicYearId && x.sequence < where.sequence.lt).sort((a, b) => b.sequence - a.sequence)[0] ?? null);
  p.attendance.count.mockResolvedValue(0);
  p.attendance.findMany.mockResolvedValue([]);
  p.behaviorIncident.count.mockResolvedValue(0);
  p.configOption.findFirst.mockResolvedValue(null);
  p.schoolCalendarEvent.findFirst.mockResolvedValue(null);
  p.grade.findMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => gradesWhere(args?.where).map(gradeShape));
  p.class.findUnique.mockResolvedValue(CLASS_SHAPE());
  // Aucun conseil validé, aucune moyenne d'origine, règles officielles par défaut
  p.classCouncil.findUnique.mockResolvedValue(null);
  p.classCouncil.findMany.mockResolvedValue([]);
  p.externalPeriodAverage.findMany.mockResolvedValue([]);
  p.academicConfig.findUnique.mockResolvedValue(null);
  p.classSubject.findMany.mockResolvedValue(SUBJECTS.map((s) => csShape(s.csId)));
  p.enrollment.findFirst.mockResolvedValue({
    id: "enr", studentId: D.students[0].id, classId: CLASS_ID, academicYearId: YEAR_ID, status: "ACTIVE", class: CLASS_SHAPE(),
  });

  // Effectif : chaque inclusion `grades` reçoit les notes filtrées par SON where.
  p.enrollment.findMany.mockImplementation(async (args: { include?: { student?: { include?: { grades?: { where?: Record<string, unknown> } } } }; select?: unknown }) => {
    if (args.select) return D.students.map((s) => ({ studentId: s.id }));
    const gw = args.include?.student?.include?.grades?.where;
    return D.students.map((s) => ({
      studentId: s.id, classId: CLASS_ID, academicYearId: YEAR_ID, status: "ACTIVE",
      student: {
        ...studentShape(s.id),
        grades: gradesWhere({ ...(gw ?? {}), studentId: s.id }).map(gradeShape),
        behaviorIncidents: [],
        studentOrientations: [],
      },
    }));
  });

  // Fiche élève : réponse construite selon les includes demandés.
  type EvInc = { where?: { periodId?: string }; include?: { grades?: { where?: Record<string, unknown> } } };
  p.studentProfile.findUnique.mockImplementation(async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
    const base = studentShape(args.where.id);
    if (!args.include) return base;
    const enrInc = args.include.enrollments as { include?: { class?: { include?: { classSubjects?: { include?: { evaluations?: EvInc } } } } } } | undefined;
    const evInc = enrInc?.include?.class?.include?.classSubjects?.include?.evaluations;
    return {
      ...base,
      enrollments: [{
        classId: CLASS_ID, academicYearId: YEAR_ID, status: "ACTIVE",
        academicYear: { id: YEAR_ID, name: "2025-2026" },
        class: {
          ...CLASS_SHAPE(),
          classSubjects: SUBJECTS.map((s) => ({
            ...csShape(s.csId),
            evaluations: evInc
              ? D.evaluations
                  .filter((e) => e.csId === s.csId && (!evInc.where?.periodId || e.periodId === evInc.where.periodId))
                  .map((e) => ({
                    ...evalShape(e),
                    grades: D.grades.filter((g) => g.evaluationId === e.id && matchGrade(g, evInc.include?.grades?.where)).map((g) => ({ ...g, value: dec(g.value) })),
                  }))
              : undefined,
          })),
        },
      }],
    };
  });
}

// ───────────────────────────── oracle appliqué au jeu de données ─────────────────────────────

function oGrades(studentId: string, csId: string, periodIds: string[]): OGrade[] {
  return D.grades
    .filter((g) => g.studentId === studentId)
    .map((g) => ({ g, e: EV.get(g.evaluationId)! }))
    .filter(({ e }) => e.csId === csId && periodIds.includes(e.periodId))
    .map(({ g, e }) => ({
      value: g.value, maxGrade: e.maxGrade, coef: e.coef, isAbsent: g.isAbsent, isExcused: g.isExcused, deleted: g.deletedAt !== null,
      kind: (["Devoir", "Composition"].includes(e.typeName) ? "D" : "I") as "D" | "I",
    }));
}
/**
 * Devoirs prévus pour l'élève dans la matière : ceux où il a une note non
 * supprimée, et ceux corrigés chez un camarade (où sa note manque → « NC »).
 */
function oPlannedDevoirs(sId: string, csId: string, period: string): number {
  const isDevoir = (e: DEval) => ["Devoir", "Composition"].includes(e.typeName);
  const resolvedRow = (g: DGrade) => g.deletedAt === null && (g.value !== null || g.isAbsent || g.isExcused);
  return D.evaluations
    .filter((e) => e.csId === csId && e.periodId === period && isDevoir(e))
    .filter((e) =>
      D.grades.some((g) => g.evaluationId === e.id && g.studentId === sId && g.deletedAt === null) ||
      D.grades.some((g) => g.evaluationId === e.id && resolvedRow(g)))
    .length;
}
/** Moyenne officielle d'une matière sur UNE période. */
const oSubject = (sId: string, csId: string, period: string) =>
  beninSubjectAverage(oGrades(sId, csId, [period]), oPlannedDevoirs(sId, csId, period));
/** Moyenne générale officielle d'une période. */
const oGeneral = (sId: string, period: string) =>
  generalAverage(SUBJECTS.map((s) => ({ avg: oSubject(sId, s.csId, period), coef: s.coef })));
const nonNull = (xs: Array<Frac | null>) => xs.filter((x): x is Frac => x !== null);
/** Moyenne annuelle officielle : moyenne simple des périodes. */
const oAnnualGeneral = (sId: string) => mean(nonNull([P1.id, P2.id].map((p) => oGeneral(sId, p))));
const r2 = (x: Frac | null) => (x === null ? null : x.round2());
/** Rang olympique officiel, sur les moyennes arrondies. */
const oRank = (x: Frac | null, all: Array<Frac | null>) => competitionRank(r2(x), all.map(r2));
function oDecision(exact: Frac | null): string {
  const avg = r2(exact);
  if (avg === null) return "Aucune";
  if (avg.cmp(Frac.int(16)) >= 0) return "Tableau d'honneur";
  if (avg.cmp(Frac.int(14)) >= 0) return "Encouragements";
  if (avg.cmp(Frac.int(10)) < 0) return "Avertissement travail";
  return "Aucune";
}
/**
 * Notes à justifier (oracle) : évaluations de la période où au moins un élève a
 * une note tranchée (saisie ou absence), et où CET élève n'a rien de tranché.
 * Une note supprimée n'existe plus : elle redevient à justifier.
 */
function oMissing(studentId: string, periodId: string): string[] {
  const resolved = (g: DGrade) => g.deletedAt === null && (g.value !== null || g.isAbsent || g.isExcused);
  const evalsOfPeriod = D.evaluations.filter((e) => e.periodId === periodId).map((e) => e.id);
  const graded = new Set(D.grades.filter((g) => resolved(g) && evalsOfPeriod.includes(g.evaluationId)).map((g) => g.evaluationId));
  const mine = new Set(D.grades.filter((g) => g.studentId === studentId && resolved(g)).map((g) => g.evaluationId));
  return Array.from(graded).filter((e) => !mine.has(e)).sort();
}

const SESSION = () => ({ session: makeSession("DIRECTOR", { schoolId: SCHOOL_ID }) }) as never;

beforeAll(() => {
  D = buildDataset();
  EV = new Map(D.evaluations.map((e) => [e.id, e]));
  wirePrisma();
});

afterAll(() => {
  mkdirSync(".quality-tmp", { recursive: true });
  writeFileSync(".quality-tmp/precision-results.json", JSON.stringify(RESULTS, null, 2));
});

// ═════════════════════════════ A. ROUTES « MOYENNES » ═════════════════════════════

describe("A. Moyennes servies par les routes vs oracle exact", () => {
  for (const period of [P1, P2]) {
    it(`/api/bulletins — ${period.name}`, async () => {
      const { GET } = await import("@/app/api/bulletins/route");
      const general: Array<[number | null, Frac | null]> = [];
      const subject: Array<[number | null, Frac | null]> = [];
      const classAvg: Array<[number | null, Frac | null]> = [];
      let rankMismatch = 0;
      const rankSamples: string[] = [];
      const oAll = D.students.map((s) => oGeneral(s.id, period.id));
      for (const [i, s] of D.students.entries()) {
        const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${s.id}&periodId=${period.id}`), SESSION());
        expect(res.status).toBe(200);
        const body = await res.json();
        general.push([body.generalAverage, oAll[i]]);
        // Notes « NC » (non tranchées) : exactement le nombre de l'oracle
        expect(body.ncGrades, s.firstName).toBe(oMissing(s.id, period.id).length);
        const expectedRank = oRank(oAll[i], oAll);
        if (body.rank !== expectedRank) { rankMismatch++; if (rankSamples.length < 6) rankSamples.push(`${s.firstName}: app=${body.rank} oracle=${expectedRank}`); }
        for (const sub of body.subjects) {
          const cs = SUBJECTS.find((x) => x.id === sub.subjectId)!;
          subject.push([sub.average, oSubject(s.id, cs.csId, period.id)]);
          if (i === 0) {
            const per = nonNull(D.students.map((x) => oSubject(x.id, cs.csId, period.id)));
            classAvg.push([sub.classAverage, mean(per)]);
          }
        }
      }
      const out = {
        generalAverage: { ...metric("moyenne générale", general), rankMismatch, rankSamples },
        subjectAverage: metric("moyenne par matière", subject),
        classSubjectAverage: metric("moyenne de classe par matière", classAvg),
      };
      RESULTS[`bulletins_${period.name}`] = out;
      expectExact(out.generalAverage);
      expectExact(out.subjectAverage);
      expectExact(out.classSubjectAverage);
      expect(rankMismatch, rankSamples.join(" | ")).toBe(0);
    });

    it(`/api/grades/report-cards (bulletin PDF) — ${period.name}`, async () => {
      const { GET } = await import("@/app/api/grades/report-cards/route");
      const general: Array<[number | null, Frac | null]> = [];
      const subject: Array<[number | null, Frac | null]> = [];
      let rankMismatch = 0;
      const rankSamples: string[] = [];
      const oAll = D.students.map((s) => oGeneral(s.id, period.id));
      for (const [i, s] of D.students.entries()) {
        const res = await GET(makeRequest(`http://localhost/api/grades/report-cards?studentId=${s.id}&periodId=${period.id}`), SESSION());
        expect(res.status).toBe(200);
        const body = await res.json();
        general.push([oAll[i] === null && body.overallAverage === 0 ? null : body.overallAverage, oAll[i]]);
        expect(body.missingGrades, s.firstName).toBe(oMissing(s.id, period.id).length);
        expect(body.isComplete).toBe(body.missingGrades === 0);
        const expectedRank = oRank(oAll[i], oAll);
        if ((body.classRank ?? null) !== expectedRank) { rankMismatch++; if (rankSamples.length < 6) rankSamples.push(`${s.firstName}: app=${body.classRank} oracle=${expectedRank} (moy. oracle ${oAll[i]?.toNumber().toFixed(4)})`); }
        for (const sub of body.subjects) {
          const cs = SUBJECTS.find((x) => x.name === sub.subject)!;
          subject.push([sub.average, oSubject(s.id, cs.csId, period.id)]);
        }
      }
      const out = {
        generalAverage: { ...metric("moyenne générale", general), rankMismatch, rankSamples },
        subjectAverage: metric("moyenne par matière", subject),
      };
      RESULTS[`reportCards_${period.name}`] = out;
      expectExact(out.generalAverage);
      expectExact(out.subjectAverage);
      expect(rankMismatch, rankSamples.join(" | ")).toBe(0);
    });

    it(`/api/grades/councils (conseil de classe) — ${period.name}`, async () => {
      const { GET } = await import("@/app/api/grades/councils/route");
      const res = await GET(makeRequest(`http://localhost/api/grades/councils?classId=${CLASS_ID}&periodId=${period.id}`), SESSION());
      const body = await res.json();
      expect(res.status, JSON.stringify(body).slice(0, 300)).toBe(200);
      const rows = (body.students ?? body.rows) as Array<{ studentId: string; generalAverage: number | null; rank: number | null; decision: string }>;
      expect(Array.isArray(rows), Object.keys(body).join(",")).toBe(true);
      const oAll = D.students.map((s) => oGeneral(s.id, period.id));
      const pairs: Array<[number | null, Frac | null]> = [];
      let rankMismatch = 0, decisionMismatch = 0;
      const decisionSamples: string[] = [];
      for (const r of rows) {
        const i = D.students.findIndex((s) => s.id === r.studentId);
        pairs.push([r.generalAverage, oAll[i]]);
        if (r.rank !== oRank(oAll[i], oAll)) rankMismatch++;
        expect((r as { ncGrades?: number }).ncGrades).toBe(oMissing(r.studentId, period.id).length);
        const od = oDecision(oAll[i]);
        if (r.decision !== od) { decisionMismatch++; if (decisionSamples.length < 6) decisionSamples.push(`app=${r.generalAverage?.toFixed(2)} « ${r.decision} » / oracle=${oAll[i]?.toNumber().toFixed(2)} « ${od} »`); }
      }
      const out = { ...metric("moyenne générale (conseil)", pairs), rankMismatch, decisionMismatch, decisionSamples };
      RESULTS[`councils_${period.name}`] = out;
      expectExact(out);
      expect(rankMismatch).toBe(0);
      expect(decisionMismatch, decisionSamples.join(" | ")).toBe(0);
    });
  }

  it("/api/orientation/council — moyenne annuelle servant à l'orientation", async () => {
    const { GET } = await import("@/app/api/orientation/council/route");
    const res = await GET(makeRequest(`http://localhost/api/orientation/council?classId=${CLASS_ID}&academicYearId=${YEAR_ID}`), SESSION());
    const body = await res.json();
    expect(res.status, JSON.stringify(body).slice(0, 300)).toBe(200);
    const pairsYear: Array<[number | null, Frac | null]> = [];
    const pairsMeanSem: Array<[number | null, Frac | null]> = [];
    for (const r of body.students as Array<{ studentId: string; generalAverage: number | null }>) {
      pairsYear.push([r.generalAverage, oAnnualGeneral(r.studentId)]);
    }
    void pairsMeanSem;
    const m = metric("moyenne annuelle (moyenne des semestres)", pairsYear);
    RESULTS.orientationCouncil = m;
    expectExact(m);
  });

  it("orientation/me — computeIndicativeRecommendations (moyenne indicative)", async () => {
    const { computeIndicativeRecommendations } = await import("@/lib/services/orientation");
    const pairs: Array<[number | null, Frac | null]> = [];
    for (const s of D.students) {
      const r = await computeIndicativeRecommendations(s.id, YEAR_ID);
      pairs.push([r.generalAverage, oAnnualGeneral(s.id)]);
    }
    const m = metric("moyenne indicative vs moyenne annuelle officielle", pairs);
    RESULTS.orientationIndicative = m;
    expectExact(m);
  });
});

// ═════════════════════════════ B. FONCTIONS DE CALCUL PURES ═════════════════════════════

describe("B. Fonctions pures vs oracle", () => {
  it("moteur : formule officielle et arrondi exacts (fuzz 20 000 cas), mentions sans trou", async () => {
    const E = await import("@/lib/academic/average-engine");
    const BC = await import("@/lib/benin/config");
    const G = await import("@/lib/utils/grades");
    const rng = seeded(7);
    let subjectMismatch = 0, generalMismatch = 0;
    const samples: string[] = [];
    for (let k = 0; k < 20000; k++) {
      const n = 1 + Math.floor(rng() * 8);
      const grades = Array.from({ length: n }, () => {
        const maxGrade = [10, 20, 40][Math.floor(rng() * 3)];
        return {
          value: Math.round(rng() * maxGrade * 100) / 100,
          maxGrade,
          isAbsent: rng() < 0.05, isExcused: rng() < 0.03,
          kind: (rng() < 0.4 ? "DEVOIR" : "INTERROGATION") as "DEVOIR" | "INTERROGATION",
        };
      });
      const app = E.toDisplay(E.subjectAverage(grades));
      const ref = beninSubjectAverage(grades.map((g) => ({ value: g.value, maxGrade: g.maxGrade, coef: 1, isAbsent: g.isAbsent, isExcused: g.isExcused, deleted: false, kind: g.kind === "DEVOIR" ? "D" : "I" })));
      const expected = ref === null ? null : ref.round2().toNumber();
      if (app !== expected) { subjectMismatch++; if (samples.length < 5) samples.push(`app=${app} oracle=${expected}`); }

      const coefs = [3, 2, 1.5];
      const subs = coefs.map((c) => ({ c, v: rng() < 0.1 ? null : Math.round(rng() * 2000) / 100 }));
      const appG = E.toDisplay(E.generalAverage(subs.map((x) => ({ average: x.v === null ? null : E.Rational.from(x.v), coefficient: x.c }))));
      const refG = generalAverage(subs.map((x) => ({ avg: x.v === null ? null : Frac.dec(x.v), coef: x.c })));
      if (appG !== (refG === null ? null : refG.round2().toNumber())) generalMismatch++;
    }
    expect(subjectMismatch, samples.join(" | ")).toBe(0);
    expect(generalMismatch).toBe(0);

    // Mentions : balayage 0 → 20 au millième, plus aucun trou entre tranches.
    let mentionNull = 0, mentionWrong = 0, apprVsMention = 0;
    const APPR: Record<string, string> = { EXCELLENT: "Excellent", TRES_BIEN: "Très bien", BIEN: "Bien", ASSEZ_BIEN: "Assez bien", PASSABLE: "Passable" };
    for (let m = 0; m <= 20000; m++) {
      const v = m / 1000;
      const got = BC.getMention(v);
      const ref = mentionOf(new Frac(BigInt(m), BigInt(1000)));
      if (got === null) mentionNull++;
      else if (got.code !== ref) mentionWrong++;
      if (ref !== "ECHEC" && G.getAppreciation(v) !== APPR[ref]) apprVsMention++;
    }
    expect(mentionNull).toBe(0);
    expect(mentionWrong).toBe(0);
    expect(apprVsMention).toBe(0);

    RESULTS.pureFunctions = {
      engineSubjectAverage_mismatch: `${subjectMismatch}/20000`,
      engineGeneralAverage_mismatch: `${generalMismatch}/20000`,
      getMention_nullResults: `${mentionNull}/20001`,
      getMention_wrongBand: mentionWrong,
      getAppreciation_vs_mention_disagreements: apprVsMention,
    };
  });

  it("règles du conseil + validations de configuration", async () => {
    const { pickDecision, councilRulesSchema, DEFAULT_COUNCIL_RULES } = await import("@/lib/academic/council-rules");
    const { validateCoefficient, validateGrade } = await import("@/lib/benin-curriculum-system");
    let wrong = 0;
    for (let m = 0; m <= 2000; m++) {
      for (const inc of [0, 2, 3, 5]) {
        const got = pickDecision(m / 100, inc).decision;
        const ref = inc >= 3 ? "Avertissement conduite" : oDecision(new Frac(BigInt(m), 100n));
        if (got !== ref) wrong++;
      }
    }
    RESULTS.config = {
      pickDecision_wrong_on_8004_cases: wrong,
      councilRules_rejects_honor_below_encouragement: !councilRulesSchema.safeParse({ ...DEFAULT_COUNCIL_RULES, honorMin: 13 }).success,
      councilRules_rejects_encouragement_eq_warning: !councilRulesSchema.safeParse({ ...DEFAULT_COUNCIL_RULES, encouragementMin: 10 }).success,
      councilRules_rejects_fractional_incidents: !councilRulesSchema.safeParse({ ...DEFAULT_COUNCIL_RULES, conductIncidents: 2.5 }).success,
      validateCoefficient_valid: Object.fromEntries(([0, -1, 0.5, 1.25, 1.255, 0.1 + 0.2, 1e-7, 1001, "2", "abc"] as unknown[]).map((c) => [String(c), validateCoefficient(c).valid])),
      validateGrade_valid: Object.fromEntries(([[21, 20], [20, 20], [-0.01, 20], [10.5, 10]] as [number, number][]).map(([g, m]) => [`${g}/${m}`, validateGrade(g, m).valid])),
    };
  });
});

// ═════════════════════════════ C. ORIENTATION ═════════════════════════════

describe("C. Orientation : classement des matières et recommandations", () => {
  it("disciplineOf sur les intitulés réels du Bénin (aucune erreur tolérée)", async () => {
    const { disciplineOf } = await import("@/lib/benin/series");
    const expected: Record<string, string | null> = {
      "Mathématiques": "MATH", "Physique-Chimie-Technologie": "PC", "PCT": "PC", "Sciences Physiques": "PC",
      "Sciences de la Vie et de la Terre": "SVT", "SVT": "SVT", "Biologie": "SVT",
      "Français": "FR", "Lecture": "FR", "Philosophie": "PHILO", "Histoire-Géographie": "HG",
      "Anglais": "LV", "Espagnol": "LV", "Allemand": "LV",
      "Éducation Physique et Sportive": "EPS", "EPS": "EPS",
      "Économie": "ECO", "Sciences Économiques et Sociales": "ECO", "Comptabilité": "ECO",
      "Informatique": "TECH", "Dessin Technique": "TECH", "Électrotechnique": "TECH", "Génie Civil": "TECH",
      "Arts plastiques": "ARTS", "Musique": "ARTS", "Éducation Artistique": "ARTS", "Éducation Civique et Morale": null,
    };
    const wrong: string[] = [];
    for (const [name, exp] of Object.entries(expected)) {
      const got = disciplineOf(name);
      if (got !== exp) wrong.push(`${name}: attendu ${exp}, obtenu ${got}`);
    }
    RESULTS.orientationClassify = { tested: Object.keys(expected).length, wrong };
    expect(wrong).toEqual([]);
  });

  it("recommandations sur profils types", async () => {
    const { computeIndicativeRecommendations } = await import("@/lib/services/orientation");
    const p = P();
    // Profil type : un élève seul dans une classe dont les matières sont celles du profil,
    // calculé par le même module que le bulletin (classe, période unique)
    const profile = async (marks: Record<string, number>) => {
      const subjects = Object.keys(marks).map((name) => ({
        id: `cs-${name}`, subjectId: `s-${name}`, coefficient: new Decimal(1), subject: { name },
      }));
      p.studentProfile.findUnique.mockResolvedValueOnce({ id: "cx", schoolId: SCHOOL_ID });
      p.enrollment.findFirst.mockResolvedValueOnce({ classId: "cls-prof", class: { classSubjects: subjects } });
      p.enrollment.findMany.mockResolvedValueOnce([{ studentId: "cx", enrolledAt: null }]);
      p.period.findMany.mockResolvedValueOnce([{ id: "p1" }]);
      p.grade.findMany.mockResolvedValueOnce(Object.entries(marks).flatMap(([name, v]) =>
        [v - 0.5, v + 0.5].map((x, k) => ({
          studentId: "cx",
          evaluationId: `ev-${name}-${k}`,
          value: new Decimal(x), isAbsent: false, isExcused: false,
          evaluation: {
            date: new Date("2026-01-10"), maxGrade: new Decimal(20), periodId: "p1", classSubjectId: `cs-${name}`,
            classSubject: { subjectId: `s-${name}` },
            type: k === 0 ? { code: "IE", name: "Interrogation", category: "INTERROGATION" } : { code: "DS", name: "Devoir", category: "DEVOIR" },
          },
        }))));
      return (await computeIndicativeRecommendations("cx", YEAR_ID)).recommendations.map((r) => `${r.series} (${r.score})`);
    };
    const sci = { "Mathématiques": 17, "Physique-Chimie": 16, "SVT": 15, "Français": 11, "Anglais": 11, "Histoire-Géographie": 11 };
    const out = {
      scientifiqueFort_EPS6: await profile({ ...sci, "Éducation Physique et Sportive": 6 }),
      scientifiqueFort_EPS18: await profile({ ...sci, "Éducation Physique et Sportive": 18 }),
      svtFort_mathsFaibles: await profile({ "Mathématiques": 9, "Physique-Chimie": 11, "SVT": 17, "Français": 11, "Anglais": 11, "Histoire-Géographie": 11 }),
      mathsFort_svtMoyenne: await profile({ "Mathématiques": 17, "Physique-Chimie": 16, "SVT": 11, "Français": 11, "Anglais": 11, "Histoire-Géographie": 11 }),
      litteraire: await profile({ "Mathématiques": 8, "Physique-Chimie": 8, "SVT": 9, "Français": 16, "Anglais": 15, "Histoire-Géographie": 15, "Philosophie": 15 }),
      langues: await profile({ "Mathématiques": 9, "Français": 15, "Anglais": 17, "Espagnol": 16, "Histoire-Géographie": 11 }),
      economique: await profile({ "Mathématiques": 13, "Français": 12, "Anglais": 12, "Histoire-Géographie": 14, "Économie": 16, "Comptabilité": 15 }),
    };
    RESULTS.orientationProfiles = out;
    const top = (k: keyof typeof out) => out[k][0].split(" ")[0];
    // L'EPS ne pèse plus sur l'orientation scientifique
    expect(out.scientifiqueFort_EPS6[0]).toBe(out.scientifiqueFort_EPS18[0]);
    // C et D se distinguent enfin
    expect(top("svtFort_mathsFaibles")).toBe("SERIE_D");
    expect(top("mathsFort_svtMoyenne")).toBe("SERIE_C");
    expect(["SERIE_A1", "SERIE_A2"]).toContain(top("litteraire"));
    expect(top("langues")).toBe("SERIE_A1");
    expect(top("economique")).toBe("SERIE_B");
    wirePrisma();
  });
});

// ═════════════════════════════ D. PRÉDICTION ═════════════════════════════

describe("D. Prédiction de la moyenne du semestre suivant", () => {
  it("régressions linéaire et quadratique vs moindres carrés exacts", async () => {
    const R = await import("@/lib/services/ai-predictive/algorithms/regression");
    const rng = seeded(11);
    let linErr = 0, quadErr = 0, quadPredErr = 0;
    for (let k = 0; k < 3000; k++) {
      const n = 3 + Math.floor(rng() * 6);
      const pts = Array.from({ length: n }, (_, i) => ({ x: i + 1, y: Math.round((8 + 8 * rng()) * 100) / 100 }));
      const app = R.linearRegression(pts), ref = exactLinear(pts)!;
      linErr = Math.max(linErr, Math.abs(app.slope - ref.b.toNumber()), Math.abs(app.intercept - ref.a.toNumber()));
      const q = R.polynomialRegression(pts), qr = exactQuadratic(pts)!;
      quadErr = Math.max(quadErr, ...q.coefficients.map((c, i) => Math.abs(c - qr[i].toNumber())));
      const x = n + 1;
      quadPredErr = Math.max(quadPredErr, Math.abs(q.predict(x) - (qr[0].toNumber() + qr[1].toNumber() * x + qr[2].toNumber() * x * x)));
    }
    const degenerate = R.linearRegression([{ x: 1, y: 12 }, { x: 1, y: 14 }]);
    RESULTS.regression = {
      linearCoeffMaxAbsErr: linErr, quadraticCoeffMaxAbsErr: quadErr, quadraticPredictionMaxAbsErr: quadPredErr,
      degenerateSameX: { slope: degenerate.slope, predict: degenerate.predict(2) },
    };
  });

  it("backtest : prédiction vs valeur réelle sur 5 × 1 000 trajectoires (5 façons d'évoluer)", async () => {
    const { predictNextPeriodGrade } = await import("@/lib/services/ai-predictive/predict-grade");
    const p = P();
    const rng = seeded(99);
    const clamp = (x: number) => Math.min(20, Math.max(0, x));
    const r2 = (x: number) => Math.round(clamp(x) * 100) / 100;
    const U = (a: number, b: number) => a + (b - a) * rng();
    // Cinq façons réalistes d'évoluer (aucune n'est « taillée » pour la méthode retenue)
    const PROCESSES: Record<string, (n: number) => number[]> = {
      "niveau stable": (n) => { const L = 11 + 3 * gauss(rng), sd = U(0.5, 2); return Array.from({ length: n }, () => r2(L + sd * gauss(rng))); },
      "tendance": (n) => { const L = 11 + 3 * gauss(rng), b = 0.4 * gauss(rng), sd = U(0.5, 1.5); return Array.from({ length: n }, (_, i) => r2(L + b * i + sd * gauss(rng))); },
      "dérive progressive": (n) => { let x = 11 + 3 * gauss(rng); const st = U(0.5, 1.5); return Array.from({ length: n }, () => { x = clamp(x + st * gauss(rng)); return r2(x + 0.4 * gauss(rng)); }); },
      "retour vers la moyenne": (n) => { const mu = 11 + 3 * gauss(rng), rho = U(0.3, 0.9), sd = U(0.7, 1.5); let x = mu + 2 * gauss(rng); return Array.from({ length: n }, () => { x = mu + rho * (x - mu) + sd * gauss(rng); return r2(x); }); },
      "rupture": (n) => { const L = 11 + 3 * gauss(rng), k = 1 + Math.floor(rng() * (n - 1)), d = 2.5 * gauss(rng); return Array.from({ length: n }, (_, i) => r2(L + (i >= k ? d : 0) + gauss(rng))); },
    };
    type Acc = { abs: number[]; in95: number; in80: number; n: number; hasRange: boolean };
    const acc: Record<string, Acc> = {};
    const mk = (name: string, actual: number, pred: number, r95?: { min: number; max: number } | null, r80?: { min: number; max: number } | null) => {
      const b = (acc[name] ??= { abs: [], in95: 0, in80: 0, n: 0, hasRange: Boolean(r95) });
      b.abs.push(Math.abs(pred - actual)); b.n++;
      if (r95 && actual >= r95.min && actual <= r95.max) b.in95++;
      if (r80 && actual >= r80.min && actual <= r80.max) b.in80++;
    };
    const confBins = Array.from({ length: 10 }, () => ({ p: 0, hit: 0, n: 0 }));
    for (const [process, gen] of Object.entries(PROCESSES)) {
      for (let k = 0; k < 1000; k++) {
        const len = 3 + (k % 6); // 3 à 8 périodes d'historique
        const series = gen(len + 1);
        const hist = series.slice(0, len), actual = series[len];
        p.gradeHistory.findMany.mockResolvedValueOnce(hist.map((v) => ({ average: new Decimal(v) })));
        const r = await predictNextPeriodGrade(`cstu${process}${k}`);
        if (r.predicted === null) throw new Error("prévision absente malgré un historique");
        mk("EduPilot", actual, r.predicted, r.range, r.range80);
        mk(`EduPilot — ${process}`, actual, r.predicted, r.range, r.range80);
        mk("Référence : dernière moyenne", actual, hist[len - 1]);
        mk(`Référence : dernière moyenne — ${process}`, actual, hist[len - 1]);
        mk("Référence : moyenne de l'historique", actual, hist.reduce((a, b) => a + b, 0) / len);
        const lin = exactLinear(hist.map((y, i) => ({ x: i + 1, y })))!;
        mk("Référence : droite des moindres carrés", actual, clamp(lin.a.toNumber() + lin.b.toNumber() * (len + 1)));
        const bin = confBins[Math.min(9, Math.floor(r.confidence / 10))];
        bin.p += r.confidence / 100; bin.hit += Math.abs(r.predicted - actual) <= 1 ? 1 : 0; bin.n++;
      }
    }
    const summary = Object.fromEntries(Object.entries(acc).map(([name, b]) => {
      const s = [...b.abs].sort((x, y) => x - y);
      return [name, {
        n: b.n,
        MAE: round(s.reduce((a, c) => a + c, 0) / s.length, 3),
        RMSE: round(Math.sqrt(s.reduce((a, c) => a + c * c, 0) / s.length), 3),
        P90: round(s[Math.floor(0.9 * s.length)], 3),
        pctWithin1pt: round((100 * s.filter((x) => x <= 1).length) / s.length, 1),
        ...(b.hasRange ? { coverage95: round((100 * b.in95) / b.n, 1), coverage80: round((100 * b.in80) / b.n, 1) } : {}),
      }];
    }));
    RESULTS.prediction = {
      model: "5 façons d'évoluer × 1 000 élèves, 3 à 8 périodes d'historique",
      summary,
      confidenceCalibration: confBins.filter((b) => b.n >= 50).map((b) => ({
        annonce: round((100 * b.p) / b.n, 1), observe: round((100 * b.hit) / b.n, 1), n: b.n,
      })),
    };
    const ours = summary["EduPilot"] as { MAE: number; coverage95: number; coverage80: number };
    const last = summary["Référence : dernière moyenne"] as { MAE: number };
    const line = summary["Référence : droite des moindres carrés"] as { MAE: number };
    // Plus précis que les méthodes de référence, et fourchettes honnêtes
    expect(ours.MAE).toBeLessThan(last.MAE);
    expect(ours.MAE).toBeLessThan(line.MAE);
    expect(ours.coverage95).toBeGreaterThanOrEqual(92);
    expect(ours.coverage95).toBeLessThanOrEqual(97.5);
    expect(ours.coverage80).toBeGreaterThanOrEqual(76);
    expect(ours.coverage80).toBeLessThanOrEqual(86);
    // Dans chaque situation, jamais nettement pire que « dernière moyenne »
    for (const process of Object.keys(PROCESSES)) {
      const a = summary[`EduPilot — ${process}`] as { MAE: number; coverage95: number };
      const b = summary[`Référence : dernière moyenne — ${process}`] as { MAE: number };
      expect(a.MAE).toBeLessThan(b.MAE * 1.05);
      expect(a.coverage95).toBeGreaterThanOrEqual(88);
    }
    // « Confiance » jamais optimiste : la part réellement à ±1 point ≥ annonce − 3 points
    for (const b of confBins.filter((x) => x.n >= 50)) expect((100 * b.hit) / b.n).toBeGreaterThanOrEqual((100 * b.p) / b.n - 3);
  });

  it("sans aucune moyenne passée : pas de prévision inventée", async () => {
    const { predictNextPeriodGrade } = await import("@/lib/services/ai-predictive/predict-grade");
    P().gradeHistory.findMany.mockResolvedValueOnce([]);
    const r = await predictNextPeriodGrade("cstu-vide");
    expect(r.predicted).toBeNull();
    expect(r.range).toBeNull();
    expect(r.confidence).toBe(0);
  });
});

// ═════════════════════════════ D. RÈGLES RÉGLABLES DE L'ÉCOLE ═════════════════════════════

/**
 * Chaque option qu'une école peut choisir est vérifiée de bout en bout (route
 * du bulletin) contre l'oracle indépendant, exactement comme la règle
 * officielle : aucun écart toléré, rang compris.
 */
describe("D. Règles réglables de l'établissement vs oracle exact", () => {
  /** Règles envoyées à l'application (formules écrites en clair, ou anciennes valeurs). */
  type Calc = {
    subjectFormula: string;
    unjustifiedAbsence: "ZERO" | "EXCLUDE";
    unresolvedNc: "EXCLUDE" | "ZERO";
    subjectNcWhenNoDevoir: boolean;
    rounding: "HALF_UP" | "TRUNCATE";
    annualFormula: string;
    periodWeights?: number[];
  };
  /** Ce que l'oracle indépendant doit calculer pour ces règles (réécrit à la main, sans lire la formule). */
  type Spec = { formula: ORules["formula"]; annualWeights: number[]; teacher?: { csId: string; formula: ORules["formula"] } };

  const OFFICIAL: Calc = {
    subjectFormula: "moyenne(MI ; DEVOIRS ; COMPOS)",
    unjustifiedAbsence: "ZERO",
    unresolvedNc: "EXCLUDE",
    subjectNcWhenNoDevoir: true,
    rounding: "HALF_UP",
    annualFormula: "moyenne(PERIODES)",
  };
  const OFFICIAL_SPEC: Spec = { formula: "OFFICIAL", annualWeights: [1, 1] };
  const CONFIGS: Array<{ name: string; calc: Calc; spec: Spec; teacherFormula?: string; mustDiffer: boolean }> = [
    { name: "moyenne de classe puis composition", calc: { ...OFFICIAL, subjectFormula: "moyenne(moyenne(MI ; MD) ; MC)" }, spec: { ...OFFICIAL_SPEC, formula: "CLASS_THEN_COMPO" }, mustDiffer: true },
    { name: "formule libre de l'école (MI + MD + 2×MC) / 4", calc: { ...OFFICIAL, subjectFormula: "(MI + MD + 2*MC) / 4" }, spec: { ...OFFICIAL_SPEC, formula: "FIXED_WEIGHTS" }, mustDiffer: true },
    { name: "formule libre : composition comptée deux fois", calc: { ...OFFICIAL, subjectFormula: "moyenne(mi, devoirs, compos, compos)" }, spec: { ...OFFICIAL_SPEC, formula: "COMPO_DOUBLE" }, mustDiffer: true },
    {
      name: "formule de l'enseignant de mathématiques seulement",
      calc: OFFICIAL,
      teacherFormula: "(MI + MD + 2*MC) / 4",
      spec: { ...OFFICIAL_SPEC, teacher: { csId: "cs-mat", formula: "FIXED_WEIGHTS" } },
      mustDiffer: true,
    },
    { name: "moyenne annuelle libre (S1 + 2×S2) / 3", calc: { ...OFFICIAL, annualFormula: "(S1 + 2*S2) / 3" }, spec: { ...OFFICIAL_SPEC, annualWeights: [1, 2] }, mustDiffer: false },
    { name: "absence non justifiée retirée", calc: { ...OFFICIAL, unjustifiedAbsence: "EXCLUDE" }, spec: OFFICIAL_SPEC, mustDiffer: true },
    { name: "note NC comptée 0", calc: { ...OFFICIAL, unresolvedNc: "ZERO" }, spec: OFFICIAL_SPEC, mustDiffer: true },
    { name: "matière jamais NC", calc: { ...OFFICIAL, subjectNcWhenNoDevoir: false }, spec: OFFICIAL_SPEC, mustDiffer: false },
    { name: "troncature au centième", calc: { ...OFFICIAL, rounding: "TRUNCATE" }, spec: OFFICIAL_SPEC, mustDiffer: true },
    {
      name: "anciennes règles enregistrées (choix d'options, poids 1-2) converties en formules",
      calc: { ...OFFICIAL, subjectFormula: "CLASSE_PUIS_COMPOSITION", annualFormula: "WEIGHTED", periodWeights: [1, 2] },
      spec: { formula: "CLASS_THEN_COMPO", annualWeights: [1, 2] },
      mustDiffer: true,
    },
    {
      name: "combinaison (formule libre, absence retirée, NC = 0, troncature, annuelle libre)",
      calc: { subjectFormula: "(MI + MD + 2*MC) / 4", unjustifiedAbsence: "EXCLUDE", unresolvedNc: "ZERO", subjectNcWhenNoDevoir: false, rounding: "TRUNCATE", annualFormula: "(P1 + 2*P2) / 3" },
      spec: { formula: "FIXED_WEIGHTS", annualWeights: [1, 2] },
      mustDiffer: true,
    },
  ];

  const toORules = (c: Calc, spec: Spec, csId?: string): ORules => ({
    formula: spec.teacher && spec.teacher.csId === csId ? spec.teacher.formula : spec.formula,
    absence: c.unjustifiedAbsence,
    ncNoDevoir: c.subjectNcWhenNoDevoir,
    rounding: c.rounding,
  });
  const kindOf = (e: DEval): "I" | "D" | "C" =>
    e.typeName === "Composition" ? "C" : e.typeName === "Devoir" ? "D" : "I";

  /** Notes de l'élève dans la matière ; avec « NC = 0 », un 0 par note attendue manquante. */
  function cfgGrades(sId: string, csId: string, period: string, c: Calc): OGrade[] {
    const own = D.grades
      .filter((g) => g.studentId === sId)
      .map((g) => ({ g, e: EV.get(g.evaluationId)! }))
      .filter(({ e }) => e.csId === csId && e.periodId === period)
      .map(({ g, e }) => ({ value: g.value, maxGrade: e.maxGrade, coef: e.coef, isAbsent: g.isAbsent, isExcused: g.isExcused, deleted: g.deletedAt !== null, kind: kindOf(e) }));
    if (c.unresolvedNc !== "ZERO") return own;
    const zeros = oMissing(sId, period)
      .map((id) => EV.get(id)!)
      .filter((e) => e.csId === csId)
      .map((e) => ({ value: 0, maxGrade: 20, coef: 1, isAbsent: false, isExcused: false, deleted: false, kind: kindOf(e) }));
    return [...own, ...zeros];
  }
  const cfgSubject = (sId: string, csId: string, period: string, c: Calc, spec: Spec) =>
    configuredSubjectAverage(cfgGrades(sId, csId, period, c), oPlannedDevoirs(sId, csId, period), toORules(c, spec, csId));
  const cfgGeneral = (sId: string, period: string, c: Calc, spec: Spec) =>
    generalAverage(SUBJECTS.map((x) => ({ avg: cfgSubject(sId, x.csId, period, c, spec), coef: x.coef })));
  const shown = (x: Frac | null, c: Calc) => {
    const r = roundWith(x, toORules(c, OFFICIAL_SPEC));
    return r === null ? null : r.toNumber();
  };

  afterEach(() => {
    P().configOption.findFirst.mockResolvedValue(null);
    P().classSubject.findMany.mockResolvedValue(SUBJECTS.map((x) => csShape(x.csId)));
  });

  for (const cfg of CONFIGS) {
    it(`bulletin — ${cfg.name}`, async () => {
      const { GET } = await import("@/app/api/bulletins/route");
      P().configOption.findFirst.mockImplementation(async (args: { where?: { category?: string } }) =>
        args?.where?.category === "GRADING_SETTINGS" ? { metadata: { calculation: cfg.calc } } : null);
      // Formule écrite par l'enseignant d'une matière (lue par le calcul de la classe)
      P().classSubject.findMany.mockImplementation(async (args: { where?: { averageFormula?: unknown } }) =>
        args?.where?.averageFormula && cfg.teacherFormula
          ? [{ id: cfg.spec.teacher!.csId, averageFormula: cfg.teacherFormula }]
          : args?.where?.averageFormula
            ? []
            : SUBJECTS.map((x) => csShape(x.csId)));

      let compared = 0;
      let differsFromOfficial = 0;
      const errors: string[] = [];
      for (const period of [P1, P2]) {
        const all = D.students.map((s) => shown(cfgGeneral(s.id, period.id, cfg.calc, cfg.spec), cfg.calc));
        for (const [i, s] of D.students.entries()) {
          const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${s.id}&periodId=${period.id}`), SESSION());
          expect(res.status).toBe(200);
          const body = await res.json();

          const expectedGeneral = all[i];
          compared++;
          if (body.generalAverage !== expectedGeneral) errors.push(`${period.name} ${s.firstName} générale app=${body.generalAverage} oracle=${expectedGeneral}`);
          if (expectedGeneral !== shown(oGeneral(s.id, period.id), OFFICIAL)) differsFromOfficial++;

          const expectedRank = expectedGeneral === null ? null : 1 + all.filter((x) => x !== null && x > expectedGeneral).length;
          if (body.rank !== expectedRank) errors.push(`${period.name} ${s.firstName} rang app=${body.rank} oracle=${expectedRank}`);

          for (const sub of body.subjects as Array<{ subjectId: string; average: number | null }>) {
            const cs = SUBJECTS.find((x) => x.id === sub.subjectId)!;
            const expected = shown(cfgSubject(s.id, cs.csId, period.id, cfg.calc, cfg.spec), cfg.calc);
            compared++;
            if (sub.average !== expected) errors.push(`${period.name} ${s.firstName} ${cs.name} app=${sub.average} oracle=${expected}`);
          }

          // Moyenne annuelle (dernière période) : simple ou pondérée selon l'école
          if (period.id === P2.id && body.annual && body.annual.isProvisional === false) {
            const periods = [P1, P2].map((p) => cfgGeneral(s.id, p.id, cfg.calc, cfg.spec));
            const exact = weightedAnnual(periods, cfg.spec.annualWeights);
            const expectedAnnual = shown(exact, cfg.calc);
            compared++;
            if (body.annual.average !== expectedAnnual) errors.push(`annuelle ${s.firstName} app=${body.annual.average} oracle=${expectedAnnual}`);
          }
        }
      }
      RESULTS[`config_${cfg.name}`] = { compared, errors: errors.length, differsFromOfficial, samples: errors.slice(0, 6) };
      expect(errors, errors.slice(0, 6).join(" | ")).toEqual([]);
      expect(compared).toBeGreaterThan(50);
      // L'option change réellement les résultats sur ce jeu de données (sinon le test ne prouverait rien)
      if (cfg.mustDiffer) expect(differsFromOfficial, cfg.name).toBeGreaterThan(0);
      // ~70 bulletins calculés de bout en bout par configuration : délai élargi
      // quand toute la suite tourne en parallèle (les vérifications restent strictes)
    }, 60_000);
  }
});


// ═════════════════════════════ E. CALCUL ADAPTÉ POUR UN ÉLÈVE ═════════════════════════════

/**
 * L'enseignant adapte le calcul pour un élève précis : une note non comptée
 * (la division perd une note), ou une formule particulière nommant ses notes
 * (D1, I1…). Vérifié de bout en bout (bulletin) contre l'oracle indépendant,
 * y compris le fait que les camarades ne sont PAS touchés.
 */
describe("E. Calcul adapté pour un élève vs oracle exact", () => {
  const on20 = (g: DGrade, e: DEval): Frac | null => {
    if (g.isExcused) return null;
    if (g.isAbsent) return Frac.int(0);
    if (g.value === null) return null;
    return Frac.dec(g.value).div(Frac.int(e.maxGrade)).mul(Frac.int(20));
  };
  const rowsOf = (sId: string, csId: string, periodId: string) =>
    D.grades
      .filter((g) => g.studentId === sId && g.deletedAt === null)
      .map((g) => ({ g, e: EV.get(g.evaluationId)! }))
      .filter(({ e }) => e.csId === csId && e.periodId === periodId);

  afterEach(() => {
    P().studentFormula.findMany.mockResolvedValue([]);
  });

  it("note non comptée : la division perd une note, chez cet élève seulement", async () => {
    const { GET } = await import("@/app/api/bulletins/route");
    // Pour 4 élèves : le premier devoir noté de mathématiques (semestre 1) ne compte pas
    const excluded = new Map<string, DGrade>();
    for (const s of D.students) {
      if (excluded.size >= 4) break;
      const first = rowsOf(s.id, "cs-mat", P1.id).find(({ g, e }) => e.typeName === "Devoir" && g.value !== null);
      if (first) excluded.set(s.id, first.g);
    }
    expect(excluded.size).toBe(4);
    for (const g of excluded.values()) (g as DGrade & { excludedReason?: string }).excludedReason = "copie perdue";
    try {
      const oracleSubject = (sId: string, csId: string) => {
        const ex = excluded.get(sId);
        if (!ex || csId !== "cs-mat") return oSubject(sId, csId, P1.id);
        const kept = oGrades(sId, csId, [P1.id]).filter((_, i) => {
          const own = D.grades
            .filter((g) => g.studentId === sId)
            .filter((g) => { const e = EV.get(g.evaluationId)!; return e.csId === csId && e.periodId === P1.id; });
          return own[i]?.id !== ex.id;
        });
        // Une note écartée par l'enseignant n'est plus un devoir « prévu »
        return beninSubjectAverage(kept, oPlannedDevoirs(sId, csId, P1.id) - 1);
      };
      const errors: string[] = [];
      let changed = 0;
      for (const s of D.students) {
        const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${s.id}&periodId=${P1.id}`), SESSION());
        const body = await res.json();
        const expectedGeneral = r2(generalAverage(SUBJECTS.map((x) => ({ avg: oracleSubject(s.id, x.csId), coef: x.coef }))));
        const shownGeneral = expectedGeneral === null ? null : expectedGeneral.toNumber();
        if (body.generalAverage !== shownGeneral) errors.push(`${s.firstName} générale app=${body.generalAverage} oracle=${shownGeneral}`);
        const maths = (body.subjects as Array<{ subjectId: string; average: number | null; excludedGrades: number }>).find((x) => x.subjectId === "s-mat")!;
        const expectedMaths = r2(oracleSubject(s.id, "cs-mat"));
        if (maths.average !== (expectedMaths === null ? null : expectedMaths.toNumber())) errors.push(`${s.firstName} maths app=${maths.average}`);
        if (maths.excludedGrades !== (excluded.has(s.id) ? 1 : 0)) errors.push(`${s.firstName} signalement bulletin`);
        if (excluded.has(s.id) && r2(oSubject(s.id, "cs-mat", P1.id))?.toNumber() !== expectedMaths?.toNumber()) changed++;
      }
      RESULTS.studentExclusion = { students: D.students.length, excluded: excluded.size, changed, errors: errors.slice(0, 5) };
      expect(errors).toEqual([]);
      expect(changed).toBeGreaterThan(0);
    } finally {
      for (const g of excluded.values()) delete (g as DGrade & { excludedReason?: string }).excludedReason;
    }
  }, 60_000);

  it("formule particulière (MI + D1) / 2 pour un élève, les camarades gardent le calcul normal", async () => {
    const { GET } = await import("@/app/api/bulletins/route");
    // Élève ayant des interrogations et un devoir noté en mathématiques (la
    // formule laisse de côté la composition : le résultat change réellement)
    const target = D.students.find((s) => {
      const rows = rowsOf(s.id, "cs-mat", P1.id);
      return rows.filter(({ e, g }) => e.typeName === "Devoir" && g.value !== null).length >= 1 &&
        rows.some(({ e, g }) => !["Devoir", "Composition"].includes(e.typeName) && g.value !== null);
    })!;
    expect(target).toBeDefined();
    const formulas = [{ classSubjectId: "cs-mat", periodId: P1.id, studentId: target.id, formula: "(MI + D1) / 2" }];
    P().studentFormula.findMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
      const w = args?.where ?? {};
      return formulas.filter((f) =>
        (w.studentId === undefined || w.studentId === f.studentId) &&
        (w.periodId === undefined || w.periodId === f.periodId || ((w.periodId as { in?: string[] })?.in ?? []).includes(f.periodId)));
    });

    // Oracle : D1 = premier devoir de l'élève (par date), MI = moyenne des interrogations comptées
    const rows = rowsOf(target.id, "cs-mat", P1.id).sort((a, b) =>
      `${a.e.date.toISOString()}|${a.e.id}`.localeCompare(`${b.e.date.toISOString()}|${b.e.id}`));
    const d1 = rows.find(({ e }) => e.typeName === "Devoir")!;
    const mi = mean(rows.filter(({ e }) => !["Devoir", "Composition"].includes(e.typeName))
      .map(({ g, e }) => on20(g, e)).filter((v): v is Frac => v !== null));
    const d1v = on20(d1.g, d1.e);
    const adapted = mi && d1v ? mi.add(d1v).div(Frac.int(2)) : null;

    const errors: string[] = [];
    for (const s of D.students) {
      const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${s.id}&periodId=${P1.id}`), SESSION());
      const body = await res.json();
      const maths = (body.subjects as Array<{ subjectId: string; average: number | null; adaptedFormula: string | null }>).find((x) => x.subjectId === "s-mat")!;
      const expected = s.id === target.id ? adapted : oSubject(s.id, "cs-mat", P1.id);
      const shownExpected = r2(expected)?.toNumber() ?? null;
      if (maths.average !== shownExpected) errors.push(`${s.firstName} maths app=${maths.average} oracle=${shownExpected}`);
      if ((maths.adaptedFormula ?? null) !== (s.id === target.id ? "(MI + D1) / 2" : null)) errors.push(`${s.firstName} signalement`);
      const expectedGeneral = r2(generalAverage(SUBJECTS.map((x) => ({
        avg: s.id === target.id && x.csId === "cs-mat" ? adapted : oSubject(s.id, x.csId, P1.id),
        coef: x.coef,
      }))))?.toNumber() ?? null;
      if (body.generalAverage !== expectedGeneral) errors.push(`${s.firstName} générale app=${body.generalAverage} oracle=${expectedGeneral}`);
    }
    RESULTS.studentFormula = {
      student: target.firstName,
      official: r2(oSubject(target.id, "cs-mat", P1.id))?.toNumber() ?? null,
      adapted: r2(adapted)?.toNumber() ?? null,
      errors: errors.slice(0, 5),
    };
    expect(errors).toEqual([]);
    expect(RESULTS.studentFormula).not.toMatchObject({ adapted: (RESULTS.studentFormula as { official: number }).official });
  }, 60_000);
});
