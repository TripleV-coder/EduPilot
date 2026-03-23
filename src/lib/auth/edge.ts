import NextAuth from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Cette configuration est strictement destinée au Edge Runtime (ex: middleware.ts).
 * Elle n'inclut aucun Provider, ni Prisma, ni le module `crypto` de Node.js,
 * évitant ainsi tout plantage lors du décodage du JWT sur Vercel Edge.
 */
export const { auth: edgeAuth } = NextAuth({
    providers: [],
    session: { strategy: "jwt" },
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as UserRole;
                session.user.schoolId = token.schoolId as string;
                session.user.firstName = token.firstName as string;
                session.user.lastName = token.lastName as string;
                session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
                session.user.isTwoFactorAuthenticated = token.isTwoFactorAuthenticated as boolean;
            }
            return session;
        },
    },
});
