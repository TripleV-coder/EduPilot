import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/accounting/entries/route";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/tenant-rls", () => ({
  withTenantRls: vi.fn(),
}));

import { withTenantRls } from "@/lib/db/tenant-rls";

function mockTx() {
  return {
    ohadaAccount: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    fiscalYear: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    journalEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
}

function stubTenant(fn: (tx: ReturnType<typeof mockTx>) => unknown) {
  const tx = mockTx();
  vi.mocked(withTenantRls).mockImplementation(async (_schoolId: string, cb: (t: typeof tx) => unknown) => cb(tx));
  return tx;
}

describe("GET /api/accounting/entries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/accounting/entries"));
    expect(res.status).toBe(401);
  });

  it("should list accounts and fiscal years with accounts=1", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const tx = stubTenant(() => undefined);
    vi.mocked(tx.ohadaAccount.findMany).mockResolvedValue([{ id: "a1", syscohadaCode: "601", label: "Achats", type: "CHARGE" }] as never);
    vi.mocked(tx.fiscalYear.findMany).mockResolvedValue([{ id: "f1", label: "2026" }] as never);

    const res = await GET(makeRequest("http://localhost/api/accounting/entries?accounts=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accounts).toHaveLength(1);
    expect(body.fiscalYears).toHaveLength(1);
  });

  it("should list recent entries with account labels", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const tx = stubTenant(() => undefined);
    vi.mocked(tx.journalEntry.findMany).mockResolvedValue([
      {
        id: "e1",
        pieceRef: "PIECE-2026-08-0001",
        entryDate: new Date("2026-08-10T10:00:00Z"),
        label: "Achat fournitures",
        status: "POSTED",
        lines: [
          { id: "l1", amountFcfa: 5000n, label: null, debitAccount: { syscohadaCode: "601", label: "Achats" }, creditAccount: null },
          { id: "l2", amountFcfa: 5000n, label: null, debitAccount: null, creditAccount: { syscohadaCode: "571", label: "Caisse" } },
        ],
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/accounting/entries"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].pieceRef).toBe("PIECE-2026-08-0001");
    expect(body.entries[0].lines[0].debit).toBe("601 · Achats");
    expect(body.entries[0].lines[1].credit).toBe("571 · Caisse");
  });
});

describe("POST /api/accounting/entries", () => {
  const balanced = {
    entryDate: "2026-08-10",
    label: "Achat de fournitures",
    lines: [
      { debitAccountId: "acc1", amountFcfa: 5000, label: "Fournitures" },
      { creditAccountId: "acc2", amountFcfa: 5000 },
    ],
  };

  beforeEach(() => vi.clearAllMocks());

  it("should return 400 for a too-short label", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost/api/accounting/entries", { method: "POST", body: { ...balanced, label: "X" } }));
    expect(res.status).toBe(400);
  });

  it("should return 400 for an unbalanced entry", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost/api/accounting/entries", {
      method: "POST",
      body: {
        ...balanced,
        lines: [
          { debitAccountId: "acc1", amountFcfa: 5000 },
          { creditAccountId: "acc2", amountFcfa: 4000 },
        ],
      },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("déséquilibrée");
  });

  it("should reject lines imputing neither debit nor credit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost/api/accounting/entries", {
      method: "POST",
      body: {
        ...balanced,
        lines: [
          { amountFcfa: 5000 },
          { creditAccountId: "acc2", amountFcfa: 5000 },
        ],
      },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 409 when no fiscal year is open", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const tx = stubTenant(() => undefined);
    vi.mocked(tx.fiscalYear.findFirst).mockResolvedValue(null);

    const res = await POST(makeRequest("http://localhost/api/accounting/entries", { method: "POST", body: balanced }));
    expect(res.status).toBe(409);
  });

  it("should reject accounts from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const tx = stubTenant(() => undefined);
    vi.mocked(tx.fiscalYear.findFirst).mockResolvedValue({ id: "f1" } as never);
    vi.mocked(tx.ohadaAccount.count).mockResolvedValue(1);

    const res = await POST(makeRequest("http://localhost/api/accounting/entries", { method: "POST", body: balanced }));
    expect(res.status).toBe(400);
  });

  it("should create the entry with an auto-incremented piece reference", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { id: "u1" }));
    const tx = stubTenant(() => undefined);
    vi.mocked(tx.fiscalYear.findFirst).mockResolvedValue({ id: "f1" } as never);
    vi.mocked(tx.ohadaAccount.count).mockResolvedValue(2);
    vi.mocked(tx.journalEntry.count).mockResolvedValue(3);
    vi.mocked(tx.journalEntry.create).mockResolvedValue({ id: "e1", label: "Achat de fournitures" } as never);

    const res = await POST(makeRequest("http://localhost/api/accounting/entries", { method: "POST", body: balanced }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.pieceRef).toBe("PIECE-2026-08-0004");
    expect(tx.ohadaAccount.update).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});