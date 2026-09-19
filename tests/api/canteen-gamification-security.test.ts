import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/gamification/service", () => ({
  gamificationService: { unlockAchievement: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findFirst: vi.fn() },
    mealTicket: { create: vi.fn(), findMany: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    achievement: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { gamificationService } from "@/lib/gamification/service";
import { POST as POST_TICKET } from "@/app/api/canteen/tickets/route";
import { POST as POST_AWARD } from "@/app/api/gamification/achievements/award/route";

const ticketUrl = "http://localhost/api/canteen/tickets";
const awardUrl = "http://localhost/api/gamification/achievements/award";

describe("POST /api/canteen/tickets — pas de repas crédités sans encaissement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.mealTicket.create).mockImplementation(async ({ data }: { data: object }) => ({ id: "t1", ...data }) as never);
  });

  it.each(["STUDENT", "PARENT", "TEACHER"])("refuse un %s (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA }));
    const res = await POST_TICKET(makeRequest(ticketUrl, { method: "POST", body: { userId: "u1", amount: 10 } }));
    expect(res.status).toBe(403);
    expect(prisma.mealTicket.create).not.toHaveBeenCalled();
  });

  it("refuse un bénéficiaire d'un autre établissement (404)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    const res = await POST_TICKET(makeRequest(ticketUrl, { method: "POST", body: { userId: "u-other", amount: 10 } }));
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.user.findFirst).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ id: "u-other", schoolId: FIXTURES.schoolA }) })
    );
    expect(prisma.mealTicket.create).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, 100_000, "abc"])("rejette le montant %s (400)", async (amount) => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolA }));
    const res = await POST_TICKET(makeRequest(ticketUrl, { method: "POST", body: { userId: "u1", amount } }));
    expect(res.status).toBe(400);
  });

  it("crédite un carnet pour un élève de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u1" } as never);
    const res = await POST_TICKET(makeRequest(ticketUrl, { method: "POST", body: { userId: "u1", amount: 10 } }));
    expect(res.status).toBe(200);
    expect(prisma.mealTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schoolId: FIXTURES.schoolA, userId: "u1", balance: 10 }) })
    );
  });
});

describe("POST /api/gamification/achievements/award — périmètre de l'établissement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
  });

  it("refuse un utilisateur d'un autre établissement (404)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    const res = await POST_AWARD(makeRequest(awardUrl, { method: "POST", body: { userId: "u-other", achievementCode: "STAR" } }));
    expect(res.status).toBe(404);
    expect(gamificationService.unlockAchievement).not.toHaveBeenCalled();
  });

  it("ne renvoie pas le message d'erreur interne", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u1" } as never);
    vi.mocked(gamificationService.unlockAchievement).mockRejectedValueOnce(new Error("relation \"user_achievements\" does not exist"));
    const res = await POST_AWARD(makeRequest(awardUrl, { method: "POST", body: { userId: "u1", achievementCode: "STAR" } }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });

  it("attribue un badge à un élève de l'école", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: "u1" } as never);
    vi.mocked(gamificationService.unlockAchievement).mockResolvedValueOnce({ id: "ua1" } as never);
    const res = await POST_AWARD(makeRequest(awardUrl, { method: "POST", body: { userId: "u1", achievementCode: "STAR" } }));
    expect(res.status).toBe(200);
  });
});
