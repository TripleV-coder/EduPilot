import { describe, expect, it } from "vitest";
import {
    computeScholarshipDiscounts,
    overpaymentMessage,
    redistributeInstallments,
    scholarshipCoversYear,
    type DiscountableFee,
    type ScholarshipRule,
} from "@/lib/finance/scholarships";

/** FIN-01 (2026-11-24) — règles pures du dû après bourse. */
const year = { startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31") };
const rule = (over: Partial<ScholarshipRule> = {}): ScholarshipRule => ({
    id: "s1",
    amount: 0,
    percentage: null,
    isActive: true,
    startDate: new Date("2026-09-01"),
    endDate: null,
    feeIds: [],
    ...over,
});
const fee = (id: string, amount: number, over: Partial<DiscountableFee> = {}): DiscountableFee => ({
    id,
    amount,
    isRequired: true,
    dueDate: null,
    ...over,
});

describe("scholarshipCoversYear — règle 2 (bourse annuelle)", () => {
    it("accordée en cours d'année : vaut pour l'année entière", () => {
        expect(scholarshipCoversYear(rule({ startDate: new Date("2027-02-15") }), year)).toBe(true);
    });
    it("inactive, commencée après l'année ou finie avant : ne s'applique pas", () => {
        expect(scholarshipCoversYear(rule({ isActive: false }), year)).toBe(false);
        expect(scholarshipCoversYear(rule({ startDate: new Date("2027-09-01") }), year)).toBe(false);
        expect(scholarshipCoversYear(rule({ startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31") }), year)).toBe(false);
    });
    it("terminée en cours d'année : reste due pour cette année (pas de prorata)", () => {
        expect(scholarshipCoversYear(rule({ endDate: new Date("2026-12-31") }), year)).toBe(true);
    });
});

describe("computeScholarshipDiscounts — règles 1 et 3", () => {
    it("sans frais visés : frais obligatoires seulement", () => {
        const d = computeScholarshipDiscounts(
            [fee("scol", 100_000), fee("cantine", 30_000, { isRequired: false })],
            [rule({ percentage: 50 })],
            year,
        );
        expect(d.get("scol")).toBe(50_000);
        expect(d.get("cantine")).toBe(0);
    });

    it("frais visés par l'école : seuls ceux-là, facultatifs compris", () => {
        const d = computeScholarshipDiscounts(
            [fee("scol", 100_000), fee("cantine", 30_000, { isRequired: false })],
            [rule({ percentage: 50, feeIds: ["cantine"] })],
            year,
        );
        expect(d.get("scol")).toBe(0);
        expect(d.get("cantine")).toBe(15_000);
    });

    it("montant fixe : UNE enveloppe répartie (échéance la plus proche d'abord), jamais déduite deux fois", () => {
        const d = computeScholarshipDiscounts(
            [fee("t2", 30_000, { dueDate: new Date("2027-01-10") }), fee("t1", 30_000, { dueDate: new Date("2026-10-10") })],
            [rule({ amount: 40_000 })],
            year,
        );
        expect(d.get("t1")).toBe(30_000);
        expect(d.get("t2")).toBe(10_000);
        expect([...d.values()].reduce((a, b) => a + b, 0)).toBe(40_000);
    });

    it("cumul de bourses plafonné au montant du frais ; arrondi au franc", () => {
        const d = computeScholarshipDiscounts(
            [fee("scol", 33_333)],
            [rule({ id: "a", percentage: 70 }), rule({ id: "b", percentage: 50 }), rule({ id: "c", amount: 5_000 })],
            year,
        );
        expect(d.get("scol")).toBe(33_333);
        expect(computeScholarshipDiscounts([fee("x", 33_333)], [rule({ percentage: 33 })], year).get("x")).toBe(11_000);
    });

    it("bourse inactive : aucune remise", () => {
        expect(computeScholarshipDiscounts([fee("scol", 100_000)], [rule({ percentage: 50, isActive: false })], year).get("scol")).toBe(0);
    });
});

describe("redistributeInstallments — règle 4", () => {
    const lines = [
        { id: "e1", amount: 20_000, dueDate: new Date("2026-10-01"), status: "PAID" },
        { id: "e2", amount: 20_000, dueDate: new Date("2026-12-01"), status: "PENDING" },
        { id: "e3", amount: 20_000, dueDate: new Date("2027-02-01"), status: "PENDING" },
    ];
    it("baisse retirée en partant de la DERNIÈRE échéance ; échéance à 0 annulée", () => {
        expect(redistributeInstallments(lines, 35_000)).toEqual([
            { id: "e2", amount: 15_000, cancel: false },
            { id: "e3", amount: 0, cancel: true },
        ]);
    });
    it("l'échéance déjà couverte n'est touchée qu'en dernier recours", () => {
        expect(redistributeInstallments(lines, 30_000).map((c) => c.id)).toEqual(["e2", "e3"]);
        expect(redistributeInstallments(lines, 10_000)).toContainEqual({ id: "e1", amount: 10_000, cancel: false });
    });
    it("hausse (bourse retirée) ajoutée à la dernière échéance ; échéances annulées ignorées", () => {
        const withCancelled = [...lines, { id: "e4", amount: 0, dueDate: new Date("2027-04-01"), status: "CANCELLED" }];
        expect(redistributeInstallments(withCancelled, 70_000)).toEqual([{ id: "e3", amount: 30_000, cancel: false }]);
    });
    it("total inchangé : aucune modification", () => {
        expect(redistributeInstallments(lines, 60_000)).toEqual([]);
    });
});

describe("overpaymentMessage — règle 5", () => {
    it("chiffre le trop-perçu et indique le geste de remboursement", () => {
        const text = overpaymentMessage("Kofi Ahouandjinou", { planId: "p", feeId: "f", previousTotal: 50_000, newTotal: 25_000, overpaid: 15_000 });
        expect(text).toContain("Kofi Ahouandjinou");
        expect(text).toMatch(/versé 40\s000 F/);
        expect(text).toMatch(/Trop-perçu à rembourser : 15\s000 F/);
    });
});
