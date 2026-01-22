import NextAuth from "next-auth";

import { authConfig } from "./config";

const nextAuth = NextAuth(authConfig);

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
