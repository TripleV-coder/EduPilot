import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateImportPassword } from "@/lib/import/initial-password";
import { escapeCsvCell } from "@/lib/utils/export";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    school: { findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn(), create: vi.fn() },
    class: { findFirst: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    enrollment: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/saas/quotas", () => ({
  checkStudentQuota: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 1000 }),
}));

import { POST as IMPORT_STUDENTS } from "@/app/api/import/students/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateImportPassword — fin du mot de passe partagé", () => {
  it("ne retourne jamais 00000000", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateImportPassword()).not.toBe("00000000");
    }
  });

  it("génère un secret unique à chaque appel", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateImportPassword()));
    expect(passwords.size).toBe(50);
  });

  it("génère au moins 20 caractères d'entropie encodée", () => {
    expect(generateImportPassword().length).toBeGreaterThanOrEqual(20);
  });
});

describe("escapeCsvCell — anti formula injection", () => {
  it("neutralise les préfixes de formule Excel", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(escapeCsvCell("+33612345678")).toMatch(/^"'/);
    expect(escapeCsvCell("@SUM(A1)")).toMatch(/^"'/);
  });

  it("double les guillemets internes", () => {
    expect(escapeCsvCell('dit "bonjour"')).toBe('"dit ""bonjour"""');
  });

  it("laisse les valeurs normales intactes", () => {
    expect(escapeCsvCell("Kossou Abalo")).toBe('"Kossou Abalo"');
    expect(escapeCsvCell(1450)).toBe('"1450"');
  });
});

describe("POST /api/import/students — garde-fous", () => {
  it("refuse un lot de plus de 500 lignes (anti-DoS)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);

    const bigBatch = Array.from({ length: 501 }, (_, i) => ({
      firstName: `Élève${i}`,
      lastName: "Test",
      email: `eleve${i}@ecole.bj`,
    }));

    const response = await IMPORT_STUDENTS(
      makeRequest("http://localhost:3000/api/import/students", {
        method: "POST",
        body: { data: bigBatch },
      })
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("500");
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await IMPORT_STUDENTS(
      makeRequest("http://localhost:3000/api/import/students", {
        method: "POST",
        body: { data: [] },
      })
    );
    expect(response.status).toBe(403);
  });

  it("refuse un payload non-tableau (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);

    const response = await IMPORT_STUDENTS(
      makeRequest("http://localhost:3000/api/import/students", {
        method: "POST",
        body: { data: "pas-un-tableau" },
      })
    );
    expect(response.status).toBe(400);
  });
});
