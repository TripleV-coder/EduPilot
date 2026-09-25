import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { subscriptionPlan: { findMany: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/public/plans/route";

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  code: "PRO",
  name: "Professionnel",
  description: null,
  maxStudents: 800,
  maxTeachers: 60,
  maxStorageGB: 20,
  features: ["SMS parents"],
  priceMonthly: "25000",
  priceYearly: "240000",
  isFeatured: true,
  priceOnRequest: false,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("GET /api/public/plans", () => {
  it("est accessible sans session et ne lit que les plans actifs", async () => {
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([plan()] as never);
    const res = await GET(makeRequest("http://localhost:3000/api/public/plans"));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.subscriptionPlan.findMany).mock.calls[0][0]).toMatchObject({ where: { isActive: true } });
    const body = await res.json();
    expect(body.data[0]).toMatchObject({ priceMonthly: 25000, priceYearly: 240000, isFeatured: true });
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("ne publie pas les prix d'un plan sur devis", async () => {
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([plan({ priceOnRequest: true })] as never);
    const body = await (await GET(makeRequest("http://localhost:3000/api/public/plans"))).json();
    expect(body.data[0].priceMonthly).toBeNull();
    expect(body.data[0].priceYearly).toBeNull();
  });

  it("n'expose pas le nombre d'écoles abonnées", async () => {
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([plan()] as never);
    await GET(makeRequest("http://localhost:3000/api/public/plans"));
    const select = vi.mocked(prisma.subscriptionPlan.findMany).mock.calls[0][0]?.select as Record<string, unknown>;
    expect(select).not.toHaveProperty("schools");
    expect(select).not.toHaveProperty("_count");
    expect(select).not.toHaveProperty("isActive");
  });
});
