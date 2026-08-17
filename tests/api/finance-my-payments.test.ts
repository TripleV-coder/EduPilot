import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/my-payments/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Route PARENT uniquement : seul parentProfile est lu (avec relations).
vi.mock("@/lib/prisma", () => ({
  default: {
    parentProfile: { findUnique: vi.fn() },
  },
}));

beforeEach(() => vi.clearAllMocks());

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
    expect((await res.json()).error).toBe("Unauthorized");
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

  it("agrège les plans de paiement des enfants (impayés, payés, prochaine échéance)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      id: cuid("parent1"),
      parentStudents: [
        {
          student: {
            user: { firstName: "Awa" },
            paymentPlans: [
              {
                totalAmount: 100000,
                paidAmount: 40000,
                fee: { name: "Scolarité T1" },
                installmentPayments: [
                  {
                    id: cuid("inst1"),
                    amount: 30000,
                    dueDate: new Date("2026-01-15"),
                    status: "PAID",
                    paidAt: new Date("2026-01-10T08:00:00Z"),
                    updatedAt: new Date("2026-01-10T08:00:00Z"),
                  },
                  {
                    id: cuid("inst2"),
                    amount: 30000,
                    dueDate: new Date("2026-02-15"),
                    status: "PENDING",
                  },
                ],
              },
            ],
          },
        },
      ],
    } as never);

    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalPending).toBe(60000);
    expect(body.totalPaid).toBe(40000);
    // Response.json sérialise les Dates en ISO (comportement réseau réel)
    expect(body.nextDueDate).toBe("2026-02-15T00:00:00.000Z");
    expect(body.payments).toHaveLength(1);
    expect(body.payments[0]).toMatchObject({
      id: cuid("inst1"),
      feeName: "Scolarité T1 (Awa)",
      amount: 30000,
      method: "CASH",
    });
    expect(body.payments[0].date).toBe("2026-01-10T08:00:00.000Z");
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/my-payments"));
    expect(res.status).toBe(500);
  });
});