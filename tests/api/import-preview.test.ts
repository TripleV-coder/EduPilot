import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/import/preview/route";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const ADMIN = makeSession("SCHOOL_ADMIN");

const VALID_TEACHER = {
  email: "t1@school.bj",
  firstName: "Jean",
  lastName: "Dupont",
  phone: "01",
  subjects: "Maths",
};

function makeBody(type: string, data: unknown[], limit?: number) {
  return { type, data, ...(limit !== undefined ? { limit } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/import/preview", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: makeBody("teachers", []) }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside allowed list", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: makeBody("teachers", []) }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid request structure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: { type: "bogus", data: [] } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Structure de requête invalide");
    expect(body.errors).toBeDefined();
  });

  it("should preview valid rows with summary", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/preview", {
      method: "POST",
      body: makeBody("teachers", [VALID_TEACHER, { ...VALID_TEACHER, email: "t2@school.bj" }]),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.type).toBe("teachers");
    expect(body.summary).toEqual({ total: 2, valid: 2, invalid: 0, percentage: 100 });
    expect(body.preview).toHaveLength(2);
    expect(body.preview[0]).toMatchObject({ row: 2, valid: true });
    expect(body.errors).toHaveLength(0);
  });

  it("should separate valid and invalid rows", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/preview", {
      method: "POST",
      body: makeBody("teachers", [
        { ...VALID_TEACHER, email: "bad-email" },
        VALID_TEACHER,
      ]),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toEqual({ total: 2, valid: 1, invalid: 1, percentage: 50 });
    expect(body.preview[0]).toMatchObject({ row: 2, valid: false });
    expect(body.preview[0].errors).toEqual(expect.arrayContaining([expect.stringContaining("email")]));
    expect(body.errors[0]).toMatchObject({ row: 2 });
    expect(body.errors[0].errors[0]).toMatchObject({ field: "email" });
  });

  it("should respect the preview limit", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const rows = [VALID_TEACHER, { ...VALID_TEACHER, email: "a@school.bj" }, { ...VALID_TEACHER, email: "b@school.bj" }];
    const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: makeBody("teachers", rows, 1) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.total).toBe(3);
    expect(body.summary.valid).toBe(3);
    expect(body.preview).toHaveLength(1);
  });

  it("should support every import type", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const cases: Array<{ type: string; row: Record<string, unknown> }> = [
      { type: "students", row: { email: "s@school.bj", firstName: "Jean", lastName: "Dupont" } },
      { type: "classes", row: { name: "6ème A", level: "6EME" } },
      { type: "parents", row: { email: "p@school.bj", firstName: "Paul", lastName: "Biya", phone: "01" } },
      { type: "subjects", row: { name: "Mathématiques", code: "MAT" } },
    ];
    for (const c of cases) {
      const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: makeBody(c.type, [c.row]) }));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.summary.valid).toBe(1);
      expect(body.summary.invalid).toBe(0);
    }
  });

  it("should return an empty summary for empty data", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/preview", { method: "POST", body: makeBody("teachers", []) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toEqual({ total: 0, valid: 0, invalid: 0, percentage: 0 });
    expect(body.preview).toHaveLength(0);
  });
});