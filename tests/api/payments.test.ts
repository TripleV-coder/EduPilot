import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, any> = {
    payment: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    parentProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
    fee: { findUnique: vi.fn() },
    paymentPlan: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    installmentPayment: { update: vi.fn(), findMany: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { GET, POST } from "@/app/api/payments/route";
import {
  GET as GET_BY_ID,
  PATCH as PATCH_BY_ID,
  DELETE as DELETE_BY_ID,
} from "@/app/api/payments/[id]/route";
import { POST as POST_CASH } from "@/app/api/payments/cash/route";

const paymentId = cuid("payment1");

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    amount: 50000,
    paidAt: new Date("2026-01-10"),
    status: "VERIFIED",
    method: "CASH",
    reference: "REF-001",
    student: { id: FIXTURES.studentA, user: { firstName: "Awa", lastName: "Dossou" } },
    fee: { id: FIXTURES.feeA, name: "Scolarité T1", amount: 100000 },
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Le fallback cache in-memory persiste entre les tests : purge obligatoire.
  await invalidateCache("api:*");
});

describe("GET /api/payments", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(makeRequest("http://localhost:3000/api/payments"));
    expect(response.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await GET(makeRequest("http://localhost:3000/api/payments"));
    expect(response.status).toBe(403);
  });

  it("retourne la liste paginée pour un ACCOUNTANT et sert le cache au 2e appel", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([paymentRecord()] as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);

    const first = await GET(makeRequest("http://localhost:3000/api/payments"));
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.pagination.total).toBe(1);
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(first.headers.get("ETag")).toBeDefined();
    // Isolation tenant : le filtre école est appliqué via la relation fee
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0].where.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });

    const second = await GET(makeRequest("http://localhost:3000/api/payments"));
    expect(second.headers.get("X-Cache")).toBe("HIT");
    // Le cache a servi la réponse : pas de requête DB supplémentaire
    expect(vi.mocked(prisma.payment.findMany)).toHaveBeenCalledTimes(1);
  });

  it("restreint un PARENT aux paiements de ses enfants", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([paymentRecord()] as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);

    const response = await GET(makeRequest("http://localhost:3000/api/payments"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0].where.studentId).toEqual({
      in: [FIXTURES.studentA],
    });
  });

  it("refuse à un PARENT le studentId d'un enfant non lié (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as any);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/payments?studentId=${FIXTURES.studentB}`)
    );

    expect(response.status).toBe(403);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();

    // Régression cache-helpers : une réponse d'erreur ne doit jamais être
    // mise en cache ni ré-encapsulée en 200.
    const second = await GET(
      makeRequest(`http://localhost:3000/api/payments?studentId=${FIXTURES.studentB}`)
    );
    expect(second.status).toBe(403);
    expect(second.headers.get("X-Cache")).toBeFalsy();
  });
});

describe("POST /api/payments", () => {
  const validBody = {
    studentId: FIXTURES.studentA,
    feeId: FIXTURES.feeA,
    amount: 50000,
    method: "CASH",
  };

  it("refuse un rôle non autorisé (STUDENT)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payments", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("retourne 404 si le frais n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue(null);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payments", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(404);
  });

  it("bloque l'enregistrement cross-tenant (frais d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeB,
      schoolId: FIXTURES.schoolB,
      amount: 100000,
    } as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payments", {
        method: "POST",
        body: { ...validBody, feeId: FIXTURES.feeB },
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("crée le paiement (201) et synchronise le plan de paiement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
      amount: 100000,
    } as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
    } as any);
    vi.mocked(prisma.payment.create).mockResolvedValue(paymentRecord() as any);
    // Pas de plan de paiement actif : la synchro du ledger s'arrête là
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payments", { method: "POST", body: validBody })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(paymentId);
    expect(vi.mocked(prisma.payment.create).mock.calls[0][0].data).toMatchObject({
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      amount: 50000,
      status: "VERIFIED",
    });
    expect(prisma.paymentPlan.findFirst).toHaveBeenCalled();
  });
});

describe("GET /api/payments/[id] — anti-IDOR", () => {
  it("un PARENT ne peut pas lire le paiement d'un enfant non lié (404 indistinguable)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);

    const response = await GET_BY_ID(makeRequest(`http://localhost:3000/api/payments/${paymentId}`), {
      params: Promise.resolve({ id: paymentId }),
    });

    expect(response.status).toBe(404);
    // La contrainte de propriété est DANS le where : l'objet hors périmètre n'est jamais lu
    expect(vi.mocked(prisma.payment.findFirst).mock.calls[0][0].where).toMatchObject({
      id: paymentId,
      studentId: { in: [FIXTURES.studentA] },
    });
  });

  it("un STUDENT n'accède qu'à ses propres paiements (filtre userId)", async () => {
    const session = makeSession("STUDENT");
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(paymentRecord() as any);

    const response = await GET_BY_ID(makeRequest(`http://localhost:3000/api/payments/${paymentId}`), {
      params: Promise.resolve({ id: paymentId }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.payment.findFirst).mock.calls[0][0].where).toMatchObject({
      id: paymentId,
      student: { userId: session.user!.id },
    });
  });

  it("un ACCOUNTANT est limité aux écoles accessibles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(paymentRecord() as any);

    await GET_BY_ID(makeRequest(`http://localhost:3000/api/payments/${paymentId}`), {
      params: Promise.resolve({ id: paymentId }),
    });

    expect(vi.mocked(prisma.payment.findFirst).mock.calls[0][0].where).toMatchObject({
      student: { user: { schoolId: { in: [FIXTURES.schoolA] } } },
    });
  });
});

