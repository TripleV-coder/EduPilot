/**
 * Oracle de référence pour les tests de précision.
 *
 * Écrit indépendamment du code de l'application : arithmétique EXACTE en
 * fractions (BigInt), aucune virgule flottante, aucun import de src/.
 * Règle de référence : formule officielle du Bénin.
 *   1. note ramenée sur 20 : valeur / barème × 20 ; absence NON justifiée = 0 ;
 *      absence justifiée / dispense, case vide et note supprimée = exclues
 *   2. moyenne de matière : (MI + D1 + … + Dn) / (1 + n), MI = moyenne simple
 *      des interrogations ; sans interrogation → moyenne des devoirs
 *   3. moyenne générale : Σ(moyenne matière × coef matière) / Σ coef matière
 *   4. moyenne annuelle : (S1 + S2) / 2 ou (T1 + T2 + T3) / 3
 *   5. arrondi unique au centième (demi vers le haut) ; rang olympique,
 *      mention et décision calculés sur cette valeur arrondie
 */

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Frac {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("division par zéro");
    if (d < 0n) [n, d] = [-n, -d];
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  /** Décimal à 2 décimales au plus (format Decimal(5,2) de la base). */
  static dec(x: number): Frac {
    return new Frac(BigInt(Math.round(x * 100)), 100n);
  }
  static int(x: number): Frac {
    return new Frac(BigInt(x));
  }
  add(o: Frac) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Frac) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Frac) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o: Frac) { return new Frac(this.n * o.d, this.d * o.n); }
  cmp(o: Frac) { const x = this.n * o.d - o.n * this.d; return x === 0n ? 0 : x > 0n ? 1 : -1; }
  toNumber() { return Number(this.n) / Number(this.d); }
  /** Arrondi au centième, demi vers le haut (convention d'affichage des bulletins). */
  round2(): Frac {
    const scaled = this.n * 100n;
    let q = scaled / this.d;
    const r = scaled - q * this.d;
    if (2n * (r < 0n ? -r : r) >= this.d) q += this.n >= 0n ? 1n : -1n;
    return new Frac(q, 100n);
  }
  /** Troncature au centième (règle réglable de l'établissement). */
  trunc2(): Frac {
    return new Frac((this.n * 100n) / this.d, 100n);
  }
}

export const ZERO = new Frac(0n);
const TWENTY = new Frac(20n);

export interface OGrade {
  value: number | null;
  maxGrade: number;
  coef: number;
  /** "D" = devoir, "C" = composition, "I" = interrogation et assimilés */
  kind?: "I" | "D" | "C";
  isAbsent: boolean;
  isExcused: boolean;
  deleted: boolean;
}

/** Valeur sur 20 retenue, ou null si la note n'entre pas dans le calcul. */
function on20(g: OGrade): Frac | null {
  if (g.deleted || g.isExcused || g.maxGrade <= 0) return null;
  if (g.isAbsent) return ZERO;
  if (g.value === null) return null;
  return Frac.dec(g.value).div(Frac.int(g.maxGrade)).mul(TWENTY);
}

/** Formule officielle : (MI + ΣD) / (1 + nombre de devoirs). */
export function beninSubjectAverage(grades: OGrade[], plannedDevoirs?: number): Frac | null {
  const values = (kind: "I" | "D") =>
    grades.filter((g) => (g.kind === "D") === (kind === "D")).map(on20).filter((v): v is Frac => v !== null);
  const mi = mean(values("I"));
  const devoirs = values("D");
  // Devoirs prévus (lignes non supprimées, ou nombre fourni) mais aucun compté → matière « NC »
  const planned = plannedDevoirs ?? grades.filter((g) => g.kind === "D" && !g.deleted).length;
  if (planned > 0 && devoirs.length === 0) return null;
  return mean([...(mi ? [mi] : []), ...devoirs]);
}

export function generalAverage(subjects: { avg: Frac | null; coef: number }[]): Frac | null {
  let num = ZERO;
  let den = ZERO;
  for (const s of subjects) {
    if (!s.avg) continue;
    const c = Frac.dec(s.coef);
    num = num.add(s.avg.mul(c));
    den = den.add(c);
  }
  return den.cmp(ZERO) > 0 ? num.div(den) : null;
}

export function mean(values: Frac[]): Frac | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a.add(b), ZERO).div(Frac.int(values.length));
}

/** Classement olympique : rang = 1 + nombre d'élèves strictement meilleurs. */
export function competitionRank(target: Frac | null, all: (Frac | null)[]): number | null {
  if (!target) return null;
  return 1 + all.filter((a) => a !== null && a.cmp(target) > 0).length;
}

/** Barème des mentions béninoises (src/lib/benin/config.ts) en intervalles semi-ouverts. */
export function mentionOf(avg: Frac): string {
  const ge = (x: number) => avg.cmp(Frac.dec(x)) >= 0;
  if (ge(18)) return "EXCELLENT";
  if (ge(16)) return "TRES_BIEN";
  if (ge(14)) return "BIEN";
  if (ge(12)) return "ASSEZ_BIEN";
  if (ge(10)) return "PASSABLE";
  return "ECHEC";
}

/** Moindres carrés exacts y = a + b·x. */
export function exactLinear(points: { x: number; y: number }[]): { a: Frac; b: Frac } | null {
  const n = Frac.int(points.length);
  let sx = ZERO, sy = ZERO, sxx = ZERO, sxy = ZERO;
  for (const p of points) {
    const x = Frac.dec(p.x), y = Frac.dec(p.y);
    sx = sx.add(x); sy = sy.add(y); sxx = sxx.add(x.mul(x)); sxy = sxy.add(x.mul(y));
  }
  const den = n.mul(sxx).sub(sx.mul(sx));
  if (den.cmp(ZERO) === 0) return null;
  const b = n.mul(sxy).sub(sx.mul(sy)).div(den);
  return { a: sy.sub(b.mul(sx)).div(n), b };
}

