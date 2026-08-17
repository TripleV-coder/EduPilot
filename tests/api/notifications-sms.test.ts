import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
    parentProfile: { findMany: vi.fn() },
  },
}));
// sms-service délègue l'envoi à un webhook HTTP externe (fetch) : mock au
// niveau module pour isoler la route de tout appel réseau réel.
vi.mock("@/lib/notifications/sms-service", () => ({
  queueSMS: vi.fn(),
  sendAttendanceSMS: vi.fn(),
  sendPaymentReminderSMS: vi.fn(),
  sendGradesNotificationSMS: vi.fn(),
  sendBulkSMS: vi.fn(),
  SMSType: {},
}));

import prisma from "@/lib/prisma";
import {
  queueSMS,
  sendAttendanceSMS,
  sendPaymentReminderSMS,
  sendGradesNotificationSMS,
  sendBulkSMS,
} from "@/lib/notifications/sms-service";
import { POST } from "@/app/api/notifications/sms/route";

const PHONE = "0199001122";

function smsRequest(body: Record<string, unknown>, search = "") {
  return POST(
    makeRequest(`http://localhost:3000/api/notifications/sms${search}`, {
      method: "POST",
      body,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queueSMS).mockResolvedValue({ success: true, messageId: "sms1", queued: true });
  vi.mocked(sendAttendanceSMS).mockResolvedValue({ success: true, messageId: "sms2", queued: true });
  vi.mocked(sendPaymentReminderSMS).mockResolvedValue({ success: true, messageId: "sms3", queued: true });
  vi.mocked(sendGradesNotificationSMS).mockResolvedValue({ success: true, messageId: "sms4", queued: true });
  vi.mocked(sendBulkSMS).mockResolvedValue({ sent: 1, failed: 0 });
});

describe("POST /api/notifications/sms — envoi simple", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE, message: "Bonjour" });
    expect(res.status).toBe(401);
  });

  it("envoie un SMS CUSTOM via queueSMS", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE, message: "Réunion demain" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.messageId).toBe("sms1");
    expect(queueSMS).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: PHONE, message: "Réunion demain", type: "CUSTOM" })
    );
  });

  it("retourne 400 si le message manque pour CUSTOM/REMINDER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("message requis");
    expect(queueSMS).not.toHaveBeenCalled();
  });

  it("envoie un SMS ATTENDANCE", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({
      type: "ATTENDANCE",
      phoneNumber: PHONE,
      studentName: "Awa Dossou",
      status: "ABSENT",
    });
    expect(res.status).toBe(200);
    expect(sendAttendanceSMS).toHaveBeenCalledWith(
      expect.objectContaining({ parentPhone: PHONE, studentName: "Awa Dossou", status: "ABSENT" })
    );
  });

  it("retourne 400 si studentName ou status manque pour ATTENDANCE", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "ATTENDANCE", phoneNumber: PHONE, studentName: "Awa" });
    expect(res.status).toBe(400);
    expect(sendAttendanceSMS).not.toHaveBeenCalled();
  });

  it("envoie un SMS PAYMENT avec montant et échéance", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({
      type: "PAYMENT",
      phoneNumber: PHONE,
      studentName: "Awa",
      amount: 25000,
      dueDate: "2026-09-30",
    });
    expect(res.status).toBe(200);
    expect(sendPaymentReminderSMS).toHaveBeenCalledWith(
      expect.objectContaining({ parentPhone: PHONE, amount: 25000 })
    );
  });

  it("retourne 400 si amount ou dueDate manque pour PAYMENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "PAYMENT", phoneNumber: PHONE, studentName: "Awa", amount: 1000 });
    expect(res.status).toBe(400);
    expect(sendPaymentReminderSMS).not.toHaveBeenCalled();
  });

  it("envoie un SMS GRADES avec période", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({
      type: "GRADES",
      phoneNumber: PHONE,
      studentName: "Awa",
      period: "S1",
      average: 14.5,
    });
    expect(res.status).toBe(200);
    expect(sendGradesNotificationSMS).toHaveBeenCalledWith(
      expect.objectContaining({ parentPhone: PHONE, period: "S1", average: 14.5 })
    );
  });

  it("retourne 400 si period manque pour GRADES", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "GRADES", phoneNumber: PHONE, studentName: "Awa" });
    expect(res.status).toBe(400);
  });

  it("retourne 400 sur un type de SMS inconnu (zod)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "PIGEON", phoneNumber: PHONE, message: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 400 si le service SMS signale un échec", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(queueSMS).mockResolvedValue({ success: false, error: "Aucun fournisseur SMS configuré." });
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE, message: "Hello" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("fournisseur");
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(queueSMS).mockRejectedValue(new Error("boom"));
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE, message: "Hello" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});

