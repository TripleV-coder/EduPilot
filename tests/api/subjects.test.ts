import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/subjects/route";
import { GET as GET_CATS, POST as POST_CATS } from "@/app/api/subjects/categories/route";
import { GET as GET_CAT, PATCH as PATCH_CAT, DELETE as DELETE_CAT } from "@/app/api/subjects/categories/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", () => ({
  withCache: (handler: () => unknown) => handler(),
  generateCacheKey: () => "subjects:list:test",
  invalidateByPath: vi.fn(),
  CACHE_TTL_LONG: 300,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    subject: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    subjectCategory: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

function makeSubject(overrides: Record<string, unknown> = {}) {
  return { id: "s1", schoolId: FIXTURES.schoolA, name: "Maths", code: "MAT", coefficient: 3, isActive: true, ...overrides } as never;
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return { id: cuid("cat1"), schoolId: FIXTURES.schoolA, name: "Sciences", code: "SCI", order: 0, isActive: true, ...overrides } as never;
}

describe("GET /api/subjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/subjects"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SUBJECT_READ permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/subjects"));
    expect(res.status).toBe(403);
  });

  it("should list school subjects with search filter", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subject.findMany).mockResolvedValue([makeSubject()]);
    const res = await GET(makeRequest("http://localhost/api/subjects?search=math"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.subject.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: FIXTURES.schoolA }) }));
  });

  it("should list all subjects for a SUPER_ADMIN without school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.subject.findMany).mockResolvedValue([makeSubject()]);
    const res = await GET(makeRequest("http://localhost/api/subjects"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/subjects", () => {
  beforeEach(() => vi.clearAllMocks());

  const body = { name: "Maths", code: "MAT", coefficient: 3 };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without SUBJECT_CREATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 500 on invalid body (zod error uncaught by the route)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body: { name: "X" } }));
    expect(res.status).toBe(500);
  });

  it("should return 400 when the code already exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subject.findFirst).mockResolvedValue(makeSubject());
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body }));
    expect(res.status).toBe(400);
  });

  it("should create the subject and invalidate the cache", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subject.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.subject.create).mockResolvedValue(makeSubject());
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body }));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    expect(resBody.code).toBe("MAT");
    const { invalidateByPath } = await import("@/lib/api/cache-helpers");
    expect(invalidateByPath).toHaveBeenCalledWith("/api/subjects");
  });

  it("should return 500 on unexpected database error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subject.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/subjects", { method: "POST", body }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/subjects/categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_CATS(makeRequest("http://localhost/api/subjects/categories"));
    expect(res.status).toBe(401);
  });

  it("should list global and school categories", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findMany).mockResolvedValue([makeCategory()]);
    const res = await GET_CATS(makeRequest("http://localhost/api/subjects/categories"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.subjectCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it("should list global categories for a SUPER_ADMIN without school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.subjectCategory.findMany).mockResolvedValue([] as never);
    const res = await GET_CATS(makeRequest("http://localhost/api/subjects/categories"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/subjects/categories", () => {
  beforeEach(() => vi.clearAllMocks());

  const body = { name: "Sciences", code: "SCI" };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_CATS(makeRequest("http://localhost/api/subjects/categories", { method: "POST", body }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_CATS(makeRequest("http://localhost/api/subjects/categories", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_CATS(makeRequest("http://localhost/api/subjects/categories", { method: "POST", body: { name: "" } }));
    expect(res.status).toBe(400);
  });

  it("should create the category (200)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.create).mockResolvedValue(makeCategory());
    const res = await POST_CATS(makeRequest("http://localhost/api/subjects/categories", { method: "POST", body }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.id).toBe(cuid("cat1"));
  });
});

describe("GET /api/subjects/categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_CAT(makeRequest("http://localhost/api/subjects/categories/c1"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the category does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findUnique).mockResolvedValue(null);
    const res = await GET_CAT(makeRequest("http://localhost/api/subjects/categories/c1"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(404);
  });

  it("should return the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.findUnique).mockResolvedValue(makeCategory());
    const res = await GET_CAT(makeRequest("http://localhost/api/subjects/categories/c1"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Sciences");
  });
});

describe("PATCH /api/subjects/categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "PATCH", body: { name: "Sciences" } }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PATCH_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "PATCH", body: { name: "" } }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(400);
  });

  it("should update the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.update).mockResolvedValue(makeCategory({ name: "Sciences renforcées" }));
    const res = await PATCH_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "PATCH", body: { name: "Sciences renforcées" } }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Sciences renforcées");
  });

  it("should return 404 when the category is missing (P2025)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const { Prisma } = await import("@prisma/client");
    vi.mocked(prisma.subjectCategory.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025" }),
    );
    const res = await PATCH_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "PATCH", body: { name: "X" } }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/subjects/categories/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(403);
  });

  it("should soft-delete the category", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.subjectCategory.update).mockResolvedValue(makeCategory({ isActive: false }));
    const res = await DELETE_CAT(makeRequest("http://localhost/api/subjects/categories/c1", { method: "DELETE" }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.subjectCategory.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { isActive: false } });
  });
});