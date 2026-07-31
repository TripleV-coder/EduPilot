import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    message: { create: vi.fn(), createMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
    class: { findUnique: vi.fn() },
    classSubject: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/services/notification.service", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif1" }),
  createBulkNotifications: vi.fn().mockResolvedValue({ count: 2 }),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return {
    ...actual,
    invalidateByPath: vi.fn().mockResolvedValue(undefined),
  };
});

import prisma from "@/lib/prisma";
import { createNotification, createBulkNotifications } from "@/lib/services/notification.service";
import { POST } from "@/app/api/messages/route";
import { POST as BROADCAST } from "@/app/api/messages/broadcast/route";

const RECIPIENT_ID = cuid("recipient1");

function postMessage(body: Record<string, unknown>) {
  return POST(
    makeRequest("http://localhost:3000/api/messages", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/messages — envoi durci", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "Bonjour",
      content: "Test message",
    });
    expect(response.status).toBe(401);
  });

  it("refuse l'auto-envoi (400)", async () => {
    const session = makeSession("TEACHER");
    vi.mocked(auth).mockResolvedValue(session as any);

    const response = await postMessage({
      recipientId: session.user!.id,
      subject: "À moi-même",
      content: "Note perso de plus de 10 caractères",
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("soi-même");
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("refuse un destinataire d'une autre école (cross-tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: RECIPIENT_ID,
      schoolId: FIXTURES.schoolB,
      isActive: true,
    } as any);

    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "Hello",
      content: "Tentative cross-tenant",
    });
    expect(response.status).toBe(403);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("refuse un destinataire inactif (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: RECIPIENT_ID,
      schoolId: FIXTURES.schoolA,
      isActive: false,
    } as any);

    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "Hello",
      content: "Message vers compte désactivé",
    });
    expect(response.status).toBe(400);
  });

  it("neutralise le HTML dans subject et content (anti-XSS stocké)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: RECIPIENT_ID,
      schoolId: FIXTURES.schoolA,
      isActive: true,
    } as any);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: cuid("msg1") } as any);

    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "<script>alert(1)</script>Réunion",
      content: "Contenu <img src=x onerror=alert(1)> piégé",
    });

    expect(response.status).toBe(201);
    const createArgs = vi.mocked(prisma.message.create).mock.calls[0][0];
    expect(createArgs.data.subject).not.toContain("<script>");
    expect(createArgs.data.subject).toContain("Réunion");
    expect(createArgs.data.content).not.toContain("<img");
  });

  it("crée le message + notification avec lien /dashboard/messages", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: RECIPIENT_ID,
      schoolId: FIXTURES.schoolA,
      isActive: true,
    } as any);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: cuid("msg2") } as any);

    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "Question cantine",
      content: "Mon fils est allergique aux arachides.",
    });

    expect(response.status).toBe(201);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: RECIPIENT_ID,
        type: "MESSAGE",
        link: "/dashboard/messages",
      })
    );
  });

  it("refuse une réponse à un fil dont on ne fait pas partie (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: cuid("other1"),
      recipientId: cuid("other2"),
    } as any);

    const response = await postMessage({
      recipientId: RECIPIENT_ID,
      subject: "Re: fil privé",
      content: "Je m'incruste dans ce fil",
      parentId: cuid("parentmsg"),
    });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/messages/broadcast — envoi groupé durci", () => {
  const CLASS_ID = cuid("classa");

  function broadcast(body: Record<string, unknown>) {
    return BROADCAST(
      makeRequest("http://localhost:3000/api/messages/broadcast", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    const response = await broadcast({ classId: CLASS_ID, subject: "x", content: "y" });
    expect(response.status).toBe(403);
  });

  it("refuse un TEACHER qui n'enseigne pas dans la classe (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6e A",
      schoolId: FIXTURES.schoolA,
    } as any);
    vi.mocked(prisma.classSubject.findFirst).mockResolvedValue(null);

    const response = await broadcast({
      classId: CLASS_ID,
      subject: "Réunion",
      content: "Réunion parents demain",
    });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toContain("enseignez pas");
  });

  it("refuse une classe d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6e B",
      schoolId: FIXTURES.schoolB,
    } as any);

    const response = await broadcast({
      classId: CLASS_ID,
      subject: "Réunion",
      content: "Cross-tenant broadcast",
    });
    expect(response.status).toBe(403);
  });

  it("envoie aux parents uniques de la classe + notifications bulk", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6e A",
      schoolId: FIXTURES.schoolA,
    } as any);
    const parent1 = cuid("parentu1");
    const parent2 = cuid("parentu2");
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { student: { parentStudents: [{ parent: { userId: parent1 } }] } },
      // le même parent1 a deux enfants dans la classe → dédupliqué
      { student: { parentStudents: [{ parent: { userId: parent1 } }, { parent: { userId: parent2 } }] } },
    ] as any);
    vi.mocked(prisma.message.createMany).mockResolvedValue({ count: 2 } as any);

    const response = await broadcast({
      classId: CLASS_ID,
      subject: "Sortie scolaire <b>important</b>",
      content: "Autorisation à signer",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(2);
    // déduplication des parents
    const createManyArgs = vi.mocked(prisma.message.createMany).mock.calls[0][0];
    expect(createManyArgs.data).toHaveLength(2);
    // sanitization du sujet
    expect(createManyArgs.data[0].subject).not.toContain("<b>");
    expect(createBulkNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ link: "/dashboard/messages", type: "MESSAGE" })
    );
  });

  it("retourne 400 si aucun parent dans la classe", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }) as any);
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: CLASS_ID,
      name: "6e A",
      schoolId: FIXTURES.schoolA,
    } as any);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as any);

    const response = await broadcast({
      classId: CLASS_ID,
      subject: "Réunion",
      content: "Personne ne lira ceci",
    });
    expect(response.status).toBe(400);
  });
});
