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
      primaryOrganizationId: string | null;
      organizationIds?: string[];
      isOrganizationManager?: boolean;
      primarySchoolId: string | null;
      schoolId: string | null;
      accessibleSchoolIds?: string[];
      schoolIdsByRole?: Record<string, string[]>;
      firstName: string;
      lastName: string;
      phone?: string | null;
      isTwoFactorEnabled: boolean;
      isTwoFactorAuthenticated: boolean;
      mustChangePassword?: boolean;
      avatar?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    primaryOrganizationId: string | null;
    organizationIds?: string[];
    isOrganizationManager?: boolean;
    primarySchoolId: string | null;
    schoolId: string | null;
    accessibleSchoolIds?: string[];
    schoolIdsByRole?: Record<string, string[]>;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    mustChangePassword?: boolean;
    avatar?: string | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    primaryOrganizationId: string | null;
    organizationIds?: string[];
    isOrganizationManager?: boolean;
    primarySchoolId: string | null;
    schoolId: string | null;
    accessibleSchoolIds?: string[];
    schoolIdsByRole?: Record<string, string[]>;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    mustChangePassword?: boolean;
    avatar?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    /** Identifiant de session stable, révoqué à la déconnexion. */
    sid?: string;
    role: UserRole;
    roles?: UserRole[];
    permissions?: Permission[];
    primaryOrganizationId: string | null;
    organizationIds?: string[];
    isOrganizationManager?: boolean;
    primarySchoolId: string | null;
    schoolId: string | null;
    accessibleSchoolIds?: string[];
    schoolIdsByRole?: Record<string, string[]>;
    firstName: string;
    lastName: string;
    phone?: string | null;
    isTwoFactorEnabled: boolean;
    isTwoFactorAuthenticated: boolean;
    mustChangePassword?: boolean;
    avatar?: string | null;
  }
}
