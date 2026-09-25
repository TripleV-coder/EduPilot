import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const feda = vi.hoisted(() => ({
  setApiKey: vi.fn(),
  setEnvironment: vi.fn(),
  retrieve: vi.fn(),
  create: vi.fn(),
  constructEvent: vi.fn(),
}));
vi.mock("fedapay", () => ({
  FedaPay: { setApiKey: feda.setApiKey, setEnvironment: feda.setEnvironment },
  Transaction: { retrieve: feda.retrieve, create: feda.create },
  Webhook: { constructEvent: feda.constructEvent },
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { logger } from "@/lib/utils/logger";
import { FlutterwaveProvider } from "@/lib/finance/providers/flutterwave";
import { PaystackProvider } from "@/lib/finance/providers/paystack";
import { FedaPayProvider } from "@/lib/finance/providers/fedapay";
import { retrieveFedaPayTransaction } from "@/lib/payments/fedapay";

const fetchMock = vi.fn();
const ENV = { ...process.env };

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

type FetchInit = { method: string; headers: Record<string, string>; body?: string };
const fetchCall = (i: number) => fetchMock.mock.calls[i] as [string, FetchInit];

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env = { ...ENV };
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ENV };
});

describe("FlutterwaveProvider", () => {
  const flw = new FlutterwaveProvider();

  it("exige la clé secrète avant tout appel réseau", async () => {
    delete process.env.FLUTTERWAVE_SECRET_KEY;
    await expect(flw.verifyPayment("ref")).rejects.toThrow("FLUTTERWAVE_SECRET_KEY non configurée");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("initie un paiement hébergé avec les métadonnées de l'élève", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK-1";
    process.env.NEXT_PUBLIC_APP_URL = "https://ecole.bj";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok", data: { link: "https://pay/abc" } }));
    const res = await flw.initiatePayment(15000, "", "p@x.bj", "REF-1", { studentName: "Awa", phone: "229", description: "T1" });
    expect(res).toEqual({ paymentUrl: "https://pay/abc", transactionId: "REF-1" });
    const [url, init] = fetchCall(0);
    expect(url).toBe("https://api.flutterwave.com/v3/payments");
    expect(init.headers.Authorization).toBe("Bearer FLWSECK-1");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      tx_ref: "REF-1",
      amount: 15000,
      currency: "XOF",
      redirect_url: "https://ecole.bj/api/payments/reconcile?ref=REF-1",
      customer: { email: "p@x.bj", name: "Awa", phonenumber: "229" },
      customizations: { description: "T1", logo: "https://ecole.bj/logo.png" },
    });
  });

  it("utilise les valeurs par défaut (URL locale, nom et description génériques)", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    delete process.env.NEXT_PUBLIC_APP_URL;
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok", data: { link: "L" } }));
    await flw.initiatePayment(1, "NGN", "e", "R", undefined as never);
    const body = JSON.parse(fetchCall(0)[1].body as string);
    expect(body.currency).toBe("NGN");
    expect(body.redirect_url).toBe("http://localhost:3000/api/payments/reconcile?ref=R");
    expect(body.customer.name).toBe("EduPilot Student");
    expect(body.customer.phonenumber).toBeUndefined();
    expect(body.customizations.description).toBe("Paiement des frais scolaires");
  });

  it.each([
    ["HTTP en erreur", { ok: false, status: 400 }, { status: "success", message: "bad", data: { link: "x" } }],
    ["statut non success", {}, { status: "error", message: "refus" }],
    ["lien absent", {}, { status: "success", message: "sans lien" }],
  ])("lève et journalise un échec d'initiation (%s)", async (_label, init, body) => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse(body, init));
    await expect(flw.initiatePayment(1, "XOF", "e", "R", {})).rejects.toThrow(`Flutterwave initiation failed: ${(body as { message: string }).message}`);
    expect(logger.error).toHaveBeenCalledWith("[Flutterwave] Échec initiation paiement", expect.any(Error), { reference: "R", amount: 1, currency: "XOF" });
  });

  it.each([
    ["successful", "SUCCESS"],
    ["failed", "FAILED"],
    ["pending", "PENDING"],
  ])("traduit le statut Flutterwave %s en %s", async (flwStatus, expected) => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    const data = { id: 1, status: flwStatus };
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok", data }));
    expect(await flw.verifyPayment("REF 1")).toEqual({ status: expected, rawData: data });
    expect(fetchCall(0)[0]).toBe("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=REF%201");
  });

  it("se replie sur la vérification par identifiant numérique", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "error" }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok", data: { status: "successful" } }));
    expect((await flw.verifyPayment("12345")).status).toBe("SUCCESS");
    expect(fetchCall(1)[0]).toBe("https://api.flutterwave.com/v3/transactions/12345/verify");
  });

  it("reste PENDING (et journalise) si la vérification échoue", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "error", message: "introuvable" }, { ok: false, status: 404 }));
    const res = await flw.verifyPayment("REF-X");
    expect(res).toEqual({ status: "PENDING", rawData: { status: "error", message: "introuvable" } });
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas de repli pour une référence non numérique
    expect(logger.warn).toHaveBeenCalledWith("[Flutterwave] Vérification paiement échouée", { transactionId: "REF-X", message: "introuvable" });
  });

  it("reste PENDING quand l'API répond 200 mais sans succès, et sans données", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "error", message: "x" }));
    expect((await flw.verifyPayment("R")).status).toBe("PENDING");
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "success", message: "ok" }));
    expect(await flw.verifyPayment("R")).toEqual({ status: "PENDING", rawData: undefined });
  });
});

