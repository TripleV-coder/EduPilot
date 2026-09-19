import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    wellbeingReport: { findMany: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/wellbeing/reports/route";

const url = "http://localhost/api/wellbeing/reports";
const report = (over: Record<string, unknown> = {}) => ({ tag: "PARENT", category: "Harcèlement", excerpt: "Signalé à la sortie des cours.", severity: "P1", ...over });
const pupil = cuid("eleveconcerne");

describe("GET /api/wellbeing/reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["TEACHER", "PARENT", "STUDENT", "ACCOUNTANT", "STAFF"])("refuse %s (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(url))).status).toBe(403);
  });

  it("refuse l'école d'un autre établissement passée en paramètre", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    const res = await GET(makeRequest(`${url}?schoolId=${FIXTURES.schoolB}`));
    expect(res.status).toBe(403);
    expect(prisma.wellbeingReport.findMany).not.toHaveBeenCalled();
  });

  it("filtre sur l'école, en ignorant les valeurs de filtre inconnues", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.wellbeingReport.findMany).mockResolvedValueOnce([
      { id: "r1", tag: "PARENT", category: "c", excerpt: "e", severity: "P0", severityLabel: "P0", status: "OPEN", createdAt: new Date("2026-09-01T00:00:00Z"), reporterUserId: "secret" },
    ] as never);
    const res = await GET(makeRequest(`${url}?status=OPEN&severity=P9`));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.wellbeingReport.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, status: "OPEN" }, take: 100 })
    );
    const body = await res.json();
    // L'auteur d'un signalement n'est jamais exposé dans la liste.
    expect(body.reports[0]).not.toHaveProperty("reporterUserId");
  });
});

describe("POST /api/wellbeing/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA, id: "u-dir" }));
    vi.mocked(prisma.wellbeingReport.create).mockImplementation(async ({ data }: { data: object }) => ({ id: "r1", ...data }) as never);
  });

  it("un signalement anonyme ne désigne personne et ne trace pas son auteur", async () => {
    expect((await POST(makeRequest(url, { method: "POST", body: report({ tag: "ANONYME", reportedUserId: pupil }) }))).status).toBe(400);
    const res = await POST(makeRequest(url, { method: "POST", body: report({ tag: "ANONYME" }) }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.wellbeingReport.create).mock.calls[0][0].data.reporterUserId).toBeNull();
  });

  it("refuse un élève d'une autre école (404)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    const res = await POST(makeRequest(url, { method: "POST", body: report({ reportedUserId: pupil }) }));
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.user.findFirst).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { id: pupil, schoolId: FIXTURES.schoolA } })
    );
  });

  it("super-admin sans école active : 400, pas une erreur 500", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest(url, { method: "POST", body: report() }));
    expect(res.status).toBe(400);
    expect(prisma.wellbeingReport.create).not.toHaveBeenCalled();
  });

  it("crée le dossier, trace l'auteur et journalise avec l'école", async () => {
    const res = await POST(makeRequest(url, { method: "POST", body: report() }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.wellbeingReport.create).mock.calls[0][0].data).toEqual(
      expect.objectContaining({ schoolId: FIXTURES.schoolA, reporterUserId: "u-dir", status: "OPEN", severityLabel: "P1 · Suivi rapproché" })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "CREATE_WELLBEING_REPORT", schoolId: FIXTURES.schoolA }) })
    );
  });

  it("rejette un extrait trop court (400)", async () => {
    expect((await POST(makeRequest(url, { method: "POST", body: report({ excerpt: "court" }) }))).status).toBe(400);
  });
});
