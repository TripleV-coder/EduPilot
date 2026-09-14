import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/students/bulk-import/route";
import { auth } from "@/lib/auth";
import { checkStudentQuota } from "@/lib/saas/quotas";
import { importStudentsAllOrNothing } from "@/lib/import/student-import";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

/**
 * N52 — la route délègue à l'import des élèves en tout ou rien
 * (lib/import/student-import), dont le comportement (validation, doublons,
 * transaction, avertissements N50, adresse N54) est prouvé sur un vrai
 * PostgreSQL : tests/integration-db/bulk-import-students.test.ts et
 * import-students.test.ts. Ici : ce qui relève de la route (accès, format du
 * lot, quota, transmission du rapport, modèle CSV).
 */
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return new MockNextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});
vi.mock("@/lib/saas/quotas", () => ({
  checkStudentQuota: vi.fn().mockResolvedValue({ allowed: true, current: 10, limit: 1000 }),
}));
vi.mock("@/lib/import/student-import", () => ({ importStudentsAllOrNothing: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn().mockResolvedValue(undefined),
  CACHE_PATHS: { students: "/api/students" },
}));

const DIRECTOR = makeSession("DIRECTOR");
const URL = "http://localhost/api/students/bulk-import";

const STUDENT_ROW = {
  email: "jean.dupont@school.bj",
  firstName: "Jean",
  lastName: "Dupont",
  className: "Terminale A1",
  dateOfBirth: "01/01/2005",
  gender: "M",
  birthPlace: "Cotonou",
  address: "Akpakpa",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: true, current: 10, limit: 1000, usagePercentage: 1 });
});

describe("POST /api/students/bulk-import", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without STUDENT_CREATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when school context is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(400);
  });

  it("should return 400 on invalid body (empty students)", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [] } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("should return 400 beyond 500 rows", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: Array(501).fill(STUDENT_ROW) } }));
    expect(res.status).toBe(400);
    expect(importStudentsAllOrNothing).not.toHaveBeenCalled();
  });

  it("should return 403 when student quota is reached", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: false, current: 1000, limit: 1000, usagePercentage: 100 });
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
    expect(importStudentsAllOrNothing).not.toHaveBeenCalled();
  });

  it("should return 403 when import would exceed quota", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(checkStudentQuota).mockResolvedValue({ allowed: true, current: 998, limit: 1000, usagePercentage: 99.8 });
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW, STUDENT_ROW, STUDENT_ROW] } }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("QUOTA_WILL_EXCEED");
    expect(importStudentsAllOrNothing).not.toHaveBeenCalled();
  });

  it("delegates the whole batch to the all-or-nothing import and returns its report", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const report = {
      created: 1,
      credentials: [{ row: 1, email: STUDENT_ROW.email, firstName: "Jean", lastName: "Dupont", provisionalPassword: "Tmp-1" }],
      errors: [] as [],
      warnings: [],
    };
    vi.mocked(importStudentsAllOrNothing).mockResolvedValue({ status: 200, body: report });
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(report);
    expect(importStudentsAllOrNothing).toHaveBeenCalledWith(FIXTURES.schoolA, [STUDENT_ROW]);
  });

  it("returns a rejected import as is (422, nothing created)", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const errors = [{ row: 1, field: "email", message: "Un compte utilise déjà l'email « jean.dupont@school.bj »" }];
    vi.mocked(importStudentsAllOrNothing).mockResolvedValue({ status: 422, body: { created: 0, credentials: [], errors } });
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ created: 0, credentials: [], errors });
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(importStudentsAllOrNothing).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(URL, { method: "POST", body: { students: [STUDENT_ROW] } }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/students/bulk-import", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(URL));
    expect(res.status).toBe(401);
  });

  it("should forbid roles without STUDENT_CREATE permission", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest(URL));
    expect(res.status).toBe(403);
  });

  it("should return the CSV template, without a parent email column (N50/N52)", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await GET(makeRequest(URL));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("email,firstName,lastName,className");
    expect(text).toContain("jean.dupont@exemple.com");
    expect(text).not.toMatch(/parentEmail/i);
  });
});
