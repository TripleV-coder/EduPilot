import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    fee: { findMany: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn(), findFirst: vi.fn() },
    payment: { groupBy: vi.fn(), aggregate: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { computePlanlessExpected, computeStudentBalances, computeStudentFeeDues, computeYearFeeRecovery } from "@/lib/finance/expected-fees";

const enrol = (studentId: string, code: string, academicYearId = "y1") => ({
  studentId,
  academicYearId,
  class: { classLevel: { code } },
  student: { user: { firstName: "Élève", lastName: studentId.toUpperCase() } },
});

const totals = (r: { expected: number; pending: number }) => ({ expected: r.expected, pending: r.pending });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as never);
});

describe("computePlanlessExpected", () => {
  it("renvoie 0 sans frais actif, sans interroger les inscriptions", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([] as never);
    const r = await computePlanlessExpected({ schoolId: "s1", plannedKeys: new Set() });
    expect(totals(r)).toEqual({ expected: 0, pending: 0 });
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("attend le montant du frais par élève inscrit du niveau, moins les paiements validés", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 100000, classLevelCode: "6E", academicYearId: "y1" },
    ] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      enrol("a", "6E"),
      enrol("b", "6E"),
      enrol("c", "5E"), // autre niveau : non concerné
    ] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { feeId: "f1", studentId: "a", _sum: { amount: 100000 } },
      { feeId: "f1", studentId: "b", _sum: { amount: 30000 } },
    ] as never);

    const r = await computePlanlessExpected({ schoolId: "s1", plannedKeys: new Set() });
    expect(totals(r)).toEqual({ expected: 200000, pending: 70000 });
  });

  it("ignore les élèves déjà couverts par un échéancier et compte un transféré une seule fois", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 50000, classLevelCode: null, academicYearId: "y1" },
    ] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      enrol("a", "6E"),
      enrol("a", "5E"), // transfert en cours d'année
      enrol("b", "6E"),
    ] as never);

    const r = await computePlanlessExpected({ schoolId: "s1", plannedKeys: new Set(["f1:b"]) });
    expect(totals(r)).toEqual({ expected: 50000, pending: 50000 });
  });

  it("rattache un frais sans année à l'année courante", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 10000, classLevelCode: null, academicYearId: null },
    ] as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: "cur" } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([enrol("a", "6E", "cur"), enrol("b", "6E", "old")] as never);

    const r = await computePlanlessExpected({ schoolId: "s1", plannedKeys: new Set() });
    expect(totals(r)).toEqual({ expected: 10000, pending: 10000 });
  });

  it("ne compte rien quand aucune année courante n'existe pour un frais sans année", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 10000, classLevelCode: null, academicYearId: null },
    ] as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null as never);
    const r = await computePlanlessExpected({ schoolId: "s1", plannedKeys: new Set() });
    expect(totals(r)).toEqual({ expected: 0, pending: 0 });
  });

  it("restreint les frais à l'échéance de la période", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([] as never);
    const range = { startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31") };
    await computePlanlessExpected({ schoolId: "s1", periodRange: range, plannedKeys: new Set() });
    expect(vi.mocked(prisma.fee.findMany).mock.calls[0][0]?.where?.dueDate).toEqual({
      gte: range.startDate,
      lte: range.endDate,
    });
  });
});

describe("computeYearFeeRecovery", () => {
  it("additionne échéanciers et frais sans échéancier, et plafonne le taux à 100 %", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      { feeId: "f1", studentId: "a", totalAmount: 100000 },
    ] as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 150000 } } as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 100000, classLevelCode: null, academicYearId: "y1" },
    ] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([enrol("a", "6E"), enrol("b", "6E")] as never);

    const r = await computeYearFeeRecovery("s1", "y1");
    // a est sous échéancier (100 000), b doit le frais (100 000) → 200 000 attendus.
    expect(r).toEqual({ expected: 200000, collected: 150000, rate: 75 });
  });

  it("renvoie null quand rien n'est facturé, plutôt qu'un taux inventé", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 5000 } } as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([] as never);
    expect(await computeYearFeeRecovery("s1", "y1")).toBeNull();
  });
});

