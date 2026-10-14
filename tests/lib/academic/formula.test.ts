/**
 * Formules écrites par l'école ou l'enseignant : lecture, vérification,
 * calcul exact, et équivalence des modèles avec les anciennes règles.
 */
import { describe, it, expect } from "vitest";
import {
    CLASS_THEN_COMPOSITION_FORMULA,
    OFFICIAL_ANNUAL_FORMULA,
    OFFICIAL_SUBJECT_FORMULA,
    evaluateFormula,
    legacyAnnualFormula,
    legacySubjectFormula,
    parseFormula,
    validateFormula,
} from "@/lib/academic/formula";
import { Rational } from "@/lib/academic/rational";
import { subjectAverage, toDisplay, type AverageGrade } from "@/lib/academic/average-engine";

const R = (x: number) => Rational.from(x);
const show = (v: Rational | null) => (v === null ? null : toDisplay(v));
const grade = (value: number | null, kind: AverageGrade["kind"], extra: Partial<AverageGrade> = {}): AverageGrade => ({
    value,
    maxGrade: 20,
    isAbsent: false,
    isExcused: false,
    kind,
    ...extra,
});

describe("lecture d'une formule", () => {
    it("accepte majuscules, minuscules, accents, ; ou , et × ÷", () => {
        for (const text of ["moyenne(MI ; DEVOIRS)", "Moyenne(mi, devoirs)", "(MI + MD) ÷ 2", "(MI × 2 + MD) / 3"]) {
            expect(() => parseFormula(text)).not.toThrow();
        }
    });

    it("lit 12,5 comme une décimale (virgule collée) et 12, 5 comme deux éléments", () => {
        expect(show(evaluateFormula("moyenne(12,5)", {}))).toBe(12.5);
        expect(show(evaluateFormula("moyenne(12, 5)", {}))).toBe(8.5);
    });

    it("refuse ce qui n'est pas une formule (aucun code exécuté)", () => {
        expect(validateFormula("process.exit()", "SUBJECT").ok).toBe(false);
        expect(validateFormula("MI; DROP TABLE", "SUBJECT").ok).toBe(false);
        expect(validateFormula("alert(1)", "SUBJECT")).toEqual({ ok: false, error: expect.stringContaining("Fonction inconnue") });
        expect(validateFormula("MI $ 2", "SUBJECT")).toEqual({ ok: false, error: expect.stringContaining("Caractère non accepté") });
        expect(validateFormula("(MI + MD", "SUBJECT")).toEqual({ ok: false, error: expect.stringContaining("Parenthèse") });
        expect(validateFormula("", "SUBJECT").ok).toBe(false);
        expect(validateFormula("x".repeat(301), "SUBJECT").ok).toBe(false);
    });

    it("explique en français une variable inconnue et une liste mal utilisée", () => {
        expect(validateFormula("(MI + D10) / 2", "SUBJECT")).toEqual({ ok: false, error: expect.stringContaining("Variable inconnue « D10 »") });
        expect(validateFormula("(MI + DEVOIRS) / 2", "SUBJECT")).toEqual({
            ok: false,
            error: expect.stringContaining("DEVOIRS est une liste de notes"),
        });
    });
});

describe("vérification avant enregistrement", () => {
    it("accepte les modèles proposés", () => {
        for (const f of [OFFICIAL_SUBJECT_FORMULA, CLASS_THEN_COMPOSITION_FORMULA, "moyenne(MI ; DEVOIRS ; COMPOS ; COMPOS)", "(MI + MD + 2*MC) / 4"]) {
            expect(validateFormula(f, "SUBJECT"), f).toEqual({ ok: true, text: f });
        }
    });

    it("refuse un diviseur faux (20 partout ne donne pas 20)", () => {
        const check = validateFormula("(MI + MD) / 3", "SUBJECT");
        expect(check.ok).toBe(false);
        if (!check.ok) expect(check.error).toContain("toutes les notes à 20");
    });

    it("refuse une formule qui peut sortir de 0 à 20", () => {
        // 20 partout → 20 et 0 partout → 0, mais MI = 20 et MD = 0 donne 40
        expect(validateFormula("2*MI - MD", "SUBJECT").ok).toBe(false);
    });

    it("refuse une formule sans note", () => {
        expect(validateFormula("10", "SUBJECT").ok).toBe(false);
    });

    it("moyenne annuelle : refuse une période qui n'existe pas dans l'année", () => {
        expect(validateFormula("(P1 + P2 + 2*P3) / 4", "ANNUAL", 2)).toEqual({ ok: false, error: expect.stringContaining("P3") });
        expect(validateFormula("(P1 + P2 + 2*P3) / 4", "ANNUAL", 3).ok).toBe(true);
        expect(validateFormula("(S1 + 2*S2) / 3", "ANNUAL", 2).ok).toBe(true);
    });
});

