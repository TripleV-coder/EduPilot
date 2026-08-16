import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/announcements/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/announcements/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    announcement: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  generateCacheKey: () => "announcements:test",
  cacheMiddleware: () => async (handler: () => unknown) => handler(),
  invalidateByPath: vi.fn(),
  CACHE_PATHS: { announcements: "announcements" },
}));

describe("GET /api/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/announcements"));
    expect(res.status).toBe(401);
  });

  it("should list published announcements with pagination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([
      { id: "a1", title: "Réunion", content: "Réunion des parents", type: "EVENT", priority: "NORMAL", isPublished: true, publishedAt: new Date(), expiresAt: null, createdAt: new Date() },
    ] as never);
    vi.mocked(prisma.announcement.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost/api/announcements?page=1&limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.announcements).toHaveLength(1);
    expect(body.pagination.totalPages).toBe(1);
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isPublished: true }) })
    );
  });

  it("should filter by type and includeExpired", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([]);
    vi.mocked(prisma.announcement.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/announcements?type=URGENT&includeExpired=true"));
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "URGENT" }) })
    );
  });
});

describe("POST /api/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 403 when account has no school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/announcements", { method: "POST", body: { title: "Annonce", content: "Contenu suffisant" } }));
    expect(res.status).toBe(403);
  });

  it("should create a published announcement and notify users", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.create).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA, isPublished: true, targetRoles: ["TEACHER"], title: "Réunion pédagogique", content: "Réunion le vendredi à 15h", type: "ACADEMIC", priority: "HIGH" } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }] as never);

    const res = await POST(makeRequest("http://localhost/api/announcements", {
      method: "POST",
      body: { title: "Réunion pédagogique", content: "Réunion le vendredi à 15h", type: "ACADEMIC", priority: "HIGH", isPublished: true, targetRoles: ["TEACHER"] },
    }));
    expect(res.status).toBe(201);
    expect(prisma.announcement.create).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/announcements", {
      method: "POST",
      body: { title: "X", content: "" },
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/announcements/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when announcement not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(null);
    const res = await GET_ONE(makeRequest("http://localhost/api/announcements/a1"), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolB, isPublished: true, targetRoles: [] } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/announcements/a1"), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(403);
  });

  it("should hide unpublished announcements from non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA, isPublished: false, targetRoles: [] } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/announcements/a1"), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(404);
  });

  it("should return the announcement for an authorized admin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA, isPublished: false, targetRoles: [] } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/announcements/a1"), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/announcements/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/announcements/a1", { method: "PATCH", body: { title: "Nouveau titre" } }), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(403);
  });

  it("should update an announcement and write an audit log", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA, publishedAt: null } as never);
    vi.mocked(prisma.announcement.update).mockResolvedValue({ id: "a1", title: "Nouveau titre" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/announcements/a1", { method: "PATCH", body: { title: "Nouveau titre" } }), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("should return 404 when announcement missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/announcements/a1", { method: "PATCH", body: { title: "Nouveau titre" } }), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/announcements/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should soft-delete an announcement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({ id: "a1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.announcement.update).mockResolvedValue({ id: "a1" } as never);

    const res = await DELETE(makeRequest("http://localhost/api/announcements/a1", { method: "DELETE" }), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(200);
  });

  it("should return 404 when announcement missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost/api/announcements/a1", { method: "DELETE" }), { params: Promise.resolve({ id: "a1" }) } as never);
    expect(res.status).toBe(404);
  });
});