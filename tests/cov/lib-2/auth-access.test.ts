import { describe, it, expect, vi, beforeEach } from "vitest";
import NextAuth from "next-auth";

vi.mock("@/lib/prisma", () => ({
  default: {
    organizationMembership: { findMany: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    classSubject: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { buildTeacherSchoolScope, getTeacherSchoolIdsForUser } from "@/lib/teachers/school-assignments";
import {
  InvalidTwoFactorSignin,
  ServiceUnavailableSignin,
  withSigninErrorMapping,
  toSigninError,
} from "@/lib/auth/login-failure";
import { edgeAuth } from "@/lib/auth/edge";

// Configuration passée à NextAuth par edge.ts, capturée avant toute remise à zéro.
const edgeConfig = vi.mocked(NextAuth).mock.calls[0]?.[0] as unknown as {
  providers: unknown[];
  session: unknown;
  callbacks: { session: (a: { session: Record<string, unknown>; token: Record<string, unknown> }) => Promise<Record<string, unknown>> };
};

const membership = (id: string, schools: string[], over: Record<string, unknown> = {}) => ({
  organizationId: id,
  isOwner: false,
  canManageSites: false,
  organization: { id, name: `Réseau ${id}`, schools: schools.map((s) => ({ id: s })) },
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([] as never);
});

describe("getOrganizationAccessForUser", () => {
  it("agrège organisations et écoles (sans doublon) et détecte un gestionnaire de sites", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValueOnce([
      membership("org-1", ["s1", "s2"]),
      membership("org-2", ["s2", "s3"], { canManageSites: true }),
    ] as never);
    const access = await getOrganizationAccessForUser("u-1");
    expect(access.organizationIds).toEqual(["org-1", "org-2"]);
    expect(access.primaryOrganizationId).toBe("org-1");
    expect(access.accessibleSchoolIds).toEqual(["s1", "s2", "s3"]);
    expect(access.isOrganizationManager).toBe(true);
    expect(access.memberships[0]).toEqual({
      organizationId: "org-1",
      organizationName: "Réseau org-1",
      isOwner: false,
      canManageSites: false,
      schoolIds: ["s1", "s2"],
    });
    // Seules les organisations actives comptent.
    expect(vi.mocked(prisma.organizationMembership.findMany).mock.calls[0][0]).toMatchObject({
      where: { userId: "u-1", organization: { isActive: true } },
    });
  });

  it("un propriétaire est gestionnaire ; un simple membre ne l'est pas", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValueOnce([membership("o", [], { isOwner: true })] as never);
    expect((await getOrganizationAccessForUser("u")).isOrganizationManager).toBe(true);
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValueOnce([membership("o", ["s"])] as never);
    expect((await getOrganizationAccessForUser("u")).isOrganizationManager).toBe(false);
  });

  it("sans adhésion : aucune organisation principale", async () => {
    const access = await getOrganizationAccessForUser("u");
    expect(access).toMatchObject({ organizationIds: [], primaryOrganizationId: null, accessibleSchoolIds: [], isOrganizationManager: false });
  });
});

describe("getAccessibleSchoolIdsForUser", () => {
  it("SUPER_ADMIN : uniquement son école principale, ou aucune restriction", async () => {
    expect(await getAccessibleSchoolIdsForUser({ userId: "sa", role: "SUPER_ADMIN", primarySchoolId: "s1" })).toEqual(["s1"]);
    expect(await getAccessibleSchoolIdsForUser({ userId: "sa", role: "SUPER_ADMIN", primarySchoolId: null })).toEqual([]);
  });

  it("TEACHER : cumule affectations, cours et classes principales", async () => {
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({ schoolId: "s1", schoolAssignments: [{ schoolId: "s2" }] } as never);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValueOnce([{ class: { schoolId: "s3" } }] as never);
    vi.mocked(prisma.class.findMany).mockResolvedValueOnce([{ schoolId: "s4" }, { schoolId: "s1" }] as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "t", role: "TEACHER", primarySchoolId: "s1" })).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("PARENT : ajoute les écoles de ses enfants", async () => {
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({
      parentStudents: [{ student: { schoolId: "s5" } }, { student: { schoolId: "s6" } }],
    } as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "p", role: "PARENT", primarySchoolId: null })).toEqual(["s5", "s6"]);
  });

  it("PARENT sans profil : seulement son école principale", async () => {
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce(null);
    expect(await getAccessibleSchoolIdsForUser({ userId: "p", role: "PARENT", primarySchoolId: "s1" })).toEqual(["s1"]);
  });

  it("STUDENT : école du profil élève, avec ou sans profil", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ schoolId: "s7" } as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "e", role: "STUDENT", primarySchoolId: "s7" })).toEqual(["s7"]);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null);
    expect(await getAccessibleSchoolIdsForUser({ userId: "e", role: "STUDENT", primarySchoolId: null })).toEqual([]);
  });

  it("DIRECTOR sans école principale : écoles de ses organisations seulement", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValueOnce([membership("o", ["s8"])] as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "d", role: "DIRECTOR", primarySchoolId: null })).toEqual(["s8"]);
    expect(prisma.school.findUnique).not.toHaveBeenCalled();
  });

  it("SCHOOL_ADMIN d'un site principal : inclut les annexes", async () => {
    vi.mocked(prisma.school.findUnique).mockResolvedValueOnce({ siteType: "MAIN", childSchools: [{ id: "a1" }] } as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "d", role: "SCHOOL_ADMIN", primarySchoolId: "m" })).toEqual(["m", "a1"]);
  });

  it("NETWORK_ADMIN d'une annexe : uniquement son école", async () => {
    vi.mocked(prisma.school.findUnique).mockResolvedValueOnce({ siteType: "ANNEXE", childSchools: [] } as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "d", role: "NETWORK_ADMIN" as never, primarySchoolId: "x" })).toEqual(["x"]);
  });

  it("autre rôle (ACCOUNTANT) : école principale + organisations", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValueOnce([membership("o", ["s9"])] as never);
    expect(await getAccessibleSchoolIdsForUser({ userId: "c", role: "ACCOUNTANT", primarySchoolId: "s1" })).toEqual(["s9", "s1"]);
  });
});

