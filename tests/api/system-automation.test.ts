import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "@/app/api/system/automation/route";
import { automationService } from "@/lib/services/automation.service";
import { makeRequest } from "./test-helpers";

vi.mock("@/lib/services/automation.service", () => ({
  automationService: { runDailyMaintenance: vi.fn() },
}));

const CRON_SECRET = "test-cron-secret-0123456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  vi.mocked(automationService.runDailyMaintenance).mockResolvedValue({
    success: true,
    analyticsSync: { processed: 10, errors: 0 },
    absenteeismAlerts: 2,
    financeAlerts: 1,
    financeReminders: { swept: 3, notified: 2, UPCOMING: 0, DUE: 0, OVERDUE: 0, CRITICAL: 0 },
  });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/system/automation", () => {
  it("should return 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("http://localhost/api/system/automation"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Configuration Error");
    expect(automationService.runDailyMaintenance).not.toHaveBeenCalled();
  });

  it("should return 401 with a wrong bearer token", async () => {
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: "Bearer wrong-token" },
    }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("should run maintenance with a valid bearer token", async () => {
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.absenteeismAlerts).toBe(2);
    expect(automationService.runDailyMaintenance).toHaveBeenCalledTimes(1);
  });

  it("should expose the failure message in non-production environments", async () => {
    vi.mocked(automationService.runDailyMaintenance).mockRejectedValue(new Error("sync crashed"));
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("sync crashed");
  });
});

describe("POST /api/system/automation", () => {
  it("should accept the same bearer token via POST", async () => {
    const res = await POST(makeRequest("http://localhost/api/system/automation", {
      method: "POST",
      body: {},
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(automationService.runDailyMaintenance).toHaveBeenCalledTimes(1);
  });

  it("should return 401 without authorization header", async () => {
    const res = await POST(makeRequest("http://localhost/api/system/automation", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });
});