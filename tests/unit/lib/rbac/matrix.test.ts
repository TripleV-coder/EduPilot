import { describe, it, expect } from "vitest";
import {
    PERMISSION_MATRIX,
    ROLE_DESCRIPTORS,
    evaluateRow,
} from "@/lib/rbac/matrix";

describe("PERMISSION_MATRIX", () => {
    it("declares exactly 8 modules covering the design's matrix", () => {
        expect(PERMISSION_MATRIX).toHaveLength(8);
        expect(PERMISSION_MATRIX.map((r) => r.label)).toEqual([
            "Élèves & dossiers",
            "Notes & bulletins",
            "Présences",
            "Finance & paiements",
            "Santé · infirmerie",
            "Communication SMS",
            "Paramètres établissement",
            "Audit log",
        ]);
    });

    it("each row exposes 4 action slots", () => {
        for (const row of PERMISSION_MATRIX) {
            expect(row.slots).toHaveLength(4);
        }
    });
});

describe("evaluateRow", () => {
    it("DIRECTOR has full access to Élèves & dossiers", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Élèves & dossiers")!;
        expect(evaluateRow("DIRECTOR", row)).toEqual(["on", "on", "on", "on"]);
    });

    it("DIRECTOR can read but not write to Santé · infirmerie (slots are n/a)", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Santé · infirmerie")!;
        expect(evaluateRow("DIRECTOR", row)).toEqual(["on", "n/a", "n/a", "n/a"]);
    });

    it("TEACHER cannot delete grades", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Notes & bulletins")!;
        const cells = evaluateRow("TEACHER", row);
        expect(cells[0]).toBe("on"); // read
        expect(cells[3]).toBe("off"); // delete
    });

    it("STUDENT has no access to Élèves & dossiers", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Élèves & dossiers")!;
        expect(evaluateRow("STUDENT", row)).toEqual(["off", "off", "off", "off"]);
    });

    it("Audit log fallback grants read-only to school-level admins", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Audit log")!;
        expect(evaluateRow("DIRECTOR", row)).toEqual(["on", "off", "off", "off"]);
        expect(evaluateRow("SCHOOL_ADMIN", row)).toEqual(["on", "off", "off", "off"]);
    });

    it("Audit log fallback denies access to TEACHER and PARENT", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Audit log")!;
        expect(evaluateRow("TEACHER", row)).toEqual(["off", "off", "off", "off"]);
        expect(evaluateRow("PARENT", row)).toEqual(["off", "off", "off", "off"]);
    });

    it("SUPER_ADMIN reads audit log (highest tier)", () => {
        const row = PERMISSION_MATRIX.find((r) => r.label === "Audit log")!;
        expect(evaluateRow("SUPER_ADMIN", row)[0]).toBe("on");
    });
});

describe("ROLE_DESCRIPTORS", () => {
    it("includes every UserRole declared in the matrix file", () => {
        const expected = new Set([
            "DIRECTOR", "SCHOOL_ADMIN", "TEACHER", "PARENT",
            "STUDENT", "ACCOUNTANT", "STAFF", "SUPER_ADMIN",
        ]);
        const actual = new Set(ROLE_DESCRIPTORS.map((d) => d.role));
        expect(actual).toEqual(expected);
    });

    it("uses approved color tokens", () => {
        const approved = new Set(["brand", "info", "success", "warning", "neutral", "danger"]);
        for (const d of ROLE_DESCRIPTORS) {
            expect(approved.has(d.color)).toBe(true);
        }
    });
});
