import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mapFedaPayStatus } from "@/lib/payments/fedapay";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { isMomoConfigured, MomoProvider } from "@/lib/finance/providers/momo";

describe("mapFedaPayStatus", () => {
    it("mappe les statuts FedaPay", () => {
        expect(mapFedaPayStatus("approved")).toBe("SUCCESS");
        expect(mapFedaPayStatus("transferred")).toBe("SUCCESS");
        expect(mapFedaPayStatus("declined")).toBe("FAILED");
        expect(mapFedaPayStatus("canceled")).toBe("FAILED");
        expect(mapFedaPayStatus("pending")).toBe("PENDING");
        expect(mapFedaPayStatus(undefined)).toBe("PENDING");
    });
});

describe("PaymentProviderFactory", () => {
    it("résout tous les providers supportés", () => {
        for (const p of ["FLUTTERWAVE", "PAYSTACK", "FEDAPAY", "MOMO"] as const) {
            expect(PaymentProviderFactory.getProvider(p).name).toBeTruthy();
        }
    });
    it("rejette un provider inconnu", () => {
        expect(() => PaymentProviderFactory.getProvider("XYZ" as never)).toThrow(/Unsupported/);
    });
});

describe("isMomoConfigured", () => {
    const ENV = process.env;
    afterEach(() => { process.env = ENV; });
    it("false si une clé manque", () => {
        process.env = { ...ENV, MOMO_SUBSCRIPTION_KEY: "k", MOMO_API_USER: "", MOMO_API_KEY: "x" };
        expect(isMomoConfigured()).toBe(false);
    });
    it("true si tout est présent", () => {
        process.env = { ...ENV, MOMO_SUBSCRIPTION_KEY: "k", MOMO_API_USER: "u", MOMO_API_KEY: "x" };
        expect(isMomoConfigured()).toBe(true);
    });
});

describe("MomoProvider", () => {
    const ENV = process.env;
    beforeEach(() => {
        process.env = {
            ...ENV,
            MOMO_SUBSCRIPTION_KEY: "sub",
            MOMO_API_USER: "user",
            MOMO_API_KEY: "key",
            MOMO_BASE_URL: "https://momo.test",
            MOMO_TARGET_ENVIRONMENT: "sandbox",
        };
    });
    afterEach(() => {
        process.env = ENV;
        vi.restoreAllMocks();
    });

    function mockFetch() {
        const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
            if (url.endsWith("/collection/token/")) {
                return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
            }
            if (url.endsWith("/requesttopay") && init?.method === "POST") {
                return new Response(null, { status: 202 });
            }
            if (url.includes("/requesttopay/")) {
                return new Response(JSON.stringify({ status: "SUCCESSFUL" }), { status: 200 });
            }
            return new Response("nope", { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("requestToPay réussit (202) et renvoie un transactionId UUID", async () => {
        mockFetch();
        const provider = new MomoProvider();
        const res = await provider.initiatePayment(5000, "XOF", "p@e.bj", "PAY-1", { phone: "22990000000" });
        expect(res.paymentUrl).toBe("");
        expect(res.transactionId).toMatch(/[0-9a-f-]{36}/);
    });

    it("refuse sans numéro de payeur", async () => {
        mockFetch();
        const provider = new MomoProvider();
        await expect(
            provider.initiatePayment(5000, "XOF", "p@e.bj", "PAY-1", {})
        ).rejects.toThrow(/payeur/);
    });

    it("verifyPayment mappe SUCCESSFUL → SUCCESS", async () => {
        mockFetch();
        const provider = new MomoProvider();
        const res = await provider.verifyPayment("ref-123");
        expect(res.status).toBe("SUCCESS");
    });
});
