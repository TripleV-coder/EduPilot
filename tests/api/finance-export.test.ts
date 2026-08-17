import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/finance/export/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// La route construit sa réponse avec `new NextResponse(...)` : le mock global
// de tests/setup.ts ne fournit pas de constructeur, on étend donc le vrai
// module avec une classe constructible (même pattern que audit-alumni-benchmark).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return new MockNextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});
vi.mock("@/lib/prisma", () => ({
  default: { payment: { findMany: vi.fn() } },
}));

const SCHOOL_ADMIN = makeSession("SCHOOL_ADMIN");
const NO_SCHOOL_ROOT = makeSession("SUPER_ADMIN", { schoolId: null });

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("pay1"),
    createdAt: new Date("2026-01-10"),
    paidAt: new Date("2026-01-10"),
    amount: 50000,
    method: "CASH",
    reference: "REF-001",
    status: "VERIFIED",
    receivedBy: "u1",
    notes: "note",
    student: {
      matricule: "MAT-001",
      user: { firstName: "=SUM(A1)", lastName: "Dossou", email: "awa@test.bj" },
    },
    fee: { name: "Scolarité T1", amount: 100000 },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/finance/export", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/export"));
    expect(res.status).toBe(401);
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    const res = await GET(makeRequest(`http://localhost/api/finance/export?schoolId=${FIXTURES.schoolB}`));
    expect(res.status).toBe(403);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("retourne 400 sans école (SUPER_ADMIN sans schoolId)", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await GET(makeRequest("http://localhost/api/finance/export"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID d'établissement requis");
  });

  it("rejette une plage de dates invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    const res = await GET(makeRequest("http://localhost/api/finance/export?startDate=zzz"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Plage de dates invalide");
  });

  it("rejette un format non supporté (400)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/finance/export?format=pdf"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Format d'export non supporté");
  });

  it("exporte un CSV avec protection contre l'injection de formules", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([paymentRecord()] as never);

    const res = await GET(
      makeRequest(
        "http://localhost/api/finance/export?startDate=2026-01-01&endDate=2026-01-31&academicYearId=" + cuid("year1")
      )
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("export-financier-");
    const csv = await res.text();
    expect(csv).toContain('"Élève"');
    expect(csv).toContain("MAT-001");
    // escapeCsvCell neutralise le préfixe de formule
    expect(csv).toContain("'=SUM(A1) Dossou");
    // Filtres posés sur la requête : école + bornes de dates + année académique
    const where = vi.mocked(prisma.payment.findMany).mock.calls[0][0].where as Record<string, unknown>;
    expect(where.fee).toEqual({ schoolId: FIXTURES.schoolA, academicYearId: cuid("year1") });
    expect(where.createdAt).toEqual({ gte: new Date("2026-01-01"), lte: new Date("2026-01-31") });
  });

  it("accepte le format excel (même sortie CSV)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([paymentRecord()] as never);
    const res = await GET(makeRequest("http://localhost/api/finance/export?format=excel"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/export"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de l'export des données financières");
  });
});