import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification, User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST, PATCH } from "@/app/api/notifications/route";

const USER_ID = cuid("userparent");

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: cuid(`notif-${Math.random().toString(36).slice(2, 8)}`),
    userId: USER_ID,
    title: "Paiement reçu",
    message: "Le paiement de la mensualité a été confirmé.",
    type: "PAYMENT",
    isRead: false,
    link: "/dashboard/finance",
    metadata: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    updatedAt: new Date(),
    ...overrides,
  };
}

function postBody(body: Record<string, unknown>) {
  return POST(
    makeRequest("http://localhost:3000/api/notifications", { method: "POST", body })
  );
}

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("liste les notifications du user avec compteur non-lu", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([notification()] as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(1);
    expect(vi.mocked(prisma.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        take: 20,
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("filtre sur isRead=false quand unread=true", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/notifications?unread=true"));
    expect(vi.mocked(prisma.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, isRead: false } })
    );
  });

  it("borne la limite entre 1 et 100", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost:3000/api/notifications?limit=1000"));
    expect(vi.mocked(prisma.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("retourne 500 si la lecture Prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/notifications"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("récupération des notifications");
  });
});

describe("POST /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await postBody({ userId: USER_ID, type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await postBody({ userId: USER_ID, type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(403);
  });

  it("retourne 400 sur body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await postBody({ userId: "bad-id", type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 404 si le destinataire n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await postBody({ userId: USER_ID, type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(404);
  });

  it("refuse un destinataire d'une autre école (403 cross-tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      schoolId: FIXTURES.schoolB,
    } as unknown as User);

    const res = await postBody({ userId: USER_ID, type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(403);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("crée la notification pour un utilisateur de la même école (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      schoolId: FIXTURES.schoolA,
    } as unknown as User);
    vi.mocked(prisma.notification.create).mockResolvedValue(notification({ type: "INFO" }) as never);

    const res = await postBody({ userId: USER_ID, type: "INFO", title: "Rentrée", message: "Bienvenue" });
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.notification.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, type: "INFO", title: "Rentrée" }),
      })
    );
  });

  it("permet à un SUPER_ADMIN d'écrire dans n'importe quelle école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      schoolId: FIXTURES.schoolB,
    } as unknown as User);
    vi.mocked(prisma.notification.create).mockResolvedValue(notification() as never);

    const res = await postBody({ userId: USER_ID, type: "PAYMENT", title: "T", message: "M" });
    expect(res.status).toBe(201);
  });

  it("retourne 500 si la création échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      schoolId: FIXTURES.schoolA,
    } as unknown as User);
    vi.mocked(prisma.notification.create).mockRejectedValue(new Error("db down"));

    const res = await postBody({ userId: USER_ID, type: "INFO", title: "T", message: "M" });
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("marque toutes les notifications comme lues", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 } as never);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", { method: "PATCH" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(vi.mocked(prisma.notification.updateMany)).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
      data: { isRead: true },
    });
  });

  it("retourne 500 si la mise à jour échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.updateMany).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications", { method: "PATCH" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("mise à jour des notifications");
  });
});