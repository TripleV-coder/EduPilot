import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    message: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return {
    ...actual,
    invalidateByPath: vi.fn().mockResolvedValue(undefined),
  };
});

import prisma from "@/lib/prisma";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { GET, PATCH, DELETE } from "@/app/api/messages/[id]/route";

const SENDER_ID = cuid("usersender");
const RECIPIENT_ID = cuid("userrecipient");
const MSG_ID = cuid("msg1");

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: MSG_ID,
    senderId: SENDER_ID,
    recipientId: RECIPIENT_ID,
    subject: "Réunion",
    content: "Rendez-vous demain à 10h.",
    parentId: null,
    isRead: false,
    readAt: null,
    isArchived: false,
    deletedBySender: false,
    deletedByRecipient: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Message;
}

function context(id: string = MSG_ID) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, method = "GET", body?: Record<string, unknown>) {
  return makeRequest(`http://localhost:3000${url}`, { method, body });
}

describe("GET /api/messages/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si le message n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(404);
  });

  it("retourne 403 si l'utilisateur n'est ni émetteur ni destinataire", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("userother") }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(message() as never);

    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("retourne le message pour l'émetteur sans le marquer lu", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(message() as never);

    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(MSG_ID);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it("marque le message lu quand le destinataire le consulte", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(message() as never);
    vi.mocked(prisma.message.update).mockResolvedValue(message({ isRead: true }) as never);

    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.message.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MSG_ID }, data: expect.objectContaining({ isRead: true }) })
    );
    expect(invalidateByPath).toHaveBeenCalledWith("/api/messages");
  });

  it("retourne 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(req("/api/messages/" + MSG_ID), context());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("récupération du message");
  });
});

describe("PATCH /api/messages/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: true }), context());
    expect(res.status).toBe(401);
  });

  it("retourne 400 sur un body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: "pas-un-boolean" }), context());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 404 si le message n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: true }), context());
    expect(res.status).toBe(404);
  });

  it("refuse l'émetteur qui n'est pas destinataire (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: SENDER_ID,
      recipientId: RECIPIENT_ID,
    } as never);

    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: true }), context());
    expect(res.status).toBe(403);
  });

  it("met à jour isRead et isArchived pour le destinataire", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: SENDER_ID,
      recipientId: RECIPIENT_ID,
    } as never);
    vi.mocked(prisma.message.update).mockResolvedValue(message({ isArchived: true }) as never);

    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: true, isArchived: true }), context());
    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.message.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({ isRead: true, isArchived: true });
    expect(updateArgs.data.readAt).toBeInstanceOf(Date);
    expect(invalidateByPath).toHaveBeenCalledWith("/api/messages");
  });

  it("annule readAt quand isRead=false", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: SENDER_ID,
      recipientId: RECIPIENT_ID,
    } as never);
    vi.mocked(prisma.message.update).mockResolvedValue(message() as never);

    await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: false }), context());
    const updateArgs = vi.mocked(prisma.message.update).mock.calls[0][0];
    expect(updateArgs.data.readAt).toBeNull();
  });

  it("retourne 500 si la mise à jour échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: SENDER_ID,
      recipientId: RECIPIENT_ID,
    } as never);
    vi.mocked(prisma.message.update).mockRejectedValue(new Error("db down"));

    const res = await PATCH(req("/api/messages/" + MSG_ID, "PATCH", { isRead: true }), context());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/messages/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si le message n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(404);
  });

  it("retourne 403 pour un tiers non concerné", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("userother") }));
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      senderId: SENDER_ID,
      recipientId: RECIPIENT_ID,
    } as never);

    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(403);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it("soft-delete côté émetteur", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique)
      .mockResolvedValueOnce({ senderId: SENDER_ID, recipientId: RECIPIENT_ID } as never)
      .mockResolvedValueOnce({ deletedBySender: false, deletedByRecipient: false } as never);
    vi.mocked(prisma.message.update).mockResolvedValue(message() as never);

    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.message.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({ deletedBySender: true });
    expect(prisma.message.delete).not.toHaveBeenCalled();
    expect(invalidateByPath).toHaveBeenCalledWith("/api/messages");
  });

  it("supprime définitivement quand les deux parties ont supprimé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: RECIPIENT_ID }));
    vi.mocked(prisma.message.findUnique)
      .mockResolvedValueOnce({ senderId: SENDER_ID, recipientId: RECIPIENT_ID } as never)
      .mockResolvedValueOnce({ deletedBySender: true, deletedByRecipient: false } as never);
    vi.mocked(prisma.message.delete).mockResolvedValue(message() as never);

    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.message.delete)).toHaveBeenCalledWith({ where: { id: MSG_ID } });
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it("retourne 500 si la suppression échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: SENDER_ID }));
    vi.mocked(prisma.message.findUnique).mockRejectedValue(new Error("db down"));

    const res = await DELETE(req("/api/messages/" + MSG_ID, "DELETE"), context());
    expect(res.status).toBe(500);
  });
});