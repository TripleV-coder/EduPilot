import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH, DELETE } from "@/app/api/notifications/[id]/route";

const OWNER_ID = cuid("userowner");
const NOTIF_ID = cuid("notif1");

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: NOTIF_ID,
    userId: OWNER_ID,
    title: "Paiement reçu",
    message: "Le paiement de la mensualité a été confirmé.",
    type: "PAYMENT",
    isRead: false,
    link: "/dashboard/finance",
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function context(id: string = NOTIF_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID), context());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la notification n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID), context());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Notification non trouvée");
  });

  it("retourne 403 si la notification appartient à un autre user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: cuid("userother") }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);

    const res = await GET(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID), context());
    expect(res.status).toBe(403);
  });

  it("retourne la notification du user connecté", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);

    const res = await GET(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID), context());
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(NOTIF_ID);
  });

  it("retourne 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID), context());
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "PATCH" }), context());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la notification n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "PATCH" }), context());
    expect(res.status).toBe(404);
  });

  it("retourne 403 si la notification appartient à un autre user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: cuid("userother") }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "PATCH" }), context());
    expect(res.status).toBe(403);
  });

  it("marque la notification comme lue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);
    vi.mocked(prisma.notification.update).mockResolvedValue(notification({ isRead: true }) as never);

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "PATCH" }), context());
    expect(res.status).toBe(200);
    expect((await res.json()).isRead).toBe(true);
    expect(vi.mocked(prisma.notification.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTIF_ID }, data: { isRead: true } })
    );
  });

  it("retourne 500 si la mise à jour échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);
    vi.mocked(prisma.notification.update).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "PATCH" }), context());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "DELETE" }), context());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la notification n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "DELETE" }), context());
    expect(res.status).toBe(404);
  });

  it("retourne 403 si la notification appartient à un autre user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: cuid("userother") }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);

    const res = await DELETE(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "DELETE" }), context());
    expect(res.status).toBe(403);
  });

  it("supprime la notification du user connecté", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);
    vi.mocked(prisma.notification.delete).mockResolvedValue(notification() as never);

    const res = await DELETE(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "DELETE" }), context());
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(vi.mocked(prisma.notification.delete)).toHaveBeenCalledWith({ where: { id: NOTIF_ID } });
  });

  it("retourne 500 si la suppression échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: OWNER_ID }));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(notification() as never);
    vi.mocked(prisma.notification.delete).mockRejectedValue(new Error("db down"));

    const res = await DELETE(makeRequest("http://localhost:3000/api/notifications/" + NOTIF_ID, { method: "DELETE" }), context());
    expect(res.status).toBe(500);
  });
});