import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { computeStudentFeeDues } from "@/lib/finance/expected-fees";
import { getParentDashboardData, getStudentDashboardData } from "@/lib/services/analytics-dashboard/family";

vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findFirst: vi.fn() },
    academicYear: { findUnique: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    parentProfile: { findFirst: vi.fn() },
    installmentPayment: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/finance/expected-fees", () => ({ computeStudentFeeDues: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: "sp1" } as never);
  vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([]);
  vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
  vi.mocked(computeStudentFeeDues).mockResolvedValue([]);
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

describe("getParentDashboardData — échéances", () => {
  beforeEach(() => {
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({
      parentStudents: [{ student: { id: "s1", userId: "u1", user: { firstName: "Awa", lastName: "Kora" } } }],
    } as never);
  });

  it("la prochaine échéance est la plus proche à venir ; les passées sont comptées en retard", async () => {
    const past = new Date(Date.now() - 10 * DAY);
    const soon = new Date(Date.now() + 5 * DAY);
    const later = new Date(Date.now() + 20 * DAY);
    const plan = { studentId: "s1", fee: { name: "Scolarité" } };
    vi.mocked(prisma.installmentPayment.findMany).mockResolvedValue([
      { id: "i1", status: "PENDING", dueDate: past, amount: 1000, paidAt: null, paymentPlan: plan },
      { id: "i2", status: "PENDING", dueDate: later, amount: 1000, paidAt: null, paymentPlan: plan },
      { id: "i3", status: "PENDING", dueDate: soon, amount: 1000, paidAt: null, paymentPlan: plan },
    ] as never);

    const data = await getParentDashboardData("parent", "y1");
    expect(data.nextDueDate).toBe(soon.toISOString());
    expect(data.overdueCount).toBe(1);
    expect(data.totalDue).toBe(3000);
  });

  it("aucune échéance à venir : nextDueDate null même s'il reste des retards", async () => {
    vi.mocked(prisma.installmentPayment.findMany).mockResolvedValue([
      { id: "i1", status: "PENDING", dueDate: new Date(Date.now() - DAY), amount: 500, paidAt: null, paymentPlan: { studentId: "s1", fee: { name: "Cantine" } } },
    ] as never);

    const data = await getParentDashboardData("parent", "y1");
    expect(data.nextDueDate).toBeNull();
    expect(data.overdueCount).toBe(1);
  });
});
