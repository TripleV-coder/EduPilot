import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { findMany: vi.fn() },
  },
}));
// Compte toujours autorisé : la revérification périodique (audit MS-01, F2)
// a ses propres tests (tests/lib/notification-stream.test.ts et intégration).
vi.mock("@/lib/auth/user-status-cache", () => ({
  getUserStatus: vi.fn(async () => ({ isActive: true, role: "TEACHER", passwordChangedAt: null, school: { isActive: true } })),
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/notifications/stream/route";

const USER_ID = cuid("userstream");

// makeRequest ne fournit pas de `signal` ; NextRequest en possède toujours un
// en conditions réelles. On l'ajoute pour que le handler puisse écouter abort.
function streamRequest(url: string): NextRequest {
  return {
    ...makeRequest(url),
    signal: new AbortController().signal,
  } as unknown as NextRequest;
}

async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }
  return chunks.join("");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/notifications/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    expect(res.status).toBe(401);
  });

  it("ouvre un flux SSE avec un événement connected", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // Audit MS-03 : flux privé jamais conservé ; no-transform préservé pour les proxys
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, no-transform");

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const { value } = await reader.read();
    const payload = new TextDecoder().decode(value);
    expect(payload).toContain("event: connected");
    expect(payload).toContain(USER_ID);

    await reader.cancel();
  });

  it("polle la DB toutes les 5 secondes et pousse les nouvelles notifications", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { id: cuid("notifnew"), createdAt: new Date(), title: "Nouvelle" },
    ] as never);

    vi.useFakeTimers();
    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    await reader.read(); // événement connected

    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.mocked(prisma.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) })
    );

    const { value } = await reader.read();
    const payload = new TextDecoder().decode(value);
    expect(payload).toContain("event: notifications");

    await reader.cancel();
  });
});
