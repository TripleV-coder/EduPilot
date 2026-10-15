/**
 * Audit du moteur de formules (src/lib/academic/formula.ts), indépendant de
 * son implémentation :
 *   - grammaire (priorités, associativité, signes, décimales, erreurs) ;
 *   - sécurité (aucune exécution de code, limites de taille et d'imbrication) ;
 *   - oracle exact écrit ici en fractions BigInt, sans réutiliser Rational ;
 *   - propriétés vérifiées sur des entrées générées (graine fixe, rejouable).
 *
 * Rapport : audit-reports/calculation-engine-audit.md.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluateFormula, parseFormula, validateFormula, OFFICIAL_SUBJECT_FORMULA } from "@/lib/academic/formula";
import { Rational } from "@/lib/academic/rational";
import { computeAnnualAverages, toDisplay } from "@/lib/academic/average-engine";

const SEED = 20261014;

// ── Oracle indépendant : fractions BigInt minimales ──────────────────────────
type Q = { n: bigint; d: bigint };
const qg = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : qg(b, a % b));
const q = (n: bigint, d = 1n): Q => {
    if (d < 0n) [n, d] = [-n, -d];
    const g = qg(n, d) || 1n;
    return { n: n / g, d: d / g };
};
const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qMean = (xs: Q[]): Q => {
    const s = xs.reduce(qAdd, q(0n));
    return q(s.n, s.d * BigInt(xs.length));
};
/** Centièmes, demi vers le haut (valeurs positives : convention du bulletin). */
const qCents = (x: Q): bigint => {
    const scaled = x.n * 100n;
    const base = scaled / x.d;
    return (scaled - base * x.d) * 2n >= x.d ? base + 1n : base;
};
/** Note en centièmes (entier) → fraction exacte. */
const cents = (c: number): Q => q(BigInt(c), 100n);
const R = (c: number) => Rational.from((c / 100).toFixed(2));
const toQ = (r: Rational | null): Q | null => (r === null ? null : q(r.n, r.d));

function evalNum(text: string): string | null {
    const r = evaluateFormula(text, {});
    return r === null ? null : `${r.n}/${r.d}`;
}

// ── 1. Grammaire ─────────────────────────────────────────────────────────────
describe("grammaire du moteur", () => {
    it.each([
        ["2 + 3 * 4", "14/1"],
        ["(2 + 3) * 4", "20/1"],
        ["10 - 4 - 3", "3/1"], // associativité à gauche
        ["100 / 10 / 2", "5/1"],
        ["-2 * 3", "-6/1"],
        ["- - 5", "5/1"],
        ["2 * -3", "-6/1"],
        ["2 × 3 ÷ 4", "3/2"],
        ["12,5 + 0.5", "13/1"], // virgule décimale collée entre deux chiffres
        ["1 / 3", "1/3"], // fraction exacte, pas 0.333…
        ["0.1 + 0.2", "3/10"], // exact : pas d'erreur binaire
    ])("%s = %s", (text, expected) => {
        expect(evalNum(text)).toBe(expected);
    });

    it("division par zéro : vide, jamais Infinity ni NaN", () => {
        expect(evalNum("5 / 0")).toBeNull();
        expect(evalNum("5 / (2 - 2)")).toBeNull();
    });

    it.each([
        ["", "vide"],
        ["(MI + 2", "Parenthèse"],
        ["MI +", "trop tôt"],
        ["MI MD", "inattendu"],
        ["MI ** 2", "inattendu"],
        ["MI ^ 2", "non accepté"],
        ["foo(MI)", "Fonction inconnue"],
        ["moyenne()", "au moins un élément"],
        ["MI ; MD", "inattendu"],
        [".5 + MI", "non accepté"],
    ])("rejette « %s »", (text, message) => {
        expect(() => parseFormula(text)).toThrow(message);
    });

    it("variables inconnues et listes mal utilisées refusées à l'enregistrement", () => {
        expect(validateFormula("MI + XYZ", "SUBJECT")).toMatchObject({ ok: false });
        expect(validateFormula("DEVOIRS + MI", "SUBJECT")).toMatchObject({ ok: false });
        expect(validateFormula("P1 + MI", "ANNUAL")).toMatchObject({ ok: false });
        expect(validateFormula("(P1 + P2 + P3) / 3", "ANNUAL", 2)).toMatchObject({ ok: false });
        expect(validateFormula("20", "SUBJECT")).toMatchObject({ ok: false }); // aucune note utilisée
    });

    it("ambiguïté de la virgule : « max(12,5) » est lu comme max(12.5), un seul argument", () => {
        // Comportement documenté (« virgule collée entre deux chiffres ») mais piégeux
        // pour une liste de constantes : le point-virgule est le seul séparateur sûr.
        expect(evalNum("max(12,5)")).toBe("25/2");
        expect(evalNum("max(12 ; 5)")).toBe("12/1");
        expect(evalNum("max(12, 5)")).toBe("12/1"); // espace : la virgule redevient séparateur
    });
});

