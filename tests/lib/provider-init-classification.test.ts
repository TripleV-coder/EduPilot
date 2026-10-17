import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Lot 3b — classification des échecs de création d'une transaction chez les
 * fournisseurs : REFUSED seulement quand le code prouve que la demande n'a
 * jamais été envoyée ; UNKNOWN dès qu'elle a pu atteindre le fournisseur
 * (délai, coupure, réponse illisible, et toute réponse HTTP d'erreur, 4xx
 * compris : aucune garantie documentée n'établit qu'un code prouve l'absence
 * de transaction). L'identifiant connu est conservé pour la vérification.
 * Adaptateurs réimportés à chaque test : les échecs simulés n'ouvrent pas le
 * disjoncteur d'un test à l'autre.
 */
const feda = vi.hoisted(() => ({ setApiKey: vi.fn(), setEnvironment: vi.fn(), retrieve: vi.fn(), create: vi.fn(), constructEvent: vi.fn() }));
vi.mock("fedapay", () => ({
    FedaPay: { setApiKey: feda.setApiKey, setEnvironment: feda.setEnvironment },
    Transaction: { retrieve: feda.retrieve, create: feda.create },
    Webhook: { constructEvent: feda.constructEvent },
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { outcomeForHttpStatus, outcomeForSendError } from "@/lib/finance/providers/init-error";
import { CircuitOpenError } from "@/lib/resilience/errors";

const fetchMock = vi.fn();
const ENV = { ...process.env };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const notJson = (status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => { throw new SyntaxError("Unexpected token <"); }, text: async () => "<html>" });

async function fresh<T>(path: string): Promise<T> {
    vi.resetModules();
    return (await import(path)) as T;
}
const initError = (outcome: "REFUSED" | "UNKNOWN", providerTransactionId?: string) =>
    expect.objectContaining({ name: "ProviderInitError", outcome, providerTransactionId });

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env = { ...ENV, MOMO_SUBSCRIPTION_KEY: "sub", MOMO_API_USER: "user", MOMO_API_KEY: "key", PAYSTACK_SECRET_KEY: "sk", FLUTTERWAVE_SECRET_KEY: "fk", FEDAPAY_SECRET_KEY: "fp" };
});
afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ENV };
});

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

describe("MoMo (requestToPay)", () => {
    type Mod = typeof import("@/lib/finance/providers/momo");
    const momo = async () => new (await fresh<Mod>("@/lib/finance/providers/momo")).MomoProvider();
    const referenceIdSent = () => (fetchMock.mock.calls[1][1] as { headers: Record<string, string> }).headers["X-Reference-Id"];

    it("numéro manquant : refus, rien n'est envoyé", async () => {
        await expect((await momo()).initiatePayment(1, "XOF", "e", "R", {})).rejects.toEqual(initError("REFUSED"));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("jeton refusé : refus, la demande de paiement n'est jamais envoyée", async () => {
        fetchMock.mockResolvedValueOnce(json({}, 401));
        await expect((await momo()).initiatePayment(1, "XOF", "e", "R", { phone: "229" })).rejects.toEqual(initError("REFUSED"));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("réponse 400 : la demande a atteint MoMo, résultat inconnu, identifiant conservé", async () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: "tok" })).mockResolvedValueOnce(json({}, 400));
        const error = await (await momo()).initiatePayment(1, "XOF", "e", "R", { phone: "229" }).catch((e) => e);
        expect(error).toEqual(initError("UNKNOWN", referenceIdSent()));
    });

    it("erreur 500 : résultat inconnu, identifiant MoMo (X-Reference-Id) conservé", async () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: "tok" })).mockResolvedValueOnce(json({}, 500));
        const error = await (await momo()).initiatePayment(1, "XOF", "e", "R", { phone: "229" }).catch((e) => e);
        expect(error).toEqual(initError("UNKNOWN", referenceIdSent()));
        expect(error.message).toContain("requestToPay refusé (500)");
    });

    it("délai dépassé après l'envoi : résultat inconnu, identifiant conservé", async () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: "tok" })).mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
        const error = await (await momo()).initiatePayment(1, "XOF", "e", "R", { phone: "229" }).catch((e) => e);
        expect(error).toEqual(initError("UNKNOWN", referenceIdSent()));
    });
});

