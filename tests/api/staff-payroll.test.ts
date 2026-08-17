import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/staff/payroll/route";
import { PATCH } from "@/app/api/staff/payroll/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findFirst: vi.fn() },
    payrollEntry: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    fiscalYear: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "pe1",
    userId: cuid("staff1"),
    schoolId: FIXTURES.schoolA,
    period: "2026-08",
    baseSalary: 100000,
    allowances: [],
    deductions: [],
    netAmount: 100000,
    status: "DRAFT",
    paidAt: null,
    journalEntryId: null,
    user: { firstName: "Paul", lastName: "Biya", role: "TEACHER" },
    createdAt: new Date(),
    ...overrides,
  } as never;
}

const PAYROLL_BODY = {
  userId: cuid("staff1"),
  period: "2026-08",
  baseSalary: 100000,
  allowances: [{ label: "Prime transport", amount: 20000 }],
  deductions: [{ label: "Avance", amount: 5000 }],
};

describe("GET /api/staff/payroll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/staff/payroll"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside staff members", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/staff/payroll"));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/staff/payroll"));
    expect(res.status).toBe(403);
  });

  it("should list all pay slips of the period for an HR manager", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findMany).mockResolvedValue([makeEntry()]);

    const res = await GET(makeRequest("http://localhost/api/staff/payroll?period=2026-08"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe("2026-08");
    expect(body.canManage).toBe(true);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toEqual(expect.objectContaining({ id: "pe1", name: "Paul Biya", netAmount: 100000 }));
    expect(prisma.payrollEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, period: "2026-08" } }),
    );
  });

  it("should only return the employee's own slips for non-managers", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.payrollEntry.findMany).mockResolvedValue([makeEntry({ userId: cuid("userteacher") })]);

    const res = await GET(makeRequest("http://localhost/api/staff/payroll"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(false);
    expect(prisma.payrollEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: FIXTURES.schoolA, userId: cuid("userteacher") }) }),
    );
  });
});

describe("POST /api/staff/payroll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-HR roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid payload", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: { ...PAYROLL_BODY, baseSalary: -100 } }));
    expect(res.status).toBe(400);
  });

  it("should return 404 when the target staff member is not in the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Agent introuvable");
  });

  it("should reject edition of an already validated slip", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: cuid("staff1") } as never);
    vi.mocked(prisma.payrollEntry.findUnique).mockResolvedValue({ status: "VALIDATED" } as never);
    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Fiche déjà validée : modification impossible.");
  });

  it("should upsert the slip with a server-computed net amount", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: cuid("staff1") } as never);
    vi.mocked(prisma.payrollEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.payrollEntry.upsert).mockResolvedValue({ id: "pe1", netAmount: 115000 } as never);

    const res = await POST(makeRequest("http://localhost/api/staff/payroll", { method: "POST", body: PAYROLL_BODY }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.netAmount).toBe(115000);
    const upsertCall = vi.mocked(prisma.payrollEntry.upsert).mock.calls[0][0] as { create: { status: string; schoolId: string } };
    expect(upsertCall.create.status).toBe("DRAFT");
    expect(upsertCall.create.schoolId).toBe(FIXTURES.schoolA);
  });
});

describe("PATCH /api/staff/payroll/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid non-HR roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid action", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "delete" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the slip is not in the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(404);
  });

  it("should reject paying a draft slip", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(makeEntry({ status: "DRAFT" }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Seule une fiche validée peut être payée.");
  });

  it("should pay a validated slip", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(makeEntry({ status: "VALIDATED" }));
    vi.mocked(prisma.payrollEntry.update).mockResolvedValue({ status: "PAID" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "pay" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.status).toBe("PAID");
    const updateCall = vi.mocked(prisma.payrollEntry.update).mock.calls[0][0] as { data: { status: string; paidAt: Date } };
    expect(updateCall.data.status).toBe("PAID");
    expect(updateCall.data.paidAt).toBeInstanceOf(Date);
  });

  it("should reject validating an already validated slip", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(makeEntry({ status: "VALIDATED" }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "validate" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Cette fiche est déjà validée.");
  });

  it("should reject validation without an open fiscal year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(makeEntry({ status: "DRAFT" }));
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "validate" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Aucun exercice fiscal ouvert. Créez-en un dans la comptabilité.");
  });

  it("should validate the slip and post the OHADA journal entry", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.payrollEntry.findFirst).mockResolvedValue(makeEntry({ status: "DRAFT", netAmount: 115000 }));
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue({ id: cuid("fy1") } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        ohadaAccount: {
          upsert: vi.fn().mockResolvedValue({ id: cuid("accexp") }),
          update: vi.fn(),
        },
        journalEntry: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({ id: cuid("journal1"), pieceRef: "PIECE-2026-08-0001" }),
        },
        payrollEntry: { update: vi.fn().mockResolvedValue({ id: "pe1" }) },
        auditLog: { create: vi.fn() },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await PATCH(makeRequest("http://localhost/api/staff/payroll/pe1", { method: "PATCH", body: { action: "validate" } }), { params: Promise.resolve({ id: "pe1" }) });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({
      status: "VALIDATED",
      journalEntryId: cuid("journal1"),
      pieceRef: "PIECE-2026-08-0001",
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});