// ── 2. Sécurité ──────────────────────────────────────────────────────────────
describe("sécurité : la formule est lue, jamais exécutée", () => {
    it.each([
        "process.exit(1)",
        "require('fs')",
        "constructor.constructor('return process')()",
        "__proto__",
        "MI; fetch('http://x')",
        "`MI`",
        "MI || 1",
        "globalThis",
    ])("refuse « %s » sans effet de bord", (text) => {
        expect(validateFormula(text, "SUBJECT").ok).toBe(false);
    });

    it("bornes de taille et d'imbrication", () => {
        expect(() => parseFormula("MI+".repeat(100) + "MI")).toThrow("300 caractères");
        expect(() => parseFormula("(".repeat(25) + "MI" + ")".repeat(25))).toThrow("imbriqu");
        expect(() => parseFormula("-".repeat(40) + "MI")).toThrow("imbriqu");
        // Un très grand nombre reste exact (BigInt), sans dépassement
        expect(evalNum("99999999999999999999 * 99999999999999999999")).toBe("9999999999999999999800000000000000000001/1");
    });

    it("temps d'analyse borné sur l'entrée la plus longue acceptée", () => {
        const text = Array.from({ length: 99 }, () => "MI").join("+"); // 296 caractères
        const t0 = performance.now();
        for (let i = 0; i < 200; i++) parseFormula(text);
        expect(performance.now() - t0).toBeLessThan(2000);
    });
});

// ── 3. Oracle indépendant : formule officielle du Bénin ──────────────────────
// Spécification (docs/QUESTIONS_NOTES_MOYENNES.md, average-engine) :
//   moyenne de matière = (MI + D1 + … + Dn + C1 + … + Cm) / (1 + n + m),
//   MI = moyenne simple des interrogations ; sans interrogation : moyenne des devoirs.
const note = fc.integer({ min: 0, max: 2000 }); // centièmes : 0,00 à 20,00

