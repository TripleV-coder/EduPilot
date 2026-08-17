import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/stats/route";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Stats : paymentPlan + classLevel (Promise.all) puis academicYear pour la
// résolution de la période "academic" (courante + précédente) et payment x2.
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
    classLevel: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
  },
}));

const ACCOUNTANT = makeSession("ACCOUNTANT");
const NO_SCHOOL_ROOT = makeSession("SUPER_ADMIN", { schoolId: null });

function academicYear(overrides: Record<string, unknown> = {}) {
  return {
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  // withCache (fallback in-memory) persiste entre les tests : purge obligatoire.
  await invalidateCache("api:*");
});

describe("GET /api/finance/stats", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(res.status).toBe(403);
    expect(prisma.paymentPlan.findMany).not.toHaveBeenCalled();
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(
      makeRequest(`http://localhost/api/finance/stats?schoolId=${FIXTURES.schoolB}`)
    );
    expect(res.status).toBe(403);
  });

  it("retourne 400 sans école active (SUPER_ADMIN sans schoolId)", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Établissement (schoolId) requis");
  });

  it("calcule revenus, recouvrement, croissance et répartition cycle/mois", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    // Période "academic" par défaut : résolution courante + précédente
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(academicYear() as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        id: "cplan1",
        totalAmount: 100000,
        paidAmount: 40000,
        fee: { classLevelCode: "6E", dueDate: new Date("2026-05-01") },
        installmentPayments: [],
      },
    ] as never);
    vi.mocked(prisma.classLevel.findMany).mockResolvedValue([
      { code: "6E", name: "6ème" },
    ] as never);
    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([
        {
          amount: 50000,
          paidAt: new Date("2026-03-10T08:00:00Z"),
          createdAt: new Date("2026-03-10T08:00:00Z"),
          fee: { classLevelCode: "6E" },
        },
      ] as never)
      .mockResolvedValueOnce([
        { amount: 20000, paidAt: new Date("2025-12-01T08:00:00Z"), createdAt: new Date("2025-12-01T08:00:00Z") },
      ] as never);

    const res = await GET(makeRequest("http://localhost/api/finance/stats?period=academic"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalRevenue).toBe(50000);
    expect(body.totalPending).toBe(60000);
    expect(body.collectionRate).toBe(50);
    // (50000 - 20000) / 20000 = +150 %
    expect(body.revenueGrowth).toBe(150);
    // Périodes courante et précédente identiques dans le mock → 0
    expect(body.pendingGrowth).toBe(0);
    expect(body.revenueByMonth).toEqual([{ month: "2026-03", amount: 50000 }]);
    expect(body.revenueByCycle).toEqual([{ name: "6ème", value: 50000 }]);
    // Isolation tenant : la requête payments est filtrée par école via fee
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0].where.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });
  });

  it("sert le cache au 2e appel (X-Cache HIT, pas de requête DB supplémentaire)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(academicYear() as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.classLevel.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);

    const first = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Cache")).toBe("MISS");

    const second = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(vi.mocked(prisma.payment.findMany)).toHaveBeenCalledTimes(2);
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.paymentPlan.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});