import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/my-payments/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Route PARENT : parentProfile (avec échéanciers) + paiements validés des enfants.
vi.mock("@/lib/prisma", () => ({
  default: {
    parentProfile: { findUnique: vi.fn() },
    payment: { findMany: vi.fn() },
  },
}));
// Frais sans échéancier : testés à part (tests/lib/finance/expected-fees.test.ts).
vi.mock("@/lib/finance/expected-fees", () => ({ computeStudentFeeDues: vi.fn() }));
import { computeStudentFeeDues } from "@/lib/finance/expected-fees";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
  vi.mocked(computeStudentFeeDues).mockResolvedValue([]);
});

describe("GET /api/finance/my-payments", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Non authentifié");
    expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("retourne un état vide si le parent n'a pas de profil", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue(null as never);
    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ totalPending: 0, totalPaid: 0, payments: [] });
  });

  it("additionne échéanciers et frais sans échéancier ; liste les paiements validés", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      id: cuid("parent1"),
      parentStudents: [
        {
          student: {
            id: FIXTURES.studentA,
            user: { firstName: "Awa" },
            paymentPlans: [
              {
                status: "ACTIVE",
                totalAmount: 100000,
                paidAmount: 40000,
                fee: { name: "Scolarité T1" },
                installmentPayments: [
                  { id: cuid("inst1"), amount: 30000, dueDate: new Date("2026-01-15"), status: "PAID" },
                  { id: cuid("inst2"), amount: 30000, dueDate: new Date("2026-02-15"), status: "PENDING" },
                ],
              },
            ],
          },
        },
      ],
    } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: cuid("pay1"),
        studentId: FIXTURES.studentA,
        amount: 30000,
        method: "MOBILE_MONEY_MTN",
        paidAt: new Date("2026-01-10T08:00:00Z"),
        createdAt: new Date("2026-01-10T08:00:00Z"),
        fee: { name: "Scolarité T1" },
      },
    ] as never);
    vi.mocked(computeStudentFeeDues).mockResolvedValue([
      {
        studentId: FIXTURES.studentA,
        feeId: cuid("fee2"),
        feeName: "Frais d'inscription",
        remaining: 25000,
        dueDate: new Date("2026-02-01"),
      },
    ]);

    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    const body = await res.json();

    expect(res.status).toBe(200);
    // 60 000 restant sur l'échéancier + 25 000 dus sans échéancier.
    expect(body.totalPending).toBe(85000);
    expect(body.totalPaid).toBe(30000);
    // L'échéance la plus proche, tous frais confondus.
    expect(body.nextDueDate).toBe("2026-02-01T00:00:00.000Z");
    expect(body.payments).toEqual([
      {
        id: cuid("pay1"),
        feeName: "Scolarité T1 (Awa)",
        amount: 30000,
        date: "2026-01-10T08:00:00.000Z",
        method: "Mobile Money MTN",
      },
    ]);
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0]?.where).toMatchObject({
      studentId: { in: [FIXTURES.studentA] },
      status: { in: ["VERIFIED", "RECONCILED"] },
    });
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    expect(res.status).toBe(500);
  });
});