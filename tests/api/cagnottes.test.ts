import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/cagnottes/route";
import { GET as GET_ONE } from "@/app/api/cagnottes/[cagnotteId]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    cagnotte: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    class: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

function makeCagnotte() {
  return {
    id: "cag1",
    title: "Sortie scolaire",
    description: "Financement du bus",
    class: { id: "cl1", name: "6A", classLevel: { name: "Collège" } },
    host: { id: "u1", firstName: "Jean", lastName: "Dupont", role: "TEACHER" },
    targetFcfa: 100000n,
    expectedParticipants: 25,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: "OPEN",
    contributions: [
      { id: "k1", parentUserId: "u2", amountFcfa: 5000n, paidAt: new Date(), parent: { firstName: "Marie", lastName: "Martin" } },
    ],
    journal: [],
  } as never;
}

describe("GET /api/cagnottes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/cagnottes"));
    expect(res.status).toBe(401);
  });

  it("should list cagnottes with computed aggregates", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.cagnotte.findMany).mockResolvedValue([makeCagnotte()]);

    const res = await GET(makeRequest("http://localhost/api/cagnottes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const c = body.cagnottes[0];
    expect(c.raisedFcfa).toBe("5000");
    expect(c.participantCount).toBe(1);
    expect(c.myContributionFcfa).toBe("0");
    expect(c.hasContributed).toBe(false);
    expect(c.classLabel).toBe("Collège 6A");
    expect(c.hostLabel).toBe("Jean Dupont");
    expect(c.daysLeft).toBeGreaterThan(0);
    expect(c.recentInitials).toEqual(["MM"]);
    expect(c.deadline).toBeDefined();
    expect(c.lastContributionAt).toBeDefined();
  });

  it("should show the viewer contribution when they gave", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u2" }));
    vi.mocked(prisma.cagnotte.findMany).mockResolvedValue([makeCagnotte()]);

    const res = await GET(makeRequest("http://localhost/api/cagnottes"));
    const body = await res.json();
    expect(body.cagnottes[0].myContributionFcfa).toBe("5000");
    expect(body.cagnottes[0].hasContributed).toBe(true);
  });

  it("should filter by status", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.cagnotte.findMany).mockResolvedValue([]);

    await GET(makeRequest("http://localhost/api/cagnottes?status=CLOSED"));
    const call = vi.mocked(prisma.cagnotte.findMany).mock.calls[0][0] as { where: { status?: string } };
    expect(call.where.status).toBe("CLOSED");
  });

  it("should reject a cross-school schoolId param", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/cagnottes?schoolId=" + FIXTURES.schoolB));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/cagnottes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-authorized roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/cagnottes", { method: "POST", body: {} }));
    expect(res.status).toBe(403);
  });

  it("should return 400 for a too-short title", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/cagnottes", {
      method: "POST",
      body: { title: "Bus", targetFcfa: 5000, deadline: new Date(Date.now() + 86400000).toISOString() },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 400 for an invalid target", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/cagnottes", {
      method: "POST",
      body: { title: "Sortie scolaire", targetFcfa: -5, deadline: new Date(Date.now() + 86400000).toISOString() },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 400 for a past deadline", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/cagnottes", {
      method: "POST",
      body: { title: "Sortie scolaire", targetFcfa: 5000, deadline: "2020-01-01T00:00:00Z" },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 404 when the class is not in the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findFirst).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/cagnottes", {
      method: "POST",
      body: {
        title: "Sortie scolaire",
        targetFcfa: 5000,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        classId: "cl1",
      },
    }));
    expect(res.status).toBe(404);
  });

  it("should create the cagnotte with a journal entry", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        cagnotte: {
          create: vi.fn().mockResolvedValue({ id: "cag1", targetFcfa: 5000n }),
        },
        cagnotteJournalEntry: { create: vi.fn() },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await POST(makeRequest("http://localhost/api/cagnottes", {
      method: "POST",
      body: {
        title: "Sortie scolaire",
        description: "  Financement du bus  ",
        targetFcfa: "5000",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        expectedParticipants: 25,
      },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("cag1");
  });
});

describe("GET /api/cagnottes/[cagnotteId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when cagnotte not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.cagnotte.findFirst).mockResolvedValue(null);
    const res = await GET_ONE(makeRequest("http://localhost/api/cagnottes/cag1"), { params: Promise.resolve({ cagnotteId: "cag1" }) });
    expect(res.status).toBe(404);
  });

  it("should return the cagnotte detail", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.cagnotte.findFirst).mockResolvedValue(makeCagnotte());

    const res = await GET_ONE(makeRequest("http://localhost/api/cagnottes/cag1"), { params: Promise.resolve({ cagnotteId: "cag1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("cag1");
  });
});