describe("school-assignments", () => {
  it("buildTeacherSchoolScope couvre l'école principale et les affectations actives", () => {
    expect(buildTeacherSchoolScope("s1")).toEqual({
      OR: [{ schoolId: "s1" }, { schoolAssignments: { some: { schoolId: "s1", status: "ACTIVE" } } }],
    });
  });

  it("getTeacherSchoolIdsForUser fusionne école principale, profil et affectations", async () => {
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({ schoolId: "s2", schoolAssignments: [{ schoolId: "s3" }, { schoolId: "s2" }] } as never);
    expect(await getTeacherSchoolIdsForUser({ userId: "t", primarySchoolId: "s1" })).toEqual(["s1", "s2", "s3"]);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce(null);
    expect(await getTeacherSchoolIdsForUser({ userId: "t" })).toEqual([]);
  });
});

describe("login-failure", () => {
  it("InvalidTwoFactorSignin porte le code invalid_2fa", () => {
    expect(new InvalidTwoFactorSignin().code).toBe("invalid_2fa");
  });

  it("withSigninErrorMapping transmet le résultat et les arguments", async () => {
    const inner = vi.fn(async (a: number, b: number) => a + b);
    expect(await withSigninErrorMapping(inner)(2, 3)).toBe(5);
    expect(inner).toHaveBeenCalledWith(2, 3);
  });

  it("une panne d'infrastructure (nom d'erreur Prisma) devient service_unavailable et est journalisée", async () => {
    const wrapped = withSigninErrorMapping(async () => {
      throw Object.assign(new Error("init"), { name: "PrismaClientInitializationError" });
    });
    await expect(wrapped()).rejects.toBeInstanceOf(ServiceUnavailableSignin);
    expect(logger.error).toHaveBeenCalled();
  });

  it("errorCode P2024 (pool saturé) est aussi une panne d'infrastructure", () => {
    expect(toSigninError({ errorCode: "P2024" })).toBeInstanceOf(ServiceUnavailableSignin);
  });

  it("une erreur métier est relancée telle quelle", async () => {
    const err = new Error("autre");
    await expect(withSigninErrorMapping(async () => { throw err; })()).rejects.toBe(err);
    expect(toSigninError(null)).toBeNull();
    expect(toSigninError("x")).toBe("x");
  });
});

describe("edge auth (middleware)", () => {
  it("déclare une config JWT sans fournisseur et exporte edgeAuth", () => {
    expect(edgeConfig.providers).toEqual([]);
    expect(edgeConfig.session).toEqual({ strategy: "jwt" });
    expect(typeof edgeAuth).toBe("function");
  });

  it("projette le jeton sur la session utilisateur", async () => {
    const res = await edgeConfig.callbacks.session({
      session: { user: {} },
      token: {
        id: "u", role: "TEACHER", primaryOrganizationId: null, organizationIds: ["o"], isOrganizationManager: false,
        primarySchoolId: "s", schoolId: "s", accessibleSchoolIds: ["s"], firstName: "F", lastName: "L",
        isTwoFactorEnabled: true, isTwoFactorAuthenticated: false, mustChangePassword: true,
      },
    });
    expect(res.user).toEqual({
      id: "u", role: "TEACHER", primaryOrganizationId: null, organizationIds: ["o"], isOrganizationManager: false,
      primarySchoolId: "s", schoolId: "s", accessibleSchoolIds: ["s"], firstName: "F", lastName: "L",
      isTwoFactorEnabled: true, isTwoFactorAuthenticated: false, mustChangePassword: true,
    });
  });

  it("mustChangePassword n'est vrai que pour la valeur booléenne true ; sans utilisateur la session est intacte", async () => {
    const res = await edgeConfig.callbacks.session({ session: { user: {} }, token: { mustChangePassword: "oui" } });
    expect((res.user as Record<string, unknown>).mustChangePassword).toBe(false);
    expect(await edgeConfig.callbacks.session({ session: { expires: "e" }, token: { id: "u" } })).toEqual({ expires: "e" });
  });
});
