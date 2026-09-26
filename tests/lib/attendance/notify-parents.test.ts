import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/services/notification.service";
import { sendAttendanceSMS } from "@/lib/notifications/sms-service";
import { notifyParentsOfAbsences } from "@/lib/attendance/notify-parents";

vi.mock("@/lib/prisma", () => ({ default: { studentProfile: { findMany: vi.fn() } } }));
vi.mock("@/lib/services/notification.service", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/notifications/sms-service", () => ({ sendAttendanceSMS: vi.fn().mockResolvedValue({ success: true }) }));

const DATE = new Date("2026-09-25T08:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
    {
      id: "s1",
      user: { firstName: "Awa", lastName: "Kora" },
      // Un parent avec compte (téléphone A) et un responsable sans compte (téléphone B).
      parentStudents: [{ parent: { user: { id: "p1", phone: "+22990000001" } } }],
      guardians: [{ phone: "+22990000001" }, { phone: "+22990000002" }],
    },
  ] as never);
});

afterEach(() => {
  delete process.env.SMS_WEBHOOK_URL;
});

describe("notifyParentsOfAbsences", () => {
  it("notifie le parent qui a un compte, sans SMS si aucun fournisseur n'est configuré", async () => {
    const result = await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "ABSENT" }] });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "p1", type: "ATTENDANCE", title: "Absence signalée", link: "/dashboard/students/s1" }),
    );
    expect(sendAttendanceSMS).not.toHaveBeenCalled();
    expect(result).toEqual({ notified: 1, sms: 0 });
  });

  it("envoie un SMS seulement au responsable qui n'a pas l'application", async () => {
    process.env.SMS_WEBHOOK_URL = "https://sms.example.test/hook";
    const result = await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "LATE" }] });
    expect(sendAttendanceSMS).toHaveBeenCalledTimes(1);
    expect(sendAttendanceSMS).toHaveBeenCalledWith(expect.objectContaining({ parentPhone: "+22990000002", status: "en retard" }));
    expect(result).toEqual({ notified: 1, sms: 1 });
  });

  it("ne fait rien sans changement", async () => {
    expect(await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [] })).toEqual({ notified: 0, sms: 0 });
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });
});
