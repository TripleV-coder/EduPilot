"use client";

import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { getRolePermissions } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";

type Permission = string | string[];

interface RBACCheck {
    permission?: Permission;
    roles?: string[];
}

/**
 * Hook providing RBAC utilities based on the user's session.
 */
export function useRBAC() {
    const sessionResult = useSession();
    const session = sessionResult?.data;
    const status = sessionResult?.status || "loading";
    const user = session?.user;

    const canAccess = useCallback(
        ({ permission: _permission, roles }: RBACCheck): boolean => {
            if (!user) return false;

            const userRoles = (user as any).roles || [user.role];
            const isSuperAdmin = userRoles.includes("SUPER_ADMIN");

            // Super admin can access everything
            if (isSuperAdmin) return true;

            // Check role-based access: user must have AT LEAST ONE of the required roles
            if (roles && roles.length > 0) {
                const hasMatchingRole = roles.some(r => userRoles.includes(r as UserRole));
                if (!hasMatchingRole) return false;
            }

            if (_permission) {
                const userPermissions = getRolePermissions(userRoles);
                const requiredPermissions = Array.isArray(_permission) ? _permission : [_permission];
                const grantsAuthenticatedAccess = requiredPermissions.includes("*");
                if (grantsAuthenticatedAccess) {
                    return true;
                }

                if (!requiredPermissions.some((p) => userPermissions.includes(p as any))) {
                    return false;
                }
            }

            return true;
        },
        [user]
    );

    const hasRole = useCallback(
        (role: string | string[]): boolean => {
            if (!user) return false;
            const targetRoles = Array.isArray(role) ? role : [role];
            const userRoles = (user as any).roles || [user.role];
            return targetRoles.some(r => userRoles.includes(r as UserRole));
        },
        [user]
    );

    return useMemo(
        () => ({ canAccess, hasRole, user, status }),
        [canAccess, hasRole, user, status]
    );
}
