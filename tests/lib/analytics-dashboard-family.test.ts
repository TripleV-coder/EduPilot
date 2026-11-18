import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getChildFinance } from "@/lib/finance/family-finance";
import { getParentDashboardData, getStudentDashboardData } from "@/lib/services/analytics-dashboard/family";

vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findFirst: vi.fn() },
    academicYear: { findUnique: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    parentProfile: { findFirst: vi.fn() },
  },
}));
// Source canonique de la page Paiements (testée sur une vraie base : parent-payment-journey)
vi.mock("@/lib/finance/family-finance", () => ({ getChildFinance: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: "sp1" } as never);
  vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([]);
  vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
});

describe("getStudentDashboardData — présence", () => {
  it("renvoie null, pas 0 %, quand aucun appel n'a été enregistré", async () => {
    const data = await getStudentDashboardData("u1", "y1");
    expect(data.attendanceRate).toBeNull();
  });

  it("compte présents et retards sur le total des appels", async () => {
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
      { status: "PRESENT", _count: 7 },
      { status: "LATE", _count: 1 },
      { status: "ABSENT", _count: 2 },
    ] as never);
    const data = await getStudentDashboardData("u1", "y1");
    expect(data.attendanceRate).toBe(80);
  });
});

type Row = { id: string; amount: number; dueDate: Date; status: string; covered: number; outstanding: number; payable: boolean };
const fee = (name: string, remaining: number, installments: Row[] | null, dueDate: Date | null = null) =>
  ({ feeId: `f-${name}`, name, remaining, installments, dueDate });
const finance = (fees: unknown[], remaining: number) =>
  ({ child: { studentId: "s1", firstName: "Awa" }, totals: { remaining }, fees }) as never;
const row = (id: string, dueDate: Date, amount: number, covered: number): Row =>
  ({ id, amount, dueDate, status: covered >= amount ? "PAID" : "PENDING", covered, outstanding: amount - covered, payable: false });

describe("getParentDashboardData — échéances (source : page Paiements)", () => {
  beforeEach(() => {
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({
      parentStudents: [{ student: { id: "s1", userId: "u1", user: { firstName: "Awa", lastName: "Kora" } } }],
    } as never);
  });

  it("la prochaine échéance est la plus proche à venir ; les passées sont comptées en retard", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const soon = new Date(Date.now() + 5 * DAY);
    const later = new Date(Date.now() + 20 * DAY);
    vi.mocked(getChildFinance).mockResolvedValue(
      finance([fee("Scolarité", 3000, [row("i1", past, 1000, 0), row("i2", later, 1000, 0), row("i3", soon, 1000, 0)])], 3000),
    );
    const data = await getParentDashboardData("parent", "y1");
    expect(data.nextDueDate).toBe(soon.toISOString());
    expect(data.overdueCount).toBe(1);
    expect(data.totalDue).toBe(3000);
  });

  it("échéance déjà payée : jamais proposée ; partiellement couverte : son reste seulement", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const soon = new Date(Date.now() + 5 * DAY);
    vi.mocked(getChildFinance).mockResolvedValue(
      finance([fee("Cantine", 50000, [row("paid", past, 30000, 30000), row("part", soon, 30000, 10000), row("next", soon, 30000, 0)])], 50000),
    );
    const data = await getParentDashboardData("parent", "y1");
    expect(data.pendingPayments.map((p) => [p.id, p.amount])).toEqual([["part", 20000], ["next", 30000]]);
    expect(data.overdueCount).toBe(0);
  });

  it("total = reste canonique, y compris au-delà de 60 jours ; « Payer » connaît l'enfant", async () => {
    const far = new Date(Date.now() + 200 * DAY);
    vi.mocked(getChildFinance).mockResolvedValue(finance([fee("Scolarité", 100000, null, far)], 100000));
    const data = await getParentDashboardData("parent", "y1");
    expect(data.totalDue).toBe(100000);
    expect(data.pendingPayments).toEqual([]);
    expect(data.nextDueDate).toBe(far.toISOString());
  });

  it("chaque ligne porte l'enfant concerné", async () => {
    vi.mocked(getChildFinance).mockResolvedValue(finance([fee("Scolarité", 5000, null, null)], 5000));
    const data = await getParentDashboardData("parent", "y1");
    expect(data.pendingPayments[0]).toMatchObject({ studentId: "s1", childName: "Awa", amount: 5000 });
  });
});
