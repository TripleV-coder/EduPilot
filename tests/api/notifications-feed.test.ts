import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/notifications/feed/route";

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: cuid(`notif-${Math.random().toString(36).slice(2, 8)}`),
    userId: cuid("user-parent"),
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

describe("GET /api/notifications/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne un flux parent catégorisé et groupé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: cuid("parent1") }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      notification({ type: "PAYMENT", title: "Paiement reçu" }),
      notification({
        type: "ERROR",
        title: "Action urgente",
        message: "Un document doit être validé.",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
      notification({
        type: "GRADE",
        title: "Nouvelle note",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      }),
    ] as Notification[]);
    vi.mocked(prisma.notification.count).mockResolvedValue(2);

    const response = await GET(makeRequest("http://localhost:3000/api/notifications/feed"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.role).toBe("PARENT");
    expect(body.unreadCount).toBe(2);
    expect(body.totalCount).toBe(3);
    expect(body.categories.map((c: { key: string }) => c.key)).toContain("finance");
    expect(body.preview).toMatchObject({
      badge: "PRIORITÉ HAUTE",
      title: "Action urgente",
    });
    expect(body.groups[0].bucket).toBe("urgent");
    expect(body.groups.some((g: { bucket: string }) => g.bucket === "thisWeek")).toBe(true);
    expect(vi.mocked(prisma.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: cuid("parent1") },
        take: 100,
      }),
    );
  });

  it("filtre les notifications par catégorie", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("teacher1") }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      notification({ type: "MESSAGE", title: "Message parent" }),
      notification({ type: "PAYMENT", title: "Paiement reçu" }),
    ] as Notification[]);
    vi.mocked(prisma.notification.count).mockResolvedValue(1);

    const response = await GET(
      makeRequest("http://localhost:3000/api/notifications/feed?category=messages"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].items).toHaveLength(1);
    expect(body.groups[0].items[0]).toMatchObject({
      category: "messages",
      uiType: "sms",
    });
    expect(body.categories.find((c: { key: string }) => c.key === "messages")?.count).toBe(1);
  });

  it("retourne 500 si la lecture Prisma échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: cuid("director1") }));
    vi.mocked(prisma.notification.findMany).mockRejectedValue(new Error("db down"));

    const response = await GET(makeRequest("http://localhost:3000/api/notifications/feed"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("centre de notifications");
  });
});
