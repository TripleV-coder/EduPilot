import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findMany: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn((promises: unknown[]) =>
      Promise.all(promises as Promise<unknown>[])
    ),
  },
}));

import prisma from "@/lib/prisma";
import { POST, GET } from "@/app/api/payments/reconcile/route";

const p1 = cuid("pay1");
const p2 = cuid("pay2");

function verifiedPayment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: "VERIFIED",
    amount: 10000,
    paidAt: new Date("2026-01-01"),
    fee: { schoolId: FIXTURES.schoolA },
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/payments/reconcile", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));
    expect(res.status).toBe(403);
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1], schoolId: FIXTURES.schoolB },
    }));
    expect(res.status).toBe(403);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("rejette un body sans paymentIds (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: {},
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("IDs de paiement requis");
  });

  it("réconcilie une liste de paiements VERIFIED", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      verifiedPayment(p1),
      verifiedPayment(p2),
    ]);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id: p1 } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1, p2], notes: "rapprochement bancaire" },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    const arg = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; reconciledAt: Date; reconciledBy: string; notes: string };
    };
    expect(arg.where.id).toBe(p1);
    expect(arg.data.status).toBe("RECONCILED");
    expect(arg.data.notes).toBe("rapprochement bancaire");
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
  });

  it("bloque si un paiement appartient à une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      verifiedPayment(p1),
      verifiedPayment(p2, { fee: { schoolId: FIXTURES.schoolB } }),
    ]);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1, p2] },
    }));

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejette un paiement non VERIFIED (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      verifiedPayment(p1, { status: "PENDING" }),
    ]);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("réconcilie en masse via reconcileAllVerified", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.payment.findMany).mockResolvedValue([verifiedPayment(p1)]);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id: p1 } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { reconcileAllVerified: true, schoolId: FIXTURES.schoolA },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    const where = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as {
      where: { status: string; reconciledAt: null; fee: { schoolId: string } };
    };
    expect(where.where.status).toBe("VERIFIED");
    expect(where.where.fee.schoolId).toBe(FIXTURES.schoolA);
  });

  it("répond sans rien faire quand aucun paiement à réconcilier en masse", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { reconcileAllVerified: true, schoolId: FIXTURES.schoolA },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("exige un schoolId pour la réconciliation en masse SUPER_ADMIN (400)", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { reconcileAllVerified: true },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID d'établissement requis");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la réconciliation des paiements");
  });
});

describe("GET /api/payments/reconcile", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/payments/reconcile"));
    expect(res.status).toBe(401);
  });

  it("exige un schoolId pour un compte non-root, quel que soit le rôle (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost:3000/api/payments/reconcile"));
    expect(res.status).toBe(400);
  });

  it("exige un schoolId pour un compte non root (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await GET(makeRequest("http://localhost:3000/api/payments/reconcile"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID d'établissement requis");
  });

  // Audit M5 : le résumé (nombre, montant total) était calculé sur la liste
  // complète chargée en mémoire ; la liste est désormais paginée et le résumé
  // calculé par PostgreSQL sur tout le périmètre (aggregate). Mêmes valeurs
  // simulées (2 paiements, 20 000), mêmes assertions.
  it("liste les paiements non réconciliés de l'école active", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      verifiedPayment(p1),
      verifiedPayment(p2),
    ]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _count: { _all: 2 }, _sum: { amount: 20000 } } as never);

    const res = await GET(
      makeRequest("http://localhost:3000/api/payments/reconcile?schoolId=" + FIXTURES.schoolA)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payments).toHaveLength(2);
    expect(body.summary).toMatchObject({ count: 2, totalAmount: 20000, status: "VERIFIED" });
    const where = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as {
      where: { status: string; reconciledAt: null; fee: { schoolId: string } };
    };
    expect(where.where.fee.schoolId).toBe(FIXTURES.schoolA);
    expect(where.where.reconciledAt).toBeNull();
  });

  it("un SUPER_ADMIN peut cibler n'importe quelle école", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.payment.findMany).mockResolvedValue([verifiedPayment(p1)]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _count: { _all: 1 }, _sum: { amount: 10000 } } as never);

    const res = await GET(
      makeRequest("http://localhost:3000/api/payments/reconcile?schoolId=" + FIXTURES.schoolB)
    );

    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as {
      where: { fee: { schoolId: string } };
    };
    expect(where.where.fee.schoolId).toBe(FIXTURES.schoolB);
  });

  // Audit M5 : liste non bornée (tous les paiements en attente de l'école,
  // avec élève et frais) et résumé calculé en mémoire sur cette liste.
  it("borne la liste et calcule le résumé sur tout le périmètre (audit M5)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([verifiedPayment(p1)]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _count: { _all: 57 }, _sum: { amount: 570000 } } as never);

    const res = await GET(
      makeRequest("http://localhost:3000/api/payments/reconcile?schoolId=" + FIXTURES.schoolA)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as { take: number; orderBy: unknown };
    expect(args.take).toBe(21);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(body.summary).toEqual({ count: 57, totalAmount: 570000, status: "VERIFIED" });
    expect(body.pagination).toMatchObject({ limit: 20, hasNextPage: false, nextCursor: null });
  });

  it("rejette un statut inconnu (400) sans interroger la base", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await GET(
      makeRequest("http://localhost:3000/api/payments/reconcile?status=PAYE&schoolId=" + FIXTURES.schoolA)
    );
    expect(res.status).toBe(400);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(
      makeRequest("http://localhost:3000/api/payments/reconcile?schoolId=" + FIXTURES.schoolA)
    );

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      "Erreur lors de la récupération des paiements"
    );
  });
});