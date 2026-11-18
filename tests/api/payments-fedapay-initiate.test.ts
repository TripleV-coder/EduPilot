import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// S7 : compte marchand de l'école du frais (résolution et client testés sur une
// vraie base : integration-db/school-payment-accounts)
vi.mock("@/lib/payments/school-accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments/school-accounts")>()),
  resolveCollectingAccount: vi.fn(),
}));
vi.mock("@/lib/payments/fedapay-account-client", () => ({ createAccountCheckout: vi.fn() }));
// L3 : `@/lib/rate-limit` est désormais le module unique (limiteurs, clés,
// mappage de routes, identifiant client). Mock PARTIEL : seule la fonction
// contrôlée par ce test est remplacée, tout le reste garde son code réel.
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { resolveCollectingAccount } from "@/lib/payments/school-accounts";
import { createAccountCheckout as createFedaPayCheckout } from "@/lib/payments/fedapay-account-client";

const credentials = { accountId: "acct-a", environment: "SANDBOX" as const, secretKey: "sk_sandbox_synthetique" };
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/payments/fedapay/initiate/route";

const paymentId = cuid("pmt1");

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    amount: 50000,
    status: "PENDING",
    reference: "EDU-ref1",
    createdAt: new Date(),
    studentId: FIXTURES.studentA,
    student: { schoolId: FIXTURES.schoolA },
    fee: { name: "Scolarité T1", schoolId: FIXTURES.schoolA },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveCollectingAccount).mockResolvedValue({ ok: true, account: { id: "acct-a", schoolId: FIXTURES.schoolA } as never, credentials });
  vi.mocked(checkRateLimit).mockResolvedValue({
    success: true,
    remaining: 19,
    reset: new Date(),
  });
  vi.mocked(createFedaPayCheckout).mockResolvedValue({
    url: "https://checkout.fedapay.sandbox/x",
    token: "tok_1",
    transactionId: "42",
  });
});

