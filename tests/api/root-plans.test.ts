import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    subscriptionPlan: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    school: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST, PATCH, DELETE } from "@/app/api/root/plans/route";

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

function planRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("plan1"),
    name: "Pro",
    code: "PRO",
    priceMonthly: 10000,
    isActive: true,
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/root/plans", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/root/plans"));
    expect(res.status).toBe(401);
  });

  it("refuse un compte non-root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost:3000/api/root/plans"));
    expect(res.status).toBe(403);
    expect(prisma.subscriptionPlan.findMany).not.toHaveBeenCalled();
  });

  it("liste les plans pour un compte root", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([planRecord()]);

    const res = await GET(makeRequest("http://localhost:3000/api/root/plans"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe("PRO");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/root/plans"));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des plans");
  });
});

describe("POST /api/root/plans", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro", code: "pro", priceMonthly: 100 },
    }));
    expect(res.status).toBe(401);
  });

  it("exige nom, code et prix (400)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro" },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Nom, code et prix requis");
  });

  it("crée un plan avec le code normalisé en majuscules (201)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.create).mockResolvedValue(planRecord());

    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro", code: "pro", priceMonthly: 100, maxStudents: "50" },
    }));

    expect(res.status).toBe(201);
    const createArgs = vi.mocked(prisma.subscriptionPlan.create).mock.calls[0][0] as {
      data: { code: string; maxStudents: number; maxTeachers: number };
    };
    expect(createArgs.data.code).toBe("PRO");
    expect(createArgs.data.maxStudents).toBe(50);
    expect(createArgs.data.maxTeachers).toBe(10);
  });

  it("retourne 400 sur code ou nom dupliqué (P2002)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const { Prisma } = await import("@prisma/client");
    vi.mocked(prisma.subscriptionPlan.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002" })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro", code: "pro", priceMonthly: 100 },
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Un plan avec ce code ou nom existe déjà");
  });

  it("retourne 500 sur erreur inattendue", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.create).mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro", code: "pro", priceMonthly: 100 },
    }));

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/root/plans", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/plans", {
      method: "PATCH",
      body: { id: cuid("plan1"), name: "Pro+" },
    }));
    expect(res.status).toBe(401);
  });

  it("exige un id (400)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/plans", {
      method: "PATCH",
      body: { name: "Pro+" },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID requis");
  });

  it("met à jour un plan", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue(
      planRecord({ name: "Pro+" })
    );

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/plans", {
      method: "PATCH",
      body: { id: cuid("plan1"), name: "Pro+", priceMonthly: 15000 },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Pro+");
    expect(vi.mocked(prisma.subscriptionPlan.update).mock.calls[0][0]).toMatchObject({
      where: { id: cuid("plan1") },
    });
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.update).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/plans", {
      method: "PATCH",
      body: { id: cuid("plan1"), name: "Pro+" },
    }));

    expect(res.status).toBe(500);
  });
});
describe("Plans : configuration par le super-administrateur", () => {
  it("refuse un prix invalide (400) au lieu d'une erreur base", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await POST(makeRequest("http://localhost:3000/api/root/plans", {
      method: "POST",
      body: { name: "Pro", code: "pro", priceMonthly: "abc" },
    }));
    expect(res.status).toBe(400);
    expect(prisma.subscriptionPlan.create).not.toHaveBeenCalled();
  });

  it("ne garde qu'un seul plan mis en avant", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue(planRecord({ isFeatured: true }));
    await PATCH(makeRequest("http://localhost:3000/api/root/plans", {
      method: "PATCH",
      body: { id: cuid("plan1"), isFeatured: true, priceOnRequest: false },
    }));
    expect(prisma.subscriptionPlan.updateMany).toHaveBeenCalledWith({
      where: { isFeatured: true, id: { not: cuid("plan1") } },
      data: { isFeatured: false },
    });
    expect(vi.mocked(prisma.subscriptionPlan.update).mock.calls[0][0].data).toMatchObject({ isFeatured: true, priceOnRequest: false });
  });

  it("refuse de supprimer un plan encore souscrit (409)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockResolvedValue(3);
    const res = await DELETE(makeRequest(`http://localhost:3000/api/root/plans?id=${cuid("plan1")}`, { method: "DELETE" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PLAN_IN_USE");
    expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
  });

  it("supprime un plan sans école", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.count).mockResolvedValue(0);
    vi.mocked(prisma.subscriptionPlan.delete).mockResolvedValue(planRecord());
    const res = await DELETE(makeRequest(`http://localhost:3000/api/root/plans?id=${cuid("plan1")}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
  });

  it("refuse la suppression à un compte non-root", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await DELETE(makeRequest(`http://localhost:3000/api/root/plans?id=${cuid("plan1")}`, { method: "DELETE" }));
    expect(res.status).toBe(403);
  });
});
