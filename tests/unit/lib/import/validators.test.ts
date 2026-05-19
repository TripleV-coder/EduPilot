import { describe, it, expect } from "vitest";
import { runValidations, readyCount } from "@/lib/import/validators";

describe("runValidations · STUDENTS", () => {
    const baseRow = {
        firstName: "Aïcha",
        lastName: "Hounsou",
        dateOfBirth: "12/03/2012",
        parentPhone: "+229 95 12 34 56",
        className: "3e A",
    };

    it("returns 5 checks when rows have student fields", () => {
        const checks = runValidations({ rows: [baseRow], type: "STUDENTS" });
        expect(checks).toHaveLength(5);
        expect(checks.map((c) => c.label)).toEqual([
            "Doublons (nom + date naissance)",
            "Format date valide",
            "Téléphone format Bénin",
            "Classe existante",
            "Âge cohérent / niveau",
        ]);
    });

    it("detects exact name+dob duplicates", () => {
        const checks = runValidations({
            rows: [baseRow, baseRow, { ...baseRow, lastName: "Coffi" }],
            type: "STUDENTS",
        });
        const dup = checks.find((c) => c.label.startsWith("Doublons"))!;
        expect(dup.passed).toBe(2);
        expect(dup.total).toBe(3);
        expect(dup.severity).toBe("warning");
    });

    it("flags malformed dates as warning", () => {
        const checks = runValidations({
            rows: [
                baseRow,
                { ...baseRow, dateOfBirth: "not-a-date" },
                { ...baseRow, dateOfBirth: "2012-03-12" },
            ],
            type: "STUDENTS",
        });
        const date = checks.find((c) => c.label === "Format date valide")!;
        expect(date.passed).toBe(2);
        expect(date.severity).toBe("warning");
    });

    it("validates Benin phone numbers", () => {
        const checks = runValidations({
            rows: [
                baseRow,
                { ...baseRow, parentPhone: "+229 97 88 12 30" },
                { ...baseRow, parentPhone: "06 12 34 56 78" },
            ],
            type: "STUDENTS",
        });
        const phone = checks.find((c) => c.label === "Téléphone format Bénin")!;
        expect(phone.passed).toBe(2);
        expect(phone.severity).toBe("warning");
    });

    it("uses knownClassNames to validate class existence", () => {
        const checks = runValidations({
            rows: [
                baseRow,
                { ...baseRow, className: "Unknown class" },
            ],
            type: "STUDENTS",
            knownClassNames: ["3e A"],
        });
        const cls = checks.find((c) => c.label === "Classe existante")!;
        expect(cls.passed).toBe(1);
        expect(cls.total).toBe(2);
        expect(cls.severity).toBe("warning");
    });

    it("passes age-coherence when birth year matches level expectation", () => {
        const checks = runValidations({
            rows: [
                { ...baseRow, dateOfBirth: "12/03/2012", className: "3e A" }, // 14yo in 2026 → OK
            ],
            type: "STUDENTS",
            referenceYear: 2026,
        });
        const age = checks.find((c) => c.label === "Âge cohérent / niveau")!;
        expect(age.passed).toBe(1);
        expect(age.severity).toBe("success");
    });

    it("flags age-incoherence (e.g. 8yo in terminale)", () => {
        const checks = runValidations({
            rows: [
                { ...baseRow, dateOfBirth: "12/03/2018", className: "Terminale" }, // 8yo → no
            ],
            type: "STUDENTS",
            referenceYear: 2026,
        });
        const age = checks.find((c) => c.label === "Âge cohérent / niveau")!;
        expect(age.passed).toBe(0);
        expect(age.severity).toBe("warning");
    });

    it("returns an empty list for an empty file", () => {
        expect(runValidations({ rows: [], type: "STUDENTS" })).toEqual([]);
    });
});

describe("readyCount", () => {
    it("returns total when no checks", () => {
        expect(readyCount([], 100)).toBe(100);
    });

    it("returns the minimum passed across full-coverage checks", () => {
        const checks = [
            { label: "a", passed: 100, total: 100, severity: "success" as const },
            { label: "b", passed: 92, total: 100, severity: "warning" as const },
            { label: "c", passed: 85, total: 100, severity: "warning" as const },
        ];
        expect(readyCount(checks, 100)).toBe(85);
    });

    it("ignores partial-coverage checks (subset totals)", () => {
        const checks = [
            { label: "a", passed: 100, total: 100, severity: "success" as const },
            { label: "b", passed: 5, total: 10, severity: "warning" as const }, // partial coverage
        ];
        expect(readyCount(checks, 100)).toBe(100);
    });
});