describe("Paystack et Flutterwave (référence marchande = identifiant de vérification)", () => {
    const paystack = async () => new (await fresh<typeof import("@/lib/finance/providers/paystack")>("@/lib/finance/providers/paystack")).PaystackProvider();
    const flutterwave = async () => new (await fresh<typeof import("@/lib/finance/providers/flutterwave")>("@/lib/finance/providers/flutterwave")).FlutterwaveProvider();

    it("Paystack réponse 422 : résultat inconnu, référence conservée", async () => {
        fetchMock.mockResolvedValueOnce(json({ status: false, message: "Invalid amount" }, 422));
        await expect((await paystack()).initiatePayment(1, "XOF", "e", "REF-1", {})).rejects.toEqual(initError("UNKNOWN", "REF-1"));
    });

    it("circuit ouvert : demande jamais envoyée, refus avéré", async () => {
        const mod = await fresh<typeof import("@/lib/finance/providers/paystack")>("@/lib/finance/providers/paystack");
        const breaker = await import("@/lib/resilience/circuit-breaker");
        const errors = await import("@/lib/resilience/errors");
        vi.spyOn(breaker, "circuitFetch").mockRejectedValueOnce(new errors.CircuitOpenError("paystack", 1000));
        await expect(new mod.PaystackProvider().initiatePayment(1, "XOF", "e", "REF-7", {})).rejects.toEqual(initError("REFUSED", undefined));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("Paystack 503, réponse illisible ou coupure : résultat inconnu, référence conservée", async () => {
        fetchMock.mockResolvedValueOnce(json({ status: false, message: "down" }, 503));
        await expect((await paystack()).initiatePayment(1, "XOF", "e", "REF-2", {})).rejects.toEqual(initError("UNKNOWN", "REF-2"));
        fetchMock.mockResolvedValueOnce(notJson(200));
        await expect((await paystack()).initiatePayment(1, "XOF", "e", "REF-3", {})).rejects.toEqual(initError("UNKNOWN", "REF-3"));
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
        await expect((await paystack()).initiatePayment(1, "XOF", "e", "REF-4", {})).rejects.toEqual(initError("UNKNOWN", "REF-4"));
    });

    it("Flutterwave réponse 400 ou succès sans lien : résultat inconnu, référence conservée", async () => {
        fetchMock.mockResolvedValueOnce(json({ status: "error", message: "bad" }, 400));
        await expect((await flutterwave()).initiatePayment(1, "XOF", "e", "REF-5", {})).rejects.toEqual(initError("UNKNOWN", "REF-5"));
        fetchMock.mockResolvedValueOnce(json({ status: "success", data: {} }, 200));
        await expect((await flutterwave()).initiatePayment(1, "XOF", "e", "REF-6", {})).rejects.toEqual(initError("UNKNOWN", "REF-6"));
    });
});

describe("FedaPay (SDK)", () => {
    const fedapay = async () => new (await fresh<typeof import("@/lib/finance/providers/fedapay")>("@/lib/finance/providers/fedapay")).FedaPayProvider();

    it("réponse 4xx à la création : résultat inconnu (aucun identifiant connu)", async () => {
        feda.create.mockRejectedValueOnce(Object.assign(new Error("invalid"), { httpStatus: 400 }));
        await expect((await fedapay()).initiatePayment(1, "XOF", "e@x.bj", "R", {})).rejects.toEqual(initError("UNKNOWN", undefined));
    });

    it("erreur réseau à la création : résultat inconnu, aucun identifiant connu", async () => {
        feda.create.mockRejectedValueOnce(new TypeError("socket hang up"));
        await expect((await fedapay()).initiatePayment(1, "XOF", "e@x.bj", "R", {})).rejects.toEqual(initError("UNKNOWN", undefined));
    });

    it("échec du jeton APRÈS la création : résultat inconnu, identifiant FedaPay conservé", async () => {
        feda.create.mockResolvedValueOnce({ id: 77, generateToken: vi.fn().mockRejectedValue(new Error("timeout")) });
        await expect((await fedapay()).initiatePayment(1, "XOF", "e@x.bj", "R", {})).rejects.toEqual(initError("UNKNOWN", "77"));
    });
});
