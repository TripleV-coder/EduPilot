import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    fiscalYear: { findFirst: vi.fn() },
    journalEntry: { count: vi.fn() },
    user: { findMany: vi.fn() },
    message: { createMany: vi.fn() },
  },
}));
vi.mock("@/lib/services/notification.service", () => ({
  createBulkNotifications: vi.fn().mockResolvedValue({ count: 2 }),
}));
vi.mock("@/lib/security/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return { ...actual, invalidateByPath: vi.fn().mockResolvedValue(undefined) };
});

import prisma from "@/lib/prisma";
import { createBulkNotifications } from "@/lib/services/notification.service";
import { POST } from "@/app/api/accounting/journal/send/route";

function send(body: Record<string, unknown> = {}) {
  return POST(
    makeRequest("http://localhost:3000/api/accounting/journal/send", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/accounting/journal/send", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    expect((await send()).status).toBe(401);
  });

  it("refuse un rôle non comptable (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as never);
    expect((await send()).status).toBe(403);
  });

  it("retourne 400 quand aucun destinataire (direction/comptabilité) n'existe", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR") as never);
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue({ id: cuid("fy"), label: "2025-2026" } as never);
    vi.mocked(prisma.journalEntry.count).mockResolvedValue(12 as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const res = await send();
    expect(res.status).toBe(400);
    expect((await res.json()).sent).toBe(0);
    expect(prisma.message.createMany).not.toHaveBeenCalled();
  });

  it("transmet le journal à la direction et la comptabilité", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as never);
    vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue({ id: cuid("fy"), label: "2025-2026" } as never);
    vi.mocked(prisma.journalEntry.count).mockResolvedValue(12 as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: cuid("dir") },
      { id: cuid("admin") },
    ] as never);
    vi.mocked(prisma.message.createMany).mockResolvedValue({ count: 2 } as never);

    const res = await send({ note: "Merci de réviser avant transmission au cabinet." });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(2);
    expect(body.entryCount).toBe(12);
    expect(prisma.message.createMany).toHaveBeenCalledOnce();
    expect(createBulkNotifications).toHaveBeenCalledOnce();

    // Le lien d'export figure dans le contenu transmis
    const createArg = vi.mocked(prisma.message.createMany).mock.calls[0][0] as {
      data: Array<{ content: string }>;
    };
    expect(createArg.data[0].content).toContain("/api/accounting/export");
  });
});
