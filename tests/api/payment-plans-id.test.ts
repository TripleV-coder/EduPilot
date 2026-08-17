import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    paymentPlan: { findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, DELETE } from "@/app/api/payment-plans/[id]/route";

const planId = cuid("plan1");

function fullPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: planId,
    studentId: FIXTURES.studentA,
    status: "ACTIVE",
    totalAmount: 100000,
    paidAmount: 0,
    student: {
      id: FIXTURES.studentA,
      user: { id: "cstud1", firstName: "Awa", lastName: "Dossou" },
      parentStudents: [],
    },
    fee: { id: FIXTURES.feeA, academicYear: { id: cuid("year1"), name: "2025-2026" } },
    installmentPayments: [],
    ...overrides,
  } as never;
}

function params() {
  return { params: Promise.resolve({ id: planId }) };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/payment-plans/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si le plan n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.paymentPlan.findUnique).mockResolvedValue(null as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Plan de paiement non trouvé");
  });

  it("bloque un SCHOOL_ADMIN sur un plan d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findUnique).mockResolvedValue({
      student: { schoolId: FIXTURES.schoolB },
    } as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(403);
    expect(prisma.paymentPlan.findUnique).toHaveBeenCalledTimes(1);
  });

  it("autorise un ACCOUNTANT de l'école du plan", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(planId);
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("autorise un STUDENT uniquement sur son propre plan", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());
    expect(res.status).toBe(200);
  });

  it("refuse un STUDENT sur un plan qui n'est pas le sien (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentB,
    } as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(403);
  });

  it("autorise un PARENT lié à l'étudiant", async () => {
    const parentSession = makeSession("PARENT");
    vi.mocked(auth).mockResolvedValue(parentSession);
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(
        fullPlan({
          student: {
            parentStudents: [{ parent: { user: { id: parentSession.user!.id } } }],
          },
        })
      );

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());
    expect(res.status).toBe(200);
  });

  it("refuse un PARENT non lié à l'étudiant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(403);
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockRejectedValueOnce(new Error("db down"));

    const res = await GET(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`), params());

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/payment-plans/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le plan n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findUnique).mockResolvedValue(null as never);

    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());

    expect(res.status).toBe(404);
  });

  it("refuse l'annulation quand des échéances sont déjà payées (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(
        fullPlan({ installmentPayments: [{ id: cuid("inst1"), status: "PAID" }] })
      );

    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());

    expect(res.status).toBe(400);
    expect(prisma.paymentPlan.update).not.toHaveBeenCalled();
  });

  it("annule le plan (soft-cancel) et journalise l'audit + notification", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(
        fullPlan({
          installmentPayments: [{ id: cuid("inst1"), status: "PENDING" }],
        })
      );
    vi.mocked(prisma.paymentPlan.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const updateArgs = vi.mocked(prisma.paymentPlan.update).mock.calls[0][0] as {
      data: { status: string };
    };
    expect(updateArgs.data.status).toBe("CANCELLED");
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0]).toMatchObject({
      data: { action: "DELETE", entity: "PaymentPlan", entityId: planId },
    });
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValueOnce(fullPlan());
    vi.mocked(prisma.paymentPlan.update).mockRejectedValue(new Error("db down"));

    const res = await DELETE(makeRequest(`http://localhost:3000/api/payment-plans/${planId}`, { method: "DELETE" }), params());

    expect(res.status).toBe(500);
  });
});