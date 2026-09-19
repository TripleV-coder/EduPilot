import { describe, expect, it } from "vitest";
import { buildEvaluationsCsv } from "@/lib/evaluations/evaluations-csv";

/**
 * Export CSV de la page Notes. L'ancienne version lisait `type` (objet →
 * « [object Object] »), `class` et `subject` (inexistants dans la réponse) et
 * ne protégeait ni les virgules ni les guillemets.
 */
const row = {
    title: "Devoir n°1, chapitre 2",
    date: "2026-03-14T08:00:00.000Z",
    type: { name: "Devoir surveillé" },
    classSubject: { class: { name: "6e A" }, subject: { name: "Mathématiques" } },
};

describe("buildEvaluationsCsv", () => {
    it("écrit l'en-tête puis une ligne par évaluation avec les bons champs", () => {
        const [header, line] = buildEvaluationsCsv([row]).split("\n");

        expect(header).toBe("Titre,Type,Date,Classe,Matière");
        expect(line).toBe('"Devoir n°1, chapitre 2",Devoir surveillé,14/03/2026,6e A,Mathématiques');
    });

    it("échappe les guillemets", () => {
        const csv = buildEvaluationsCsv([{ ...row, title: 'Contrôle "surprise"' }]);
        expect(csv.split("\n")[1].startsWith('"Contrôle ""surprise"""')).toBe(true);
    });

    it("neutralise une formule de tableur en tête de cellule", () => {
        const csv = buildEvaluationsCsv([{ ...row, title: "=HYPERLINK(\"x\")" }]);
        expect(csv.split("\n")[1].startsWith("\"'=HYPERLINK")).toBe(true);
    });
});
