import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/finance/fees/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    fee: { findMany: vi.fn(), create: vi.fn() },
  },
}));

const ACCOUNTANT = makeSession("ACCOUNTANT");
const NO_SCHOOL_ROOT = makeSession("SUPER_ADMIN", { schoolId: null });

function feeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.feeA,
    schoolId: FIXTURES.schoolA,
    name: "Scolarité T1",
    description: null,
    amount: 100000,
    isActive: true,
    isRequired: true,
    createdAt: new Date("2026-01-01"),
    academicYear: null,
    _count: { payments: 3, paymentPlans: 1 },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/finance/fees", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/fees"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/finance/fees"));
    expect(res.status).toBe(403);
    expect(prisma.fee.findMany).not.toHaveBeenCalled();
  });

  it("retourne 400 sans école (SUPER_ADMIN sans schoolId)", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await GET(makeRequest("http://localhost/api/finance/fees"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("School ID required");
  });

  it("liste les frais actifs de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([feeRecord()] as never);

    const res = await GET(makeRequest("http://localhost/api/finance/fees"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Scolarité T1");
    expect(vi.mocked(prisma.fee.findMany).mock.calls[0][0].where).toEqual({
      schoolId: FIXTURES.schoolA,
      isActive: true,
    });
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.fee.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/fees"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});

describe("POST /api/finance/fees", () => {
  const validBody = {
    schoolId: FIXTURES.schoolA,
    name: "Scolarité T1",
    amount: 100000,
  };

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/finance/fees", { method: "POST", body: validBody }));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/finance/fees", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("rejette un body invalide avec 400 + issues Zod", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    const res = await POST(
      makeRequest("http://localhost/api/finance/fees", { method: "POST", body: { schoolId: FIXTURES.schoolA, name: "x", amount: -5 } })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(Array.isArray(body.error)).toBe(true);
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    const res = await POST(
      makeRequest("http://localhost/api/finance/fees", { method: "POST", body: { ...validBody, schoolId: FIXTURES.schoolB } })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("hors périmètre");
  });

  it("retourne 400 si l'utilisateur n'est associé à aucune école", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await POST(
      makeRequest("http://localhost/api/finance/fees", { method: "POST", body: { name: "Scolarité T1", amount: 100000 } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("User not associated with a school");
  });

  it("crée le frais actif dans l'école cible (201)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.fee.create).mockResolvedValue(feeRecord() as never);

    const res = await POST(makeRequest("http://localhost/api/finance/fees", { method: "POST", body: validBody }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(FIXTURES.feeA);
    expect(vi.mocked(prisma.fee.create).mock.calls[0][0].data).toMatchObject({
      schoolId: FIXTURES.schoolA,
      name: "Scolarité T1",
      amount: 100000,
      isActive: true,
      isRequired: true,
    });
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.fee.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/finance/fees", { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Internal Server Error");
  });
});