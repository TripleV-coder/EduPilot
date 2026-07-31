"use client";

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { ReactNode } from "react";
import { Permission, hasPermission, roleSatisfies } from "@/lib/rbac/permissions";

interface RoleActionGuardProps {
    children: ReactNode;
    allowedRoles?: UserRole[];
    requiredPermission?: Permission;
    fallback?: ReactNode;
}

export function RoleActionGuard({
    children,
    allowedRoles,
    requiredPermission,
    fallback = null,
}: RoleActionGuardProps) {
    const { data: session } = useSession();
    const userRole = session?.user?.role as UserRole | undefined;

    if (!userRole) {
        return <>{fallback}</>;
    }

    // Check roles if provided (NETWORK_ADMIN hérite de SCHOOL_ADMIN via roleSatisfies).
    if (allowedRoles && allowedRoles.length > 0) {
        if (!roleSatisfies(userRole, allowedRoles)) {
            return <>{fallback}</>;
        }
    }

    // Check permissions if provided
    if (requiredPermission) {
        if (!hasPermission(userRole, requiredPermission)) {
            return <>{fallback}</>;
        }
    }

    return <>{children}</>;
}
