// AVERTISSEMENT : next-auth 5.0.0-beta.25 — version bêta épinglée volontairement.
// Ne pas mettre à jour sans lire le changelog : https://authjs.dev/getting-started/migrating-to-v5
// Dès qu'une version stable (5.x.x sans -beta) est disponible, migrer et retirer cet avertissement.
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

import { authConfig } from "./config";

const nextAuth = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma) as any, // Type casting pour compatibilité Next Auth v5
});

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
