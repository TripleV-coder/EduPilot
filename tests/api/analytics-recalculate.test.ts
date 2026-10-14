import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as POST_RECALCULATE } from "@/app/api/analytics/recalculate/route";
import { POST as POST_SYNC_ALL } from "@/app/api/analytics/sync-all/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAllStudentsForSchool: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findMany: vi.fn() },
    studentAnalytics: { updateMany: vi.fn() },
    academicYear: { findFirst: vi.fn() },
  },
}));

const AY = cuid("ay1");

describe("POST /api/analytics/recalculate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse sans session (401) et pour un rôle non autorisé (403)", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const anon = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: null });
    expect(anon.status).toBe(401);
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const director = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: makeSession("DIRECTOR") });
    expect(director.status).toBe(403);
  });

  it("exige un établissement (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(400);
  });

  it("refuse de recalculer un AUTRE établissement (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_RECALCULATE(
      makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: { schoolId: FIXTURES.schoolB } }),
      { session: makeSession("SCHOOL_ADMIN") },
    );
    expect(res.status).toBe(403);
    expect(syncAllStudentsForSchool).not.toHaveBeenCalled();
  });

  it("recalcule avec le modèle officiel (paramètres de l'école), sans modèle parallèle", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(syncAllStudentsForSchool).mockResolvedValue({ processed: 3, errors: 0 });

    const res = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: makeSession("SCHOOL_ADMIN") });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, processed: 3, errors: 0 });
    expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, AY);
    // Plus aucune écriture directe et approximative du niveau de risque
    expect(prisma.studentAnalytics.updateMany).not.toHaveBeenCalled();
  });

  it("signale l'absence d'année en cours (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(400);
  });

  it("renvoie 500 si le recalcul échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(syncAllStudentsForSchool).mockRejectedValue(new Error("boom"));
    const res = await POST_RECALCULATE(makeRequest("http://localhost/api/analytics/recalculate", { method: "POST", body: {} }), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du calcul");
  });
});

describe("POST /api/analytics/sync-all", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: {} }), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when no academic year is resolvable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: {} }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Année académique requise");
  });

  it("should return 400 when no school is available", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: { academicYearId: AY } }), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Établissement requis");
  });

  it("should sync using the provided academic year", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(syncAllStudentsForSchool).mockResolvedValue({ processed: 42, errors: 1 });
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: { academicYearId: AY } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(42);
    expect(body.errors).toBe(1);
    expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, AY);
    // L'année fournie est rattachée à l'établissement avant toute synchronisation.
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: AY, schoolId: FIXTURES.schoolA }) })
    );
  });

  it("should resolve the current year when none is provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(syncAllStudentsForSchool).mockResolvedValue({ processed: 0, errors: 0 });
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: {} }), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(200);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: FIXTURES.schoolA, isCurrent: true }) })
    );
    expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, AY);
  });

  it("should return 500 when the sync fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(syncAllStudentsForSchool).mockRejectedValue(new Error("boom"));
    const res = await POST_SYNC_ALL(makeRequest("http://localhost/api/analytics/sync-all", { method: "POST", body: { academicYearId: AY } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    // Message générique : le détail de l'erreur reste dans le journal serveur.
    expect((await res.json()).error).toBe("Erreur lors de la synchronisation globale");
  });
});