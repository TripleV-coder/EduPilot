import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

// Le routeur SSE importe `Redis` de "ioredis" : mock au niveau module pour
// éviter tout client réseau réel pendant les tests.
const { RedisMock, redisInstances } = vi.hoisted(() => {
  class RedisMock {
    url: string;
    subscribe = vi.fn((_channel: string, cb?: (err?: Error | null) => void) => {
      cb?.(null);
    });
    on = vi.fn();
    unsubscribe = vi.fn();
    quit = vi.fn();
    constructor(url: string) {
      this.url = url;
      redisInstances.push(this);
    }
  }
  const redisInstances: RedisMock[] = [];
  return { RedisMock, redisInstances };
});

vi.mock("ioredis", () => ({ default: RedisMock }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { findMany: vi.fn() },
  },
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
  delete process.env.REDIS_URL;
});

describe("GET /api/notifications/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisInstances.length = 0;
  });

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    expect(res.status).toBe(401);
  });

  it("ouvre un flux SSE avec un événement connected (fallback DB)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);

    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");

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

  it("s'abonne à Redis quand REDIS_URL est configuré et relaie les messages", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    process.env.REDIS_URL = "redis://localhost:6379";

    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    expect(res.status).toBe(200);
    expect(redisInstances).toHaveLength(1);
    const subscriber = redisInstances[0];
    expect(subscriber.subscribe).toHaveBeenCalledWith(`notifications:${USER_ID}`, expect.any(Function));

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    await reader.read(); // événement connected

    const messageHandler = subscriber.on.mock.calls.find(([event]) => event === "message")?.[1];
    expect(messageHandler).toBeDefined();
    messageHandler?.(`notifications:${USER_ID}`, JSON.stringify({ id: "n1", title: "Live" }));

    const { value } = await reader.read();
    const payload = new TextDecoder().decode(value);
    expect(payload).toContain("event: notifications");
    expect(payload).toContain("Live");

    await reader.cancel();
    expect(subscriber.unsubscribe).toHaveBeenCalled();
    expect(subscriber.quit).toHaveBeenCalled();
  });

  it("relaie une demande de refresh quand le message Redis le demande", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    process.env.REDIS_URL = "redis://localhost:6379";

    const res = await GET(streamRequest("http://localhost:3000/api/notifications/stream"));
    const subscriber = redisInstances[0];
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    await reader.read();

    const messageHandler = subscriber.on.mock.calls.find(([event]) => event === "message")?.[1];
    messageHandler?.(`notifications:${USER_ID}`, JSON.stringify({ REFRESH_REQUIRED: true }));

    const { value } = await reader.read();
    const payload = new TextDecoder().decode(value);
    expect(payload).toContain("event: refresh");
    expect(payload).toContain('"reload":true');

    await reader.cancel();
  });
});