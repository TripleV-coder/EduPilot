import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "@/app/api/system/automation/route";
import { automationService } from "@/lib/services/automation.service";
import { acquireJobLease, releaseJobLease } from "@/lib/system/job-lease";
import { makeRequest } from "./test-helpers";

// Tâches lancées « après la réponse » : conservées pour que le test attende leur fin.
const background = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }));

vi.mock("@/lib/services/automation.service", () => ({
  automationService: { runDailyMaintenance: vi.fn() },
}));
vi.mock("@/lib/system/job-lease", () => ({
  acquireJobLease: vi.fn(),
  releaseJobLease: vi.fn(),
}));
vi.mock("@/lib/system/run-in-background", () => ({
  runInBackground: vi.fn((task: () => Promise<void>) => {
    background.tasks.push(task());
  }),
}));

const CRON_SECRET = "test-cron-secret-0123456789abcdef";
const flushBackground = () => Promise.allSettled(background.tasks.splice(0));

beforeEach(() => {
  vi.clearAllMocks();
  background.tasks.length = 0;
  process.env.CRON_SECRET = CRON_SECRET;
  vi.mocked(acquireJobLease).mockResolvedValue("lease-token");
  vi.mocked(releaseJobLease).mockResolvedValue(undefined);
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
    expect(acquireJobLease).not.toHaveBeenCalled();
  });

  // Audit N8 : exigeait 200 avec le résultat, donc une maintenance exécutée
  // DANS la requête (733 s mesurées, au-delà du délai du planificateur, qui
  // réessayait et lançait une 2e exécution concurrente). La route accepte
  // désormais la tâche (202), la lance après la réponse sous bail exclusif,
  // et libère le bail à la fin.
  it("should accept the maintenance (202), run it after the response and release the lease", async () => {
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true });
    expect(acquireJobLease).toHaveBeenCalledWith("daily-maintenance", expect.any(Number));

    await flushBackground();
    expect(automationService.runDailyMaintenance).toHaveBeenCalledTimes(1);
    expect(releaseJobLease).toHaveBeenCalledWith("daily-maintenance", "lease-token");
  });

  it("should refuse a concurrent run while the lease is held (409)", async () => {
    vi.mocked(acquireJobLease).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Maintenance déjà en cours");
    await flushBackground();
    expect(automationService.runDailyMaintenance).not.toHaveBeenCalled();
  });

  // Audit N8 : exigeait l'erreur de la maintenance dans la réponse HTTP (500),
  // ce qui supposait une exécution synchrone. L'échec est désormais journalisé
  // par la tâche de fond, et le bail est libéré malgré l'erreur.
  it("should release the lease even when the maintenance fails", async () => {
    vi.mocked(automationService.runDailyMaintenance).mockRejectedValue(new Error("sync crashed"));
    const res = await GET(makeRequest("http://localhost/api/system/automation", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(res.status).toBe(202);
    await flushBackground();
    expect(releaseJobLease).toHaveBeenCalledWith("daily-maintenance", "lease-token");
  });
});

describe("POST /api/system/automation", () => {
  it("should accept the same bearer token via POST", async () => {
    const res = await POST(makeRequest("http://localhost/api/system/automation", {
      method: "POST",
      body: {},
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(res.status).toBe(202);
    await flushBackground();
    expect(automationService.runDailyMaintenance).toHaveBeenCalledTimes(1);
  });

  it("should return 401 without authorization header", async () => {
    const res = await POST(makeRequest("http://localhost/api/system/automation", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });
});
