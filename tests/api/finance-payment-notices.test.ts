import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    fee: { findUnique: vi.fn() },
    classLevel: { findUnique: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
    payment: { groupBy: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/finance/payment-notices/route";

const url = "http://localhost/api/finance/payment-notices";

function fee(overrides: Record<string, unknown> = {}) {
  return {
    id: "fee-1",
    name: "Scolarité T1",
    description: null,
    amount: "45000",
    dueDate: new Date("2026-10-15T00:00:00Z"),
    classLevelCode: "6E",
    isActive: true,
    deletedAt: null,
    schoolId: FIXTURES.schoolA,
    academicYear: { id: "ay-1", name: "2026-2027" },
    school: { name: "CEG Akpakpa", address: "Cotonou", phone: null, email: null },
    ...overrides,
  };
}

const level = { id: "lvl-6", name: "6ème", code: "6E", schoolId: FIXTURES.schoolA };

function enrollment(studentId: string, lastName: string, className = "6ème A") {
  return {
    studentId,
    class: { name: className },
    student: { matricule: `M-${studentId}`, user: { firstName: "Awa", lastName } },
  };
}

function post(body: unknown) {
  return POST(makeRequest(url, { method: "POST", body }));
}

describe("POST /api/finance/payment-notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolA }));
  });

  it("refuse un enseignant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6" });
    expect(res.status).toBe(403);
  });

  it("masque un frais d'un autre établissement (404)", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee({ schoolId: FIXTURES.schoolB }) as never);
    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6" });
    expect(res.status).toBe(404);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("refuse un niveau que le frais ne concerne pas (400)", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee({ classLevelCode: "5E" }) as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValueOnce(level as never);
    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("6ème");
  });

  it("calcule le reste à payer : seuls les paiements validés comptent", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee() as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValueOnce(level as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValueOnce([
      enrollment("s1", "Zinsou"),
      enrollment("s2", "Adjovi"),
      enrollment("s3", "Houngbo", "6ème B"),
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([
      { studentId: "s1", status: "VERIFIED", _sum: { amount: "45000" } },
      { studentId: "s2", status: "RECONCILED", _sum: { amount: "20000" } },
      { studentId: "s2", status: "PENDING", _sum: { amount: "25000" } },
    ] as never);

    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6" });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.rows.map((r: { studentId: string }) => r.studentId)).toEqual(["s2", "s1", "s3"]);
    expect(data.rows[0]).toEqual(expect.objectContaining({ paid: 20000, pending: 25000, remaining: 25000 }));
    expect(data.rows[1]).toEqual(expect.objectContaining({ paid: 45000, remaining: 0 }));
    expect(data.rows[2]).toEqual(expect.objectContaining({ paid: 0, remaining: 45000 }));
    expect(data.totals).toEqual({ students: 3, debtors: 2, due: 135000, paid: 65000, remaining: 70000 });

    expect(vi.mocked(prisma.enrollment.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          academicYearId: "ay-1",
          status: "ACTIVE",
          class: { classLevelId: "lvl-6", schoolId: FIXTURES.schoolA },
        }),
      })
    );
    expect(vi.mocked(prisma.payment.groupBy).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ feeId: "fee-1", deletedAt: null, status: { not: "CANCELLED" } }),
      })
    );
  });

  it("rattache un frais sans année à l'année courante", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee({ academicYear: null, classLevelCode: null }) as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValueOnce(level as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValueOnce({ id: "ay-cur", name: "2026-2027" } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValueOnce([] as never);

    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.enrollment.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ academicYearId: "ay-cur" }) })
    );
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });

  it("produit un PDF d'avis pour les débiteurs", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee() as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValueOnce(level as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValueOnce([enrollment("s1", "Zinsou"), enrollment("s2", "Adjovi")] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([] as never);

    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6", format: "pdf" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="avis-paiement-[\w-]+\.pdf"/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("refuse le PDF quand personne ne doit rien (400)", async () => {
    vi.mocked(prisma.fee.findUnique).mockResolvedValueOnce(fee() as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValueOnce(level as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValueOnce([enrollment("s1", "Zinsou")] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([
      { studentId: "s1", status: "VERIFIED", _sum: { amount: "45000" } },
    ] as never);

    const res = await post({ feeId: "fee-1", classLevelId: "lvl-6", format: "pdf" });
    expect(res.status).toBe(400);
  });

  it("rejette un corps invalide (400)", async () => {
    const res = await post({ feeId: "fee-1" });
    expect(res.status).toBe(400);
  });
});
