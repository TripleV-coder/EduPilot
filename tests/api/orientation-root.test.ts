import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/orientation/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentOrientation: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

function makeOrientation(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    studentId: FIXTURES.studentA,
    academicYearId: "ay1",
    classLevelId: "l1",
    status: "PENDING",
    createdAt: new Date("2026-01-01"),
    student: {
      id: FIXTURES.studentA,
      user: { firstName: "Awa", lastName: "Diallo", email: "awa@school.bj" },
    },
    academicYear: { id: "ay1", name: "2025-2026" },
    classLevel: { id: "l1", name: "Troisième" },
    recommendations: [],
    ...overrides,
  } as never;
}

describe("GET /api/orientation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should list orientations filtered by studentId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findMany).mockResolvedValue([makeOrientation()]);
    const res = await GET(makeRequest("http://localhost/api/orientation?studentId=" + FIXTURES.studentA), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].student.user.firstName).toBe("Awa");
    expect(body[0].academicYear.name).toBe("2025-2026");
    expect(prisma.studentOrientation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: FIXTURES.studentA }),
      })
    );
  });

  it("should scope non-super admin to their school via enrollments", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findMany).mockResolvedValue([]);
    await GET(makeRequest("http://localhost/api/orientation"), { session: makeSession("DIRECTOR") });
    expect(prisma.studentOrientation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          student: { enrollments: { some: { class: { schoolId: FIXTURES.schoolA } } } },
        }),
      })
    );
  });

  it("should not apply school scope for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.studentOrientation.findMany).mockResolvedValue([]);
    await GET(makeRequest("http://localhost/api/orientation"), { session: makeSession("SUPER_ADMIN") });
    expect(prisma.studentOrientation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/orientation"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});

describe("POST /api/orientation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/orientation", { method: "POST", body: {} }), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/orientation", { method: "POST", body: {} }), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/orientation", {
      method: "POST",
      body: { studentId: FIXTURES.studentA },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Données invalides");
    expect(body.details).toBeDefined();
  });

  it("should create an orientation with PENDING status and audit log", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.create).mockResolvedValue(makeOrientation({ id: cuid("o1") }));
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "al1" } as never);
    const res = await POST(makeRequest("http://localhost/api/orientation", {
      method: "POST",
      body: {
        studentId: FIXTURES.studentA,
        academicYearId: "ay1",
        classLevelId: "l1",
      },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
    expect(prisma.studentOrientation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentId: FIXTURES.studentA, academicYearId: "ay1", classLevelId: "l1", status: "PENDING" }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "StudentOrientation" }),
      })
    );
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/orientation", {
      method: "POST",
      body: { studentId: FIXTURES.studentA, academicYearId: "ay1", classLevelId: "l1" },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});