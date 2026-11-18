import { describe, expect, it } from "vitest";
import {
    confirmationMismatch,
    parseProviderAmount,
    parseProviderCurrency,
    providerBindingMismatch,
    readProviderEvent,
} from "@/lib/finance/online-payments";

describe("parseProviderAmount", () => {
    it("lit nombres et chaînes", () => {
        expect(parseProviderAmount(50000, "MOMO")).toBe(50000);
        expect(parseProviderAmount("50000", "FEDAPAY")).toBe(50000);
    });

    it("Paystack : centièmes ramenés en FCFA", () => {
        expect(parseProviderAmount(5000000, "PAYSTACK")).toBe(50000);
    });

    it("absent ou illisible → null (jamais 0)", () => {
        for (const value of [undefined, null, "", "  ", "abc", Number.NaN, {}]) {
            expect(parseProviderAmount(value, "MOMO")).toBeNull();
        }
    });
});

describe("parseProviderCurrency", () => {
    it("chaîne ou objet { iso }", () => {
        expect(parseProviderCurrency("xof")).toBe("XOF");
        expect(parseProviderCurrency({ iso: "XOF" })).toBe("XOF");
    });

    it("absente → null", () => {
        expect(parseProviderCurrency(undefined)).toBeNull();
        expect(parseProviderCurrency({ id: 1 })).toBeNull();
    });
});

describe("confirmationMismatch", () => {
    it("montant exact et XOF : conforme", () => {
        expect(confirmationMismatch(50000, 50000, "XOF")).toBeNull();
    });

    it("devise non transmise : conforme si le montant l'est (transaction créée en XOF)", () => {
        expect(confirmationMismatch(50000, 50000, null)).toBeNull();
    });

    it("montant partiel, supérieur ou absent : refusé", () => {
        expect(confirmationMismatch(50000, 49999, "XOF")).toContain("49999");
        expect(confirmationMismatch(50000, 50001, "XOF")).toContain("50001");
        expect(confirmationMismatch(50000, null, "XOF")).toContain("non transmis");
    });

    it("autre devise : refusé même au bon montant", () => {
        expect(confirmationMismatch(50000, 50000, "EUR")).toContain("EUR");
    });
});

describe("readProviderEvent", () => {
    it("Flutterwave : tx_ref, statut successful, identifiant fournisseur", () => {
        expect(
            readProviderEvent(
                { event: "charge.completed", data: { id: 77, tx_ref: "PAY-1", amount: 1000, currency: "XOF", status: "successful" } },
                "FLUTTERWAVE",
            ),
        ).toEqual({ reference: "PAY-1", status: "SUCCESS", amount: 1000, currency: "XOF", providerTransactionId: "77" });
    });

    it("Paystack : reference, statut success, montant en centièmes", () => {
        expect(
            readProviderEvent({ data: { reference: "PAY-2", amount: 100000, currency: "XOF", status: "success" } }, "PAYSTACK"),
        ).toMatchObject({ reference: "PAY-2", status: "SUCCESS", amount: 1000 });
    });

    it("échec, abandon ou statut inconnu", () => {
        expect(readProviderEvent({ data: { reference: "R", status: "abandoned" } }, "PAYSTACK").status).toBe("FAILED");
        expect(readProviderEvent({ data: { tx_ref: "R", status: "failed" } }, "FLUTTERWAVE").status).toBe("FAILED");
        expect(readProviderEvent({ data: { tx_ref: "R", status: "pending" } }, "FLUTTERWAVE").status).toBeNull();
    });
});

describe("providerBindingMismatch (S3)", () => {
    const fedapay = { provider: "FEDAPAY", providerTransactionId: "4242" };

    it("même fournisseur, même transaction : conforme", () => {
        expect(providerBindingMismatch(fedapay, "FEDAPAY", "4242")).toBeNull();
    });

    it("autre fournisseur, ou paiement sans fournisseur : refusé", () => {
        expect(providerBindingMismatch(fedapay, "MOMO", "4242")).toContain("initié chez FEDAPAY");
        expect(providerBindingMismatch({ provider: null, providerTransactionId: null }, "FEDAPAY", "1")).toContain("sans fournisseur");
    });

    it("FedaPay (identifiants comparables) : autre transaction ou identifiant absent refusés ; inconnu à l'initiation accepté", () => {
        expect(providerBindingMismatch(fedapay, "FEDAPAY", "5151")).toContain("différent");
        expect(providerBindingMismatch(fedapay, "FEDAPAY", null)).toContain("absent");
        expect(providerBindingMismatch({ provider: "FEDAPAY", providerTransactionId: null }, "FEDAPAY", "7373")).toBeNull();
    });

    it("MoMo, Flutterwave, Paystack : identifiants de nature différente, jamais comparés", () => {
        expect(providerBindingMismatch({ provider: "MOMO", providerTransactionId: "x-ref" }, "MOMO", "fin-123")).toBeNull();
        expect(providerBindingMismatch({ provider: "FLUTTERWAVE", providerTransactionId: "PAY-1" }, "FLUTTERWAVE", "77")).toBeNull();
        expect(providerBindingMismatch({ provider: "PAYSTACK", providerTransactionId: "PAY-2" }, "PAYSTACK", "88")).toBeNull();
    });
});
