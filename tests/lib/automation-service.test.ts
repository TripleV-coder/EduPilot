import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { createBulkNotifications } from "@/lib/services/notification.service";
import { AutomationService } from "@/lib/services/automation.service";

vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/services/notification.service", () => ({ createBulkNotifications: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({ syncAllStudentsForSchool: vi.fn() }));
vi.mock("@/lib/finance/reminders", () => ({ runInstallmentReminders: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("AutomationService.checkAbsenteeismAlerts", () => {
  // Audit N8 : un groupBy par classe, puis une lecture des administrateurs par
  // classe en alerte — des centaines de requêtes séquentielles par exécution.
  it("compte les absences de toutes les classes en une requête et n'alerte que les classes au-delà de 15 % (N8)", async () => {
    vi.mocked(prisma.class.findMany).mockResolvedValue([
      { id: "c1", name: "6e A", schoolId: "school-a" },
      { id: "c2", name: "6e B", schoolId: "school-a" },
      { id: "c3", name: "CM2", schoolId: "school-b" },
    ] as never);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
      { classId: "c1", status: "ABSENT", _count: { _all: 2 } },
      { classId: "c1", status: "PRESENT", _count: { _all: 8 } },
      { classId: "c2", status: "PRESENT", _count: { _all: 10 } },
      { classId: "c3", status: "ABSENT", _count: { _all: 1 } },
      { classId: "c3", status: "PRESENT", _count: { _all: 9 } },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin-a", schoolId: "school-a" }] as never);

    const alerts = await new AutomationService().checkAbsenteeismAlerts();

    expect(alerts).toBe(1);
    expect(prisma.attendance.groupBy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.attendance.groupBy).mock.calls[0][0]).toMatchObject({ by: ["classId", "status"] });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(createBulkNotifications).toHaveBeenCalledTimes(1);
    expect(createBulkNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["admin-a"], message: expect.stringContaining("6e A présente un taux d'absence élevé de 20.0%") }),
    );
  });

  it("n'interroge ni les administrateurs ni les notifications sans classe en alerte", async () => {
    vi.mocked(prisma.class.findMany).mockResolvedValue([{ id: "c1", name: "6e A", schoolId: "school-a" }] as never);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([{ classId: "c1", status: "PRESENT", _count: { _all: 10 } }] as never);

    expect(await new AutomationService().checkAbsenteeismAlerts()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(createBulkNotifications).not.toHaveBeenCalled();
  });
});
