import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/periods/route";
import { GET as GET_ID, PUT, DELETE } from "@/app/api/periods/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn(), findUnique: vi.fn() },
    period: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    grade: { count: vi.fn() },
  },
}));

function makePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("period1"),
    academicYearId: cuid("year1"),
    name: "Trimestre 1",
    type: "TRIMESTER",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-12-20"),
    sequence: 1,
    ...overrides,
  } as never;
}

const PERIOD_BODY = {
  name: "Trimestre 1",
  type: "TRIMESTER",
  startDate: "2026-09-01",
  endDate: "2026-12-20",
  sequence: 1,
  academicYearId: cuid("year1"),
};

describe("GET /api/periods", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/periods"));
    expect(res.status).toBe(401);
  });

  it("should return 400 when no academic year is resolvable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/periods"));
    expect(res.status).toBe(400);
  });

  it("should return 404 when the academic year does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/periods?academicYearId=y1"));
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);
    const res = await GET(makeRequest("http://localhost/api/periods?academicYearId=y1"));
    expect(res.status).toBe(403);
  });

  it("should list periods for the given academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.period.findMany).mockResolvedValue([makePeriod()]);
    const res = await GET(makeRequest("http://localhost/api/periods?academicYearId=y1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].sequence).toBe(1);
  });

  it("should resolve the current academic year when none is provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: cuid("year1") } as never);
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.period.findMany).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/periods"));
    expect(res.status).toBe(200);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, isCurrent: true } }));
  });
});

describe("POST /api/periods", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: { name: "", type: "TRIMESTER" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("should return 400 when academicYearId is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const { academicYearId, ...body } = PERIOD_BODY;
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Année scolaire requise");
  });

  it("should return 404 when the academic year does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school creation", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on duplicate sequence", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue(makePeriod());
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Une période avec ce numéro existe déjà");
  });

  it("should create the period", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.period.create).mockResolvedValue(makePeriod());
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(cuid("period1"));
  });

  it("should return 500 on unexpected database error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.period.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/periods", { method: "POST", body: PERIOD_BODY }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la création de la période");
  });
});

describe("GET /api/periods/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_ID(makeRequest("http://localhost/api/periods/p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the period does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await GET_ID(makeRequest("http://localhost/api/periods/p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolB } }));
    const res = await GET_ID(makeRequest("http://localhost/api/periods/p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("should return the period", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolA } }));
    const res = await GET_ID(makeRequest("http://localhost/api/periods/p1"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Trimestre 1");
  });
});

describe("PUT /api/periods/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { sequence: 0 } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the period does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school update", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolB } }));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on duplicate sequence", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ sequence: 1, academicYear: { schoolId: FIXTURES.schoolA } }));
    vi.mocked(prisma.period.findFirst).mockResolvedValue(makePeriod({ id: cuid("period2") }));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { sequence: 2 } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Une période avec ce numéro existe déjà");
  });

  it("should update the period", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ sequence: 1, academicYear: { schoolId: FIXTURES.schoolA } }));
    vi.mocked(prisma.period.update).mockResolvedValue(makePeriod({ name: "T1" }));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("T1");
  });

  it("should return 500 on unexpected database error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolA } }));
    vi.mocked(prisma.period.update).mockRejectedValue(new Error("db down"));
    const res = await PUT(makeRequest("http://localhost/api/periods/p1", { method: "PUT", body: { name: "T1" } }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/periods/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-manage roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when the period does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school deletion", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolB } }));
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("should block deletion when grades are attached", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolA } }));
    vi.mocked(prisma.grade.count).mockResolvedValue(5);
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("des notes sont associées");
  });

  it("should delete the period", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(makePeriod({ academicYear: { schoolId: FIXTURES.schoolA } }));
    vi.mocked(prisma.grade.count).mockResolvedValue(0);
    vi.mocked(prisma.period.delete).mockResolvedValue(makePeriod());
    const res = await DELETE(makeRequest("http://localhost/api/periods/p1", { method: "DELETE" }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});