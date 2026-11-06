import bcrypt from "@/lib/auth/password";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts
} from "./account-lockout";
import { verifyToken, findMatchingBackupCode } from "./two-factor";
import {
  checkRateLimitKey,
  createRateLimitKey,
  resetRateLimit,
  MFA_VERIFY_RATE_LIMIT,
} from "@/lib/rate-limit";
import { getRolePermissions, Permission } from "@/lib/rbac/permissions";
import { getOrganizationAccessForUser } from "./organization-access";
import { assignedRoles } from "@/lib/rbac/permissions";
import { getSchoolAccessForAssignedRoles, resolveActiveSchoolId } from "./school-access";
import { getUserStatus, invalidateUserStatusCache } from "./user-status-cache";
import { isSessionRevoked, revokeSession } from "./session-revocation";
import { InvalidTwoFactorSignin, SchoolSuspendedSignin, withSigninErrorMapping } from "./login-failure";
import { isBlockedBySchoolSuspension } from "./school-suspension";
import { resolveAuthRedirect } from "@/lib/security/safe-redirect";
import {
  LONG_SESSION_SECONDS,
  isSessionExpiredByInactivity,
  parseRememberFlag,
  rememberAllowed,
} from "./session-lifetime";

/**
 * Extended user type for authentication.
 *
 * P7 CONVENTION: `role` is the PRIMARY role used for dashboard routing and UI decisions.
 * `roles` is the union of all assigned roles, used for permission calculation via getRolePermissions().
 * At login, if `user.roles` is populated, it is used; otherwise `[user.role]` is the fallback.
 * The session always exposes both fields for maximum flexibility.
 *
 * P15 NOTE: the account row (status, role, primary school, rights marker `roleChangedAt`) is
 * read on EVERY request; school access is recomputed whenever that marker changes
 * (`user-status-cache.ts`, PostgreSQL triggers). Revocation applies on the next request on
 * every instance, without logging the user out (audit MS-01).
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: UserRole[]; // Hybrid roles support
  primaryOrganizationId: string | null;
  organizationIds: string[];
  isOrganizationManager: boolean;
  primarySchoolId: string | null;
  schoolId: string | null;
  accessibleSchoolIds: string[];
  schoolIdsByRole?: Partial<Record<UserRole, string[]>>;
  isTwoFactorEnabled: boolean;
  isTwoFactorAuthenticated: boolean;
  /** Compte créé par un tiers : mot de passe provisoire à remplacer (M1). */
  mustChangePassword: boolean;
  /** « Rester connecté » coché (et permis pour ce rôle) : session de 30 jours. */
  rememberMe: boolean;
  permissions?: Permission[]; // Union of permissions
  avatar?: string | null;
}

const loginSchema = z.object({
  // Pas de `.email()` : zod 4 refuse les adresses accentuées (« zoé.dossou@… »),
  // qui ne pouvaient donc plus se connecter. La connexion compare l'adresse
  // saisie aux comptes existants ; il suffit d'une forme « x@y ».
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+$/, "Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  twoFactorCode: z.string().optional(),
  remember: z.unknown().optional(),
});

export { invalidateUserStatusCache };

