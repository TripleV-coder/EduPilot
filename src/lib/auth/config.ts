import bcrypt from "bcryptjs";
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
import { getRolePermissions, Permission } from "@/lib/rbac/permissions";
import { getOrganizationAccessForUser } from "./organization-access";
import { getAccessibleSchoolIdsForUser, resolveActiveSchoolId } from "./school-access";

/**
 * Extended user type for authentication.
 *
 * P7 CONVENTION: `role` is the PRIMARY role used for dashboard routing and UI decisions.
 * `roles` is the union of all assigned roles, used for permission calculation via getRolePermissions().
 * At login, if `user.roles` is populated, it is used; otherwise `[user.role]` is the fallback.
 * The session always exposes both fields for maximum flexibility.
 *
 * P15 NOTE: The JWT status cache (`userStatusCache`) is an in-memory Map with 30s TTL.
 * In multi-instance deployments (Vercel serverless, PM2 cluster), each instance has its own cache.
 * Token invalidation after password/role changes may take up to 30s × instances to propagate.
 * This is an acceptable trade-off vs. adding a Redis dependency for this single use case.
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
  isTwoFactorEnabled: boolean;
  isTwoFactorAuthenticated: boolean;
  permissions?: Permission[]; // Union of permissions
  avatar?: string | null;
}

const loginSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  password: z.string().min(1, "Le mot de passe est requis"),
  twoFactorCode: z.string().optional(),
});

// P15: In-memory cache for JWT token invalidation checks (30s TTL).
// Prevents a `SELECT` per authenticated request. Trade-off: multi-instance inconsistency (see AuthUser doc).
const JWT_CACHE_TTL_MS = 30_000;
interface CachedUserStatus {
  passwordChangedAt: Date | null;
  roleChangedAt: Date | null;
  role: UserRole;
  isActive: boolean;
  fetchedAt: number;
}
const userStatusCache = new Map<string, CachedUserStatus>();

async function getCachedUserStatus(userId: string): Promise<CachedUserStatus | null> {
  const cached = userStatusCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < JWT_CACHE_TTL_MS) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true, roleChangedAt: true, role: true, isActive: true },
  });

  if (!user) return null;

  const entry: CachedUserStatus = { ...user, fetchedAt: Date.now() };
  userStatusCache.set(userId, entry);

  // Evict old entries periodically (keep map bounded)
  if (userStatusCache.size > 1000) {
    const now = Date.now();
    for (const [key, val] of userStatusCache) {
      if (now - val.fetchedAt > JWT_CACHE_TTL_MS) userStatusCache.delete(key);
    }
  }

  return entry;
}

/** Invalidate cache for a specific user (call after password/role change) */
export function invalidateUserStatusCache(userId: string): void {
  userStatusCache.delete(userId);
}

export const authConfig: NextAuthConfig = {
  // Auth.js (NextAuth v5) bloque par défaut certains hosts en production.
  // En local, `next start` force NODE_ENV=production, donc on autorise explicitement localhost
  // via AUTH_TRUST_HOST=true ou en dehors de la prod.
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
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
      },
      async authorize(credentials): Promise<AuthUser | null> {
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
            avatar: true,
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
                throw new Error("Code 2FA incorrect");
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

        // Audit log pour succès
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN_SUCCESS',
            entity: 'user',
            entityId: user.id,
          },
        });

        const effectiveRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
        const organizationAccess = await getOrganizationAccessForUser(user.id);
        const accessibleSchoolIds = await getAccessibleSchoolIdsForUser({
          userId: user.id,
          role: user.role,
          primarySchoolId: user.schoolId,
        });
        const activeSchoolId = resolveActiveSchoolId({
          primarySchoolId: user.schoolId,
          accessibleSchoolIds,
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
          accessibleSchoolIds,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          isTwoFactorAuthenticated,
          permissions: getRolePermissions(effectiveRoles),
          avatar: user.avatar,
        };
      },
    }),
  ],
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
        token.firstName = authUser.firstName;
        token.lastName = authUser.lastName;
        token.isTwoFactorEnabled = authUser.isTwoFactorEnabled;
        token.isTwoFactorAuthenticated = authUser.isTwoFactorAuthenticated;
        token.avatar = authUser.avatar;
      }

      // MFA Verification via Update
      if (trigger === "update") {
        const userId = token.id as string;

        // MFA Verification
        if (session?.twoFactorCode) {
          if (userId) {
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
          if (token.role === "SUPER_ADMIN") {
            token.schoolId = (session.schoolId as string | null | undefined) ?? null;
          } else {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { schoolId: true, role: true },
            });

            if (dbUser) {
              const organizationAccess = await getOrganizationAccessForUser(userId);
              const accessibleSchoolIds = await getAccessibleSchoolIdsForUser({
                userId,
                role: dbUser.role,
                primarySchoolId: dbUser.schoolId,
              });
              token.primaryOrganizationId = organizationAccess.primaryOrganizationId;
              token.organizationIds = organizationAccess.organizationIds;
              token.isOrganizationManager = organizationAccess.isOrganizationManager;
              token.primarySchoolId = dbUser.schoolId;
              token.accessibleSchoolIds = accessibleSchoolIds;

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

      // Vérifier l'invalidation du token après changement de mdp, rôle ou désactivation compte
      if (token.id && trigger !== "signIn") {
        const userStatus = await getCachedUserStatus(token.id as string);

        if (userStatus) {
          // Invalider si compte désactivé
          if (!userStatus.isActive) {
            token.invalidated = true;
            return token;
          }

          const tokenIssuedAt = token.iat ? new Date(Number(token.iat) * 1000) : new Date(0);

          // Invalider si mot de passe changé après émission du token
          if (userStatus.passwordChangedAt && userStatus.passwordChangedAt > tokenIssuedAt) {
            token.invalidated = true;
            return token;
          }

          // Invalider si rôle changé après émission du token
          if (userStatus.roleChangedAt && userStatus.roleChangedAt > tokenIssuedAt) {
            token.invalidated = true;
            return token;
          }

          // Mettre à jour le rôle dans le token s'il a changé
          if (userStatus.role !== token.role) {
            token.role = userStatus.role;
          }
        }
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
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
        session.user.isTwoFactorAuthenticated = token.isTwoFactorAuthenticated as boolean;
        session.user.avatar = token.avatar as string | null | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Si l'URL de redirection est relative, la construire avec baseUrl
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Si l'URL est du même site, la retourner
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Par défaut, rediriger vers le dashboard
      return `${baseUrl}/dashboard`;
    },
  },
};
