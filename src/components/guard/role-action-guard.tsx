"use client";

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { ReactNode } from "react";
import { Permission, hasPermission, roleAppliesAtSchool, rolesSatisfy } from "@/lib/rbac/permissions";

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
    // Rôle principal seulement, comme la garde serveur (cumul désactivé)
    const userRoles = session?.user?.role ? [session.user.role] : [];

    if (userRoles.length === 0) {
        return <>{fallback}</>;
    }

    // Check roles if provided (NETWORK_ADMIN hérite de SCHOOL_ADMIN via roleSatisfies).
    if (allowedRoles && allowedRoles.length > 0) {
        const matching = userRoles.filter((role) => rolesSatisfy([role], allowedRoles));
        if (matching.length === 0) {
            return <>{fallback}</>;
        }
        const schoolId = session?.user?.schoolId;
        const byRole = session?.user?.schoolIdsByRole;
        if (byRole && schoolId && !matching.some((role) => roleAppliesAtSchool(role, schoolId, byRole))) {
            return <>{fallback}</>;
        }
    }

    // Check permissions if provided
    if (requiredPermission) {
        if (!hasPermission(userRoles as UserRole[], requiredPermission)) {
            return <>{fallback}</>;
        }
        const schoolId = session?.user?.schoolId;
        const byRole = session?.user?.schoolIdsByRole;
        if (byRole && schoolId) {
            const grants = userRoles.filter((role) => hasPermission(role as UserRole, requiredPermission));
            if (!grants.some((role) => roleAppliesAtSchool(role, schoolId, byRole))) {
                return <>{fallback}</>;
            }
        }
    }

    return <>{children}</>;
}
