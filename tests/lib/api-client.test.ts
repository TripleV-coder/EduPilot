import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "@/lib/api/client";

describe("api/client.apiFetch", () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    return {
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      headers: new Map(Object.entries(init.headers ?? {})),
      json: async () => body,
    } as unknown as Response;
  }

  it("returns parsed body and propagates requestId", async () => {
    fetchMock.mockResolvedValue(mockResponse({ id: 1 }, { headers: { "X-Request-Id": "req-1" } }));
    const result = await apiFetch<{ id: number }>("http://test/api");
    expect(result.data).toEqual({ id: 1 });
    expect(result.requestId).toBe("req-1");
  });

  it("attaches a generated X-Request-Id when none provided", async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true }));
    await apiFetch("http://test/api");
    const callInit = fetchMock.mock.calls[0][1];
    const headers = callInit.headers as Headers;
    expect(headers.get("X-Request-Id")).toBeTruthy();
  });

  it("retries on 5xx and eventually succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: "boom" }, { status: 503 }))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const result = await apiFetch<{ ok: boolean }>("http://test/api", { retries: 1 });
    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx errors", async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: "bad" }, { status: 400 }));
    await expect(apiFetch("http://test/api", { retries: 2 })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws Error with status and requestId on 401", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: "Non authentifié" }, { status: 401, headers: { "X-Request-Id": "r2" } })
    );
    await expect(apiFetch("http://test/api")).rejects.toMatchObject({
      status: 401,
      requestId: "r2",
    });
  });

  it("respects user-provided requestId", async () => {
    fetchMock.mockResolvedValue(mockResponse({}));
    await apiFetch("http://test/api", { requestId: "my-id" });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-Request-Id")).toBe("my-id");
  });
});
