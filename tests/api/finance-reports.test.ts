import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/finance/reports/generate/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Route sans restriction de rôle (createApiHandler par défaut) : seuls les
// modèles prisma réellement lus sont mockés. resolveFinanceDateRange n'est
// exercé que sur le chemin explicite (startDate/endDate), sans academicYear.
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findUnique: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    fee: { findMany: vi.fn() },
  },
}));

const ACCOUNTANT = makeSession("ACCOUNTANT");
const NO_SCHOOL_ROOT = makeSession("SUPER_ADMIN", { schoolId: null });

function schoolRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.schoolA,
    name: "École A",
    address: "Cotonou",
    phone: "+229 00 00 00 00",
    email: "a@a.bj",
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/finance/reports/generate", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/finance/reports/generate"));
    expect(res.status).toBe(401);
  });

  it("retourne 400 sans école active (SUPER_ADMIN sans schoolId)", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await GET(makeRequest("http://localhost/api/finance/reports/generate"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID d'établissement requis");
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(
      makeRequest(`http://localhost/api/finance/reports/generate?schoolId=${FIXTURES.schoolB}`)
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si l'établissement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null as never);
    const res = await GET(makeRequest("http://localhost/api/finance/reports/generate"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Établissement non trouvé");
  });

  it("génère un rapport summary (frais attendus, collectés, impayés)", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(schoolRecord() as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        id: cuid("plan1"),
        totalAmount: 100000,
        paidAmount: 40000,
        studentId: FIXTURES.studentA,
        fee: { dueDate: null },
        installmentPayments: [],
      },
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: cuid("pay1"), amount: 50000, paidAt: new Date("2026-01-10"), createdAt: new Date("2026-01-10") },
    ] as never);

    const res = await GET(
      makeRequest("http://localhost/api/finance/reports/generate?reportType=summary")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reportType).toBe("summary");
    expect(body.school.name).toBe("École A");
    expect(body.period).toEqual({ start: null, end: null });
    expect(body.pdfUrl).toBeNull();
    expect(body.data).toMatchObject({
      totalFees: 100000,
      feesCount: 1,
      totalCollected: 50000,
      paymentsCount: 1,
      totalPending: 60000,
      pendingCount: 1,
      totalPaidOnPlans: 40000,
    });
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where).toEqual({
      fee: { schoolId: FIXTURES.schoolA },
      status: { not: "CANCELLED" },
    });
  });

  it("génère un rapport payments avec les élèves et totaux", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(schoolRecord() as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: cuid("pay1"),
        amount: 50000,
        paidAt: new Date("2026-01-10T08:00:00Z"),
        createdAt: new Date("2026-01-10T08:00:00Z"),
        method: "CASH",
        status: "VERIFIED",
        student: { user: { firstName: "Awa", lastName: "Dossou" } },
        fee: { name: "Scolarité T1" },
      },
    ] as never);

    const res = await GET(
      makeRequest("http://localhost/api/finance/reports/generate?reportType=payments")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.totalCount).toBe(1);
    expect(body.data.totalAmount).toBe(50000);
    expect(body.data.payments[0]).toMatchObject({
      id: cuid("pay1"),
      student: "Awa Dossou",
      fee: "Scolarité T1",
      amount: 50000,
      method: "CASH",
      status: "VERIFIED",
    });
    expect(prisma.paymentPlan.findMany).not.toHaveBeenCalled();
  });

  it("génère un rapport fees avec le nombre de paiements par frais", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(schoolRecord() as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      {
        id: FIXTURES.feeA,
        name: "Scolarité T1",
        amount: 100000,
        dueDate: null,
        isRequired: true,
        _count: { payments: 5 },
      },
    ] as never);

    const res = await GET(
      makeRequest("http://localhost/api/finance/reports/generate?reportType=fees")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.totalFees).toBe(100000);
    expect(body.data.fees[0]).toMatchObject({
      name: "Scolarité T1",
      paymentsCount: 5,
      isRequired: true,
    });
    expect(vi.mocked(prisma.fee.findMany).mock.calls[0][0].where).toEqual({
      schoolId: FIXTURES.schoolA,
      isActive: true,
    });
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/finance/reports/generate"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la génération du rapport");
  });
});

describe("POST /api/finance/reports/generate", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/finance/reports/generate", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("retourne 400 sans école active", async () => {
    vi.mocked(auth).mockResolvedValue(NO_SCHOOL_ROOT);
    const res = await POST(makeRequest("http://localhost/api/finance/reports/generate", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("retourne 404 si l'établissement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null as never);
    const res = await POST(makeRequest("http://localhost/api/finance/reports/generate", { method: "POST" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Établissement non trouvé");
  });

  it("exporte un rapport texte avec en-têtes attachment", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(schoolRecord() as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);

    const res = await POST(
      makeRequest("http://localhost/api/finance/reports/generate?reportType=summary", { method: "POST" })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain("rapport-financier-summary.txt");
    const content = await res.text();
    expect(content).toContain("RAPPORT FINANCIER");
    expect(content).toContain("École A");
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(ACCOUNTANT);
    vi.mocked(prisma.school.findUnique).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/finance/reports/generate", { method: "POST" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de l'export du rapport");
  });
});