describe("POST /api/notifications/sms?bulk=true — envoi groupé", () => {
  it("envoie aux destinataires fournis explicitement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(sendBulkSMS).mockResolvedValue({ sent: 2, failed: 0 });
    const res = await smsRequest(
      {
        type: "CUSTOM",
        recipients: [
          { phone: "0101010101", message: "Hi A" },
          { phone: "0202020202", message: "Hi B" },
        ],
      },
      "?bulk=true"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.recipientsCount).toBe(2);
    expect(sendBulkSMS).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ phone: "0101010101" })]),
      "CUSTOM",
      FIXTURES.schoolA
    );
  });

  it("résout les destinataires cible teachers_all depuis la DB", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { phone: "0303030303", firstName: "Paul" },
      { phone: null, firstName: "Sans téléphone" },
    ] as never);

    const res = await smsRequest(
      { type: "CUSTOM", target: "teachers_all", message: "Réunion {Prenom_Parent}" },
      "?bulk=true"
    );
    expect(res.status).toBe(200);
    expect(sendBulkSMS).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phone: "0303030303", message: "Réunion Paul" }),
      ]),
      "CUSTOM",
      FIXTURES.schoolA
    );
    expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: FIXTURES.schoolA, role: "TEACHER" }) })
    );
  });

  it("résout les destinataires cible parents_debt avec solde restant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        totalAmount: 50000,
        paidAmount: 10000,
        student: {
          user: { firstName: "Awa", lastName: "Dossou" },
          parentStudents: [{ parent: { user: { phone: "0404040404", firstName: "Maman" } } }],
        },
      },
    ] as never);

    const res = await smsRequest(
      { type: "REMINDER", target: "parents_debt", message: "Solde {Solde_A_Payer}" },
      "?bulk=true"
    );
    expect(res.status).toBe(200);
    expect(sendBulkSMS).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phone: "0404040404", message: "Solde 40000 FCFA" }),
      ]),
      "REMINDER",
      FIXTURES.schoolA
    );
  });

  it("résout les destinataires cible parents_all", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.parentProfile.findMany).mockResolvedValue([
      {
        user: { phone: "0505050505", firstName: "Papa" },
        parentStudents: [{ student: { user: { firstName: "Kofi", lastName: "Ade" } } }],
      },
    ] as never);

    const res = await smsRequest(
      { type: "ATTENDANCE", target: "parents_all", message: "Votre enfant {Nom_Enfant}" },
      "?bulk=true"
    );
    expect(res.status).toBe(200);
    expect(sendBulkSMS).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phone: "0505050505", message: "Votre enfant Kofi Ade" }),
      ]),
      "ATTENDANCE",
      FIXTURES.schoolA
    );
  });

  it("retourne 400 si la cible groupée ne fournit pas de message", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "CUSTOM", target: "teachers_all" }, "?bulk=true");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("message requis");
  });

  it("retourne 400 si aucun destinataire valide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "CUSTOM", recipients: [] }, "?bulk=true");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Aucun destinataire");
  });

  it("retourne 400 si la résolution DB échoue (zod)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await smsRequest({ type: "INVALID_TYPE", target: "teachers_all", message: "x" }, "?bulk=true");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/notifications/sms — SUPER_ADMIN sans école", () => {
  it("envoie avec le contexte super_admin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await smsRequest({ type: "CUSTOM", phoneNumber: PHONE, message: "Global" });
    expect(res.status).toBe(200);
    expect(queueSMS).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "super_admin" }));
  });
});