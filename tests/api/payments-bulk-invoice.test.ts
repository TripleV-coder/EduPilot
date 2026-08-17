import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/payments/bulk-invoice/route";

const p1 = cuid("pay1");
const p2 = cuid("pay2");

beforeEach(() => vi.clearAllMocks());

describe("POST /api/payments/bulk-invoice", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));
    expect(res.status).toBe(403);
  });

  it("rejette un body invalide (400 + détails Zod)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: ["bad-id"] },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.details).toBeDefined();
  });

  it("refuse des IDs de paiement inconnus (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1, p2] },
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Paiements invalides");
  });

  it("bloque des paiements hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: p1, fee: { schoolId: FIXTURES.schoolB } },
    ] as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));

    expect(res.status).toBe(403);
  });

  it("génère les URLs de facture pour un ACCOUNTANT (périmètre vérifié)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: p1, fee: { schoolId: FIXTURES.schoolA } },
      { id: p2, fee: { schoolId: FIXTURES.schoolA } },
    ] as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1, p2] },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(body.invoices).toEqual([
      { paymentId: p1, invoiceUrl: `/api/payments/${p1}/invoice` },
      { paymentId: p2, invoiceUrl: `/api/payments/${p2}/invoice` },
    ]);
    const where = vi.mocked(prisma.payment.findMany).mock.calls[0][0] as {
      where: { id: { in: string[] } };
    };
    expect(where.where.id.in).toEqual([p1, p2]);
  });

  it("un SUPER_ADMIN génère sans vérifier le périmètre école", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));

    expect(res.status).toBe(200);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/bulk-invoice", {
      method: "POST",
      body: { paymentIds: [p1] },
    }));

    expect(res.status).toBe(500);
  });
});