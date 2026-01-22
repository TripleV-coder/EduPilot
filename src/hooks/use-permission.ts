"use client";

import { useSession } from "next-auth/react";
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";

export function usePermission() {
    const { data: session, status } = useSession();
    const userRole = session?.user?.role as UserRole | undefined;

    const can = (permission: Permission) => {
        if (!userRole) return false;
        return hasPermission(userRole, permission);
    };

    const canAny = (permissions: Permission[]) => {
        if (!userRole) return false;
        return hasAnyPermission(userRole, permissions);
    };

    const canAll = (permissions: Permission[]) => {
        if (!userRole) return false;
        return hasAllPermissions(userRole, permissions);
    };

    return {
        can,
        canAny,
        canAll,
        role: userRole,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
    };
}
