/**
 * Couverture finance : rapports (/reports/generate), tableau de bord,
 * modification/annulation d'un paiement, paiements du parent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findUnique: vi.fn() },
    period: { findUnique: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
    payment: { findMany: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    fee: { findMany: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
// Frais sans échéancier : testé à part (tests/lib/finance-expected-fees.test.ts).
vi.mock("@/lib/finance/expected-fees", () => ({
  computePlanlessExpected: vi.fn(async () => ({ expected: 0, pending: 0, overdue: new Map() })),
  computeStudentFeeDues: vi.fn(async () => []),
}));
vi.mock("@/lib/modules/school-modules", () => ({ getEnabledModules: vi.fn() }));
vi.mock("@/lib/security/audit-log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return { ...actual, invalidateByPath: vi.fn() };
});
vi.mock("@/lib/finance/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/finance/helpers")>();
  return { ...actual, resolveFinanceDateRange: vi.fn(), syncPaymentPlanLedger: vi.fn() };
});

import prisma from "@/lib/prisma";
import { resolveFinanceDateRange, syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { GET as getReport, POST as exportReport } from "@/app/api/finance/reports/generate/route";
import { GET as getDashboard } from "@/app/api/finance/dashboard/route";
import { PUT as putPayment, DELETE as deletePayment } from "@/app/api/finance/payments/[id]/route";
import { GET as getMyPayments } from "@/app/api/finance/my-payments/route";

const reportUrl = "http://localhost/api/finance/reports/generate";
const school = { name: "CEG Akpakpa", address: null, phone: null, email: null };
const student = (first: string, last: string) => ({ user: { firstName: first, lastName: last } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolA }));
  vi.mocked(prisma.school.findUnique).mockResolvedValue(school as never);
  vi.mocked(resolveFinanceDateRange).mockResolvedValue({});
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (tx: unknown) => unknown) => Promise.resolve(cb(prisma))) as never);
});

describe("GET /api/finance/reports/generate", () => {
  it("outstanding : cumule les soldes par élève, ignore les plans soldés et trie par montant", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      { studentId: "s1", totalAmount: 100000, paidAmount: 40000, student: student("Awa", "Dossou") },
      { studentId: "s1", totalAmount: 20000, paidAmount: 0, student: student("Awa", "Dossou") },
      { studentId: "s2", totalAmount: 90000, paidAmount: 0, student: student("Koffi", "Agbo") },
      { studentId: "s3", totalAmount: 50000, paidAmount: 50000, student: student("Soldé", "Total") },
    ] as never);
    const res = await getReport(makeRequest(`${reportUrl}?reportType=outstanding&academicYearId=ay1`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.outstandingStudents).toEqual([
      { studentId: "s2", name: "Koffi Agbo", totalOutstanding: 90000, paymentCount: 1 },
      { studentId: "s1", name: "Awa Dossou", totalOutstanding: 80000, paymentCount: 2 },
    ]);
    expect(body.data.totalOutstanding).toBe(170000);
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0]?.where).toMatchObject({
      fee: { schoolId: FIXTURES.schoolA, academicYearId: "ay1" },
    });
  });

  it("reconciliation : paiements vérifiés non rapprochés de l'école", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", paidAt: new Date("2026-02-01"), amount: 15000, method: "CASH", student: student("Awa", "Dossou"), fee: { name: "T1" } },
      { id: "p2", paidAt: null, amount: 5000, method: "MOBILE_MONEY", student: null, fee: null },
    ] as never);
    const body = await (await getReport(makeRequest(`${reportUrl}?reportType=reconciliation`))).json();
    expect(body.data.count).toBe(2);
    expect(body.data.totalUnreconciled).toBe(20000);
    expect(body.data.unreconciledPayments[0].student).toBe("Awa Dossou");
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0]?.where).toEqual({
      fee: { schoolId: FIXTURES.schoolA },
      status: "VERIFIED",
      reconciledAt: null,
    });
  });

  it("collection : agrège les encaissements par mois (date effective)", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { amount: 10000, paidAt: new Date("2026-01-05"), createdAt: new Date("2026-01-01") },
      { amount: 5000, paidAt: null, createdAt: new Date("2026-01-20") },
      { amount: 7000, paidAt: new Date("2026-02-02"), createdAt: new Date("2026-02-01") },
    ] as never);
    const body = await (await getReport(makeRequest(`${reportUrl}?reportType=collection`))).json();
    expect(body.data.monthlyCollection).toEqual([
      { month: "2026-01", total: 15000, count: 2 },
      { month: "2026-02", total: 7000, count: 1 },
    ]);
    expect(body.data.totalCollected).toBe(22000);
  });

  it("type inconnu : retombe sur le résumé, en filtrant les échéances par période", async () => {
    vi.mocked(resolveFinanceDateRange).mockResolvedValue({
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
    });
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        totalAmount: 90000,
        paidAmount: 30000,
        studentId: "s1",
        fee: { dueDate: null },
        installmentPayments: [
          { amount: 30000, dueDate: new Date("2025-12-01"), status: "PAID" },
          { amount: 30000, dueDate: new Date("2026-02-01"), status: "PENDING" },
          { amount: 30000, dueDate: new Date("2026-05-01"), status: "PENDING" },
        ],
      },
      // Sans échéance dans la période, frais échu dans la période : attendu = total.
      { totalAmount: 20000, paidAmount: 5000, studentId: "s2", fee: { dueDate: new Date("2026-02-15") }, installmentPayments: [] },
      // Frais hors période : rien d'attendu.
      { totalAmount: 20000, paidAmount: 0, studentId: "s3", fee: { dueDate: new Date("2026-06-15") }, installmentPayments: [] },
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([{ amount: 12000 }] as never);
    const body = await (await getReport(makeRequest(`${reportUrl}?reportType=inconnu`))).json();
    expect(body.reportType).toBe("inconnu");
    expect(body.data).toMatchObject({ totalFees: 50000, totalPending: 45000, pendingCount: 2, totalCollected: 12000 });
    expect(body.period.start).toBe("2026-01-01T00:00:00.000Z");
  });

  it("résumé sans période : plans sans échéancier pris au total", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      { totalAmount: 50000, paidAmount: 60000, studentId: "s1", fee: { dueDate: null }, installmentPayments: [] },
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const body = await (await getReport(makeRequest(reportUrl))).json();
    expect(body.data).toMatchObject({ totalFees: 50000, totalPending: 0, pendingCount: 0 });
    expect(body.period).toEqual({ start: null, end: null });
  });

  it("n'expose pas le détail d'une erreur interne (500 générique)", async () => {
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error("relation payment does not exist"));
    const res = await getReport(makeRequest(`${reportUrl}?reportType=collection`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });

  // BUG : la route n'a ni allowedRoles ni requiredPermissions. Un élève ou un
  // parent obtient les impayés nominatifs de TOUTE l'école.
  it.skip("BUG: refuse un élève (403) — rapport financier nominatif de toute l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    const res = await getReport(makeRequest(`${reportUrl}?reportType=outstanding`));
    expect(res.status).toBe(403);
    expect(prisma.paymentPlan.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/finance/reports/generate (export texte)", () => {
  async function exportText(type: string) {
    const res = await exportReport(makeRequest(`${reportUrl}?reportType=${type}`, { method: "POST" }));
    return { res, text: await res.text() };
  }

  it("payments : liste les paiements de l'école dans le fichier", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", paidAt: new Date("2026-01-05"), createdAt: new Date("2026-01-05"), amount: 10000, method: "CASH", status: "VERIFIED", student: student("Awa", "Dossou"), fee: { name: "T1" } },
    ] as never);
    const { res, text } = await exportText("payments");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("rapport-financier-payments.txt");
    expect(text).toContain("Awa Dossou");
    expect(text).toContain("Adresse: N/A");
  });

  it("fees : compte les paiements par frais (et saute le groupBy sans frais)", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValueOnce([
      { id: "f1", name: "Scolarité", amount: 45000, dueDate: null, isRequired: true },
      { id: "f2", name: "Tenue", amount: 5000, dueDate: null, isRequired: false },
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([{ feeId: "f1", _count: { _all: 3 } }] as never);
    const { text } = await exportText("fees");
    expect(text).toContain("\"paymentsCount\": 3");
    expect(text).toContain("\"totalFees\": 50000");
    expect(vi.mocked(prisma.fee.findMany).mock.calls[0][0]?.where).toEqual({ schoolId: FIXTURES.schoolA, isActive: true });

    vi.mocked(prisma.fee.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.payment.groupBy).mockClear();
    await exportText("fees");
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });

  it("outstanding, reconciliation, collection : chaque type produit son contenu", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    expect((await exportText("outstanding")).text).toContain("\"studentCount\": 0");
    expect((await exportText("reconciliation")).text).toContain("\"count\": 0");
    expect((await exportText("collection")).text).toContain("\"totalPayments\": 0");
  });

  it("résumé par défaut avec période affichée en dates françaises", async () => {
    vi.mocked(resolveFinanceDateRange).mockResolvedValue({ startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") });
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const { text } = await exportText("summary");
    expect(text).toMatch(/Période: \d{2}\/\d{2}\/2026 - \d{2}\/\d{2}\/2026/);
  });
});

describe("GET /api/finance/dashboard", () => {
  it("trie les élèves en retard par solde et la tendance par jour", async () => {
    const past = new Date(Date.now() - 20 * 86400000);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 30000 } } as never);
    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { amount: 5000, paidAt: new Date("2026-03-02"), createdAt: new Date("2026-03-02") },
        { amount: 2000, paidAt: new Date("2026-03-01"), createdAt: new Date("2026-03-01") },
      ] as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        studentId: "s1", totalAmount: 50000, paidAmount: 40000, status: "ACTIVE",
        student: student("Awa", "Dossou"), fee: { name: "T1", dueDate: null },
        installmentPayments: [{ amount: 10000, dueDate: past, status: "PENDING" }],
      },
      {
        studentId: "s2", totalAmount: 90000, paidAmount: 0, status: "OVERDUE",
        student: student("Koffi", "Agbo"), fee: { name: "T1", dueDate: null },
        installmentPayments: [],
      },
    ] as never);
    const body = await (await getDashboard(makeRequest("http://localhost/api/finance/dashboard"))).json();
    expect(body.overdueStudents.map((s: { studentId: string }) => s.studentId)).toEqual(["s2", "s1"]);
    expect(body.paymentsTrend.map((d: { date: string }) => d.date)).toEqual(["2026-03-01", "2026-03-02"]);
  });
});

describe("/api/finance/payments/[id]", () => {
  const id = cuid("payment1");
  const ctx = { params: Promise.resolve({ id }) };
  const url = `http://localhost/api/finance/payments/${id}`;
  const existing = (schoolId: string, status = "PENDING") => ({
    studentId: "s1", feeId: "f1", paidAt: null, status, amount: 10000,
    student: { user: { schoolId } }, fee: { schoolId },
  });

  it("PUT : accepte un montant transmis en chaîne (converti en nombre)", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existing(FIXTURES.schoolA) as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id } as never);
    const res = await putPayment(makeRequest(url, { method: "PUT", body: { amount: "15000" } }), ctx);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.payment.update).mock.calls[0][0].data.amount).toBe(15000);
    expect(syncPaymentPlanLedger).toHaveBeenCalledWith(prisma, "s1", "f1");
    expect(invalidateByPath).toHaveBeenCalledWith("/api/finance/dashboard");
  });

  it("PUT : pose paidAt à maintenant lors d'une vérification sans date", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existing(FIXTURES.schoolA) as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id } as never);
    await putPayment(makeRequest(url, { method: "PUT", body: { status: "VERIFIED" } }), ctx);
    expect(vi.mocked(prisma.payment.update).mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);
  });

  it("PUT : refuse un paiement d'un autre établissement (403)", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existing(FIXTURES.schoolB) as never);
    const res = await putPayment(makeRequest(url, { method: "PUT", body: { notes: "x" } }), ctx);
    expect(res.status).toBe(403);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it.skip("BUG: PUT refuse un montant négatif (400)", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existing(FIXTURES.schoolA) as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id } as never);
    const res = await putPayment(makeRequest(url, { method: "PUT", body: { amount: -50000 } }), ctx);
    expect(res.status).toBe(400);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("DELETE : refuse un paiement d'un autre établissement (403)", async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(existing(FIXTURES.schoolB) as never);
    const res = await deletePayment(makeRequest(url, { method: "DELETE" }), ctx);
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("GET /api/finance/my-payments", () => {
  it("ignore les échéanciers annulés dans le reste à payer", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{
        student: {
          id: "s1",
          user: { firstName: "Awa" },
          paymentPlans: [
            { status: "ACTIVE", totalAmount: 60000, paidAmount: 20000, fee: { name: "T1" }, installmentPayments: [] },
            { status: "CANCELLED", totalAmount: 90000, paidAmount: 0, fee: { name: "T2" }, installmentPayments: [] },
          ],
        },
      }],
    } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const body = await (await getMyPayments(makeRequest("http://localhost/api/finance/my-payments"))).json();
    expect(body.totalPending).toBe(40000);
    expect(body.payments).toEqual([]);
    expect(vi.mocked(prisma.parentProfile.findUnique).mock.calls[0][0]?.where).toEqual({ userId: expect.any(String) });
  });
});