describe("PaystackProvider", () => {
  const ps = new PaystackProvider();

  it("exige la clé secrète", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    await expect(ps.initiatePayment(1, "NGN", "e", "R", {})).rejects.toThrow("PAYSTACK_SECRET_KEY non configurée");
  });

  it("initie un paiement en centimes avec URL de retour et d'annulation", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test";
    process.env.NEXT_PUBLIC_APP_URL = "https://ecole.bj";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: true, message: "ok", data: { authorization_url: "https://ps/a" } }));
    const res = await ps.initiatePayment(12.345, "", "p@x.bj", "R-9", { classe: "6e" });
    expect(res).toEqual({ paymentUrl: "https://ps/a", transactionId: "R-9" });
    const [url, init] = fetchCall(0);
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "p@x.bj",
      amount: 1235,
      currency: "NGN",
      reference: "R-9",
      callback_url: "https://ecole.bj/api/payments/reconcile?ref=R-9",
      metadata: { classe: "6e", cancel_action: "https://ecole.bj/dashboard/finance" },
    });
  });

  it("utilise l'URL locale par défaut", async () => {
    process.env.PAYSTACK_SECRET_KEY = "k";
    delete process.env.NEXT_PUBLIC_APP_URL;
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: true, message: "ok", data: { authorization_url: "u" } }));
    await ps.initiatePayment(1, "XOF", "e", "R", {});
    expect(JSON.parse(fetchCall(0)[1].body as string).callback_url).toBe("http://localhost:3000/api/payments/reconcile?ref=R");
  });

  it.each([
    ["HTTP en erreur", { ok: false }, { status: true, message: "m1", data: { authorization_url: "u" } }],
    ["status false", {}, { status: false, message: "m2" }],
    ["URL absente", {}, { status: true, message: "m3", data: {} }],
  ])("lève et journalise un échec d'initiation (%s)", async (_l, init, body) => {
    process.env.PAYSTACK_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse(body, init));
    await expect(ps.initiatePayment(1, "NGN", "e", "R", {})).rejects.toThrow(`Paystack initiation failed: ${body.message}`);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["success", "SUCCESS"],
    ["failed", "FAILED"],
    ["abandoned", "FAILED"],
    ["pending", "PENDING"],
  ])("traduit le statut Paystack %s en %s", async (psStatus, expected) => {
    process.env.PAYSTACK_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: true, message: "ok", data: { status: psStatus } }));
    expect((await ps.verifyPayment("R/1")).status).toBe(expected);
    expect(fetchCall(0)[0]).toBe("https://api.paystack.co/transaction/verify/R%2F1");
  });

  it("reste PENDING et journalise si la vérification échoue", async () => {
    process.env.PAYSTACK_SECRET_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: false, message: "nope" }));
    expect(await ps.verifyPayment("R")).toEqual({ status: "PENDING", rawData: { status: false, message: "nope" } });
    expect(logger.warn).toHaveBeenCalledWith("[Paystack] Vérification paiement échouée", { transactionId: "R", message: "nope" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: true, message: "x" }, { ok: false }));
    expect((await ps.verifyPayment("R")).status).toBe("PENDING");
  });
});