describe("computePlanlessExpected — retards", () => {
  it("liste les élèves dont un frais échu n'est pas soldé, avec le reste dû", async () => {
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", amount: 80000, classLevelCode: null, academicYearId: "y1", dueDate: new Date("2026-01-10") },
      { id: "f2", amount: 20000, classLevelCode: null, academicYearId: "y1", dueDate: new Date("2026-12-10") },
    ] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([enrol("a", "6E"), enrol("b", "6E")] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { feeId: "f1", studentId: "a", _sum: { amount: 80000 } },
      { feeId: "f1", studentId: "b", _sum: { amount: 30000 } },
    ] as never);

    const r = await computePlanlessExpected({
      schoolId: "s1",
      plannedKeys: new Set(),
      now: new Date("2026-06-01"),
    });
    // f2 n'est pas encore échu : seul le reste de f1 pour b est en retard.
    expect([...r.overdue]).toEqual([["b", { studentName: "Élève B", balance: 50000 }]]);
  });
});

describe("computeStudentFeeDues", () => {
  const enrolled = (studentId: string, code: string, schoolId = "s1") => ({
    studentId,
    academicYearId: "y1",
    class: { schoolId, classLevel: { code } },
  });

  it("ne lit rien sans élève", async () => {
    expect(await computeStudentFeeDues([])).toEqual([]);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("renvoie le reste dû par frais, hors frais soldés, sous échéancier ou d'un autre niveau", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([enrolled("a", "6E")] as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", name: "Inscription", amount: 50000, classLevelCode: null, schoolId: "s1", academicYearId: "y1", dueDate: null },
      { id: "f2", name: "Scolarité", amount: 90000, classLevelCode: null, schoolId: "s1", academicYearId: null, dueDate: null },
      { id: "f3", name: "Cantine", amount: 20000, classLevelCode: null, schoolId: "s1", academicYearId: "y1", dueDate: null },
      { id: "f4", name: "Examen 3e", amount: 15000, classLevelCode: "3E", schoolId: "s1", academicYearId: "y1", dueDate: null },
      { id: "f5", name: "Autre école", amount: 10000, classLevelCode: null, schoolId: "s2", academicYearId: "y1", dueDate: null },
    ] as never);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([{ feeId: "f2", studentId: "a" }] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { feeId: "f1", studentId: "a", _sum: { amount: 20000 } },
      { feeId: "f3", studentId: "a", _sum: { amount: 20000 } },
    ] as never);

    expect(await computeStudentFeeDues(["a"])).toEqual([
      { studentId: "a", feeId: "f1", feeName: "Inscription", remaining: 30000, dueDate: null },
    ]);
  });
});

describe("computeStudentBalances — préremplissage du guichet", () => {
  beforeEach(() => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
      academicYearId: "y1",
      class: { schoolId: "sch1", classLevel: { code: "6EME" } },
    } as never);
    vi.mocked(prisma.fee.findMany).mockResolvedValue([
      { id: "f1", name: "Scolarité", amount: 150000, dueDate: null },
      { id: "f2", name: "Tenue", amount: 15000, dueDate: null },
    ] as never);
  });

  it("propose le reste dû, pas le total, et déduit ce qui est en attente", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { feeId: "f1", status: "VERIFIED", _sum: { amount: 100000 } },
      { feeId: "f1", status: "PENDING", _sum: { amount: 20000 } },
    ] as never);

    const [scolarite, tenue] = await computeStudentBalances("s1");
    expect(scolarite).toMatchObject({ billed: 150000, paid: 100000, pending: 20000, remaining: 50000, suggested: 30000 });
    expect(tenue).toMatchObject({ billed: 15000, paid: 0, remaining: 15000, suggested: 15000 });
  });

  it("un échéancier remplace le montant du frais (remise accordée)", async () => {
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([{ feeId: "f1", totalAmount: 120000 }] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([{ feeId: "f1", status: "RECONCILED", _sum: { amount: 120000 } }] as never);

    const [scolarite] = await computeStudentBalances("s1");
    expect(scolarite).toMatchObject({ billed: 120000, remaining: 0, suggested: 0 });
  });

  it("aucune inscription active : aucun solde", async () => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);
    expect(await computeStudentBalances("s1")).toEqual([]);
  });
});
