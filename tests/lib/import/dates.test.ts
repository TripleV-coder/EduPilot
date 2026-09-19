import { describe, expect, it } from "vitest";
import { parseImportDate } from "@/lib/import/dates";

/** Lot 5 (N46) — dates des fichiers d'import : JJ/MM/AAAA d'abord, jamais corrigées en silence. */
const iso = (value: unknown) => {
    const result = parseImportDate(value);
    return result.ok ? result.date?.toISOString().slice(0, 10) ?? null : "invalide";
};

describe("parseImportDate", () => {
    it("lit le format français, quel que soit le séparateur", () => {
        expect(iso("15/03/2012")).toBe("2012-03-15");
        expect(iso("5/3/2012")).toBe("2012-03-05");
        expect(iso("15.03.2012")).toBe("2012-03-15");
        expect(iso("15-03-2012")).toBe("2012-03-15");
    });

    it("lit le format ISO", () => {
        expect(iso("2012-11-02")).toBe("2012-11-02");
        expect(iso("2012-11-02T00:00:00.000Z")).toBe("2012-11-02");
    });

    it("ne lit jamais le jour et le mois à l'américaine", () => {
        expect(iso("03/04/2012")).toBe("2012-04-03");
    });

    it("refuse les dates impossibles et les formats inconnus", () => {
        expect(iso("31/02/2012")).toBe("invalide");
        expect(iso("13/13/2012")).toBe("invalide");
        expect(iso("15 mars 2012")).toBe("invalide");
        expect(iso("2012/03/15")).toBe("invalide");
    });

    it("une cellule vide n'est pas une erreur", () => {
        expect(iso(undefined)).toBeNull();
        expect(iso("")).toBeNull();
        expect(iso("  ")).toBeNull();
    });
});
