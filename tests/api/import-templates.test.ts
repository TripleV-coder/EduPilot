import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/import/templates/route";
import { GET as GET_ONE, PUT, DELETE } from "@/app/api/import/templates/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    importTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const ADMIN = makeSession("SCHOOL_ADMIN");
const TEMPLATE_ID = cuid("tmpl1");

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    schoolId: FIXTURES.schoolA,
    createdById: cuid("user1"),
    name: "Modèle enseignants",
    type: "TEACHERS",
    mappings: { email: "email", firstName: "first_name" },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/import/templates", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/import/templates"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside the allowed list", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/import/templates"));
    expect(res.status).toBe(403);
  });

  it("should return 400 when schoolId is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/import/templates"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School ID required");
  });

  it("should list templates scoped to the school", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findMany).mockResolvedValue([makeTemplate()] as never);
    const res = await GET(makeRequest("http://localhost/api/import/templates?type=TEACHERS"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(prisma.importTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: FIXTURES.schoolA, type: "TEACHERS" }),
    }));
  });

  it("should list templates without type filter", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/import/templates"));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.importTemplate.findMany).mock.calls[0][0] as { where: { type?: unknown } };
    expect(call.where.type).toBeUndefined();
  });
});

describe("POST /api/import/templates", () => {
  it("should create a template", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.create).mockResolvedValue(makeTemplate() as never);
    const res = await POST(makeRequest("http://localhost/api/import/templates", {
      method: "POST",
      body: { name: "Modèle enseignants", type: "TEACHERS", mappings: { email: "email" } },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(TEMPLATE_ID);
    expect(prisma.importTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: FIXTURES.schoolA,
        createdById: ADMIN.user!.id,
        name: "Modèle enseignants",
        type: "TEACHERS",
      }),
    }));
  });

  it("should return 400 on zod validation failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/templates", {
      method: "POST",
      body: { name: "", type: "UNKNOWN", mappings: {} },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("should return 400 when schoolId is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/import/templates", {
      method: "POST",
      body: { name: "Modèle", type: "STUDENTS", mappings: {} },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/import/templates", {
      method: "POST",
      body: { name: "Modèle", type: "STUDENTS", mappings: {} },
    }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});

describe("GET /api/import/templates/[id]", () => {
  it("should return 404 when template does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Template not found");
  });

  it("should forbid access from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolB }));
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    const res = await GET_ONE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
  });

  it("should return the template for the same school", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    const res = await GET_ONE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TEMPLATE_ID);
    expect(body.name).toBe("Modèle enseignants");
  });
});

describe("PUT /api/import/templates/[id]", () => {
  it("should return 404 when template does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "PUT", body: { name: "Renommé" } }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should forbid access from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolB }));
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    const res = await PUT(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "PUT", body: { name: "Renommé" } }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(403);
  });

  it("should update the template", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    vi.mocked(prisma.importTemplate.update).mockResolvedValue(makeTemplate({ name: "Renommé" }) as never);
    const res = await PUT(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "PUT", body: { name: "Renommé", mappings: { email: "email" } } }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Renommé");
    expect(prisma.importTemplate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: TEMPLATE_ID },
      data: expect.objectContaining({ name: "Renommé" }),
    }));
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    const res = await PUT(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "PUT", body: { name: 123 } }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Validation failed");
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    vi.mocked(prisma.importTemplate.update).mockRejectedValue(new Error("db down"));
    const res = await PUT(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "PUT", body: { name: "Renommé" } }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/import/templates/[id]", () => {
  it("should return 404 when template does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "DELETE" }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should forbid access from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolB }));
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    const res = await DELETE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "DELETE" }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(403);
  });

  it("should delete the template", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.importTemplate.findUnique).mockResolvedValue(makeTemplate() as never);
    vi.mocked(prisma.importTemplate.delete).mockResolvedValue(makeTemplate() as never);
    const res = await DELETE(makeRequest(`http://localhost/api/import/templates/${TEMPLATE_ID}`, { method: "DELETE" }), { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(prisma.importTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });
});