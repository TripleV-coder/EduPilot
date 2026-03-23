import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

/** Helper to build a request with json() support for vitest */
function makeJsonRequest(url: string, body: unknown) {
  return {
    json: () => Promise.resolve(body),
    url,
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
  } as any;
}

describe("POST /api/auth/register (deprecated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 410 with deprecation message", async () => {
    const request = makeJsonRequest("http://localhost:3000/api/auth/register", {
      email: "admin@example.com",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toContain("désactivée");
    expect(data.code).toBe("REGISTER_DISABLED");
  });
});
