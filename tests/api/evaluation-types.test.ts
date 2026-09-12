import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    evaluationType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET as GET_LIST, POST as POST_CREATE } from "@/app/api/evaluation-types/route";
import { GET as GET_DETAIL, PATCH, DELETE } from "@/app/api/evaluation-types/[id]/route";

const typeId = cuid("type1");
const typeRoute = "http://localhost:3000/api/evaluation-types";
const routeParams = { params: Promise.resolve({ id: typeId }) };

function typeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: typeId,
    name: "Devoir",
    code: "DEV",
    weight: 1,
    maxCount: 5,
    isActive: true,
    schoolId: FIXTURES.schoolA,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/evaluation-types", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_LIST(makeRequest(typeRoute));
    expect(res.status).toBe(401);
  });

  it("retourne 400 pour un SUPER_ADMIN sans schoolId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET_LIST(makeRequest(typeRoute));
    expect(res.status).toBe(400);
  });

  it("refuse un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET_LIST(makeRequest(`${typeRoute}?schoolId=${FIXTURES.schoolB}`));
    expect(res.status).toBe(403);
  });

  it("liste les types actifs de l'école (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findMany).mockResolvedValue([typeFixture()] as never);

    const res = await GET_LIST(makeRequest(typeRoute));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.evaluationType.findMany).toHaveBeenCalledWith({
      where: { schoolId: FIXTURES.schoolA, isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("liste les types pour un SUPER_ADMIN avec schoolId fourni", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.evaluationType.findMany).mockResolvedValue([typeFixture()] as never);

    const res = await GET_LIST(makeRequest(`${typeRoute}?schoolId=${FIXTURES.schoolA}`));
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.evaluationType.findMany).mock.calls[0][0];
    expect(args.where.schoolId).toBe(FIXTURES.schoolA);
  });
});

describe("POST /api/evaluation-types", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_CREATE(
      makeRequest(typeRoute, { method: "POST", body: { name: "Devoir", code: "DEV" } })
    );
    expect(res.status).toBe(401);
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_CREATE(
      makeRequest(typeRoute, { method: "POST", body: { name: "Devoir", code: "DEV" } })
    );
    expect(res.status).toBe(403);
  });

  it("retourne 400 pour un SUPER_ADMIN sans école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST_CREATE(
      makeRequest(typeRoute, { method: "POST", body: { name: "Devoir", code: "DEV" } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeDefined();
  });

  it("rejette un code déjà existant (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findFirst).mockResolvedValue(typeFixture() as never);
    const res = await POST_CREATE(
      makeRequest(typeRoute, { method: "POST", body: { name: "Devoir", code: "DEV" } })
    );
    expect(res.status).toBe(400);
    expect(prisma.evaluationType.findFirst).toHaveBeenCalledWith({
      where: { schoolId: FIXTURES.schoolA, code: "DEV" },
    });
  });

  it("crée le type d'évaluation (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.evaluationType.create).mockResolvedValue(typeFixture() as never);

    const res = await POST_CREATE(
      makeRequest(typeRoute, {
        method: "POST",
        body: { name: "Devoir", code: "DEV", weight: 1, maxCount: 5 },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(typeId);
    const createArgs = vi.mocked(prisma.evaluationType.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      schoolId: FIXTURES.schoolA,
      name: "Devoir",
      code: "DEV",
    });
  });

  it("utilise le schoolId du body pour un SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.evaluationType.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.evaluationType.create).mockResolvedValue(typeFixture() as never);

    const res = await POST_CREATE(
      makeRequest(typeRoute, {
        method: "POST",
        body: { name: "Devoir", code: "DEV", schoolId: FIXTURES.schoolB },
      })
    );
    expect(res.status).toBe(201);
    const createArgs = vi.mocked(prisma.evaluationType.create).mock.calls[0][0];
    expect(createArgs.data.schoolId).toBe(FIXTURES.schoolB);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("convertit une erreur de validation non interceptée en 400 VALIDATION_ERROR (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_CREATE(
      makeRequest(typeRoute, { method: "POST", body: { name: "D", code: "DEV" } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/evaluation-types/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_DETAIL(makeRequest(`${typeRoute}/${typeId}`), routeParams);
    expect(res.status).toBe(401);
  });

  it("retourne 404 si le type n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(null);
    const res = await GET_DETAIL(makeRequest(`${typeRoute}/${typeId}`), routeParams);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Type d'évaluation non trouvé");
  });

  it("refuse un type d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(
      typeFixture({ schoolId: FIXTURES.schoolB }) as never
    );
    const res = await GET_DETAIL(makeRequest(`${typeRoute}/${typeId}`), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne le type avec ses évaluations (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);

    const res = await GET_DETAIL(makeRequest(`${typeRoute}/${typeId}`), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(typeId);
    expect(prisma.evaluationType.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: typeId }, include: expect.objectContaining({ evaluations: expect.anything() }) })
    );
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET_DETAIL(makeRequest(`${typeRoute}/${typeId}`), routeParams);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/evaluation-types/[id]", () => {
  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, { method: "PATCH", body: { name: "Interrogation" } }),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le type n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(null);
    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, { method: "PATCH", body: { name: "Interrogation" } }),
      routeParams
    );
    expect(res.status).toBe(404);
  });

  it("refuse un type d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(
      typeFixture({ schoolId: FIXTURES.schoolB }) as never
    );
    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, { method: "PATCH", body: { name: "Interrogation" } }),
      routeParams
    );
    expect(res.status).toBe(403);
  });

  it("met à jour le type (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);
    vi.mocked(prisma.evaluationType.update).mockImplementation(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: typeId,
      ...args.data,
    }) as never);

    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, {
        method: "PATCH",
        body: { name: "Interrogation", weight: 2 },
      }),
      routeParams
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Interrogation");
    expect(body.weight).toBe(2);
  });

  it("retourne 400 sur body invalide (poids > 10)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);
    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, { method: "PATCH", body: { weight: 11 } }),
      routeParams
    );
    expect(res.status).toBe(400);
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);
    vi.mocked(prisma.evaluationType.update).mockRejectedValue(new Error("db down"));
    const res = await PATCH(
      makeRequest(`${typeRoute}/${typeId}`, { method: "PATCH", body: { name: "Interrogation" } }),
      routeParams
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/evaluation-types/[id]", () => {
  it("refuse un DIRECTOR (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await DELETE(makeRequest(`${typeRoute}/${typeId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("retourne 404 si le type n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeRequest(`${typeRoute}/${typeId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(404);
  });

  it("refuse un type d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(
      typeFixture({ schoolId: FIXTURES.schoolB }) as never
    );
    const res = await DELETE(makeRequest(`${typeRoute}/${typeId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(403);
  });

  it("supprime le type (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);
    vi.mocked(prisma.evaluationType.delete).mockResolvedValue({ id: typeId } as never);

    const res = await DELETE(makeRequest(`${typeRoute}/${typeId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(prisma.evaluationType.delete).toHaveBeenCalledWith({ where: { id: typeId } });
  });

  it("retourne 500 si prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluationType.findUnique).mockResolvedValue(typeFixture() as never);
    vi.mocked(prisma.evaluationType.delete).mockRejectedValue(new Error("db down"));
    const res = await DELETE(makeRequest(`${typeRoute}/${typeId}`, { method: "DELETE" }), routeParams);
    expect(res.status).toBe(500);
  });
});