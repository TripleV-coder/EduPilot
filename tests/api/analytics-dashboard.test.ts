import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/analytics/dashboard/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getAdminDashboardData,
  getGlobalDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getParentDashboardData,
  getAccountantDashboardData,
  getStaffDashboardData,
} from "@/lib/services/analytics-dashboard";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/school-access", () => ({
  getAccessibleSchoolIdsForUser: vi.fn(),
}));
vi.mock("@/lib/services/analytics-dashboard", () => ({
  getAdminDashboardData: vi.fn(),
  getGlobalDashboardData: vi.fn(),
  getTeacherDashboardData: vi.fn(),
  getStudentDashboardData: vi.fn(),
  getParentDashboardData: vi.fn(),
  getAccountantDashboardData: vi.fn(),
  getStaffDashboardData: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
  },
}));

const AY = cuid("ay1");

describe("GET /api/analytics/dashboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // withCache (repli mémoire) persiste entre les tests : purge obligatoire.
    await invalidateCache("api:*");
  });

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid cross-school request", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest(`http://localhost/api/analytics/dashboard?schoolId=${FIXTURES.schoolB}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should reject SCHOOL_ADMIN without school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("SCHOOL_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(403);
  });

  it("should serve global data for SUPER_ADMIN without school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(getGlobalDashboardData).mockResolvedValue({ platform: "ok" } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ platform: "ok" });
    expect(getGlobalDashboardData).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
  });

  it("should return 400 when no academic year is found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Année académique requise");
  });

  it("should compute admin dashboard for DIRECTOR", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({ overview: { totalStudents: 120 } } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.totalStudents).toBe(120);
    expect(getAdminDashboardData).toHaveBeenCalledWith(
      FIXTURES.schoolA,
      AY,
      undefined,
      undefined,
      undefined,
      [FIXTURES.schoolA]
    );
  });

  /**
   * Perf (2026-09-18) : ce tableau de bord déclenchait une trentaine de
   * requêtes — 356 ms de médiane sur la base de l'audit — et les recalculait à
   * chaque affichage. C'est la première donnée que voit un directeur en
   * arrivant : elle doit être immédiate au deuxième chargement.
   */
  it("sert le cache au 2e appel identique, sans recalculer", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({ overview: { totalStudents: 120 } } as never);

    const url = "http://localhost/api/analytics/dashboard?cachetest=1";
    const first = await GET(makeRequest(url), { session: makeSession("DIRECTOR") });
    const second = await GET(makeRequest(url), { session: makeSession("DIRECTOR") });

    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect((await second.json()).overview.totalStudents).toBe(120);
    expect(getAdminDashboardData).toHaveBeenCalledTimes(1);
    expect(second.headers.get("Cache-Control")).toContain("private");
  });

  it("ne partage pas le cache entre deux comptes", async () => {
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({ overview: { totalStudents: 7 } } as never);
    const url = "http://localhost/api/analytics/dashboard?cachetest=2";

    const un = makeSession("DIRECTOR", { id: cuid("directeurun") });
    const deux = makeSession("DIRECTOR", { id: cuid("directeurdeux") });
    vi.mocked(auth).mockResolvedValue(un);
    await GET(makeRequest(url), { session: un });
    vi.mocked(auth).mockResolvedValue(deux);
    const other = await GET(makeRequest(url), { session: deux });

    expect(other.headers.get("X-Cache")).toBe("MISS");
    expect(getAdminDashboardData).toHaveBeenCalledTimes(2);
  });

  it("ne partage pas le cache entre deux périmètres d'établissements", async () => {
    // Un compte réseau qui change de périmètre garde la même URL et le même
    // identifiant : sans le périmètre dans la clé, il recevrait la vue de
    // l'autre périmètre. Constaté par tests/integration-db/analytics-dashboard.
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({ overview: { totalStudents: 1 } } as never);
    const url = "http://localhost/api/analytics/dashboard?cachetest=3";

    const seul = makeSession("DIRECTOR", { accessibleSchoolIds: [FIXTURES.schoolA] });
    const reseau = makeSession("DIRECTOR", { accessibleSchoolIds: [FIXTURES.schoolA, FIXTURES.schoolB] });

    vi.mocked(auth).mockResolvedValue(seul);
    const premier = await GET(makeRequest(url), { session: seul });
    vi.mocked(auth).mockResolvedValue(reseau);
    const second = await GET(makeRequest(url), { session: reseau });

    expect(premier.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("MISS");
    expect(getAdminDashboardData).toHaveBeenCalledTimes(2);
  });

  it("should forward filters to the admin service", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({} as never);
    const classId = cuid("class1");
    const periodId = cuid("p2");
    const subjectId = cuid("subj1");
    const res = await GET(makeRequest(
      `http://localhost/api/analytics/dashboard?academicYearId=${AY}&classId=${classId}&periodId=${periodId}&subjectId=${subjectId}`
    ), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(200);
    expect(getAdminDashboardData).toHaveBeenCalledWith(
      FIXTURES.schoolA,
      AY,
      classId,
      periodId,
      subjectId,
      [FIXTURES.schoolA]
    );
  });

  it("should compute teacher dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u_teach" }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getTeacherDashboardData).mockResolvedValue({ myClasses: [] } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("TEACHER", { id: "u_teach" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ myClasses: [] });
    expect(getTeacherDashboardData).toHaveBeenCalledWith("u_teach", FIXTURES.schoolA, AY);
  });

  it("should compute student dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_stu" }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getStudentDashboardData).mockResolvedValue({ grades: [] } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("STUDENT", { id: "u_stu" }) });
    expect(res.status).toBe(200);
    expect(getStudentDashboardData).toHaveBeenCalledWith("u_stu", AY);
  });

  it("should compute parent dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_par" }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getParentDashboardData).mockResolvedValue({ children: [] } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("PARENT", { id: "u_par" }) });
    expect(res.status).toBe(200);
    expect(getParentDashboardData).toHaveBeenCalledWith("u_par", AY);
  });

  it("should compute accountant dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAccountantDashboardData).mockResolvedValue({ revenue: 1000 } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("ACCOUNTANT") });
    expect(res.status).toBe(200);
    expect(getAccountantDashboardData).toHaveBeenCalledWith(FIXTURES.schoolA);
  });

  it("should compute staff dashboard", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getStaffDashboardData).mockResolvedValue({ attendance: 0.9 } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("STAFF") });
    expect(res.status).toBe(200);
    expect(getStaffDashboardData).toHaveBeenCalledWith(FIXTURES.schoolA, AY);
  });

  it("should resolve accessible school ids when session has none declared", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { accessibleSchoolIds: [] }));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockResolvedValue({} as never);
    const { getAccessibleSchoolIdsForUser } = await import("@/lib/auth/school-access");
    vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue([FIXTURES.schoolA, FIXTURES.schoolB]);
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("DIRECTOR", { accessibleSchoolIds: [] }) });
    expect(res.status).toBe(200);
    expect(getAccessibleSchoolIdsForUser).toHaveBeenCalledWith({
      userId: expect.any(String),
      role: "DIRECTOR",
      primarySchoolId: FIXTURES.schoolA,
    });
    expect(getAdminDashboardData).toHaveBeenCalledWith(
      FIXTURES.schoolA,
      AY,
      undefined,
      undefined,
      undefined,
      [FIXTURES.schoolA, FIXTURES.schoolB]
    );
  });

  it("should return 500 when the service fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: AY } as never);
    vi.mocked(getAdminDashboardData).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("http://localhost/api/analytics/dashboard"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
  });
});