describe("calcul exact", () => {
    it("valeur vide : moyenne() l'ignore, un calcul + − × ÷ donne NC", () => {
        const values = { MI: R(12), MD: R(14), MC: null, INTERROS: [R(12)], DEVOIRS: [R(14)], COMPOS: [] };
        expect(show(evaluateFormula("moyenne(MI ; MD ; MC)", values))).toBe(13);
        expect(evaluateFormula("(MI + MD + 2*MC) / 4", values)).toBeNull();
    });

    it("fractions exactes, un seul arrondi final", () => {
        const values = { MI: R(14), DEVOIRS: [R(10), R(16)], COMPOS: [], INTERROS: [], MD: R(13), MC: null };
        // (14 + 10 + 16) / 3 = 13,333… → 13,33
        expect(show(evaluateFormula(OFFICIAL_SUBJECT_FORMULA, values))).toBe(13.33);
        // 1/3 + 1/3 + 1/3 = 1 exactement
        expect(evaluateFormula("MI/3 + MI/3 + MI/3", { MI: R(1) })!.cmp(R(1))).toBe(0);
    });

    it("division par zéro : vide, jamais une erreur", () => {
        expect(evaluateFormula("MI / (MD - MD)", { MI: R(10), MD: R(5) })).toBeNull();
    });

    it("formule illisible enregistrée par erreur : vide plutôt qu'un nombre faux", () => {
        expect(evaluateFormula("(MI +", { MI: R(10) })).toBeNull();
    });
});

describe("équivalence avec les anciennes règles", () => {
    const grades = [grade(15, "INTERROGATION"), grade(13, "INTERROGATION"), grade(10, "DEVOIR"), grade(16, "DEVOIR"), grade(8, "COMPOSITION")];

    it("règle officielle : (MI + D1 + D2 + C) / 4, la composition compte comme un devoir", () => {
        // MI = 14 ; (14 + 10 + 16 + 8) / 4 = 12
        expect(show(subjectAverage(grades, 0, undefined, OFFICIAL_SUBJECT_FORMULA))).toBe(12);
    });

    it("moyenne de classe puis composition : ((MI + MD) / 2 + MC) / 2", () => {
        // MI = 14, MD = 13 → 13,5 ; (13,5 + 8) / 2 = 10,75
        expect(show(subjectAverage(grades, 0, undefined, CLASS_THEN_COMPOSITION_FORMULA))).toBe(10.75);
    });

    it("anciennes valeurs enregistrées converties en formules", () => {
        expect(legacySubjectFormula("MI_PLUS_DEVOIRS")).toBe(OFFICIAL_SUBJECT_FORMULA);
        expect(legacySubjectFormula("CLASSE_PUIS_COMPOSITION")).toBe(CLASS_THEN_COMPOSITION_FORMULA);
        expect(legacyAnnualFormula("MEAN")).toBe(OFFICIAL_ANNUAL_FORMULA);
        expect(legacyAnnualFormula("WEIGHTED", [1, 1, 2])).toBe("(P1 + P2 + 2*P3) / 4");
        // La formule convertie donne exactement l'ancien résultat pondéré
        const p = { P1: R(10), P2: R(12), P3: R(15), PERIODES: [R(10), R(12), R(15)] };
        expect(show(evaluateFormula(legacyAnnualFormula("WEIGHTED", [1, 1, 2]) as string, p))).toBe(13);
    });
});