export const authConfig: NextAuthConfig = {
  // Auth.js (NextAuth v5) bloque par défaut certains hosts en production.
  // En local, `next start` force NODE_ENV=production, donc on autorise explicitement localhost
  // via AUTH_TRUST_HOST=true ou en dehors de la prod.
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
    // 30 jours au plus ; sans « Rester connecté », 24 h d'inactivité suffisent
    // à fermer la session (callback jwt, lib/auth/session-lifetime).
    maxAge: LONG_SESSION_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        twoFactorCode: { label: "Code 2FA", type: "text" },
        remember: { label: "Rester connecté", type: "checkbox" },
      },
      // M10 : une panne de base devient `code=service_unavailable`, jamais un
      // faux « identifiants invalides » (voir ./login-failure).
      authorize: withSigninErrorMapping(async (credentials): Promise<AuthUser | null> => {
        const validatedFields = loginSchema.safeParse(credentials);

        if (!validatedFields.success) {
          return null;
        }

        const { email, password } = validatedFields.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            firstName: true,
            lastName: true,
            role: true,
            roles: true, // New array field
            schoolId: true,
            isActive: true,
            lockedUntil: true,
            isTwoFactorEnabled: true,
            twoFactorSecret: true,
            twoFactorBackupCodes: true,
            mustChangePassword: true,
            avatar: true,
            school: { select: { isActive: true } },
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        // Vérifier si le compte est verrouillé
        const lockStatus = await isAccountLocked(user.id);
        if (lockStatus.isLocked) {
          // Audit log pour tentative sur compte verrouillé
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_FAILED_LOCKED',
              entity: 'user',
              entityId: user.id,
              newValues: { message: 'Login attempt on locked account' },
            },
          });
          return null;
        }

        if (!user.password) {
          return null; // Compte sans mot de passe (OAuth/magic link uniquement)
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          // Enregistrer tentative échouée
          await recordFailedLoginAttempt(user.id);

          // Audit log pour échec
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_FAILED',
              entity: 'user',
              entityId: user.id,
              newValues: { message: 'Invalid password' },
            },
          });

          return null;
        }

        // Établissement suspendu par la plateforme : vérifié seulement après un mot de
        // passe correct, pour ne rien révéler de l'établissement à un inconnu.
        if (isBlockedBySchoolSuspension(user)) {
          throw new SchoolSuspendedSignin();
        }

        // 2FA Verification
        let isTwoFactorAuthenticated = true;

        if (user.isTwoFactorEnabled) {
          const twoFactorCode = (credentials?.twoFactorCode as string) || "";

          if (twoFactorCode) {
            const isValid = await verifyToken(twoFactorCode, user.twoFactorSecret || "");
            if (!isValid) {
              const hashedBackupCodes = user.twoFactorBackupCodes || [];
              const backupIndex = await findMatchingBackupCode(twoFactorCode, hashedBackupCodes);
              if (backupIndex === -1) {
                // Un code 2FA erroné est une tentative d'authentification
                // échouée au même titre qu'un mot de passe erroné : sans
                // incrément du compteur, le verrouillage de compte ne protège
                // pas le second facteur contre la force brute.
                await recordFailedLoginAttempt(user.id);
                await prisma.auditLog.create({
                  data: {
                    userId: user.id,
                    action: 'LOGIN_FAILED_2FA',
                    entity: 'user',
                    entityId: user.id,
                    newValues: { message: 'Invalid 2FA code' },
                  },
                });
                throw new InvalidTwoFactorSignin();
              }
              // Supprimer le backup code utilisé (à usage unique)
              const updatedCodes = hashedBackupCodes.filter((_, i) => i !== backupIndex);
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: updatedCodes },
              });
            }
            isTwoFactorAuthenticated = true;
          } else {
            isTwoFactorAuthenticated = false;
          }
        }

        // Connexion réussie - réinitialiser compteur
        await resetFailedLoginAttempts(user.id);

        const rememberMe = parseRememberFlag(credentials?.remember) && rememberAllowed(user.role);

        // Audit log pour succès
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN_SUCCESS',
            entity: 'user',
            entityId: user.id,
            newValues: { rememberMe },
          },
        });

        const effectiveRoles = assignedRoles(user) as UserRole[];
        const organizationAccess = await getOrganizationAccessForUser(user.id);
        const schoolAccess = await getSchoolAccessForAssignedRoles({
          userId: user.id,
          roles: effectiveRoles,
          primarySchoolId: user.schoolId,
        });
        const activeSchoolId = resolveActiveSchoolId({
          primarySchoolId: user.schoolId,
          accessibleSchoolIds: schoolAccess.accessibleSchoolIds,
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          roles: effectiveRoles,
          primaryOrganizationId: organizationAccess.primaryOrganizationId,
          organizationIds: organizationAccess.organizationIds,
          isOrganizationManager: organizationAccess.isOrganizationManager,
          primarySchoolId: user.schoolId,
          schoolId: activeSchoolId,
          accessibleSchoolIds: schoolAccess.accessibleSchoolIds,
          schoolIdsByRole: schoolAccess.schoolIdsByRole,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          isTwoFactorAuthenticated,
          mustChangePassword: user.mustChangePassword === true,
          rememberMe,
          permissions: getRolePermissions(effectiveRoles),
          avatar: user.avatar,
        };
      }),
    }),
  ],
  events: {
    // Déconnexion : la session est révoquée côté serveur, pas seulement le
    // cookie du navigateur (sécurité HTTP, 2026-10-18)
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token && typeof token.sid === "string" && typeof token.id === "string") {
        await revokeSession(token.sid, token.id);
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authUser = user as AuthUser;
        token.id = authUser.id;
        token.role = authUser.role;
        token.roles = authUser.roles;
        token.permissions = authUser.permissions;
        token.primaryOrganizationId = authUser.primaryOrganizationId;
        token.organizationIds = authUser.organizationIds;
        token.isOrganizationManager = authUser.isOrganizationManager;
        token.primarySchoolId = authUser.primarySchoolId;
        token.schoolId = authUser.schoolId;
        token.accessibleSchoolIds = authUser.accessibleSchoolIds;
        token.schoolIdsByRole = authUser.schoolIdsByRole;
        token.firstName = authUser.firstName;
        token.lastName = authUser.lastName;
        token.isTwoFactorEnabled = authUser.isTwoFactorEnabled;
        token.isTwoFactorAuthenticated = authUser.isTwoFactorAuthenticated;
        token.mustChangePassword = authUser.mustChangePassword;
        token.avatar = authUser.avatar;
        token.remember = authUser.rememberMe === true;
        token.lastSeenAt = Math.floor(Date.now() / 1000);
        // Identifiant de session stable (le jti d'Auth.js change à chaque
        // réémission) : la déconnexion le révoque côté serveur.
        token.sid = globalThis.crypto.randomUUID();
      }

      // MFA Verification via Update
      if (trigger === "update") {
        const userId = token.id as string;

        // MFA Verification
        if (session?.twoFactorCode) {
          if (userId) {
            // Un TOTP ne vaut que 6 chiffres : sans plafond de tentatives, il
            // est devinable par force brute depuis une session pré-2FA.
            const mfaRl = await checkRateLimitKey(
              createRateLimitKey("mfa-verify", userId),
              MFA_VERIFY_RATE_LIMIT,
            );
            if (!mfaRl.success) {
              await prisma.auditLog.create({
                data: {
                  userId,
                  action: "MFA_VERIFY_RATE_LIMITED",
                  entity: "user",
                  entityId: userId,
                },
              });
              return token;
            }

            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { twoFactorSecret: true, twoFactorBackupCodes: true },
            });

            if (dbUser) {
              const isValid = await verifyToken(session.twoFactorCode, dbUser.twoFactorSecret || "");

              let isBackup = false;
              if (!isValid && dbUser.twoFactorBackupCodes && dbUser.twoFactorBackupCodes.length > 0) {
                const backupIdx = await findMatchingBackupCode(session.twoFactorCode, dbUser.twoFactorBackupCodes);
                isBackup = backupIdx !== -1;
                if (isBackup) {
                  // Consommer le backup code utilisé
                  const updatedCodes = dbUser.twoFactorBackupCodes.filter((_, i) => i !== backupIdx);
                  await prisma.user.update({
                    where: { id: userId },
                    data: { twoFactorBackupCodes: updatedCodes },
                  });
                }
              }

              if (isValid || isBackup) {
                token.isTwoFactorAuthenticated = true;
                await resetRateLimit(createRateLimitKey("mfa-verify", userId));
                await prisma.auditLog.create({
                  data: {
                    userId,
                    action: isBackup ? "MFA_VERIFIED_BACKUP_CODE" : "MFA_VERIFIED",
                    entity: "user",
                    entityId: userId,
                  },
                });
              }
            }
          }
        }

        // Changement de contexte école
        const hasSchoolContextUpdate =
          !!userId &&
          !!session &&
          Object.prototype.hasOwnProperty.call(session, "schoolId");

        if (hasSchoolContextUpdate && userId) {
          // Les droits relus plus bas doivent refléter l'état en base, pas le cache
          invalidateUserStatusCache(userId);
          if (token.role === "SUPER_ADMIN") {
            // S6 : l'école choisie doit exister ; sinon, retour à la vue globale
            // (sans école active) plutôt qu'un identifiant arbitraire en session.
            const requestedSchoolId = typeof session.schoolId === "string" && session.schoolId ? session.schoolId : null;
            const school = requestedSchoolId
              ? await prisma.school.findUnique({ where: { id: requestedSchoolId }, select: { id: true } })
              : null;
            token.schoolId = school?.id ?? null;
          } else {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { schoolId: true, role: true, roles: true },
            });

            if (dbUser) {
              const organizationAccess = await getOrganizationAccessForUser(userId);
              const schoolAccess = await getSchoolAccessForAssignedRoles({
                userId,
                roles: assignedRoles(dbUser) as UserRole[],
                primarySchoolId: dbUser.schoolId,
              });
              const accessibleSchoolIds = schoolAccess.accessibleSchoolIds;
              token.primaryOrganizationId = organizationAccess.primaryOrganizationId;
              token.organizationIds = organizationAccess.organizationIds;
              token.isOrganizationManager = organizationAccess.isOrganizationManager;
              token.primarySchoolId = dbUser.schoolId;
              token.accessibleSchoolIds = accessibleSchoolIds;
              token.schoolIdsByRole = schoolAccess.schoolIdsByRole;

              const requestedSchoolId =
                typeof session.schoolId === "string" ? session.schoolId : null;

              if (requestedSchoolId && accessibleSchoolIds.includes(requestedSchoolId)) {
                token.schoolId = requestedSchoolId;
              } else {
                token.schoolId = resolveActiveSchoolId({
                  primarySchoolId: dbUser.schoolId,
                  accessibleSchoolIds,
                  requestedSchoolId,
                });
              }
            }
          }
        }
      }

      // État du compte relu à chaque requête : désactivation, mot de passe,
      // rôle et droits d'établissement s'appliquent dès la requête suivante.
      if (token.id && trigger !== "signIn") {
        // Sans « Rester connecté » : 24 h sans activité ferment la session
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (isSessionExpiredByInactivity(token, nowSeconds)) {
          token.invalidated = true;
          return token;
        }

        const userStatus = await getUserStatus(token.id as string);

        // Compte supprimé définitivement : aucun droit ne survit dans le jeton
        if (!userStatus) {
          token.invalidated = true;
          return token;
        }

        // Session fermée par une déconnexion : une copie du cookie n'est plus acceptée
        if (typeof token.sid === "string" && (await isSessionRevoked(token.sid))) {
          token.invalidated = true;
          return token;
        }

        // Invalider si compte désactivé
        if (!userStatus.isActive || isBlockedBySchoolSuspension(userStatus)) {
          token.invalidated = true;
          return token;
        }

        const tokenIssuedAt = token.iat ? new Date(Number(token.iat) * 1000) : new Date(0);

        // Invalider si mot de passe changé après émission du token
        if (userStatus.passwordChangedAt && userStatus.passwordChangedAt > tokenIssuedAt) {
          token.invalidated = true;
          return token;
        }

        // Rôle et permissions toujours ceux de la base, jamais ceux figés
        // dans le jeton ; un changement de rôle ne déconnecte pas.
        const effectiveRoles = assignedRoles(userStatus) as UserRole[];
        token.role = userStatus.role;
        token.roles = effectiveRoles;
        token.permissions = getRolePermissions(effectiveRoles);
        // Devenu super-administrateur : la session longue ne le suit pas
        if (token.remember === true && !rememberAllowed(userStatus.role)) token.remember = false;

        // Droits d'établissement relus en base : un rattachement retiré ne
        // survit pas dans le jeton, et l'école active retirée est remplacée.
        // SUPER_ADMIN choisit librement son école (aucune liste à appliquer).
        if (userStatus.role !== "SUPER_ADMIN") {
          const { access } = userStatus;
          token.primarySchoolId = access.primarySchoolId;
          token.accessibleSchoolIds = access.accessibleSchoolIds;
          token.schoolIdsByRole = access.schoolIdsByRole;
          token.organizationIds = access.organizationIds;
          token.primaryOrganizationId = access.primaryOrganizationId;
          token.isOrganizationManager = access.isOrganizationManager;
          if (!token.schoolId || !access.accessibleSchoolIds.includes(token.schoolId as string)) {
            token.schoolId = resolveActiveSchoolId({
              primarySchoolId: access.primarySchoolId,
              accessibleSchoolIds: access.accessibleSchoolIds,
            });
          }
        }

        // Session toujours valide : l'activité de cette requête est notée
        token.lastSeenAt = nowSeconds;
      }

      return token;
    },
    async session({ session, token }) {
      // If token was invalidated (account disabled, password changed, role changed),
      // return a session with no user — middleware will redirect to login.
      if (token?.invalidated) {
        session.user = undefined as unknown as typeof session.user;
        return session;
      }

      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.roles = token.roles as UserRole[];
        session.user.permissions = token.permissions as Permission[];
        session.user.primaryOrganizationId = token.primaryOrganizationId as string | null;
        session.user.organizationIds = (token.organizationIds as string[] | undefined) || [];
        session.user.isOrganizationManager = token.isOrganizationManager as boolean | undefined;
        session.user.primarySchoolId = token.primarySchoolId as string | null;
        session.user.schoolId = token.schoolId;
        session.user.accessibleSchoolIds = (token.accessibleSchoolIds as string[] | undefined) || [];
        session.user.schoolIdsByRole = token.schoolIdsByRole as Record<string, string[]> | undefined;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
        session.user.isTwoFactorAuthenticated = token.isTwoFactorAuthenticated as boolean;
        session.user.mustChangePassword = token.mustChangePassword === true;
        session.user.avatar = token.avatar as string | null | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirect(url, baseUrl);
    },
  },
};
