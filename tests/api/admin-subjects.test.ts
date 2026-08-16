import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT as PUT_BULK } from "@/app/api/admin/subjects/route";
import { PUT } from "@/app/api/admin/subjects/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    subject: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("GET /api/admin/subjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when user has no school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/admin/subjects"));
    expect(res.status).toBe(401);
  });

  it("should list school subjects", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.subject.findMany).mockResolvedValue([{ id: "s1", name: "Maths" }] as never);

    const res = await GET(makeRequest("http://localhost/api/admin/subjects"));
    expect(res.status).toBe(200);
    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA } })
    );
  });
});

describe("POST /api/admin/subjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid teachers", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/admin/subjects", { method: "POST", body: { name: "Maths", code: "MAT" } }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when name or code missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/admin/subjects", { method: "POST", body: { name: "Maths" } }));
    expect(res.status).toBe(400);
  });

  it("should return 409 when the code already exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ id: "s1" } as never);
    const res = await POST(makeRequest("http://localhost/api/admin/subjects", { method: "POST", body: { name: "Maths", code: "MAT" } }));
    expect(res.status).toBe(409);
  });

  it("should create the subject with uppercase code", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subject.create).mockResolvedValue({ id: "s1" } as never);

    const res = await POST(makeRequest("http://localhost/api/admin/subjects", { method: "POST", body: { name: "Maths", code: "mat", coefficient: 4 } }));
    expect(res.status).toBe(201);
    expect(prisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "MAT", coefficient: 4 }) })
    );
  });
});

describe("PUT /api/admin/subjects (import)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should import primary subjects and skip existing ones", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.subject.findUnique).mockResolvedValueOnce({ id: "s1" } as never).mockResolvedValueOnce(null);
    vi.mocked(prisma.subject.create).mockResolvedValue({ id: "s2" } as never);

    const res = await PUT_BULK(makeRequest("http://localhost/api/admin/subjects", { method: "PUT", body: { type: "primary" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBeGreaterThan(0);
    expect(body.skipped).toBeGreaterThan(0);
    expect(body.total).toBe(body.created + body.skipped);
  });
});

describe("PUT /api/admin/subjects/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when user has no school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await PUT(makeRequest("http://localhost/api/admin/subjects/s1", { method: "PUT", body: { name: "Mathématiques" } }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(401);
  });

  it("should update the subject", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.subject.findFirst).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.subject.update).mockResolvedValue({ id: "s1", name: "Mathématiques" } as never);

    const res = await PUT(makeRequest("http://localhost/api/admin/subjects/s1", { method: "PUT", body: { name: "Mathématiques", coefficient: 3 } }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    expect(prisma.subject.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "s1" }) })
    );
  });
});