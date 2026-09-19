import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/audit-log", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return { ...actual, invalidateByPath: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/security/audit-log";
import { PATCH } from "@/app/api/academic-years/[id]/status/route";

const yearId = "ay-2025";
const params = { params: Promise.resolve({ id: yearId }) };
const url = `http://localhost/api/academic-years/${yearId}/status`;

function year(overrides: Record<string, unknown> = {}) {
  return { id: yearId, name: "2025-2026", schoolId: FIXTURES.schoolA, status: "ACTIVE", isCurrent: true, ...overrides };
}

function patch(body: unknown) {
  return PATCH(makeRequest(url, { method: "PATCH", body }), params);
}

describe("PATCH /api/academic-years/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA }));
  });

  it("refuse un enseignant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    const res = await patch({ action: "close" });
    expect(res.status).toBe(403);
    expect(prisma.academicYear.updateMany).not.toHaveBeenCalled();
  });

  it("répond 404 pour une année d'un autre établissement", async () => {
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year({ schoolId: FIXTURES.schoolB }) as never);
    const res = await patch({ action: "close" });
    expect(res.status).toBe(404);
    expect(prisma.academicYear.updateMany).not.toHaveBeenCalled();
  });

  it("demande confirmation (409) si des inscriptions sont encore actives", async () => {
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year() as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(12);
    const res = await patch({ action: "close" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(expect.objectContaining({ code: "ACTIVE_ENROLLMENTS", activeEnrollments: 12 }));
    expect(prisma.academicYear.updateMany).not.toHaveBeenCalled();
  });

  it("clôture l'année (CLOSED, plus courante) et journalise", async () => {
    vi.mocked(prisma.academicYear.findUnique)
      .mockResolvedValueOnce(year() as never)
      .mockResolvedValueOnce({ id: yearId, name: "2025-2026", status: "CLOSED", isCurrent: false } as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(3);
    vi.mocked(prisma.academicYear.updateMany).mockResolvedValue({ count: 1 });

    const res = await patch({ action: "close", force: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ status: "CLOSED", isCurrent: false }));
    expect(prisma.academicYear.updateMany).toHaveBeenCalledWith({
      where: { id: yearId, status: { notIn: ["CLOSED", "ARCHIVED"] } },
      data: { status: "CLOSED", isCurrent: false },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACADEMIC_YEAR_CLOSED", entityId: yearId, schoolId: FIXTURES.schoolA })
    );
  });

  it("n'écrit qu'une fois si deux clôtures se croisent (409)", async () => {
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year() as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(0);
    vi.mocked(prisma.academicYear.updateMany).mockResolvedValue({ count: 0 });
    const res = await patch({ action: "close" });
    expect(res.status).toBe(409);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("refuse de clôturer une année déjà clôturée (409)", async () => {
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year({ status: "CLOSED" }) as never);
    const res = await patch({ action: "close" });
    expect(res.status).toBe(409);
  });

  it("réserve la réouverture à l'administration (DIRECTOR → 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year({ status: "CLOSED" }) as never);
    const res = await patch({ action: "reopen" });
    expect(res.status).toBe(403);
    expect(prisma.academicYear.updateMany).not.toHaveBeenCalled();
  });

  it("rouvre une année clôturée et journalise en CRITICAL", async () => {
    vi.mocked(prisma.academicYear.findUnique)
      .mockResolvedValueOnce(year({ status: "CLOSED", isCurrent: false }) as never)
      .mockResolvedValueOnce({ id: yearId, name: "2025-2026", status: "ACTIVE", isCurrent: false } as never);
    vi.mocked(prisma.academicYear.updateMany).mockResolvedValue({ count: 1 });
    const res = await patch({ action: "reopen" });
    expect(res.status).toBe(200);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACADEMIC_YEAR_REOPENED", severity: "CRITICAL" })
    );
  });

  it("refuse de rouvrir une année non clôturée (409)", async () => {
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(year() as never);
    const res = await patch({ action: "reopen" });
    expect(res.status).toBe(409);
  });

  it("rejette une action inconnue (400)", async () => {
    const res = await patch({ action: "archive" });
    expect(res.status).toBe(400);
  });
});
