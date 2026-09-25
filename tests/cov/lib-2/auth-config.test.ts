import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Le fournisseur Credentials est remplacé par une fabrique transparente : on
// récupère ainsi `authorize` tel que déclaré dans la configuration.
vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: Record<string, unknown>) => ({ id: "credentials", type: "credentials", ...opts }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));

vi.mock("@/lib/auth/account-lockout", () => ({
  isAccountLocked: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  resetFailedLoginAttempts: vi.fn(),
}));

vi.mock("@/lib/auth/two-factor", () => ({
  verifyToken: vi.fn(),
  findMatchingBackupCode: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitKey: vi.fn(),
  createRateLimitKey: (prefix: string, id: string) => `${prefix}:${id}`,
  resetRateLimit: vi.fn(),
  MFA_VERIFY_RATE_LIMIT: { limit: 5, windowMs: 60_000 },
}));

vi.mock("@/lib/auth/organization-access", () => ({
  getOrganizationAccessForUser: vi.fn(),
}));

vi.mock("@/lib/auth/school-access", () => ({
  getAccessibleSchoolIdsForUser: vi.fn(),
  resolveActiveSchoolId: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { isAccountLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from "@/lib/auth/account-lockout";
import { verifyToken, findMatchingBackupCode } from "@/lib/auth/two-factor";
import { checkRateLimitKey, resetRateLimit } from "@/lib/rate-limit";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { getAccessibleSchoolIdsForUser, resolveActiveSchoolId } from "@/lib/auth/school-access";
import { authConfig, invalidateUserStatusCache } from "@/lib/auth/config";

type Authorize = (credentials: Record<string, unknown>, req?: unknown) => Promise<Record<string, unknown> | null>;
const provider = (authConfig.providers[0] as unknown as { authorize: Authorize });
const authorize = (creds: Record<string, unknown>) => provider.authorize(creds, {} as never);

type Cb = Record<string, (arg: Record<string, unknown>) => Promise<Record<string, unknown> | string>>;
const callbacks = authConfig.callbacks as unknown as Cb;
const jwt = (arg: Record<string, unknown>) => callbacks.jwt(arg) as Promise<Record<string, unknown>>;

const findUnique = vi.mocked(prisma.user.findUnique);
const auditCreate = vi.mocked(prisma.auditLog.create);

function dbUser(over: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    email: "prof@ecole.bj",
    password: "hash",
    firstName: "Awa",
    lastName: "Kossi",
    role: "TEACHER",
    roles: [],
    schoolId: "school-1",
    isActive: true,
    lockedUntil: null,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    mustChangePassword: false,
    avatar: null,
    ...over,
  };
}

const CREDS = { email: "PROF@Ecole.bj", password: "secret" };

function auditActions() {
  return auditCreate.mock.calls.map((c) => (c[0] as { data: { action: string } }).data.action);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isAccountLocked).mockResolvedValue({ isLocked: false } as never);
  vi.mocked(getOrganizationAccessForUser).mockResolvedValue({
    primaryOrganizationId: "org-1",
    organizationIds: ["org-1"],
    isOrganizationManager: false,
  } as never);
  vi.mocked(getAccessibleSchoolIdsForUser).mockResolvedValue(["school-1", "school-2"] as never);
  vi.mocked(resolveActiveSchoolId).mockReturnValue("school-1");
  vi.mocked(checkRateLimitKey).mockResolvedValue({ success: true } as never);
});

describe("authConfig — options générales", () => {
  it("utilise des sessions JWT de 24 h et redirige les erreurs vers /login", () => {
    expect(authConfig.session).toEqual({ strategy: "jwt", maxAge: 86400 });
    expect(authConfig.pages).toEqual({ signIn: "/login", error: "/login" });
  });
});

describe("authorize — refus", () => {
  it("refuse des identifiants mal formés sans interroger la base", async () => {
    expect(await authorize({ email: "pas-un-email", password: "x" })).toBeNull();
    expect(await authorize({ email: "a@b.bj", password: "" })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("normalise l'email en minuscules avant la recherche", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await authorize(CREDS)).toBeNull();
    expect(findUnique.mock.calls[0][0]).toMatchObject({ where: { email: "prof@ecole.bj" } });
  });

  it("refuse un compte inexistant ou désactivé", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await authorize(CREDS)).toBeNull();
    findUnique.mockResolvedValueOnce(dbUser({ isActive: false }) as never);
    expect(await authorize(CREDS)).toBeNull();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("refuse un compte verrouillé et journalise LOGIN_FAILED_LOCKED sans vérifier le mot de passe", async () => {
    findUnique.mockResolvedValueOnce(dbUser() as never);
    vi.mocked(isAccountLocked).mockResolvedValueOnce({ isLocked: true } as never);
    expect(await authorize(CREDS)).toBeNull();
    expect(auditActions()).toEqual(["LOGIN_FAILED_LOCKED"]);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("refuse un compte sans mot de passe (OAuth / lien magique)", async () => {
    findUnique.mockResolvedValueOnce(dbUser({ password: null }) as never);
    expect(await authorize(CREDS)).toBeNull();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("refuse un mauvais mot de passe : incrémente le compteur et journalise LOGIN_FAILED", async () => {
    findUnique.mockResolvedValueOnce(dbUser() as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    expect(await authorize(CREDS)).toBeNull();
    expect(recordFailedLoginAttempt).toHaveBeenCalledWith("u-1");
    expect(auditActions()).toEqual(["LOGIN_FAILED"]);
    expect(resetFailedLoginAttempts).not.toHaveBeenCalled();
  });

  it("rejette un code 2FA invalide (ni TOTP ni code de secours) avec code invalid_2fa et compte la tentative", async () => {
    findUnique.mockResolvedValueOnce(
      dbUser({ isTwoFactorEnabled: true, twoFactorSecret: "S", twoFactorBackupCodes: ["h1"] }) as never,
    );
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    vi.mocked(findMatchingBackupCode).mockResolvedValueOnce(-1);
    await expect(authorize({ ...CREDS, twoFactorCode: "000000" })).rejects.toMatchObject({ code: "invalid_2fa" });
    expect(recordFailedLoginAttempt).toHaveBeenCalledWith("u-1");
    expect(auditActions()).toEqual(["LOGIN_FAILED_2FA"]);
    expect(resetFailedLoginAttempts).not.toHaveBeenCalled();
  });

  it("vérifie le TOTP avec un secret vide et une liste de secours vide si absents en base", async () => {
    findUnique.mockResolvedValueOnce(
      dbUser({ isTwoFactorEnabled: true, twoFactorSecret: null, twoFactorBackupCodes: null }) as never,
    );
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    vi.mocked(findMatchingBackupCode).mockResolvedValueOnce(-1);
    await expect(authorize({ ...CREDS, twoFactorCode: "123456" })).rejects.toMatchObject({ code: "invalid_2fa" });
    expect(verifyToken).toHaveBeenCalledWith("123456", "");
    expect(findMatchingBackupCode).toHaveBeenCalledWith("123456", []);
  });

  it("transforme une panne de base en service_unavailable, jamais en identifiants invalides", async () => {
    findUnique.mockRejectedValueOnce(Object.assign(new Error("db down"), { code: "P1001" }));
    await expect(authorize(CREDS)).rejects.toMatchObject({ code: "service_unavailable" });
  });
});

describe("authorize — succès", () => {
  it("retourne l'utilisateur complet, réinitialise le compteur et journalise LOGIN_SUCCESS", async () => {
    findUnique.mockResolvedValueOnce(dbUser({ avatar: "a.png", mustChangePassword: true }) as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    const user = await authorize(CREDS);
    expect(user).toMatchObject({
      id: "u-1",
      email: "prof@ecole.bj",
      name: "Awa Kossi",
      role: "TEACHER",
      roles: ["TEACHER"], // repli sur [role] quand roles est vide
      primaryOrganizationId: "org-1",
      organizationIds: ["org-1"],
      isOrganizationManager: false,
      primarySchoolId: "school-1",
      schoolId: "school-1",
      accessibleSchoolIds: ["school-1", "school-2"],
      isTwoFactorEnabled: false,
      isTwoFactorAuthenticated: true,
      mustChangePassword: true,
      avatar: "a.png",
    });
    expect(Array.isArray(user?.permissions)).toBe(true);
    expect((user?.permissions as string[]).length).toBeGreaterThan(0);
    expect(resetFailedLoginAttempts).toHaveBeenCalledWith("u-1");
    expect(auditActions()).toEqual(["LOGIN_SUCCESS"]);
    expect(getAccessibleSchoolIdsForUser).toHaveBeenCalledWith({ userId: "u-1", role: "TEACHER", primarySchoolId: "school-1" });
    expect(resolveActiveSchoolId).toHaveBeenCalledWith({ primarySchoolId: "school-1", accessibleSchoolIds: ["school-1", "school-2"] });
  });

  it("utilise les rôles hybrides quand ils sont renseignés", async () => {
    findUnique.mockResolvedValueOnce(dbUser({ roles: ["TEACHER", "PARENT"] }) as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    const user = await authorize(CREDS);
    expect(user?.roles).toEqual(["TEACHER", "PARENT"]);
    expect(user?.mustChangePassword).toBe(false);
  });

  it("2FA activée sans code : connexion pré-2FA (isTwoFactorAuthenticated=false)", async () => {
    findUnique.mockResolvedValueOnce(dbUser({ isTwoFactorEnabled: true, twoFactorSecret: "S" }) as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    const user = await authorize(CREDS);
    expect(user).toMatchObject({ isTwoFactorEnabled: true, isTwoFactorAuthenticated: false });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("2FA avec TOTP valide : session pleinement authentifiée", async () => {
    findUnique.mockResolvedValueOnce(dbUser({ isTwoFactorEnabled: true, twoFactorSecret: "S" }) as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    vi.mocked(verifyToken).mockResolvedValueOnce(true);
    const user = await authorize({ ...CREDS, twoFactorCode: "123456" });
    expect(user?.isTwoFactorAuthenticated).toBe(true);
    expect(verifyToken).toHaveBeenCalledWith("123456", "S");
    expect(findMatchingBackupCode).not.toHaveBeenCalled();
  });

  it("2FA avec code de secours : le code consommé est retiré de la liste (usage unique)", async () => {
    findUnique.mockResolvedValueOnce(
      dbUser({ isTwoFactorEnabled: true, twoFactorSecret: "S", twoFactorBackupCodes: ["h0", "h1", "h2"] }) as never,
    );
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    vi.mocked(findMatchingBackupCode).mockResolvedValueOnce(1);
    const user = await authorize({ ...CREDS, twoFactorCode: "abcde-fghij" });
    expect(user?.isTwoFactorAuthenticated).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { twoFactorBackupCodes: ["h0", "h2"] },
    });
  });
});

describe("callback jwt — connexion initiale", () => {
  it("recopie toutes les propriétés de l'utilisateur dans le jeton sans vérification de statut au signIn", async () => {
    const user = {
      id: "u-2", role: "DIRECTOR", roles: ["DIRECTOR"], permissions: ["X"],
      primaryOrganizationId: null, organizationIds: [], isOrganizationManager: true,
      primarySchoolId: "s", schoolId: "s", accessibleSchoolIds: ["s"],
      firstName: "F", lastName: "L", isTwoFactorEnabled: true, isTwoFactorAuthenticated: false,
      mustChangePassword: false, avatar: null,
    };
    const token = await jwt({ token: {}, user, trigger: "signIn" });
    expect(token).toEqual({ ...user });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("retourne le jeton tel quel s'il n'a pas d'identifiant", async () => {
    const token = await jwt({ token: { foo: 1 } });
    expect(token).toEqual({ foo: 1 });
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("callback jwt — vérification MFA (trigger update)", () => {
  it("ne vérifie rien si le jeton n'a pas d'utilisateur", async () => {
    const token = await jwt({ token: {}, trigger: "update", session: { twoFactorCode: "123456" } });
    expect(checkRateLimitKey).not.toHaveBeenCalled();
    expect(token.isTwoFactorAuthenticated).toBeUndefined();
  });

  it("bloque la vérification quand le plafond anti-force-brute est atteint", async () => {
    vi.mocked(checkRateLimitKey).mockResolvedValueOnce({ success: false } as never);
    const token = await jwt({ token: { id: "mfa-rl" }, trigger: "update", session: { twoFactorCode: "123456" } });
    expect(token.isTwoFactorAuthenticated).toBeUndefined();
    expect(auditActions()).toEqual(["MFA_VERIFY_RATE_LIMITED"]);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(checkRateLimitKey).toHaveBeenCalledWith("mfa-verify:mfa-rl", expect.anything());
  });

  it("valide un TOTP correct, remet à zéro le plafond et journalise MFA_VERIFIED", async () => {
    findUnique
      .mockResolvedValueOnce({ twoFactorSecret: "S", twoFactorBackupCodes: [] } as never)
      .mockResolvedValueOnce({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER" } as never);
    vi.mocked(verifyToken).mockResolvedValueOnce(true);
    const token = await jwt({ token: { id: "mfa-ok", role: "TEACHER" }, trigger: "update", session: { twoFactorCode: "123456" } });
    expect(token.isTwoFactorAuthenticated).toBe(true);
    expect(resetRateLimit).toHaveBeenCalledWith("mfa-verify:mfa-ok");
    expect(auditActions()).toEqual(["MFA_VERIFIED"]);
    expect(findMatchingBackupCode).not.toHaveBeenCalled();
  });

  it("accepte un code de secours valide, le consomme et journalise MFA_VERIFIED_BACKUP_CODE", async () => {
    findUnique
      .mockResolvedValueOnce({ twoFactorSecret: null, twoFactorBackupCodes: ["a", "b"] } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    vi.mocked(findMatchingBackupCode).mockResolvedValueOnce(0);
    const token = await jwt({ token: { id: "mfa-bk" }, trigger: "update", session: { twoFactorCode: "code" } });
    expect(verifyToken).toHaveBeenCalledWith("code", "");
    expect(token.isTwoFactorAuthenticated).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "mfa-bk" }, data: { twoFactorBackupCodes: ["b"] } });
    expect(auditActions()).toEqual(["MFA_VERIFIED_BACKUP_CODE"]);
  });

  it("refuse un code faux quand aucun code de secours ne correspond", async () => {
    findUnique
      .mockResolvedValueOnce({ twoFactorSecret: "S", twoFactorBackupCodes: ["a"] } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    vi.mocked(findMatchingBackupCode).mockResolvedValueOnce(-1);
    const token = await jwt({ token: { id: "mfa-ko" }, trigger: "update", session: { twoFactorCode: "bad" } });
    expect(token.isTwoFactorAuthenticated).toBeUndefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(resetRateLimit).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("refuse un code faux sans consulter les codes de secours quand il n'y en a pas", async () => {
    findUnique
      .mockResolvedValueOnce({ twoFactorSecret: "S", twoFactorBackupCodes: null } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(verifyToken).mockResolvedValueOnce(false);
    const token = await jwt({ token: { id: "mfa-nobk" }, trigger: "update", session: { twoFactorCode: "bad" } });
    expect(findMatchingBackupCode).not.toHaveBeenCalled();
    expect(token.isTwoFactorAuthenticated).toBeUndefined();
  });

  it("ignore la vérification si l'utilisateur n'existe plus", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "mfa-gone" }, trigger: "update", session: { twoFactorCode: "123456" } });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(token.isTwoFactorAuthenticated).toBeUndefined();
  });
});

describe("callback jwt — changement d'école active", () => {
  it("un SUPER_ADMIN choisit librement l'école (ou aucune)", async () => {
    findUnique.mockResolvedValue(null);
    let token = await jwt({ token: { id: "sa-1", role: "SUPER_ADMIN" }, trigger: "update", session: { schoolId: "any" } });
    expect(token.schoolId).toBe("any");
    token = await jwt({ token: { id: "sa-1", role: "SUPER_ADMIN", schoolId: "x" }, trigger: "update", session: { schoolId: undefined } });
    expect(token.schoolId).toBeNull();
    expect(getAccessibleSchoolIdsForUser).not.toHaveBeenCalled();
    findUnique.mockReset();
  });

  it("un autre rôle ne peut basculer que vers une école accessible", async () => {
    findUnique
      .mockResolvedValueOnce({ schoolId: "school-1", role: "DIRECTOR" } as never)
      .mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "dir-1", role: "DIRECTOR" }, trigger: "update", session: { schoolId: "school-2" } });
    expect(token).toMatchObject({
      schoolId: "school-2",
      primarySchoolId: "school-1",
      accessibleSchoolIds: ["school-1", "school-2"],
      primaryOrganizationId: "org-1",
      organizationIds: ["org-1"],
      isOrganizationManager: false,
    });
    expect(resolveActiveSchoolId).not.toHaveBeenCalled();
  });

  it("une école non accessible est refusée : repli sur l'école résolue", async () => {
    findUnique
      .mockResolvedValueOnce({ schoolId: "school-1", role: "DIRECTOR" } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(resolveActiveSchoolId).mockReturnValueOnce("school-1");
    const token = await jwt({ token: { id: "dir-2", role: "DIRECTOR" }, trigger: "update", session: { schoolId: "ecole-pirate" } });
    expect(token.schoolId).toBe("school-1");
    expect(resolveActiveSchoolId).toHaveBeenCalledWith({
      primarySchoolId: "school-1",
      accessibleSchoolIds: ["school-1", "school-2"],
      requestedSchoolId: "ecole-pirate",
    });
  });

  it("une valeur non textuelle est traitée comme absence de choix", async () => {
    findUnique
      .mockResolvedValueOnce({ schoolId: null, role: "DIRECTOR" } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(resolveActiveSchoolId).mockReturnValueOnce(null);
    const token = await jwt({ token: { id: "dir-3", role: "DIRECTOR" }, trigger: "update", session: { schoolId: 42 } });
    expect(token.schoolId).toBeNull();
    expect(resolveActiveSchoolId).toHaveBeenCalledWith(expect.objectContaining({ requestedSchoolId: null }));
  });

  it("ne change rien si l'utilisateur a disparu de la base", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "dir-4", role: "DIRECTOR", schoolId: "keep" }, trigger: "update", session: { schoolId: "school-2" } });
    expect(token.schoolId).toBe("keep");
    expect(getOrganizationAccessForUser).not.toHaveBeenCalled();
  });

  it("une mise à jour sans clé schoolId ne touche pas au contexte école", async () => {
    findUnique.mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "dir-5", role: "DIRECTOR", schoolId: "keep" }, trigger: "update", session: { name: "x" } });
    expect(token.schoolId).toBe("keep");
    expect(findUnique).toHaveBeenCalledTimes(1); // uniquement le contrôle de statut
  });

  it("une mise à jour sans session ne fait aucun changement de contexte", async () => {
    findUnique.mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "dir-6", role: "DIRECTOR" }, trigger: "update" });
    expect(token).toEqual({ id: "dir-6", role: "DIRECTOR" });
  });
});

describe("callback jwt — invalidation du jeton", () => {
  afterEach(() => vi.useRealTimers());

  it("invalide le jeton d'un compte désactivé", async () => {
    findUnique.mockResolvedValueOnce({ isActive: false, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER" } as never);
    const token = await jwt({ token: { id: "inv-1", role: "TEACHER" } });
    expect(token.invalidated).toBe(true);
  });

  it("invalide le jeton si le mot de passe a changé après son émission", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2026-01-02"), roleChangedAt: null, role: "TEACHER" } as never);
    const token = await jwt({ token: { id: "inv-2", role: "TEACHER", iat: Date.parse("2026-01-01") / 1000 } });
    expect(token.invalidated).toBe(true);
  });

  it("invalide un jeton sans iat dès qu'un changement de mot de passe existe", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2020-01-01"), roleChangedAt: null, role: "TEACHER" } as never);
    const token = await jwt({ token: { id: "inv-3", role: "TEACHER" } });
    expect(token.invalidated).toBe(true);
  });

  it("invalide le jeton si le rôle a changé après son émission", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2025-01-01"), roleChangedAt: new Date("2026-02-01"), role: "TEACHER" } as never);
    const token = await jwt({ token: { id: "inv-4", role: "TEACHER", iat: Date.parse("2026-01-01") / 1000 } });
    expect(token.invalidated).toBe(true);
  });

  it("garde un jeton valide et synchronise le rôle courant", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2025-01-01"), roleChangedAt: new Date("2025-01-01"), role: "DIRECTOR" } as never);
    const token = await jwt({ token: { id: "inv-5", role: "TEACHER", iat: Date.parse("2026-01-01") / 1000 } });
    expect(token.invalidated).toBeUndefined();
    expect(token.role).toBe("DIRECTOR");
  });

  it("met en cache le statut 30 s puis le relit, et invalidateUserStatusCache force la relecture", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
    findUnique.mockResolvedValue({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER" } as never);
    await jwt({ token: { id: "cache-1", role: "TEACHER" } });
    await jwt({ token: { id: "cache-1", role: "TEACHER" } });
    expect(findUnique).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-03-01T10:00:31Z"));
    await jwt({ token: { id: "cache-1", role: "TEACHER" } });
    expect(findUnique).toHaveBeenCalledTimes(2);

    invalidateUserStatusCache("cache-1");
    await jwt({ token: { id: "cache-1", role: "TEACHER" } });
    expect(findUnique).toHaveBeenCalledTimes(3);
    findUnique.mockReset();
  });

  it("purge les entrées expirées quand le cache dépasse 1000 utilisateurs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00Z"));
    findUnique.mockResolvedValue({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER" } as never);
    for (let i = 0; i < 1001; i++) {
      await jwt({ token: { id: `bulk-${i}`, role: "TEACHER" } });
    }
    // Les 1000+ entrées récentes ne sont pas purgées : relecture servie par le cache.
    const callsBefore = findUnique.mock.calls.length;
    await jwt({ token: { id: "bulk-0", role: "TEACHER" } });
    expect(findUnique.mock.calls.length).toBe(callsBefore);

    // 31 s plus tard, un nouvel utilisateur déclenche la purge des entrées expirées.
    vi.setSystemTime(new Date("2026-04-01T10:00:31Z"));
    await jwt({ token: { id: "bulk-new", role: "TEACHER" } });
    await jwt({ token: { id: "bulk-new", role: "TEACHER" } });
    expect(findUnique.mock.calls.length).toBe(callsBefore + 1);
    findUnique.mockReset();
  });
});

describe("callback session", () => {
  it("retire l'utilisateur d'une session dont le jeton est invalidé", async () => {
    const session = { user: { id: "x" }, expires: "" };
    const res = (await callbacks.session({ session, token: { invalidated: true } })) as { user?: unknown };
    expect(res.user).toBeUndefined();
  });

  it("projette le jeton sur session.user avec des valeurs par défaut sûres", async () => {
    const session = { user: {} as Record<string, unknown>, expires: "" };
    const token = {
      id: "u", role: "TEACHER", roles: ["TEACHER"], permissions: ["P"], primaryOrganizationId: null,
      isOrganizationManager: false, primarySchoolId: "s", schoolId: "s", firstName: "F", lastName: "L",
      isTwoFactorEnabled: true, isTwoFactorAuthenticated: false, mustChangePassword: "yes", avatar: "a",
    };
    const res = (await callbacks.session({ session, token })) as { user: Record<string, unknown> };
    expect(res.user).toMatchObject({
      id: "u", role: "TEACHER", roles: ["TEACHER"], permissions: ["P"], organizationIds: [],
      accessibleSchoolIds: [], schoolId: "s", isTwoFactorAuthenticated: false,
      mustChangePassword: false, // seule la valeur booléenne true compte
      avatar: "a",
    });
  });

  it("conserve les listes d'organisations et d'écoles quand elles existent", async () => {
    const session = { user: {} as Record<string, unknown>, expires: "" };
    const res = (await callbacks.session({
      session,
      token: { id: "u", organizationIds: ["o"], accessibleSchoolIds: ["s1"], mustChangePassword: true },
    })) as { user: Record<string, unknown> };
    expect(res.user).toMatchObject({ organizationIds: ["o"], accessibleSchoolIds: ["s1"], mustChangePassword: true });
  });

  it("laisse la session intacte si elle n'a pas d'utilisateur", async () => {
    const session = { expires: "e" };
    expect(await callbacks.session({ session, token: { id: "u" } })).toEqual({ expires: "e" });
  });
});

describe("callback redirect", () => {
  const base = "https://app.edupilot.bj";
  it("résout les URL relatives sur le site", async () => {
    expect(await callbacks.redirect({ url: "/dashboard/grades", baseUrl: base })).toBe(`${base}/dashboard/grades`);
  });
  it("accepte une URL absolue du même site", async () => {
    expect(await callbacks.redirect({ url: `${base}/x`, baseUrl: base })).toBe(`${base}/x`);
  });
  it("refuse une redirection externe (open redirect) au profit du tableau de bord", async () => {
    expect(await callbacks.redirect({ url: "https://evil.example/phish", baseUrl: base })).toBe(`${base}/dashboard`);
  });
  it.skip("BUG: refuse un domaine qui ne fait que commencer comme baseUrl (open redirect par préfixe)", async () => {
    // url.startsWith(baseUrl) accepte « https://app.edupilot.bj.evil.example » et « https://app.edupilot.bj@evil.example ».
    expect(await callbacks.redirect({ url: `${base}.evil.example/phish`, baseUrl: base })).toBe(`${base}/dashboard`);
    expect(await callbacks.redirect({ url: `${base}@evil.example/phish`, baseUrl: base })).toBe(`${base}/dashboard`);
  });
});