describe("oracle exact — formule officielle", () => {
    it("égalité EXACTE (fraction) et arrondi identiques à l'oracle, 2 000 élèves générés", () => {
        fc.assert(
            fc.property(
                fc.array(note, { maxLength: 6 }),
                fc.array(note, { maxLength: 6 }),
                fc.array(note, { maxLength: 3 }),
                (I, D, C) => {
                    const items: Q[] = [];
                    if (I.length) items.push(qMean(I.map(cents)));
                    items.push(...D.map(cents), ...C.map(cents));
                    const expected = items.length ? qMean(items) : null;

                    const vI = I.map(R);
                    const mi = vI.length ? vI.reduce((a, b) => a.add(b)).div(Rational.int(vI.length)) : null;
                    const result = evaluateFormula(OFFICIAL_SUBJECT_FORMULA, {
                        MI: mi,
                        INTERROS: vI,
                        DEVOIRS: D.map(R),
                        COMPOS: C.map(R),
                    });
                    expect(toQ(result)).toEqual(expected);
                    if (expected && result) {
                        // Arrondi au centième du moteur (toDisplay) vs arrondi de l'oracle
                        expect(BigInt(Math.round(toDisplay(result)! * 100))).toBe(qCents(expected));
                    }
                },
            ),
            { seed: SEED, numRuns: 2000 },
        );
    });

    it("propriétés : résultat dans [min, max] des notes ; notes toutes égales → cette valeur", () => {
        fc.assert(
            fc.property(fc.array(note, { minLength: 1, maxLength: 8 }), fc.array(note, { minLength: 1, maxLength: 4 }), (I, D) => {
                const vI = I.map(R);
                const mi = vI.reduce((a, b) => a.add(b)).div(Rational.int(vI.length));
                const r = evaluateFormula(OFFICIAL_SUBJECT_FORMULA, { MI: mi, INTERROS: vI, DEVOIRS: D.map(R), COMPOS: [] })!;
                const all = [...I, ...D];
                expect(r.cmp(R(Math.min(...all)))).toBeGreaterThanOrEqual(0);
                expect(r.cmp(R(Math.max(...all)))).toBeLessThanOrEqual(0);
            }),
            { seed: SEED, numRuns: 1000 },
        );
        const ten = R(1000);
        expect(evaluateFormula(OFFICIAL_SUBJECT_FORMULA, { MI: ten, INTERROS: [ten], DEVOIRS: [ten, ten], COMPOS: [ten] })!.cmp(ten)).toBe(0);
    });

    it("arrondi : demi vers le haut sur la fraction exacte (pas sur un flottant)", () => {
        // 1,005 en binaire vaut 1,00499999… : un arrondi flottant donnerait 1,00
        expect(toDisplay(Rational.from("1.005"))).toBe(1.01);
        expect(toDisplay(Rational.from("2").div(Rational.from("3")))).toBe(0.67);
        expect(toDisplay(Rational.from("41").div(Rational.from("3")))).toBe(13.67);
        expect(toDisplay(Rational.from("12.345"), "TRUNCATE")).toBe(12.34);
    });
});

// ── 4. Validation avant enregistrement : ce qu'elle garantit, et ses limites ─
describe("validation avant enregistrement (cas types)", () => {
    it("accepte les formules prédéfinies et refuse un mauvais diviseur", () => {
        expect(validateFormula("(MI + MD + 2*MC) / 4", "SUBJECT").ok).toBe(true);
        expect(validateFormula("(MI + MD + 2*MC) / 3", "SUBJECT").ok).toBe(false);
        expect(validateFormula("(P1 + P2 + 2*P3) / 4", "ANNUAL").ok).toBe(true);
    });

    it("LIMITE : une formule qui passe les cas types peut sortir de 0 à 20 ailleurs (matière)", () => {
        // Polynôme nul sur toutes les valeurs de MI des cas types (0 ; 20 ; 10 ; 40/3 ; 10,375)
        const crafted = "MI + MI*(20-MI)*(MI-10)*(3*MI-40)*(8*MI-83)/(-10000)";
        expect(validateFormula(crafted, "SUBJECT").ok).toBe(true);
        const five = Rational.from(5);
        const raw = evaluateFormula(crafted, { MI: five, INTERROS: [five], DEVOIRS: [], COMPOS: [] })!;
        expect(raw.cmp(Rational.from(20))).toBe(1); // > 20 : l'enregistrement ne l'a pas vu
    });

    it("moyenne annuelle : un résultat hors de 0 à 20 n'est jamais publié (garde-fou)", () => {
        const crafted = "P1 + P1*(20-P1)*(P1-8)/10";
        expect(validateFormula(crafted, "ANNUAL", 1).ok).toBe(true);
        // Une période, un élève à 10 de moyenne : la formule donne 10 + 10×10×2/10 = 30
        const grades = [
            { classSubjectId: "m", periodId: "p1", evaluationId: "e1", value: 10, isAbsent: false, isExcused: false, maxGrade: 20, type: { code: "DS" } },
        ];
        const annual = computeAnnualAverages(grades, [{ id: "m", coefficient: 1 }], [{ id: "p1" }], [], {
            rules: {
                subjectFormula: OFFICIAL_SUBJECT_FORMULA,
                unjustifiedAbsence: "ZERO",
                unresolvedNc: "EXCLUDE",
                subjectNcWhenNoDevoir: true,
                rounding: "HALF_UP",
                annualFormula: crafted,
            },
        });
        const shown = toDisplay(annual.general);
        expect(shown === null || (shown >= 0 && shown <= 20)).toBe(true);
    });
});
