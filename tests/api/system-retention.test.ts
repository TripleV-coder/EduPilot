import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/system/retention/route";
import { auth } from "@/lib/auth";
import { enforceDataRetentionPolicies } from "@/lib/security/rgpd";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/rgpd", () => ({
  enforceDataRetentionPolicies: vi.fn(),
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });
const SCHOOL_ADMIN = makeSession("SCHOOL_ADMIN");
const CRON_SECRET = "test-cron-secret-0123456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceDataRetentionPolicies).mockResolvedValue([
    { school: "École A", dataType: "AUDIT_LOGS", deletedCount: 120, retentionYears: 5 },
    { school: "École B", dataType: "NOTIFICATIONS", deletedCount: 8, retentionYears: 1 },
  ]);
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("POST /api/system/retention", () => {
  // Audit N2 : ce test exigeait « Non authentifié », le refus du garde de
  // session par défaut de createApiHandler. Ce garde passait AVANT le contrôle
  // du CRON_SECRET : un cron (sans session) ne pouvait jamais s'exécuter. Le
  // refus vient désormais du contrôle de la route elle-même.
  it("should return 401 without session nor bearer token", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/system/retention", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Non autorisé");
    expect(enforceDataRetentionPolicies).not.toHaveBeenCalled();
  });

  it("should run enforcement for a cron call carrying the secret and no session (N2)", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    process.env.CRON_SECRET = CRON_SECRET;
    const res = await POST(makeRequest("http://localhost/api/system/retention", {
      method: "POST",
      body: {},
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));

    expect(res.status).toBe(200);
    expect(enforceDataRetentionPolicies).toHaveBeenCalledTimes(1);
  });

  it("should refuse a SUPER_ADMIN session whose second factor is pending", async () => {
    const root = makeSession("SUPER_ADMIN", { id: "root2", email: "root@edupilot.app" });
    vi.mocked(auth).mockResolvedValue({
      ...root,
      user: { ...root.user, isTwoFactorEnabled: true, isTwoFactorAuthenticated: false },
    });
    const res = await POST(makeRequest("http://localhost/api/system/retention", { method: "POST", body: {} }));

    expect(res.status).toBe(401);
    expect(enforceDataRetentionPolicies).not.toHaveBeenCalled();
  });

  it("should refuse a non-super-admin session without a valid bearer token", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    const res = await POST(makeRequest("http://localhost/api/system/retention", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Non autorisé");
    expect(enforceDataRetentionPolicies).not.toHaveBeenCalled();
  });

  it("should refuse a wrong bearer token even with a session", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    process.env.CRON_SECRET = CRON_SECRET;
    const res = await POST(makeRequest("http://localhost/api/system/retention", {
      method: "POST",
      body: {},
      headers: { Authorization: "Bearer wrong-token" },
    }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Non autorisé");
    expect(enforceDataRetentionPolicies).not.toHaveBeenCalled();
  });

  it("should run enforcement with a valid bearer token regardless of session role", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    process.env.CRON_SECRET = CRON_SECRET;
    const res = await POST(makeRequest("http://localhost/api/system/retention", {
      method: "POST",
      body: {},
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.totalDeleted).toBe(128);
    expect(body.details).toHaveLength(2);
    expect(body.executedAt).toBeDefined();
    expect(enforceDataRetentionPolicies).toHaveBeenCalledTimes(1);
  });

  it("should run enforcement for a SUPER_ADMIN session", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await POST(makeRequest("http://localhost/api/system/retention", { method: "POST", body: {} }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalDeleted).toBe(128);
  });

  it("should return 500 when enforcement fails", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(enforceDataRetentionPolicies).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/system/retention", { method: "POST", body: {} }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur interne");
  });
});