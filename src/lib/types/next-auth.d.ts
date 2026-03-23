import { UserRole } from "@prisma/client";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import { Permission } from "@/lib/rbac/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      roles?: UserRole[];
      permissions?: Permission[];
      schoolId: string | null;
      firstName: string;
      lastName: string;
      phone?: string | null;
      isTwoFactorEnabled: boolean;
      isTwoFactorAuthenticated: boolean;
      avatar?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    schoolId: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    avatar?: string | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    schoolId: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    avatar?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    schoolId: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    avatar?: string | null;
  }
}