describe("POST /api/payments/fedapay/initiate", () => {
  function post(body: Record<string, unknown>) {
    return POST(makeRequest("http://localhost:3000/api/payments/fedapay/initiate", {
      method: "POST",
      body,
    }));
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ paymentId });
    expect(res.status).toBe(401);
  });

  it("école du frais sans compte marchand actif : 503, rien d'attribué, aucun appel FedaPay (S7)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ firstName: "Awa", lastName: "Dossou", email: "awa@school.bj" } as never);
    vi.mocked(resolveCollectingAccount).mockResolvedValue({ ok: false, reason: "NO_ACTIVE_ACCOUNT" });
    const res = await post({ paymentId });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("ONLINE_PAYMENT_UNAVAILABLE");
    expect(resolveCollectingAccount).toHaveBeenCalledWith(prisma, FIXTURES.schoolA);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("retourne 429 en cas de rate limit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      reset: new Date(),
    });
    const res = await post({ paymentId });
    expect(res.status).toBe(429);
  });

  it("rejette un paymentId invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await post({ paymentId: "bad-id" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 404 si le paiement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Paiement introuvable");
  });

  it("bloque une initiation cross-tenant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      paymentRecord({ student: { schoolId: FIXTURES.schoolB } })
    );
    const res = await post({ paymentId });
    expect(res.status).toBe(403);
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("refuse à un PARENT un paiement d'un enfant non lié (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentB }],
    } as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(403);
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("rejette un paiement non PENDING (409)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      paymentRecord({ status: "VERIFIED" })
    );
    const res = await post({ paymentId });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ce paiement n'est pas en attente.");
  });

  it("exige un email de payeur (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: null,
    } as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Email du payeur requis pour le paiement en ligne.");
  });

  it("initie le checkout FedaPay et met à jour la référence du paiement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: "awa@school.bj",
    } as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id: paymentId } as never);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await post({ paymentId });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.fedapay.sandbox/x");
    expect(body.reference).toBe("EDU-ref1");
    expect(createFedaPayCheckout).toHaveBeenCalledWith(
      credentials,
      expect.objectContaining({
        amount: 50000,
        reference: "EDU-ref1",
        customer: { firstname: "Awa", lastname: "Dossou", email: "awa@school.bj" },
      })
    );
    // Prise conditionnelle (S3) : seul un paiement confié à aucun fournisseur est attribué à FedaPay
    const claimArgs = vi.mocked(prisma.payment.updateMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: { reference: string; method: string };
    };
    expect(claimArgs.where).toEqual({ id: paymentId, status: "PENDING", provider: null });
    expect(claimArgs.data.method).toBe("MOBILE_MONEY_MTN");
    expect(claimArgs.data.reference).toBe("EDU-ref1");
    expect(claimArgs.data).toMatchObject({ provider: "FEDAPAY", paymentAccountId: "acct-a" });
    // Identifiant FedaPay rangé pour la réconciliation à 24 h
    const idArgs = vi.mocked(prisma.payment.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(idArgs.data).toHaveProperty("providerTransactionId");
  });

  it("refuse de relancer une demande de plus de 24 h (409, aucun appel FedaPay)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      paymentRecord({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
    );

    const res = await post({ paymentId });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PAYMENT_EXPIRED");
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("enregistre la référence AVANT de créer la transaction chez FedaPay (arrêt brutal)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: "awa@school.bj",
    } as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id: paymentId } as never);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    await post({ paymentId });

    // Si le processus s'arrête juste après la création chez FedaPay, le
    // webhook (merchant_reference) doit déjà retrouver le paiement.
    const updateOrder = vi.mocked(prisma.payment.updateMany).mock.invocationCallOrder[0];
    const checkoutOrder = vi.mocked(createFedaPayCheckout).mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(checkoutOrder);
  });

  // Audit (arrêts brutaux) : ce test exigeait qu'aucune référence ne soit
  // enregistrée quand FedaPay échoue — l'ordre « appel puis écriture » qui
  // rend irrécupérable un arrêt survenant entre les deux. La référence est
  // déterministe et le paiement reste PENDING : l'enregistrer d'abord est sans
  // effet si l'appel échoue, et garantit le rapprochement s'il réussit.
  it("retourne 502 quand FedaPay échoue, paiement toujours en attente", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: "awa@school.bj",
    } as never);
    vi.mocked(createFedaPayCheckout).mockRejectedValue(new Error("fedapay down"));
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await post({ paymentId });

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(
      "Échec de l'initialisation du paiement. Réessayez."
    );
    const claimArgs = vi.mocked(prisma.payment.updateMany).mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(claimArgs?.data).toEqual({ reference: "EDU-ref1", method: "MOBILE_MONEY_MTN", provider: "FEDAPAY", paymentAccountId: "acct-a" });
    // Résultat inconnu (lot 3b) : l'essai reste PENDING, repéré par une note, sans changement de statut
    const marked = vi.mocked(prisma.payment.updateMany).mock.calls[1]?.[0] as { where: unknown; data: Record<string, unknown> };
    expect(marked.where).toEqual({ id: paymentId, status: "PENDING" });
    expect(marked.data).not.toHaveProperty("status");
    expect(String(marked.data.notes)).toContain("Résultat de l'initialisation inconnu");
  });

  // S3 : un paiement déjà confié à un fournisseur n'est ni réattribué à FedaPay ni recréé chez lui
  it.each([
    ["MOMO", "PAYMENT_PROVIDER_CONFLICT"],
    ["FEDAPAY", "PAYMENT_ALREADY_STARTED"],
  ])("paiement déjà confié à %s : 409 %s, aucune transaction FedaPay, rien de modifié", async (provider, code) => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord({ provider }));

    const res = await post({ paymentId });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe(code);
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("deux lancements simultanés : la prise conditionnelle perdue renvoie 409 sans appeler FedaPay", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique)
      .mockResolvedValueOnce(paymentRecord())
      .mockResolvedValueOnce({ provider: "FEDAPAY", notes: null } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ firstName: "Awa", lastName: "Dossou", email: "awa@school.bj" } as never);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await post({ paymentId });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PAYMENT_ALREADY_STARTED");
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });
});
