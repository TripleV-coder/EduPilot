import { describe, expect, it, vi } from "vitest";
import { Webhook } from "fedapay";
import {
    createAccountCheckout,
    retrieveAccountTransaction,
    verifyAccountCredentials,
    verifyAccountWebhook,
} from "@/lib/payments/fedapay-account-client";

/**
 * S7 : client FedaPay d'un compte d'école. La clé part dans l'en-tête de CHAQUE
 * appel (le SDK officiel la garde dans un état global, partagé entre requêtes
 * concurrentes). Fournisseur simulé, clés synthétiques.
 */
const A = { accountId: "compte-a", environment: "SANDBOX" as const, secretKey: "sk_sandbox_ecole_A_synthetique" };
const B = { accountId: "compte-b", environment: "LIVE" as const, secretKey: "sk_live_ecole_B_synthetique" };
const customer = { firstname: "Awa", lastname: "Dossou", email: "parent@ecole.bj" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeFedaPay(delayMs = 0) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        await new Promise((r) => setTimeout(r, delayMs));
        const auth = new Headers(init?.headers).get("authorization");
        const u = String(url);
        if (u.endsWith("/transactions") && init?.method === "POST") return json({ "v1/transaction": { id: auth?.includes("ecole_A") ? 101 : 202, status: "pending" } });
        if (u.includes("/token")) return json({ token: "tok", url: `https://checkout.test/${u.split("/").at(-2)}` });
        return json({ id: 1 });
    });
}

describe("createAccountCheckout", () => {
    it("envoie la clé du compte, l'URL de son environnement et notre référence", async () => {
        const fetchMock = fakeFedaPay();
        const out = await createAccountCheckout(A, { amount: 5000, description: "Frais", reference: "PAY-1", callbackUrl: "https://app/retour", customer }, fetchMock as never);
        expect(out).toEqual({ url: "https://checkout.test/101", token: "tok", transactionId: "101" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://sandbox-api.fedapay.com/v1/transactions");
        expect(new Headers(init!.headers).get("authorization")).toBe(`Bearer ${A.secretKey}`);
        expect(JSON.parse(String(init!.body))).toMatchObject({ amount: 5000, currency: { iso: "XOF" }, merchant_reference: "PAY-1" });
    });

    it("requêtes simultanées de deux écoles : chacune avec SA clé, jamais celle de l'autre", async () => {
        const fetchMock = fakeFedaPay(5);
        const [a, b] = await Promise.all([
            createAccountCheckout(A, { amount: 1, description: "a", reference: "RA", callbackUrl: "u", customer }, fetchMock as never),
            createAccountCheckout(B, { amount: 1, description: "b", reference: "RB", callbackUrl: "u", customer }, fetchMock as never),
        ]);
        expect(a.transactionId).toBe("101");
        expect(b.transactionId).toBe("202");
        for (const [url, init] of fetchMock.mock.calls) {
            const auth = new Headers(init!.headers).get("authorization")!;
            if (String(url).startsWith("https://api.fedapay.com")) expect(auth).toBe(`Bearer ${B.secretKey}`);
            else expect(auth).toBe(`Bearer ${A.secretKey}`);
        }
    });

    it("refus HTTP à la création : résultat inconnu (UNKNOWN), jamais un refus présumé", async () => {
        const fetchMock = vi.fn(async () => json({ message: "erreur" }, 422));
        await expect(createAccountCheckout(A, { amount: 1, description: "a", reference: "R", callbackUrl: "u", customer }, fetchMock as never))
            .rejects.toMatchObject({ name: "ProviderInitError", outcome: "UNKNOWN" });
    });

    it("échec du jeton après création : inconnu, avec l'identifiant de la transaction créée", async () => {
        const fetchMock = vi.fn(async (url: string | URL | Request) =>
            String(url).includes("/token") ? json({}, 500) : json({ "v1/transaction": { id: 77 } }));
        await expect(createAccountCheckout(A, { amount: 1, description: "a", reference: "R", callbackUrl: "u", customer }, fetchMock as never))
            .rejects.toMatchObject({ outcome: "UNKNOWN", providerTransactionId: "77" });
    });
});

describe("retrieveAccountTransaction et verifyAccountCredentials", () => {
    it("lit l'état avec ou sans enveloppe v1/transaction", async () => {
        const wrapped = vi.fn(async () => json({ "v1/transaction": { status: "approved", merchant_reference: "PAY-1", amount: 5000 } }));
        expect(await retrieveAccountTransaction(A, "1", wrapped as never)).toMatchObject({ status: "SUCCESS", merchantReference: "PAY-1" });
        const root = vi.fn(async () => json({ status: "declined" }));
        expect((await retrieveAccountTransaction(A, "1", root as never)).status).toBe("FAILED");
    });

    it("test des identifiants : accepté, refusé (401/403) ou injoignable", async () => {
        expect(await verifyAccountCredentials(A, vi.fn(async () => json({ data: [] })) as never)).toBe("valid");
        expect(await verifyAccountCredentials(A, vi.fn(async () => json({}, 401)) as never)).toBe("invalid");
        expect(await verifyAccountCredentials(A, vi.fn(async () => { throw new Error("réseau"); }) as never)).toBe("unreachable");
    });
});

describe("verifyAccountWebhook (algorithme du SDK officiel, secret du compte)", () => {
    const payload = JSON.stringify({ name: "transaction.approved", entity: { id: 9, merchant_reference: "PAY-1", amount: 5000 } });
    const header = (secret: string, timestamp?: number) => Webhook.generateTestHeaderString({ payload, secret, timestamp });

    it("signature du bon secret : événement lu", () => {
        expect(verifyAccountWebhook(payload, header("whsec_ecole_A"), "whsec_ecole_A")).toMatchObject({ name: "transaction.approved", entity: { merchant_reference: "PAY-1" } });
    });

    it("secret d'une autre école, signature absente ou trop ancienne : refusée", () => {
        expect(() => verifyAccountWebhook(payload, header("whsec_ecole_B"), "whsec_ecole_A")).toThrow();
        expect(() => verifyAccountWebhook(payload, null, "whsec_ecole_A")).toThrow();
        expect(() => verifyAccountWebhook(payload, header("whsec_ecole_A", Math.floor(Date.now() / 1000) - 3600), "whsec_ecole_A")).toThrow();
    });
});
