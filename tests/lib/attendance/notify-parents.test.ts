import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { createNotifications } from "@/lib/services/notification.service";
import { enqueueJobs } from "@/lib/jobs/queue";
import { queueFamilyMessages, type FamilyMessage } from "@/lib/notifications/family-channel";
import type { NewJob } from "@/lib/jobs/types";
import { notifyParentsOfAbsences } from "@/lib/attendance/notify-parents";

vi.mock("@/lib/prisma", () => ({ default: { studentProfile: { findMany: vi.fn() } } }));
vi.mock("@/lib/services/notification.service", () => ({
  createNotifications: vi.fn(async (items: unknown[]) => ({ count: items.length })),
}));
vi.mock("@/lib/notifications/sms-service", () => ({
  attendanceSmsMessage: vi.fn(({ studentName, status }: { studentName: string; status: string }) => `${studentName} ${status}`),
}));
// WhatsApp d'abord, SMS en secours : le choix du canal est testé dans family-channel
vi.mock("@/lib/notifications/family-channel", () => ({
  queueFamilyMessages: vi.fn(async (items: unknown[]) => ({ whatsapp: items.length, sms: 0, skipped: 0 })),
}));
vi.mock("@/lib/jobs/queue", () => ({ enqueueJobs: vi.fn(async (jobs: unknown[]) => jobs.length) }));

const DATE = new Date("2026-09-25T08:00:00.000Z");

const queuedJobs = (): NewJob[] => vi.mocked(enqueueJobs).mock.calls.flatMap(([jobs]) => jobs);
const familyMessages = (): FamilyMessage[] => vi.mocked(queueFamilyMessages).mock.calls.flatMap(([items]) => items);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
    {
      id: "s1",
      user: { firstName: "Awa", lastName: "Kora" },
      // Un parent avec compte (téléphone A) et un responsable sans compte (téléphone B).
      parentStudents: [{ parent: { user: { id: "p1", phone: "+22990000001", email: "parent@ecole.bj", firstName: "Céleste" } } }],
      guardians: [{ phone: "+22990000001" }, { phone: "+22990000002" }],
    },
  ] as never);
});

describe("notifyParentsOfAbsences", () => {
  it("notifie le parent qui a un compte dans l'application et le prévient par WhatsApp", async () => {
    const result = await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "ABSENT" }] });
    expect(createNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "p1", type: "ATTENDANCE", title: "Absence signalée", link: "/dashboard/students/s1" }),
    ]);
    expect(queuedJobs().filter((job) => job.type === "sms.send")).toHaveLength(0);
    expect(result).toEqual({ notified: 1, whatsapp: 2, sms: 0 });
  });

  it("WhatsApp à chaque numéro de la famille ; SMS de secours seulement pour le responsable sans compte", async () => {
    await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "LATE" }] });
    // Le numéro du parent, aussi déclaré comme responsable, n'est prévenu qu'une fois
    expect(familyMessages()).toEqual([
      { phone: "+22990000001", message: "Awa Kora en retard", kind: "ATTENDANCE", schoolId: "sch1", userId: "p1", smsFallback: false },
      { phone: "+22990000002", message: "Awa Kora en retard", kind: "ATTENDANCE", schoolId: "sch1", smsFallback: true },
    ]);
  });

  it("une file WhatsApp/SMS indisponible ne bloque ni la notification ni le courriel", async () => {
    vi.mocked(queueFamilyMessages).mockRejectedValueOnce(new Error("file saturée"));
    const result = await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "ABSENT" }] });
    expect(result).toEqual({ notified: 1, whatsapp: 0, sms: 0 });
    expect(queuedJobs().filter((job) => job.type === "email.send")).toHaveLength(1);
  });

  it("met en file un courriel pour le parent qui a un compte, avec le nom échappé", async () => {
    vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
      {
        id: "s1",
        user: { firstName: "Awa<script>", lastName: "Kora" },
        parentStudents: [{ parent: { user: { id: "p1", phone: null, email: "parent@ecole.bj", firstName: "Céleste" } } }],
        guardians: [],
      },
    ] as never);
    await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "ABSENT" }] });
    const emails = queuedJobs().filter((job) => job.type === "email.send");
    expect(emails).toHaveLength(1);
    const mail = emails[0];
    if (mail.type !== "email.send") throw new Error("type inattendu");
    expect(mail.schoolId).toBe("sch1");
    expect(mail.payload.to).toBe("parent@ecole.bj");
    expect(mail.payload.subject).toMatch(/absence/i);
    expect(mail.payload.html).not.toContain("<script>");
    expect(mail.payload.html).toContain("Awa&lt;script&gt;");
  });

  it("une file indisponible ne bloque pas la notification dans l'application", async () => {
    vi.mocked(enqueueJobs).mockRejectedValueOnce(new Error("db down"));
    const result = await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [{ studentId: "s1", status: "ABSENT" }] });
    expect(result.notified).toBe(1);
  });

  it("ne fait rien sans changement", async () => {
    expect(await notifyParentsOfAbsences({ schoolId: "sch1", date: DATE, changes: [] })).toEqual({ notified: 0, whatsapp: 0, sms: 0 });
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });
});
