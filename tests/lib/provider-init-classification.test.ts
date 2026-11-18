import { describe, it, expect } from "vitest";

/**
 * Lot 3b — classification des échecs de création d'une transaction chez les
 * fournisseurs : REFUSED seulement quand le code prouve que la demande n'a
 * jamais été envoyée ; UNKNOWN dès qu'elle a pu atteindre le fournisseur
 * (délai, coupure, réponse illisible, et toute réponse HTTP d'erreur, 4xx
 * compris : aucune garantie documentée n'établit qu'un code prouve l'absence
 * de transaction). L'identifiant connu est conservé pour la vérification.
 * Fournisseurs globaux retirés (2026-11-08) : les règles ci-dessous sont
 * appliquées par le client des comptes d'école (fedapay-account-client,
 * éprouvé par tests/lib/payments/fedapay-account-client.test.ts).
 */
import { outcomeForHttpStatus, outcomeForSendError } from "@/lib/finance/providers/init-error";
import { CircuitOpenError } from "@/lib/resilience/errors";

describe("Règles de classification", () => {
    it("toute réponse HTTP d'erreur à la création = résultat inconnu, 4xx compris", () => {
        for (const s of [400, 401, 403, 408, 409, 422, 429, 500, 502, 503, 504]) expect(outcomeForHttpStatus(s), String(s)).toBe("UNKNOWN");
    });

    it("erreur à l'envoi : circuit ouvert = jamais envoyée ; délai ou réseau = inconnu", () => {
        expect(outcomeForSendError(new CircuitOpenError("momo", 1000))).toBe("REFUSED");
        expect(outcomeForSendError(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("UNKNOWN");
        expect(outcomeForSendError(new TypeError("fetch failed"))).toBe("UNKNOWN");
    });
});
