import { describe, expect, it } from "vitest";
import { canEditExam, examBareme, parseQuestionInput } from "@/lib/exams/questions";

/**
 * Recette 2026-09-28 (08/06) : aucun moyen d'ajouter une question à un examen
 * en ligne ; l'élève tombait sur un écran planté (examen vide).
 */
describe("parseQuestionInput", () => {
    it("accepte un QCM dont la bonne réponse fait partie des choix", () => {
        const r = parseQuestionInput({ type: "MCQ", question: "2 + 2 ?", points: 2, options: ["3", "4", "5"], correctAnswer: "4" });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data).toMatchObject({ type: "MCQ", options: ["3", "4", "5"], correctAnswer: "4" });
    });

    it("refuse un QCM dont la bonne réponse n'est pas un des choix", () => {
        const r = parseQuestionInput({ type: "MCQ", question: "2 + 2 ?", points: 1, options: ["3", "5"], correctAnswer: "4" });
        expect(r.success).toBe(false);
    });

    it("refuse un QCM de moins de deux choix, ou aux choix en double", () => {
        expect(parseQuestionInput({ type: "MCQ", question: "Q", points: 1, options: ["A"], correctAnswer: "A" }).success).toBe(false);
        expect(parseQuestionInput({ type: "MCQ", question: "Q", points: 1, options: ["A", " A "], correctAnswer: "A" }).success).toBe(false);
    });

    it("impose Vrai / Faux comme choix d'une question vrai-faux", () => {
        const r = parseQuestionInput({ type: "TRUE_FALSE", question: "La Terre est ronde.", points: 1, correctAnswer: "Vrai" });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.options).toEqual(["Vrai", "Faux"]);
        expect(parseQuestionInput({ type: "TRUE_FALSE", question: "Q", points: 1, correctAnswer: "Peut-être" }).success).toBe(false);
    });

    it("accepte une réponse courte sans choix (corrigée par l'enseignant)", () => {
        const r = parseQuestionInput({ type: "SHORT_ANSWER", question: "Nommez l'organite de la photosynthèse.", points: 3 });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data).toMatchObject({ options: [], correctAnswer: null });
    });

    it("refuse un énoncé vide ou un barème nul", () => {
        expect(parseQuestionInput({ type: "SHORT_ANSWER", question: "  ", points: 1 }).success).toBe(false);
        expect(parseQuestionInput({ type: "SHORT_ANSWER", question: "Q", points: 0 }).success).toBe(false);
    });
});

describe("examBareme", () => {
    it("le total est la somme des points, la réussite la moitié (arrondie au supérieur)", () => {
        expect(examBareme([{ points: 2 }, { points: 3 }])).toEqual({ totalPoints: 5, passingScore: 3 });
        expect(examBareme([{ points: 10 }, { points: 10 }])).toEqual({ totalPoints: 20, passingScore: 10 });
    });

    it("examen vide : barème nul", () => {
        expect(examBareme([])).toEqual({ totalPoints: 0, passingScore: 0 });
    });
});

describe("canEditExam", () => {
    const exam = { createdById: "u-prof", classSubject: { teacher: { userId: "u-prof" } } };

    it("l'auteur ou l'enseignant de la matière peut modifier", () => {
        expect(canEditExam({ id: "u-prof", role: "TEACHER" }, exam)).toBe(true);
        expect(canEditExam({ id: "u-prof", role: "TEACHER" }, { createdById: null, classSubject: { teacher: { userId: "u-prof" } } })).toBe(true);
    });

    it("la direction peut modifier", () => {
        expect(canEditExam({ id: "u-dir", role: "DIRECTOR" }, exam)).toBe(true);
        expect(canEditExam({ id: "u-adm", role: "SCHOOL_ADMIN" }, exam)).toBe(true);
    });

    it("un autre enseignant, un élève ou un parent ne peuvent pas", () => {
        expect(canEditExam({ id: "u-autre", role: "TEACHER" }, exam)).toBe(false);
        expect(canEditExam({ id: "u-eleve", role: "STUDENT" }, exam)).toBe(false);
        expect(canEditExam({ id: "u-parent", role: "PARENT" }, exam)).toBe(false);
    });
});
