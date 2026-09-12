import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/stats/route";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { collectedByUtcMonth, summarizePaymentPlansInRange } from "@/lib/finance/stats-aggregates";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Stats : academicYear pour la résolution de la période "academic" (courante +
// précédente), niveaux et frais (libellés de cycle), encaissements agrégés.
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    classLevel: { findMany: vi.fn() },
    fee: { findMany: vi.fn() },
    payment: { groupBy: vi.fn(), aggregate: vi.fn() },
  },
}));
// Agrégats SQL (mois, plans de paiement) : prouvés contre un vrai PostgreSQL
// par tests/integration-db/finance-stats.test.ts.
vi.mock("@/lib/finance/stats-aggregates", () => ({
  collectedByUtcMonth: vi.fn(),
  summarizePaymentPlansInRange: vi.fn(),
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

function mockEmptyData() {
  vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(academicYear() as never);
  vi.mocked(prisma.classLevel.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.fee.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as never);
  vi.mocked(collectedByUtcMonth).mockResolvedValue([]);
  vi.mocked(summarizePaymentPlansInRange).mockResolvedValue({ totalExpected: 0, totalPending: 0 });
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
    expect(summarizePaymentPlansInRange).not.toHaveBeenCalled();
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
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
    vi.mocked(prisma.classLevel.findMany).mockResolvedValue([
      { code: "6E", name: "6ème" },
    ] as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "cfee6", classLevelCode: "6E" },
    ] as never);
    // Plan de 100 000 dont 40 000 payés, dû dans les deux périodes
    vi.mocked(summarizePaymentPlansInRange).mockResolvedValue({ totalExpected: 100000, totalPending: 60000 });
    // Période courante : 50 000 encaissés en mars ; précédente : 20 000
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { feeId: "cfee6", _sum: { amount: 50000 } },
    ] as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 20000 } } as never);
    vi.mocked(collectedByUtcMonth).mockResolvedValue([{ month: "2026-03", amount: 50000 }]);

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
    // Isolation tenant : les encaissements sont filtrés par école via fee
    expect(vi.mocked(prisma.payment.groupBy).mock.calls[0][0].where?.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });
    expect(vi.mocked(prisma.payment.aggregate).mock.calls[0][0].where?.fee).toEqual({
      schoolId: FIXTURES.schoolA,
    });
    expect(summarizePaymentPlansInRange).toHaveBeenCalledWith(FIXTURES.schoolA, expect.any(Object));
  });

  it("sert le cache au 2e appel (X-Cache HIT, pas de requête DB supplémentaire)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    mockEmptyData();

    const first = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Cache")).toBe("MISS");

    const second = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(vi.mocked(prisma.payment.groupBy)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.payment.aggregate)).toHaveBeenCalledTimes(1);
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    mockEmptyData();
    vi.mocked(prisma.classLevel.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/stats"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});
