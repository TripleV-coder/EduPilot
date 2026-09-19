import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({ assertModelAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({
  default: {
    classSubject: { findMany: vi.fn() },
    evaluation: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { GET } from "@/app/api/grades/cahier/route";

const base = "http://localhost/api/grades/cahier";

describe("GET /api/grades/cahier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    vi.mocked(assertModelAccess).mockResolvedValue(null);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
      { id: "cs-a1", subject: { name: "Maths" }, teacher: null },
      { id: "cs-a2", subject: { name: "Français" }, teacher: null },
    ] as never);
    vi.mocked(prisma.evaluation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as never);
  });

  it("exige une classe (400)", async () => {
    expect((await GET(makeRequest(base))).status).toBe(400);
  });

  it("refuse une classe hors périmètre (garde de tenant)", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(assertModelAccess).mockResolvedValueOnce(NextResponse.json({ error: "Classe introuvable" }, { status: 404 }));
    expect((await GET(makeRequest(`${base}?classId=class-b`))).status).toBe(404);
    expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
  });

  it("n'ouvre pas les notes d'une matière d'une autre classe via classSubjectId (404)", async () => {
    const res = await GET(makeRequest(`${base}?classId=class-a&classSubjectId=cs-b9`));
    expect(res.status).toBe(404);
    expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
  });

  it("filtre les évaluations sur les matières de la classe", async () => {
    const res = await GET(makeRequest(`${base}?classId=class-a&periodId=p1`));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.evaluation.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ classSubjectId: { in: ["cs-a1", "cs-a2"] }, periodId: "p1" }) })
    );
  });

  it("accepte une matière de la classe", async () => {
    const res = await GET(makeRequest(`${base}?classId=class-a&classSubjectId=cs-a2`));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.evaluation.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ classSubjectId: "cs-a2" }) })
    );
  });

  it.each(["STUDENT", "PARENT"])("refuse %s (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(`${base}?classId=class-a`))).status).toBe(403);
  });
});
