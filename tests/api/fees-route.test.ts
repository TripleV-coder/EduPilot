import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    fee: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/fees/route";

const academicYearId = cuid("year2026");

function validCreateBody() {
  return {
    name: "Scolarité T1",
    amount: 150000,
    academicYearId,
    isRequired: true,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/fees", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/fees"));
    expect(res.status).toBe(401);
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost:3000/api/fees"));
    expect(res.status).toBe(403);
    expect(prisma.fee.findMany).not.toHaveBeenCalled();
  });

  it("retourne 400 sans école active", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost:3000/api/fees"));
    expect(res.status).toBe(400);
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await GET(
      makeRequest(`http://localhost:3000/api/fees?schoolId=${FIXTURES.schoolB}`)
    );
    expect(res.status).toBe(403);
  });

  it("liste les frais actifs de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      {
        id: FIXTURES.feeA,
        name: "Scolarité T1",
        amount: 150000,
        schoolId: FIXTURES.schoolA,
        isActive: true,
        academicYear: { id: academicYearId, name: "2025-2026" },
        payments: [],
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost:3000/api/fees"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Scolarité T1");
    expect(vi.mocked(prisma.fee.findMany).mock.calls[0][0]?.where).toEqual({
      schoolId: FIXTURES.schoolA,
      isActive: true,
    });
  });
});

describe("POST /api/fees", () => {
  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(
      makeRequest("http://localhost:3000/api/fees", {
        method: "POST",
        body: validCreateBody(),
      })
    );
    expect(res.status).toBe(403);
  });

  it("crée un frais scolaire (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.fee.create).mockResolvedValue({
      id: FIXTURES.feeA,
      ...validCreateBody(),
      schoolId: FIXTURES.schoolA,
    } as never);

    const res = await POST(
      makeRequest("http://localhost:3000/api/fees", {
        method: "POST",
        body: validCreateBody(),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("Scolarité T1");
    expect(vi.mocked(prisma.fee.create).mock.calls[0][0]?.data).toMatchObject({
      schoolId: FIXTURES.schoolA,
      name: "Scolarité T1",
      amount: 150000,
      academicYearId,
      isRequired: true,
    });
  });

  it("rejette un montant invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(
      makeRequest("http://localhost:3000/api/fees", {
        method: "POST",
        body: { name: "Scolarité T1", amount: -100 },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(Array.isArray(body.error)).toBe(true);
    expect(prisma.fee.create).not.toHaveBeenCalled();
  });
});
