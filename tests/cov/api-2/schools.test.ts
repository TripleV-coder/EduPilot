/**
 * Couverture des routes établissements : /api/schools, /api/schools/context,
 * /api/schools/[id], /levels et /modules.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "../../api/test-helpers";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new MockNextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});
vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    SchoolType: { PUBLIC: "PUBLIC", PRIVATE: "PRIVATE", RELIGIOUS: "RELIGIOUS", INTERNATIONAL: "INTERNATIONAL" },
    SchoolLevel: { PRIMARY: "PRIMARY", SECONDARY_COLLEGE: "SECONDARY_COLLEGE", SECONDARY_LYCEE: "SECONDARY_LYCEE", MIXED: "MIXED" },
    SiteType: { MAIN: "MAIN", ANNEXE: "ANNEXE" },
  };
});
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/modules/school-modules", () => ({
  getEnabledModules: vi.fn().mockResolvedValue(null),
  invalidateSchoolModulesCache: vi.fn(),
}));
vi.mock("@/lib/auth/school-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/school-access")>();
  return { ...actual, getAccessibleSchoolIdsForUser: vi.fn() };
});
vi.mock("@/lib/schools/provisioning", () => ({ createSchoolWithDefaults: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return { ...actual, invalidateByPath: vi.fn() };
});
vi.mock("@/lib/security/audit-log", () => ({ createAuditLog: vi.fn() }));

import prisma from "@/lib/prisma";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { createSchoolWithDefaults } from "@/lib/schools/provisioning";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { GET as listSchools, POST as createSchool } from "@/app/api/schools/route";
import { GET as getContext } from "@/app/api/schools/context/route";
import { GET as getSchool, PATCH as patchSchool, DELETE as deleteSchool } from "@/app/api/schools/[id]/route";
import { GET as getLevels } from "@/app/api/schools/[id]/levels/route";
import { GET as getModules } from "@/app/api/schools/[id]/modules/route";

const base = "http://localhost/api/schools";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (tx: unknown) => unknown) => Promise.resolve(cb(prisma))) as never);
});

describe("GET /api/schools", () => {
  it("le super-admin voit tous les établissements (aucun filtre)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.school.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.school.count).mockResolvedValue(0 as never);
    const res = await listSchools(makeRequest(`${base}?page=1`));
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.school.findMany).mock.calls[0][0]?.where;
    expect(JSON.stringify(where ?? {})).not.toContain("\"in\"");
  });

  it("refuse (403) un compte sans aucun établissement accessible", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA, accessibleSchoolIds: [] }));
    vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue([]);
    const res = await listSchools(makeRequest(base));
    expect(res.status).toBe(403);
    expect(prisma.school.findMany).not.toHaveBeenCalled();
  });

  it("restreint un directeur à ses établissements résolus", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA, accessibleSchoolIds: [] }));
    vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue([FIXTURES.schoolA]);
    vi.mocked(prisma.school.findMany).mockResolvedValue([] as never);
    const res = await listSchools(makeRequest(base));
    expect(res.status).toBe(200);
    expect(JSON.stringify(vi.mocked(prisma.school.findMany).mock.calls[0][0]?.where)).toContain(FIXTURES.schoolA);
  });
});

describe("POST /api/schools", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
  });

  it("refuse un directeur (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await createSchool(makeRequest(base, { method: "POST", body: { name: "Lycée Béhanzin" } }));
    expect(res.status).toBe(403);
    expect(createSchoolWithDefaults).not.toHaveBeenCalled();
  });

  it("rejette un nom trop court (400)", async () => {
    const res = await createSchool(makeRequest(base, { method: "POST", body: { name: "Ly" } }));
    expect(res.status).toBe(400);
  });

  it("crée l'établissement et invalide le cache (201)", async () => {
    vi.mocked(createSchoolWithDefaults).mockResolvedValue({ id: "s1", name: "Lycée Béhanzin" } as never);
    const res = await createSchool(makeRequest(base, { method: "POST", body: { name: "Lycée Béhanzin", city: "Porto-Novo" } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "s1", name: "Lycée Béhanzin" });
    expect(vi.mocked(createSchoolWithDefaults).mock.calls[0][1]).toMatchObject({ name: "Lycée Béhanzin", city: "Porto-Novo" });
    expect(invalidateByPath).toHaveBeenCalledWith("/api/schools");
  });

  it.each([
    "PARENT_SCHOOL_NOT_FOUND",
    "PARENT_SCHOOL_MUST_BE_MAIN",
    "ORGANIZATION_NOT_FOUND",
    "ORGANIZATION_INACTIVE",
    "PARENT_SCHOOL_ORGANIZATION_MISMATCH",
    "PARENT_SCHOOL_REQUIRES_SHARED_ORGANIZATION",
  ])("traduit l'erreur métier %s en 400", async (code) => {
    vi.mocked(createSchoolWithDefaults).mockRejectedValue(new Error(code));
    const res = await createSchool(makeRequest(base, { method: "POST", body: { name: "Annexe Nord" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).not.toContain(code);
    expect(invalidateByPath).not.toHaveBeenCalled();
  });

  it("une erreur inattendue donne un 500 générique sans fuite", async () => {
    vi.mocked(createSchoolWithDefaults).mockRejectedValue(new Error("connexion SQL perdue"));
    const res = await createSchool(makeRequest(base, { method: "POST", body: { name: "Annexe Nord" } }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SQL");
  });
});

describe("GET /api/schools/context", () => {
  it("super-admin sans école active : tout le catalogue, aucune année", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: "s1" }, { id: "s2" }] as never);
    const res = await getContext(makeRequest(`${base}/context`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accessibleSchoolIds).toEqual(["s1", "s2"]);
    expect(body.activeSchoolId).toBeNull();
    expect(body.schoolName).toBeNull();
    expect(body.enabledModules.length).toBeGreaterThan(3);
    expect(body.organizationIds).toEqual([]);
    expect(body.isOrganizationManager).toBe(false);
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
  });

  it("super-admin avec école active introuvable : catalogue complet par défaut", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.school.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null as never);
    const body = await (await getContext(makeRequest(`${base}/context`))).json();
    expect(body.activeSchoolId).toBe(FIXTURES.schoolA);
    expect(body.offeredLevels).toEqual([]);
    expect(body.academicYears).toEqual([]);
  });

  it("enseignant : établissements résolus, école active et réglages de l'école", async () => {
    const session = makeSession("TEACHER", { schoolId: FIXTURES.schoolA, accessibleSchoolIds: [] });
    Object.assign(session.user, { primarySchoolId: FIXTURES.schoolA, organizationIds: ["o1"], isOrganizationManager: true, primaryOrganizationId: "o1" });
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue([FIXTURES.schoolA]);
    vi.mocked(prisma.school.findMany).mockResolvedValue([{ id: FIXTURES.schoolA, name: "CEG" }] as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({
      name: "CEG Akpakpa",
      enabledModules: ["grades"],
      offeredLevels: ["PRIMARY"],
      academicYears: [{ id: "ay", name: "2026-2027", isCurrent: true, status: "ACTIVE" }],
    } as never);
    const body = await (await getContext(makeRequest(`${base}/context`))).json();
    expect(vi.mocked(prisma.school.findMany).mock.calls[0][0]?.where).toEqual({ id: { in: [FIXTURES.schoolA] } });
    expect(vi.mocked(prisma.school.findUnique).mock.calls[0][0]?.where).toEqual({ id: FIXTURES.schoolA });
    expect(body).toMatchObject({
      activeSchoolId: FIXTURES.schoolA,
      primarySchoolId: FIXTURES.schoolA,
      primaryOrganizationId: "o1",
      organizationIds: ["o1"],
      isOrganizationManager: true,
      schoolName: "CEG Akpakpa",
      offeredLevels: ["PRIMARY"],
    });
  });

  it("aucun établissement accessible : liste vide sans requête", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: FIXTURES.schoolA, accessibleSchoolIds: [] }));
    vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue([]);
    const body = await (await getContext(makeRequest(`${base}/context`))).json();
    expect(prisma.school.findMany).not.toHaveBeenCalled();
    expect(body.schools).toEqual([]);
    expect(body.activeSchoolId).toBeNull();
  });
});

describe("/api/schools/[id]", () => {
  it("GET : 404 si l'établissement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null as never);
    const res = await getSchool(makeRequest(`${base}/${FIXTURES.schoolA}`), params(FIXTURES.schoolA));
    expect(res.status).toBe(404);
  });

  it("GET : refuse l'accès à l'établissement d'un autre tenant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await getSchool(makeRequest(`${base}/${FIXTURES.schoolB}`), params(FIXTURES.schoolB));
    expect(res.status).toBe(403);
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
  });

  it("PATCH : 403 hors de son établissement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await patchSchool(makeRequest(`${base}/${FIXTURES.schoolB}`, { method: "PATCH", body: { name: "Nouveau nom" } }), params(FIXTURES.schoolB));
    expect(res.status).toBe(403);
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it("PATCH : 404 si l'établissement n'existe plus", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null as never);
    const res = await patchSchool(makeRequest(`${base}/${FIXTURES.schoolA}`, { method: "PATCH", body: { name: "Nouveau nom" } }), params(FIXTURES.schoolA));
    expect(res.status).toBe(404);
  });

  it("PATCH : rejette un champ inconnu (schéma strict, 400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ id: FIXTURES.schoolA } as never);
    const res = await patchSchool(makeRequest(`${base}/${FIXTURES.schoolA}`, { method: "PATCH", body: { enabledModules: ["x"] } }), params(FIXTURES.schoolA));
    expect(res.status).toBe(400);
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it("PATCH : met à jour son établissement et invalide le cache", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ id: FIXTURES.schoolA } as never);
    vi.mocked(prisma.school.update).mockResolvedValue({ id: FIXTURES.schoolA, motto: "Travail" } as never);
    const res = await patchSchool(makeRequest(`${base}/${FIXTURES.schoolA}`, { method: "PATCH", body: { motto: "Travail" } }), params(FIXTURES.schoolA));
    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.school.update).mock.calls[0][0];
    expect(arg.where).toEqual({ id: FIXTURES.schoolA });
    expect(arg.data).toMatchObject({ motto: "Travail" });
    expect(invalidateByPath).toHaveBeenCalledWith("/api/schools");
  });

  it("DELETE : réservé au super-admin (403 pour un admin d'école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await deleteSchool(makeRequest(`${base}/${FIXTURES.schoolA}`, { method: "DELETE" }), params(FIXTURES.schoolA));
    expect(res.status).toBe(403);
    expect(prisma.school.delete).not.toHaveBeenCalled();
  });

  it("DELETE : le super-admin supprime (204)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.school.delete).mockResolvedValue({} as never);
    const id = cuid("todelete");
    const res = await deleteSchool(makeRequest(`${base}/${id}`, { method: "DELETE" }), params(id));
    expect(res.status).toBe(204);
    expect(prisma.school.delete).toHaveBeenCalledWith({ where: { id } });
  });
});

describe("/api/schools/[id]/levels et /modules", () => {
  // Tous les rôles connus ont SCHOOL_READ : seul un rôle hérité/inconnu en session atteint ce refus.
  it("levels : 403 pour un rôle inconnu (sans SCHOOL_READ)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("GUEST"));
    const res = await getLevels(makeRequest(`${base}/${FIXTURES.schoolA}/levels`), params(FIXTURES.schoolA));
    expect(res.status).toBe(403);
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
  });

  it("modules : 403 pour un rôle inconnu (sans SCHOOL_READ)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("GUEST"));
    const res = await getModules(makeRequest(`${base}/${FIXTURES.schoolA}/modules`), params(FIXTURES.schoolA));
    expect(res.status).toBe(403);
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
  });
});