/** Moindres carrés exacts y = a + b·x + c·x² (équations normales, Gauss exact). */
export function exactQuadratic(points: { x: number; y: number }[]): [Frac, Frac, Frac] | null {
  const pow = (x: Frac, k: number) => { let r = new Frac(1n); for (let i = 0; i < k; i++) r = r.mul(x); return r; };
  const S = (k: number) => points.reduce((s, p) => s.add(pow(Frac.dec(p.x), k)), ZERO);
  const T = (k: number) => points.reduce((s, p) => s.add(pow(Frac.dec(p.x), k).mul(Frac.dec(p.y))), ZERO);
  const m: Frac[][] = [
    [S(0), S(1), S(2), T(0)],
    [S(1), S(2), S(3), T(1)],
    [S(2), S(3), S(4), T(2)],
  ];
  for (let c = 0; c < 3; c++) {
    const pivot = m.findIndex((row, r) => r >= c && row[c].cmp(ZERO) !== 0);
    if (pivot < 0) return null;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c].div(m[c][c]);
      m[r] = m[r].map((v, k) => v.sub(f.mul(m[c][k])));
    }
  }
  return [m[0][3].div(m[0][0]), m[1][3].div(m[1][1]), m[2][3].div(m[2][2])];
}

// ─────────────── Règles réglables de l'établissement (oracle indépendant) ───────────────

/**
 * Options de calcul qu'une école peut choisir, réécrites ici sans rien
 * reprendre du code de l'application :
 *   formula     OFFICIAL : (MI + ΣD) / (1 + n), composition = devoir
 *               CLASS_THEN_COMPO : ((MI + moy. devoirs) / 2 + moy. compositions) / 2,
 *               une composante absente → on garde celle qui existe
 *   absence     absence non justifiée : 0 (ZERO) ou retirée (EXCLUDE)
 *   ncNoDevoir  matière « NC » si des devoirs étaient prévus mais aucun compté
 *   rounding    centième au plus proche (HALF_UP) ou tronqué (TRUNCATE)
 * Une note « NC » comptée 0 (règle nc = ZERO) est fournie par l'appelant comme
 * une note de valeur 0, à la place de l'évaluation manquante.
 */
export interface ORules {
  /**
   * OFFICIAL, CLASS_THEN_COMPO (voir ci-dessus),
   * COMPO_DOUBLE : comme OFFICIAL, chaque composition comptée deux fois,
   * FIXED_WEIGHTS : (MI + MD + 2 × MC) / 4, et « NC » s'il manque une des trois.
   */
  formula: "OFFICIAL" | "CLASS_THEN_COMPO" | "COMPO_DOUBLE" | "FIXED_WEIGHTS";
  absence: "ZERO" | "EXCLUDE";
  ncNoDevoir: boolean;
  rounding: "HALF_UP" | "TRUNCATE";
}

function on20Rules(g: OGrade, r: ORules): Frac | null {
  if (g.deleted || g.isExcused || g.maxGrade <= 0) return null;
  if (g.isAbsent) return r.absence === "ZERO" ? ZERO : null;
  if (g.value === null) return null;
  return Frac.dec(g.value).div(Frac.int(g.maxGrade)).mul(TWENTY);
}

export function configuredSubjectAverage(grades: OGrade[], plannedDevoirs: number, r: ORules): Frac | null {
  const pick = (k: "I" | "D" | "C") =>
    grades.filter((g) => (g.kind ?? "I") === k).map((g) => on20Rules(g, r)).filter((v): v is Frac => v !== null);
  const mi = mean(pick("I"));
  if (r.ncNoDevoir && plannedDevoirs > 0 && pick("D").length === 0 && pick("C").length === 0) return null;
  if (r.formula === "COMPO_DOUBLE") return mean([...(mi ? [mi] : []), ...pick("D"), ...pick("C"), ...pick("C")]);
  if (r.formula === "FIXED_WEIGHTS") {
    const md = mean(pick("D"));
    const mc = mean(pick("C"));
    if (!mi || !md || !mc) return null;
    return mi.add(md).add(mc.mul(Frac.int(2))).div(Frac.int(4));
  }
  const devoirs = r.formula === "OFFICIAL" ? [...pick("D"), ...pick("C")] : pick("D");
  const compos = r.formula === "OFFICIAL" ? [] : pick("C");
  if (r.formula === "OFFICIAL") return mean([...(mi ? [mi] : []), ...devoirs]);
  const parts = (xs: Array<Frac | null>) => xs.filter((x): x is Frac => x !== null);
  const classAvg = mean(parts([mi, mean(devoirs)]));
  return mean(parts([classAvg, mean(compos)]));
}

export const roundWith = (x: Frac | null, r: ORules): Frac | null =>
  x === null ? null : r.rounding === "TRUNCATE" ? x.trunc2() : x.round2();

/** Moyenne annuelle pondérée (poids entiers), seulement si chaque période a une moyenne. */
export function weightedAnnual(periods: Array<Frac | null>, weights: number[]): Frac | null {
  if (periods.some((p) => p === null)) return null;
  let num = ZERO;
  let den = ZERO;
  periods.forEach((p, i) => {
    num = num.add((p as Frac).mul(Frac.int(weights[i])));
    den = den.add(Frac.int(weights[i]));
  });
  return num.div(den);
}
