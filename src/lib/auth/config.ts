import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts
} from "./account-lockout";
import { verifyToken } from "./two-factor";

// Extended user type for authentication
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId: string | null;
  isTwoFactorEnabled: boolean;
  isTwoFactorAuthenticated: boolean;
}

const loginSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  password: z.string().min(1, "Le mot de passe est requis"),
  twoFactorCode: z.string().optional(),
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
            schoolId: true,
            isActive: true,
            lockedUntil: true,
            isTwoFactorEnabled: true,
            twoFactorSecret: true,
            twoFactorBackupCodes: true,
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
          const twoFactorCode = (credentials.twoFactorCode as string) || "";

          if (twoFactorCode) {
            const isValid = await verifyToken(twoFactorCode, user.twoFactorSecret || "");
            if (!isValid) {
              const backupCodes = user.twoFactorBackupCodes || [];
              if (!backupCodes.includes(twoFactorCode)) {
                throw new Error("Code 2FA incorrect");
              }
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

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          schoolId: user.schoolId,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          isTwoFactorAuthenticated,
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
        token.schoolId = authUser.schoolId;
        token.firstName = authUser.firstName;
        token.lastName = authUser.lastName;
        token.isTwoFactorEnabled = authUser.isTwoFactorEnabled;
        token.isTwoFactorAuthenticated = authUser.isTwoFactorAuthenticated;
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
              if (!isValid && dbUser.twoFactorBackupCodes) {
                isBackup = dbUser.twoFactorBackupCodes.includes(session.twoFactorCode);
              }

              if (isValid || isBackup) {
                token.isTwoFactorAuthenticated = true;
              }
            }
          }
        }

        // Changement de contexte école
        if (session?.schoolId && userId) {
          // Vérifier si l'utilisateur a le droit d'accéder à cette école
          // 1. C'est son école principale
          // 2. Il a une assignation explicite (TeacherSchoolAssignment)
          // 3. C'est un SUPER_ADMIN (accès partout)

          if (token.role === "SUPER_ADMIN") {
            token.schoolId = session.schoolId;
          } else {
            // Vérifier DB
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                schoolId: true,
                teacherProfile: {
                  select: {
                    assignments: {
                      where: { schoolId: session.schoolId },
                      select: { schoolId: true }
                    }
                  }
                }
              }
            });

            if (user) {
              const isPrimary = user.schoolId === session.schoolId;
              const hasAssignment = user.teacherProfile?.assignments?.length ? user.teacherProfile.assignments.length > 0 : false;

              if (isPrimary || hasAssignment) {
                token.schoolId = session.schoolId;
              }
            }
          }
        }
      }

      // Vérifier l'invalidation du token après changement de mdp ou rôle
      if (token.id && trigger !== "signIn") {
        const userFromDb = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            passwordChangedAt: true,
            roleChangedAt: true,
            role: true,
          },
        });

        if (userFromDb) {
          const tokenIssuedAt = token.iat ? new Date(token.iat * 1000) : new Date(0);

          // Invalider si mot de passe changé après émission du token
          if (userFromDb.passwordChangedAt && userFromDb.passwordChangedAt > tokenIssuedAt) {
            return null as any; // Token invalide
          }

          // Invalider si rôle changé après émission du token
          if (userFromDb.roleChangedAt && userFromDb.roleChangedAt > tokenIssuedAt) {
            return null as any; // Token invalide
          }

          // Mettre à jour le rôle dans le token s'il a changé
          if (userFromDb.role !== token.role) {
            token.role = userFromDb.role;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.schoolId = token.schoolId;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
        session.user.isTwoFactorAuthenticated = token.isTwoFactorAuthenticated as boolean;
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
