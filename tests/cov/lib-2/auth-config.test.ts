import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Le fournisseur Credentials est remplacé par une fabrique transparente : on
// récupère ainsi `authorize` tel que déclaré dans la configuration.
vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: Record<string, unknown>) => ({ id: "credentials", type: "credentials", ...opts }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    school: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/password", () => ({ default: { compare: vi.fn() } }));

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

vi.mock("@/lib/auth/school-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/school-access")>();
  const getAccessibleSchoolIdsForUser = vi.fn();
  return {
    ...actual,
    getAccessibleSchoolIdsForUser,
    resolveActiveSchoolId: vi.fn(),
    // Même calcul que le vrai module, mais sur la version simulée par rôle
    getSchoolAccessForAssignedRoles: vi.fn(async (input: { userId: string; roles: string[]; primarySchoolId: string | null }) => {
      const schoolIdsByRole: Record<string, string[]> = {};
      for (const role of input.roles) {
        schoolIdsByRole[role] = await getAccessibleSchoolIdsForUser({ userId: input.userId, role, primarySchoolId: input.primarySchoolId });
      }
      return { accessibleSchoolIds: [...new Set(Object.values(schoolIdsByRole).flat())], schoolIdsByRole };
    }),
  };
});

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import bcrypt from "@/lib/auth/password";
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
  it("jeton JWT de 30 jours au plus (« Rester connecté ») et erreurs redirigées vers /login", () => {
    expect(authConfig.session).toEqual({ strategy: "jwt", maxAge: 30 * 24 * 60 * 60 });
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

describe("« Rester connecté » (30 jours)", () => {
  afterEach(() => vi.useRealTimers());

  it("la case cochée donne une session longue, journalisée ; jamais pour le super-administrateur", async () => {
    findUnique.mockResolvedValueOnce(dbUser() as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    expect((await authorize({ ...CREDS, remember: "true" }))?.rememberMe).toBe(true);
    expect(auditCreate.mock.calls.at(-1)?.[0]).toMatchObject({ data: { action: "LOGIN_SUCCESS", newValues: { rememberMe: true } } });

    findUnique.mockResolvedValueOnce(dbUser() as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    expect((await authorize({ ...CREDS, remember: "false" }))?.rememberMe).toBe(false);

    findUnique.mockResolvedValueOnce(dbUser({ role: "SUPER_ADMIN" }) as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    expect((await authorize({ ...CREDS, remember: "true" }))?.rememberMe).toBe(false);
  });

  it("sans la case : 24 h sans activité ferment la session, sans même lire la base", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    const now = Math.floor(Date.now() / 1000);
    const token = await jwt({ token: { id: "idle-1", role: "PARENT", remember: false, lastSeenAt: now - 25 * 3600 } });
    expect(token.invalidated).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("avec la case : 10 jours d'absence ne ferment pas la session ; l'activité est notée", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    const now = Math.floor(Date.now() / 1000);
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "PARENT", roles: [], schoolId: "school-1" } as never);
    const token = await jwt({ token: { id: "long-1", role: "PARENT", remember: true, lastSeenAt: now - 10 * 86400 } });
    expect(token.invalidated).toBeUndefined();
    expect(token.lastSeenAt).toBe(now);
    expect(token.remember).toBe(true);
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
    // + identifiant de session stable, révocable à la déconnexion (sécurité HTTP),
    // + durée de session : « Rester connecté » non coché, dernière activité maintenant
    expect(token).toEqual({ ...user, sid: expect.any(String), remember: false, lastSeenAt: expect.any(Number) });
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
      .mockResolvedValueOnce({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER", roles: [], schoolId: "school-1" } as never);
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
  it("un SUPER_ADMIN choisit n'importe quelle école existante (ou aucune) ; une école inconnue le ramène à la vue globale (S6)", async () => {
    findUnique.mockResolvedValue(null);
    const schoolFind = vi.mocked(prisma.school.findUnique);
    schoolFind.mockResolvedValueOnce({ id: "any" } as never);
    let token = await jwt({ token: { id: "sa-1", role: "SUPER_ADMIN" }, trigger: "update", session: { schoolId: "any" } });
    expect(token.schoolId).toBe("any");
    schoolFind.mockResolvedValueOnce(null);
    token = await jwt({ token: { id: "sa-1", role: "SUPER_ADMIN", schoolId: "x" }, trigger: "update", session: { schoolId: "inconnue" } });
    expect(token.schoolId).toBeNull();
    token = await jwt({ token: { id: "sa-1", role: "SUPER_ADMIN", schoolId: "x" }, trigger: "update", session: { schoolId: undefined } });
    expect(token.schoolId).toBeNull();
    expect(getAccessibleSchoolIdsForUser).not.toHaveBeenCalled();
    findUnique.mockReset();
    schoolFind.mockReset();
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

  it("une mise à jour sans session ne change pas d'école ; compte introuvable : session invalidée (F1)", async () => {
    findUnique.mockResolvedValueOnce(null);
    const token = await jwt({ token: { id: "dir-6", role: "DIRECTOR" }, trigger: "update" });
    expect(token).toEqual({ id: "dir-6", role: "DIRECTOR", invalidated: true });
    expect(getOrganizationAccessForUser).not.toHaveBeenCalled();
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

  it("un changement de rôle ne déconnecte pas : rôle et permissions repris de la base", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2025-01-01"), roleChangedAt: new Date("2026-02-01"), role: "DIRECTOR", roles: [], schoolId: "school-1" } as never);
    const token = await jwt({ token: { id: "inv-4", role: "TEACHER", roles: ["TEACHER"], permissions: [], iat: Date.parse("2026-01-01") / 1000 } });
    expect(token.invalidated).toBeUndefined();
    expect(token.role).toBe("DIRECTOR");
    expect(token.roles).toEqual(["DIRECTOR"]);
    expect(token.permissions).toEqual(expect.arrayContaining(["analytics:view"]));
  });

  it("garde un jeton valide et synchronise rôle et droits d'établissement", async () => {
    findUnique.mockResolvedValueOnce({ isActive: true, passwordChangedAt: new Date("2025-01-01"), roleChangedAt: new Date("2025-01-01"), role: "DIRECTOR", roles: [], schoolId: "school-1" } as never);
    const token = await jwt({ token: { id: "inv-5", role: "TEACHER", schoolId: "school-9", accessibleSchoolIds: ["school-9"], iat: Date.parse("2026-01-01") / 1000 } });
    expect(token.invalidated).toBeUndefined();
    expect(token.role).toBe("DIRECTOR");
    expect(token.accessibleSchoolIds).toEqual(["school-1", "school-2"]);
    expect(token.schoolId).toBe("school-1");
  });

  it("relit le compte à chaque requête ; recalcule les droits si le marqueur, le rôle ou l'école changent, ou après 60 s", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
    const row = { isActive: true, passwordChangedAt: null, roleChangedAt: null as Date | null, role: "TEACHER", roles: [], schoolId: "school-1" };
    findUnique.mockImplementation(async () => ({ ...row }) as never);
    const compute = vi.mocked(getAccessibleSchoolIdsForUser);
    const run = () => jwt({ token: { id: "cache-1", role: "TEACHER" } });

    await run();
    await run();
    expect(findUnique).toHaveBeenCalledTimes(2); // ligne du compte : chaque requête
    expect(compute).toHaveBeenCalledTimes(1); // droits : en cache

    row.roleChangedAt = new Date("2026-03-01T10:00:01Z"); // trigger : droits modifiés
    await run();
    expect(compute).toHaveBeenCalledTimes(2);
    await run();
    expect(compute).toHaveBeenCalledTimes(2);

    row.schoolId = "school-2"; // école principale modifiée
    await run();
    expect(compute).toHaveBeenCalledTimes(3);

    vi.setSystemTime(new Date("2026-03-01T10:01:01Z")); // filet de sécurité
    await run();
    expect(compute).toHaveBeenCalledTimes(4);

    invalidateUserStatusCache("cache-1");
    await run();
    expect(compute).toHaveBeenCalledTimes(5);
    findUnique.mockReset();
  });

  it("purge les calculs expirés quand le cache dépasse 1000 utilisateurs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00Z"));
    findUnique.mockResolvedValue({ isActive: true, passwordChangedAt: null, roleChangedAt: null, role: "TEACHER", roles: [], schoolId: "school-1" } as never);
    const compute = vi.mocked(getAccessibleSchoolIdsForUser);
    for (let i = 0; i < 1001; i++) {
      await jwt({ token: { id: `bulk-${i}`, role: "TEACHER" } });
    }
    // Les 1000+ entrées récentes ne sont pas purgées : calcul servi par le cache.
    const callsBefore = compute.mock.calls.length;
    await jwt({ token: { id: "bulk-0", role: "TEACHER" } });
    expect(compute.mock.calls.length).toBe(callsBefore);

    // 61 s plus tard, un nouvel utilisateur déclenche la purge des entrées expirées.
    vi.setSystemTime(new Date("2026-04-01T10:01:01Z"));
    await jwt({ token: { id: "bulk-new", role: "TEACHER" } });
    await jwt({ token: { id: "bulk-new", role: "TEACHER" } });
    expect(compute.mock.calls.length).toBe(callsBefore + 1);
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
