import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { GET, POST } from "@/app/api/finance/payments/route";
import { PUT, DELETE } from "@/app/api/finance/payments/[id]/route";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Modèles lus : user (filtre école du GET), payment, studentProfile + fee
// (contrôle multi-tenant du POST), paymentPlan (ledger via syncPaymentPlanLedger).
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    user: { findUnique: vi.fn() },
    payment: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    fee: { findUnique: vi.fn() },
    paymentPlan: { findFirst: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";

const paymentId = cuid("payment1");
const ACCOUNTANT = makeSession("ACCOUNTANT");

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    amount: 50000,
    method: "CASH",
    status: "VERIFIED",
    createdAt: new Date("2026-01-10"),
    student: { user: { firstName: "Awa", lastName: "Dossou" } },
    fee: { id: FIXTURES.feeA, name: "Scolarité T1", amount: 100000 },
    ...overrides,
  };
}

beforeEach(async () => {
  // resetAllMocks (et non clearAllMocks) : restore l'implémentation par défaut de
  // $transaction, sinon un mockRejectedValue posé par un test précédent pollue les suivants.
  vi.resetAllMocks();
  // invalidateByPath (fallback in-memory) persiste entre les tests : purge.
  await invalidateCache("api:*");
});

describe("GET /api/finance/payments", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/payments"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/finance/payments"));
    expect(res.status).toBe(403);
  });

  it("rejette une plage de dates invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    const res = await GET(makeRequest("http://localhost/api/finance/payments?startDate=zzz"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Plage de dates invalide");
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("liste les paiements paginés de l'école (data + meta)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([paymentRecord()] as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);

    const res = await GET(
      makeRequest("http://localhost/api/finance/payments?page=1&pageSize=20")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
    // Isolation tenant : filtre école posé via la relation fee
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0].where.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });
  });

  it("applique pagination et filtres studentId/feeId/method/status", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);

    await GET(
      makeRequest(
        `http://localhost/api/finance/payments?page=2&pageSize=5&studentId=${FIXTURES.studentA}&feeId=${FIXTURES.feeA}&method=CASH&status=VERIFIED`
      )
    );

    const args = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
      skip: number;
      take: number;
    };
    expect(args.where).toMatchObject({
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      method: "CASH",
      status: "VERIFIED",
    });
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/payments"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/finance/payments", () => {
  const validBody = {
    studentId: FIXTURES.studentA,
    feeId: FIXTURES.feeA,
    amount: 50000,
    method: "CASH",
  };

  it("refuse un rôle non autorisé (STUDENT, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST(makeRequest("http://localhost/api/finance/payments", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("retourne 400 VALIDATION_ERROR sur un body invalide, sans paiement créé (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    const res = await POST(
      makeRequest("http://localhost/api/finance/payments", { method: "POST", body: { amount: 50000 } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("bloque un étudiant hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      user: { schoolId: FIXTURES.schoolB },
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);

    const res = await POST(makeRequest("http://localhost/api/finance/payments", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Étudiant introuvable ou hors périmètre");
  });

  it("bloque un frais hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);

    const res = await POST(makeRequest("http://localhost/api/finance/payments", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Frais introuvable ou hors périmètre");
  });

  it("crée le paiement VERIFIED (201) et synchronise le ledger", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.payment.create).mockResolvedValue(paymentRecord() as never);
    // Pas de plan actif : la synchro du ledger s'arrête sur findFirst null
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null as never);

    const res = await POST(makeRequest("http://localhost/api/finance/payments", { method: "POST", body: validBody }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(paymentId);
    expect(vi.mocked(prisma.payment.create).mock.calls[0][0].data).toMatchObject({
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      amount: 50000,
      method: "CASH",
      status: "VERIFIED",
      receivedBy: ACCOUNTANT.user!.id,
    });
    expect(prisma.paymentPlan.findFirst).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de transaction", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("http://localhost/api/finance/payments", { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/finance/payments/[id]", () => {
  function existingPayment(overrides: Record<string, unknown> = {}) {
    return {
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      paidAt: null,
      status: "PENDING",
      student: { user: { schoolId: FIXTURES.schoolA } },
      fee: { schoolId: FIXTURES.schoolA },
      ...overrides,
    };
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: {} }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: {} }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le paiement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null as never);
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: { amount: 60000 } }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Payment not found");
  });

  it("bloque la modification cross-tenant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      existingPayment({ student: { user: { schoolId: FIXTURES.schoolB } } }) as never
    );
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: { amount: 60000 } }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("verrouille un paiement déjà VERIFIED (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment({ status: "VERIFIED" }) as never);
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: { amount: 60000 } }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("verrouillé");
  });

  it("met à jour le paiement et resynchronise le ledger (200)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment() as never);
    vi.mocked(prisma.payment.update).mockResolvedValue(paymentRecord({ amount: 60000, status: "PENDING" }) as never);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null as never);

    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: { amount: 60000 } }), {
      params: Promise.resolve({ id: paymentId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(paymentId);
    expect(vi.mocked(prisma.payment.update).mock.calls[0][0]).toMatchObject({
      where: { id: paymentId },
      data: { amount: 60000 },
    });
    expect(prisma.paymentPlan.findFirst).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment() as never);
    vi.mocked(prisma.payment.update).mockRejectedValue(new Error("db down"));
    const res = await PUT(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "PUT", body: { amount: 60000 } }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});

describe("DELETE /api/finance/payments/[id]", () => {
  function existingPayment(overrides: Record<string, unknown> = {}) {
    return {
      amount: 50000,
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      status: "PENDING",
      student: { user: { schoolId: FIXTURES.schoolA } },
      fee: { schoolId: FIXTURES.schoolA },
      ...overrides,
    };
  }

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le paiement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null as never);
    const res = await DELETE(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(404);
  });

  it("verrouille un paiement déjà VERIFIED (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment({ status: "VERIFIED" }) as never);
    const res = await DELETE(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("déjà vérifié");
  });

  it("annule (soft-cancel) le paiement en transaction (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment() as never);
    vi.mocked(prisma.payment.update).mockResolvedValue(paymentRecord({ status: "CANCELLED" }) as never);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null as never);

    const res = await DELETE(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: paymentId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Le tx du $transaction reçoit le prismaMock : l'update passe par le même vi.fn
    expect(vi.mocked(prisma.payment.update).mock.calls[0][0]).toEqual({
      where: { id: paymentId },
      data: { status: "CANCELLED" },
    });
    expect(prisma.paymentPlan.findFirst).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existingPayment() as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db down"));
    const res = await DELETE(makeRequest(`http://localhost/api/finance/payments/${paymentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: paymentId }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});