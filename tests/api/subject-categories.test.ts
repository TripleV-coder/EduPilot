import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/subject-categories/route";
import { GET as GET_ID, PATCH, DELETE } from "@/app/api/subject-categories/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    subjectCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

function makeCategory(overrides: Record<string, unknown> = {}) {
  return { id: cuid("cat1"), schoolId: FIXTURES.schoolA, name: "Sciences", code: "SCI", order: 0, isActive: true, ...overrides } as never;
}

const CATEGORY_BODY = { name: "Sciences", code: "SCI", color: "#ff0000", order: 1 };

describe("GET /api/subject-categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/subject-categories"));
    expect(res.status).toBe(401);
  });

  it("should return 400 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/subject-categories"));
    expect(res.status).toBe(400);
  });

  it("should list active categories by default", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findMany).mockResolvedValue([makeCategory()]);
    const res = await GET(makeRequest("http://localhost/api/subject-categories"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.subjectCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, isActive: true } }),
    );
  });

  it("should include inactive categories with activeOnly=false", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findMany).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/subject-categories?activeOnly=false"));
    expect(res.status).toBe(200);
    expect(prisma.subjectCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA } }),
    );
  });
});

describe("POST /api/subject-categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: CATEGORY_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: CATEGORY_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: CATEGORY_BODY }));
    expect(res.status).toBe(400);
  });

  // Audit M3 : exigeait 500 — l'erreur de validation remontait en erreur
  // serveur. createApiHandler la convertit désormais en 400 détaillé.
  it("should return 400 VALIDATION_ERROR on invalid body (audit M3)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: { name: "X" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("should return 409 when the code already exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findUnique).mockResolvedValue(makeCategory());
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: CATEGORY_BODY }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ce code de catégorie existe déjà");
  });

  it("should create the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subjectCategory.create).mockResolvedValue(makeCategory());
    const res = await POST(makeRequest("http://localhost/api/subject-categories", { method: "POST", body: CATEGORY_BODY }));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    expect(resBody.id).toBe(cuid("cat1"));
    const createCall = vi.mocked(prisma.subjectCategory.create).mock.calls[0][0] as { data: { schoolId: string; order: number } };
    expect(createCall.data).toEqual(expect.objectContaining({ schoolId: FIXTURES.schoolA, order: 1 }));
  });
});

describe("GET /api/subject-categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_ID(makeRequest("http://localhost/api/subject-categories/c1"), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(401);
  });

  it("should return 400 on invalid id", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET_ID(makeRequest("http://localhost/api/subject-categories/c1"), { params: Promise.resolve({ id: "bad-id" }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the category does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(null);
    const res = await GET_ID(makeRequest("http://localhost/api/subject-categories/c1"), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(404);
  });

  it("should return the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(makeCategory());
    const res = await GET_ID(makeRequest("http://localhost/api/subject-categories/c1"), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Sciences");
  });
});

describe("PATCH /api/subject-categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid id", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: "bad-id" }) });
    expect(res.status).toBe(400);
  });

  it("should return 400 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the category does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(404);
  });

  it("should return 409 when the new code is already used", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(makeCategory({ code: "OLD" }));
    vi.mocked(prisma.subjectCategory.findUnique).mockResolvedValue(makeCategory({ id: cuid("cat2") }));
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { code: "NEW" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(409);
  });

  it("should update the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(makeCategory({ code: "SCI" }));
    vi.mocked(prisma.subjectCategory.update).mockResolvedValue(makeCategory({ name: "Sciences renforcées" }));
    const res = await PATCH(makeRequest("http://localhost/api/subject-categories/c1", { method: "PATCH", body: { name: "Sciences renforcées" } }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Sciences renforcées");
  });
});

describe("DELETE /api/subject-categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid id", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: "bad-id" }) });
    expect(res.status).toBe(400);
  });

  it("should return 400 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the category does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(404);
  });

  it("should delete the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findFirst).mockResolvedValue(makeCategory());
    vi.mocked(prisma.subjectCategory.delete).mockResolvedValue(makeCategory());
    const res = await DELETE(makeRequest("http://localhost/api/subject-categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: cuid("cat1") }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.subjectCategory.delete).toHaveBeenCalledWith({ where: { id: cuid("cat1") } });
  });
});