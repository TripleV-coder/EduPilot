import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    fiscalYear: { findFirst: vi.fn() },
    ohadaAccount: { findMany: vi.fn() },
    journalEntry: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/accounting/overview/route";

const fiscalYearId = cuid("fy2026");

function ohadaAccount(code: string, type: string, balance: bigint) {
  return {
    id: cuid(`acc${code}`),
    syscohadaCode: code,
    label: `Compte ${code}`,
    type,
    balanceFcfa: balance,
    isActive: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/accounting/overview", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(makeRequest("http://localhost:3000/api/accounting/overview"));
    expect(response.status).toBe(401);
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await GET(makeRequest("http://localhost:3000/api/accounting/overview"));
    expect(response.status).toBe(403);
  });

  it("bloque la consultation cross-tenant via ?schoolId (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/accounting/overview?schoolId=${FIXTURES.schoolB}`)
    );

    expect(response.status).toBe(403);
    expect(prisma.fiscalYear.findFirst).not.toHaveBeenCalled();
  });

  it("retourne des KPIs à zéro sans exercice fiscal", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue(null);

    const response = await GET(makeRequest("http://localhost:3000/api/accounting/overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fiscalYear).toBeNull();
    expect(body.kpis).toEqual({
      cashBalanceFcfa: "0",
      bankBalanceFcfa: "0",
      momoBalanceFcfa: "0",
      exerciseResultFcfa: "0",
      journalEntryCount: 0,
    });
    expect(body.journalEntries).toEqual([]);
  });

  it("calcule les soldes caisse/banque/momo et le résultat d'exercice (produits - charges)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue({
      id: fiscalYearId,
      label: "Exercice 2026",
      status: "OPEN",
    } as any);
    vi.mocked(prisma.ohadaAccount.findMany).mockResolvedValue([
      ohadaAccount("571", "ASSET", BigInt(250000)), // caisse
      ohadaAccount("521", "ASSET", BigInt(1200000)), // banque
      ohadaAccount("531", "ASSET", BigInt(80000)), // momo
      ohadaAccount("701", "INCOME", BigInt(2000000)), // produits scolarité
      ohadaAccount("661", "EXPENSE", BigInt(900000)), // salaires
      ohadaAccount("605", "EXPENSE", BigInt(300000)), // fournitures
    ] as any);
    vi.mocked(prisma.journalEntry.findMany).mockResolvedValue([
      {
        id: cuid("je1"),
        pieceRef: "PC-2026-001",
        entryDate: new Date("2026-01-15"),
        label: "Encaissement scolarité",
        lines: [
          {
            id: cuid("jel1"),
            amountFcfa: BigInt(150000),
            label: "Scolarité Awa Dossou",
            debitAccount: { syscohadaCode: "571", label: "Caisse" },
            creditAccount: { syscohadaCode: "701", label: "Produits scolarité" },
          },
        ],
      },
    ] as any);
    vi.mocked(prisma.journalEntry.count).mockResolvedValue(42);

    const response = await GET(makeRequest("http://localhost:3000/api/accounting/overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fiscalYear).toEqual({ id: fiscalYearId, label: "Exercice 2026", status: "OPEN" });
    expect(body.kpis.cashBalanceFcfa).toBe("250000");
    expect(body.kpis.bankBalanceFcfa).toBe("1200000");
    expect(body.kpis.momoBalanceFcfa).toBe("80000");
    // Résultat = 2 000 000 - (900 000 + 300 000)
    expect(body.kpis.exerciseResultFcfa).toBe("800000");
    expect(body.kpis.journalEntryCount).toBe(42);

    // Chaque ligne d'écriture porte un débit ET un crédit (partie double)
    const line = body.journalEntries[0].lines[0];
    expect(line.debit).toEqual({ code: "571", label: "Caisse" });
    expect(line.credit).toEqual({ code: "701", label: "Produits scolarité" });
    expect(line.amountFcfa).toBe("150000");

    // Top dépenses trié décroissant avec pourcentages cohérents (somme = 100)
    expect(body.expenseAccounts.map((a: any) => a.code)).toEqual(["661", "605"]);
    expect(body.expenseAccounts[0].pct).toBe(75);
    expect(body.expenseAccounts[1].pct).toBe(25);
    expect(body.expenseTotalFcfa).toBe("1200000");

    // Seules les écritures POSTED de l'exercice actif sont lues
    expect(vi.mocked(prisma.journalEntry.findMany).mock.calls[0][0].where).toMatchObject({
      schoolId: FIXTURES.schoolA,
      fiscalYearId,
      status: "POSTED",
    });
  });

  it("borne txLimit entre 1 et 100", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue({
      id: fiscalYearId,
      label: "Exercice 2026",
      status: "OPEN",
    } as any);
    vi.mocked(prisma.ohadaAccount.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.journalEntry.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.journalEntry.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/accounting/overview?txLimit=5000"));

    expect(vi.mocked(prisma.journalEntry.findMany).mock.calls[0][0].take).toBe(100);
  });
});
