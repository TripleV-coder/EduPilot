import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/dashboard/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Dashboard : period (optionnel via periodId), payment (aggregate + 2 findMany)
// et paymentPlan sont les seuls modèles lus.
vi.mock("@/lib/prisma", () => ({
  default: {
    period: { findUnique: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
  },
}));

const ACCOUNTANT = makeSession("ACCOUNTANT");

function planRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("plan1"),
    studentId: FIXTURES.studentA,
    totalAmount: 100000,
    paidAmount: 40000,
    status: "ACTIVE",
    student: { user: { firstName: "Awa", lastName: "Dossou" } },
    fee: { name: "Scolarité T1", dueDate: new Date("2026-01-10") },
    installmentPayments: [],
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/finance/dashboard", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/dashboard"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/finance/dashboard"));
    expect(res.status).toBe(403);
    expect(prisma.payment.aggregate).not.toHaveBeenCalled();
  });

  it("retourne 400 sans école active (SUPER_ADMIN sans schoolId)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/finance/dashboard"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID d'établissement requis");
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(
      makeRequest(`http://localhost/api/finance/dashboard?schoolId=${FIXTURES.schoolB}`)
    );
    expect(res.status).toBe(403);
  });

  it("calcule le summary, les impayés en retard et la tendance par jour", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 50000 } } as never);
    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([
        {
          id: cuid("pay1"),
          amount: 50000,
          paidAt: new Date("2026-01-10T08:00:00Z"),
          createdAt: new Date("2026-01-10T08:00:00Z"),
          status: "VERIFIED",
          method: "CASH",
          student: { id: FIXTURES.studentA, user: { firstName: "Awa", lastName: "Dossou" } },
          fee: { name: "Scolarité T1" },
        },
      ] as never)
      .mockResolvedValueOnce([
        { amount: 50000, paidAt: new Date("2026-01-10T08:00:00Z"), createdAt: new Date("2026-01-10T08:00:00Z") },
      ] as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([planRecord()] as never);

    const res = await GET(makeRequest("http://localhost/api/finance/dashboard"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toEqual({
      totalFees: 100000,
      totalCollected: 50000,
      totalPending: 60000,
      collectionRate: 50,
    });
    expect(body.overdueStudents).toEqual([
      { studentId: FIXTURES.studentA, studentName: "Awa Dossou", balance: 60000 },
    ]);
    expect(body.recentPayments).toHaveLength(1);
    expect(body.paymentsTrend).toEqual([{ date: "2026-01-10", amount: 50000, count: 1 }]);
    // Isolation tenant : le filtre école passe par la relation fee
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });
  });

  it("borne les montants à la période quand periodId est fourni", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: cuid("period1"),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    } as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 20000 } } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      planRecord({
        paidAmount: 0,
        fee: { name: "Scolarité T1", dueDate: null },
        installmentPayments: [
          { amount: 30000, dueDate: new Date("2026-01-15"), status: "PENDING" },
          { amount: 20000, dueDate: new Date("2026-01-20"), status: "PAID" },
          { amount: 50000, dueDate: new Date("2026-02-10"), status: "PENDING" },
        ],
      }),
    ] as never);

    const res = await GET(
      makeRequest(`http://localhost/api/finance/dashboard?periodId=${cuid("period1")}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    // Seules les échéances de janvier comptent : 30 000 impayées sur 50 000 attendus
    expect(body.summary).toEqual({
      totalFees: 50000,
      totalCollected: 20000,
      totalPending: 30000,
      collectionRate: 40,
    });
    expect(body.overdueStudents[0].balance).toBe(30000);
    expect(body.paymentsTrend).toEqual([]);
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.payment.aggregate).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/dashboard"));
    expect(res.status).toBe(500);
  });
});