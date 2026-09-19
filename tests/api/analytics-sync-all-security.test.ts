import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({ syncAllStudentsForSchool: vi.fn().mockResolvedValue({ synced: 3 }) }));
vi.mock("@/lib/prisma", () => ({ default: { academicYear: { findFirst: vi.fn() } } }));

import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { POST } from "@/app/api/analytics/sync-all/route";

const url = "http://localhost/api/analytics/sync-all";

describe("POST /api/analytics/sync-all — recalcul complet réservé au personnel pédagogique", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["STUDENT", "PARENT", "ACCOUNTANT"])("refuse un %s (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA }));
    const res = await POST(makeRequest(url, { method: "POST", body: {} }));
    expect(res.status).toBe(403);
    expect(syncAllStudentsForSchool).not.toHaveBeenCalled();
  });

  it("refuse une année d'un autre établissement (404)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValueOnce(null as never);
    const res = await POST(makeRequest(url, { method: "POST", body: { academicYearId: "year-other" } }));
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.academicYear.findFirst).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ id: "year-other", schoolId: FIXTURES.schoolA }) })
    );
    expect(syncAllStudentsForSchool).not.toHaveBeenCalled();
  });

  it("synchronise l'année courante de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValueOnce({ id: "year-1" } as never);
    const res = await POST(makeRequest(url, { method: "POST", body: {} }));
    expect(res.status).toBe(200);
    expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, "year-1");
  });
});
