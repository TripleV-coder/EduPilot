import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { intentAmount, publicPaymentStatus } from "@/lib/finance/family-finance";

/** Solde au format getFeeBalance. */
const balance = (billed: number, settled: number, reserved = 0) => {
    const remaining = Math.max(0, billed - settled);
    return { billed, settled, reserved, remaining, available: Math.max(0, remaining - reserved) };
};
const installments = [
    { id: "i3", amount: 30000, dueDate: new Date("2026-12-01"), status: "PENDING" },
    { id: "i1", amount: 30000, dueDate: new Date("2026-10-01"), status: "PENDING" },
    { id: "i2", amount: 30000, dueDate: new Date("2026-11-01"), status: "PENDING" },
];

describe("intentAmount — montant d'une intention, recalculé par le serveur", () => {
    it("prochaine échéance : reste de la plus ancienne non soldée (ordre des dates, pas de la liste)", () => {
        expect(intentAmount("NEXT_INSTALLMENT", balance(90000, 10000), installments)).toEqual({ amount: 20000, installmentId: "i1" });
        expect(intentAmount("NEXT_INSTALLMENT", balance(90000, 30000), installments)).toEqual({ amount: 30000, installmentId: "i2" });
    });

    it("prochaine échéance plafonnée au disponible (échéancier plus grand que le facturé)", () => {
        expect(intentAmount("NEXT_INSTALLMENT", balance(25000, 10000), installments)).toEqual({ amount: 15000, installmentId: "i1" });
    });

    it("échéance annulée ignorée ; sans échéancier ou tout couvert : NO_INSTALLMENT_DUE", () => {
        const withCancelled = [{ ...installments[1], status: "CANCELLED" }, installments[2]];
        expect(intentAmount("NEXT_INSTALLMENT", balance(90000, 0), withCancelled)).toEqual({ amount: 30000, installmentId: "i2" });
        expect(intentAmount("NEXT_INSTALLMENT", balance(100000, 0), null)).toEqual({ error: "NO_INSTALLMENT_DUE" });
        expect(intentAmount("NEXT_INSTALLMENT", balance(100000, 90000), installments)).toEqual({ error: "NO_INSTALLMENT_DUE" });
    });

    it("tout le solde : le disponible", () => {
        expect(intentAmount("FULL_BALANCE", balance(100000, 40000), null)).toEqual({ amount: 60000 });
    });

    it("essai en attente : refus (le solde ou l'échéance peuvent déjà être couverts) ; rien de dû : NOTHING_DUE", () => {
        expect(intentAmount("FULL_BALANCE", balance(100000, 0, 5000), null)).toEqual({ error: "PAYMENT_IN_PROGRESS" });
        expect(intentAmount("NEXT_INSTALLMENT", balance(90000, 0, 5000), installments)).toEqual({ error: "PAYMENT_IN_PROGRESS" });
        expect(intentAmount("FULL_BALANCE", balance(100000, 100000), null)).toEqual({ error: "NOTHING_DUE" });
    });
});

describe("publicPaymentStatus — statut montré à la famille", () => {
    it.each([
        ["VERIFIED", null, "CONFIRMED"],
        ["RECONCILED", null, "CONFIRMED"],
        ["CANCELLED", null, "FAILED"],
        ["EXPIRED", null, "FAILED"],
        ["PENDING", null, "PENDING"],
        ["PENDING", "Résultat de l'initialisation inconnu chez le fournisseur", "UNDER_REVIEW"],
        ["PENDING", "Validation bloquée : plan incohérent", "UNDER_REVIEW"],
        ["PENDING", "À rapprocher (FedaPay compte x) : montant reçu 1000 ≠ 13000.", "UNDER_REVIEW"],
        ["PENDING", "Sans réponse définitive du fournisseur après 24 h : reste en attente, montant réservé.", "UNDER_REVIEW"],
        ["PENDING", "Signalé à l'administration financière : en attente depuis plus de 48 h.", "UNDER_REVIEW"],
        ["VERIFIED", "À rapprocher (ancien) : écart", "CONFIRMED"],
    ])("%s (%s) → %s", (status, notes, expected) => {
        expect(publicPaymentStatus(status, notes)).toBe(expected);
    });
});
