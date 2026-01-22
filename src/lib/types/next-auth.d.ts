import { UserRole } from "@prisma/client";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      schoolId: string | null;
      firstName: string;
      lastName: string;
      phone?: string | null;
      isTwoFactorEnabled: boolean;
      isTwoFactorAuthenticated: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: UserRole;
    schoolId: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: UserRole;
    schoolId: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
  }
}
