import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readSpreadsheetRows } from "@/lib/import/read-spreadsheet";

/**
 * Lot 5 (N45) — l'écran d'import lisait les fichiers par readAsBinaryString
 * puis XLSX.read(type "binary") : un CSV en UTF-8 sans BOM (export par défaut
 * de LibreOffice, Google Sheets…) donnait « AÃ¯cha » ; en Windows-1252,
 * l'apostrophe typographique disparaissait (« NDiaye »). Les noms étaient
 * enregistrés ainsi. La lecture part désormais des octets du fichier.
 */
const TEXT = "prenom;nom;email\nAïcha;Hounsou;a@x.bj\nÉmile;Dègbè;e@x.bj\nFrançois;N’Diaye;f@x.bj\n";
const EXPECTED = [
    { prenom: "Aïcha", nom: "Hounsou", email: "a@x.bj" },
    { prenom: "Émile", nom: "Dègbè", email: "e@x.bj" },
    { prenom: "François", nom: "N’Diaye", email: "f@x.bj" },
];

const CP1252: Record<string, number> = { é: 0xe9, ï: 0xef, É: 0xc9, è: 0xe8, ç: 0xe7, "’": 0x92 };
const toCp1252 = (text: string) => Uint8Array.from([...text].map((c) => CP1252[c] ?? c.charCodeAt(0)));
const utf8 = (text: string) => new TextEncoder().encode(text);
const withBom = (bytes: Uint8Array) => Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes]);

describe("N45 — lecture des fichiers d'import (encodages, séparateurs, Excel)", () => {
    it("CSV en UTF-8 sans BOM", () => {
        const { headers, rows } = readSpreadsheetRows(utf8(TEXT), "eleves.csv");
        expect(headers).toEqual(["prenom", "nom", "email"]);
        expect(rows).toEqual(EXPECTED);
    });

    it("CSV en UTF-8 avec BOM", () => {
        expect(readSpreadsheetRows(withBom(utf8(TEXT)), "eleves.csv").rows).toEqual(EXPECTED);
    });

    it("CSV en Windows-1252 (Excel français), apostrophe typographique comprise", () => {
        expect(readSpreadsheetRows(toCp1252(TEXT), "eleves.csv").rows).toEqual(EXPECTED);
    });

    it("CSV séparé par des virgules", () => {
        expect(readSpreadsheetRows(utf8(TEXT.replaceAll(";", ",")), "eleves.csv").rows).toEqual(EXPECTED);
    });

    it("classeur Excel (.xlsx)", () => {
        const sheet = XLSX.utils.aoa_to_sheet([["prenom", "nom", "email"], ...EXPECTED.map((r) => [r.prenom, r.nom, r.email])]);
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Élèves");
        const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
        expect(readSpreadsheetRows(bytes, "eleves.xlsx").rows).toEqual(EXPECTED);
    });

    it("ignore les lignes vides et les en-têtes sans nom, garde les cellules vides", () => {
        const { headers, rows } = readSpreadsheetRows(utf8("prenom;nom;\nAïcha;;\n;;\n"), "eleves.csv");
        expect(headers).toEqual(["prenom", "nom"]);
        expect(rows).toEqual([{ prenom: "Aïcha", nom: undefined }]);
    });
});
