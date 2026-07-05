import { describe, it, expect } from "vitest";
import {
    isHrManager,
    summarizeAttendance,
    countLeaveDays,
    isValidLeaveRange,
    sumLines,
    computePayrollNet,
    buildPayrollJournalLines,
    STAFF_MEMBER_ROLES,
} from "@/lib/staff/hr";

describe("isHrManager", () => {
    it("autorise SCHOOL_ADMIN, DIRECTOR, SUPER_ADMIN", () => {
        expect(isHrManager("SCHOOL_ADMIN")).toBe(true);
        expect(isHrManager("DIRECTOR")).toBe(true);
        expect(isHrManager("SUPER_ADMIN")).toBe(true);
    });
    it("fait hériter NETWORK_ADMIN de SCHOOL_ADMIN", () => {
        expect(isHrManager("NETWORK_ADMIN")).toBe(true);
    });
    it("refuse TEACHER / STAFF / null", () => {
        expect(isHrManager("TEACHER")).toBe(false);
        expect(isHrManager("STAFF")).toBe(false);
        expect(isHrManager(null)).toBe(false);
    });
    it("exclut STUDENT et PARENT du personnel", () => {
        expect(STAFF_MEMBER_ROLES).not.toContain("STUDENT");
        expect(STAFF_MEMBER_ROLES).not.toContain("PARENT");
    });
});

describe("summarizeAttendance", () => {
    it("compte chaque statut", () => {
        const s = summarizeAttendance([
            { status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" },
            { status: "LATE" }, { status: "ON_LEAVE" },
        ]);
        expect(s).toEqual({ present: 2, absent: 1, late: 1, onLeave: 1, total: 5 });
    });
    it("gère la liste vide", () => {
        expect(summarizeAttendance([])).toEqual({ present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });
    });
});

describe("countLeaveDays / isValidLeaveRange", () => {
    it("compte les bornes incluses", () => {
        expect(countLeaveDays(new Date("2026-07-01"), new Date("2026-07-01"))).toBe(1);
        expect(countLeaveDays(new Date("2026-07-01"), new Date("2026-07-05"))).toBe(5);
    });
    it("renvoie 0 si la fin précède le début", () => {
        expect(countLeaveDays(new Date("2026-07-05"), new Date("2026-07-01"))).toBe(0);
    });
    it("valide l'ordre des bornes", () => {
        expect(isValidLeaveRange(new Date("2026-07-01"), new Date("2026-07-02"))).toBe(true);
        expect(isValidLeaveRange(new Date("2026-07-02"), new Date("2026-07-01"))).toBe(false);
    });
});

describe("paie", () => {
    it("somme uniquement les montants positifs", () => {
        expect(sumLines([{ label: "a", amount: 1000 }, { label: "b", amount: -50 }, { label: "c", amount: 250 }])).toBe(1250);
    });
    it("net = base + primes − retenues, arrondi, jamais négatif", () => {
        expect(computePayrollNet(100000, [{ label: "transport", amount: 15000 }], [{ label: "avance", amount: 20000 }])).toBe(95000);
        expect(computePayrollNet(50000, [], [{ label: "trop", amount: 999999 }])).toBe(0);
    });
    it("construit une écriture OHADA équilibrée (débit 66 / crédit 42)", () => {
        const lines = buildPayrollJournalLines(95000, "acc-66", "acc-42", "Salaire 2026-07 — Awa Kone");
        expect(lines).toHaveLength(2);
        const debit = lines.find((l) => l.debitAccountId);
        const credit = lines.find((l) => l.creditAccountId);
        expect(debit?.debitAccountId).toBe("acc-66");
        expect(credit?.creditAccountId).toBe("acc-42");
        expect(debit?.amountFcfa).toBe(95000);
        expect(credit?.amountFcfa).toBe(95000);
    });
});
