import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findMany: vi.fn() },
    subscriptionPlan: { findMany: vi.fn() },
    payment: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/root/finance/summary/route";

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/root/finance/summary", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/root/finance/summary"));
    expect(res.status).toBe(401);
  });

  it("refuse un compte non-root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost:3000/api/root/finance/summary"));
    expect(res.status).toBe(403);
    expect(prisma.school.findMany).not.toHaveBeenCalled();
  });

  it("calcule le chiffre d'affaires, la distribution et le taux de recouvrement", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.findMany).mockResolvedValue([
      {
        id: cuid("sch1"),
        name: "École A",
        planId: cuid("plan1"),
        subscriptionStatus: "ACTIVE",
      },
      { id: cuid("sch2"), name: "École B", planId: null, subscriptionStatus: "TRIAL" },
    ] as never);
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([
      { id: cuid("plan1"), name: "Pro", priceMonthly: 10000 },
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { status: "VERIFIED", _count: 3 },
      { status: "PENDING", _count: 1 },
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: cuid("pay1"),
        amount: 5000,
        paidAt: new Date("2026-01-01"),
        student: { school: { name: "École A" } },
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost:3000/api/root/finance/summary"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toMatchObject({
      totalMonthlyRevenue: 10000,
      activeTenants: 2,
      averageRevenuePerTenant: 5000,
      collectionRate: 75,
    });
    expect(body.distribution).toEqual([{ name: "Pro", count: 1 }]);
    expect(body.recentPayments).toHaveLength(1);
    expect(body.recentPayments[0]).toMatchObject({
      schoolName: "École A",
      amount: 5000,
      paidAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/root/finance/summary"));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du calcul des finances");
  });
});