describe("FedaPayProvider", () => {
  const fp = new FedaPayProvider();

  it("refuse d'initier sans clé FedaPay", async () => {
    delete process.env.FEDAPAY_SECRET_KEY;
    await expect(fp.initiatePayment(1, "XOF", "e", "R", {})).rejects.toThrow("FEDAPAY_SECRET_KEY non configurée");
    expect(feda.create).not.toHaveBeenCalled();
  });

  it("crée le checkout en scindant prénom / nom et encode la référence de retour", async () => {
    process.env.FEDAPAY_SECRET_KEY = "sk";
    process.env.NEXT_PUBLIC_APP_URL = "https://ecole.bj";
    feda.create.mockResolvedValueOnce({ id: 77, generateToken: async () => ({ token: "t", url: "https://feda/pay" }) });
    const res = await fp.initiatePayment(5000, "XOF", "p@x.bj", "R&1", {
      studentName: "  Awa  Marie Kossi ",
      phone: "0190000000",
      description: "Scolarité",
    });
    expect(res).toEqual({ paymentUrl: "https://feda/pay", transactionId: "77" });
    expect(feda.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Scolarité",
        callback_url: "https://ecole.bj/api/payments/reconcile?ref=R%261",
        merchant_reference: "R&1",
        customer: expect.objectContaining({
          firstname: "Awa",
          lastname: "Marie Kossi",
          phone_number: { number: "0190000000", country: "bj" },
        }),
      }),
    );
  });

  it("gère un nom unique, l'absence de nom et les valeurs par défaut", async () => {
    process.env.FEDAPAY_SECRET_KEY = "sk";
    delete process.env.NEXT_PUBLIC_APP_URL;
    feda.create.mockResolvedValue({ id: 1, generateToken: async () => ({ token: "t", url: "u" }) });
    await fp.initiatePayment(1, "XOF", "e", "R", { studentName: "Awa" });
    let arg = feda.create.mock.calls[0][0] as { customer: Record<string, unknown>; description: string; callback_url: string };
    expect(arg.customer).toMatchObject({ firstname: "Awa", lastname: "—" });
    expect(arg.customer.phone_number).toBeUndefined();
    expect(arg.description).toBe("Frais scolaires EduPilot");
    expect(arg.callback_url).toBe("http://localhost:3000/api/payments/reconcile?ref=R");

    await fp.initiatePayment(1, "XOF", "e", "R", undefined as never);
    arg = feda.create.mock.calls[1][0] as typeof arg;
    expect(arg.customer).toMatchObject({ firstname: "EduPilot", lastname: "Élève" });
  });

  it("vérifie une transaction via le SDK et mappe son statut", async () => {
    process.env.FEDAPAY_SECRET_KEY = "sk";
    process.env.FEDAPAY_ENVIRONMENT = "live";
    feda.retrieve.mockResolvedValueOnce({ id: 9, status: "approved" });
    expect(await fp.verifyPayment("9")).toEqual({ status: "SUCCESS", rawData: { id: 9, status: "approved" } });
    expect(feda.setApiKey).toHaveBeenCalledWith("sk");
    expect(feda.setEnvironment).toHaveBeenCalledWith("live");
  });

  it("retrieveFedaPayTransaction : statut déclinée → FAILED, en sandbox par défaut", async () => {
    delete process.env.FEDAPAY_ENVIRONMENT;
    feda.retrieve.mockResolvedValueOnce({ status: "declined" });
    expect(await retrieveFedaPayTransaction("3")).toEqual({ status: "FAILED", raw: { status: "declined" } });
    expect(feda.retrieve).toHaveBeenCalledWith("3");
    expect(feda.setEnvironment).toHaveBeenCalledWith("sandbox");
  });
});

describe("MomoProvider", () => {
  async function freshMomo() {
    vi.resetModules();
    const mod = await import("@/lib/finance/providers/momo");
    return new mod.MomoProvider();
  }
  function configure() {
    process.env.MOMO_SUBSCRIPTION_KEY = "sub";
    process.env.MOMO_API_USER = "user";
    process.env.MOMO_API_KEY = "key";
  }

  it("refuse toute opération sans configuration MoMo", async () => {
    delete process.env.MOMO_API_KEY;
    const momo = await freshMomo();
    await expect(momo.verifyPayment("x")).rejects.toThrow("non configurée");
    await expect(momo.initiatePayment(1, "XOF", "e", "R", { phone: "229" })).rejects.toThrow("non configurée");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exige le numéro du payeur", async () => {
    configure();
    const momo = await freshMomo();
    await expect(momo.initiatePayment(1, "XOF", "e", "R", {})).rejects.toThrow("Numéro du payeur requis");
  });

  it("signale un échec d'authentification OAuth", async () => {
    configure();
    const momo = await freshMomo();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }));
    await expect(momo.verifyPayment("tx")).rejects.toThrow("Échec d'authentification (401)");
  });

  it("requestToPay refusé : erreur explicite avec extrait du corps journalisé", async () => {
    configure();
    const momo = await freshMomo();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "x".repeat(500) });
    await expect(momo.initiatePayment(1000, "XOF", "e", "R-1", { phone: "+229 01 02" })).rejects.toThrow("requestToPay refusé (400)");
    const meta = vi.mocked(logger.error).mock.calls[0][2] as { reference: string; body: string };
    expect(meta.reference).toBe("R-1");
    expect(meta.body).toHaveLength(300);
    // Le numéro est normalisé (espaces et « + » retirés).
    expect(JSON.parse(fetchCall(1)[1].body as string).payer).toEqual({ partyIdType: "MSISDN", partyId: "2290102" });
  });

  it("requestToPay refusé et corps illisible : corps vide journalisé", async () => {
    configure();
    const momo = await freshMomo();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => { throw new Error("stream"); } });
    await expect(momo.initiatePayment(1, "", "e", "R", { phone: "229" })).rejects.toThrow("(500)");
    expect((vi.mocked(logger.error).mock.calls[0][2] as { body: string }).body).toBe("");
  });

  it("vérification : une erreur HTTP laisse le paiement en attente", async () => {
    configure();
    const momo = await freshMomo();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));
    expect(await momo.verifyPayment("tx-1")).toEqual({ status: "PENDING", rawData: { httpStatus: 503 } });
    expect(fetchCall(1)[0]).toBe("https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/tx-1");
  });
});