describe("PATCH /api/payments/[id]", () => {
  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);

    const response = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/payments/${paymentId}`, {
        method: "PATCH",
        body: { amount: 60000 },
      }),
      { params: Promise.resolve({ id: paymentId }) }
    );
    expect(response.status).toBe(403);
  });

  it("bloque la modification cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      ...paymentRecord(),
      studentId: FIXTURES.studentB,
      feeId: FIXTURES.feeB,
      student: { user: { schoolId: FIXTURES.schoolB } },
    } as any);

    const response = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/payments/${paymentId}`, {
        method: "PATCH",
        body: { amount: 60000 },
      }),
      { params: Promise.resolve({ id: paymentId }) }
    );

    expect(response.status).toBe(403);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("rejette un body invalide avec 400 + détails Zod", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      ...paymentRecord(),
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      student: { user: { schoolId: FIXTURES.schoolA } },
    } as any);

    const response = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/payments/${paymentId}`, {
        method: "PATCH",
        body: { amount: -5 },
      }),
      { params: Promise.resolve({ id: paymentId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toBeDefined();
  });
});

describe("DELETE /api/payments/[id]", () => {
  it("refuse un ACCOUNTANT (réservé SUPER_ADMIN/SCHOOL_ADMIN)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);

    const response = await DELETE_BY_ID(
      makeRequest(`http://localhost:3000/api/payments/${paymentId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: paymentId }) }
    );
    expect(response.status).toBe(403);
  });

  it("annule (soft-cancel) au lieu de supprimer physiquement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      ...paymentRecord(),
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      student: { user: { schoolId: FIXTURES.schoolA } },
    } as any);
    vi.mocked(prisma.payment.update).mockResolvedValue(paymentRecord({ status: "CANCELLED" }) as any);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);

    const response = await DELETE_BY_ID(
      makeRequest(`http://localhost:3000/api/payments/${paymentId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: paymentId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(vi.mocked(prisma.payment.update).mock.calls[0][0].data).toEqual({ status: "CANCELLED" });
  });
});

describe("POST /api/payments/cash", () => {
  const validBody = {
    studentId: FIXTURES.studentA,
    feeId: FIXTURES.feeA,
    amount: 10000,
    method: "CASH",
  };

  function mockStudentAndFee() {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
    } as any);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
    } as any);
  }

  it("rejette un mode de paiement non manuel (MOBILE_MONEY_MTN)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);

    const response = await POST_CASH(
      makeRequest("http://localhost:3000/api/payments/cash", {
        method: "POST",
        body: { ...validBody, method: "MOBILE_MONEY_MTN" },
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejette un montant qui dépasse le solde restant du plan", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    mockStudentAndFee();
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      totalAmount: 100000,
      paidAmount: 95000,
    } as any);

    const response = await POST_CASH(
      makeRequest("http://localhost:3000/api/payments/cash", {
        method: "POST",
        body: { ...validBody, amount: 10000 },
      })
    );

    expect(response.status).toBe(400);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("encaisse et passe le plan à COMPLETED quand le total est couvert", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    mockStudentAndFee();
    const dueDate = new Date("2026-01-01");
    // 1er findFirst : contrôle du solde restant — 2e : synchro du ledger
    vi.mocked(prisma.paymentPlan.findFirst)
      .mockResolvedValueOnce({ totalAmount: 100000, paidAmount: 90000 } as any)
      .mockResolvedValueOnce({
        id: cuid("plan1"),
        totalAmount: 100000,
        paidAmount: 90000,
        fee: { dueDate: null },
        installmentPayments: [
          { id: cuid("inst1"), amount: 100000, dueDate, status: "PENDING" },
        ],
      } as any);
    vi.mocked(prisma.payment.create).mockResolvedValue(paymentRecord({ amount: 10000 }) as any);
    // Paiements vérifiés cumulés : 100 000 = totalAmount → plan soldé
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { amount: 90000, paidAt: new Date("2026-01-05"), createdAt: new Date("2026-01-05") },
      { amount: 10000, paidAt: new Date("2026-01-10"), createdAt: new Date("2026-01-10") },
    ] as any);
    vi.mocked(prisma.installmentPayment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.installmentPayment.findMany).mockResolvedValue([
      { id: cuid("inst1"), amount: 100000, dueDate, paidAt: new Date("2026-01-10"), status: "PAID" },
    ] as any);
    vi.mocked(prisma.paymentPlan.update).mockResolvedValue({} as any);

    const response = await POST_CASH(
      makeRequest("http://localhost:3000/api/payments/cash", {
        method: "POST",
        body: { ...validBody, amount: 10000 },
      })
    );

    expect(response.status).toBe(200);
    // L'échéance couverte par les paiements passe à PAID
    expect(vi.mocked(prisma.installmentPayment.update).mock.calls[0][0].data.status).toBe("PAID");
    // Le plan est soldé : paidAmount = 100 000, statut COMPLETED
    expect(vi.mocked(prisma.paymentPlan.update).mock.calls[0][0].data).toMatchObject({
      paidAmount: 100000,
      status: "COMPLETED",
    });
  });

  it("bloque un encaissement cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentB,
      schoolId: FIXTURES.schoolB,
    } as any);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeB,
      schoolId: FIXTURES.schoolB,
    } as any);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);

    const response = await POST_CASH(
      makeRequest("http://localhost:3000/api/payments/cash", {
        method: "POST",
        body: { ...validBody, studentId: FIXTURES.studentB, feeId: FIXTURES.feeB },
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
