import { NextResponse } from "next/server";
import { type Session } from "next-auth";
import { type AuthUser } from "@/lib/auth/config";

/**
 * Ensures that the user has access to the requested school resource.
 * 
 * Rules:
 * 1. SUPER_ADMIN has access to everything.
 * 2. Other users must have a schoolId in their session.
 * 3. The user's schoolId must match the resource's schoolId.
 * 
 * @param session The user session
 * @param resourceSchoolId The school ID of the resource being accessed (optional)
 * @returns null if access is granted, or a NextResponse if access is denied
 */
export function ensureSchoolAccess(session: Session | null, resourceSchoolId?: string | null): NextResponse | null {
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = session.user as AuthUser;

    // SUPER_ADMIN has global access
    if (user.role === "SUPER_ADMIN") {
        return null;
    }

    // User must be attached to a school
    if (!user.schoolId) {
        return NextResponse.json(
            { error: "Aucun établissement associé à ce compte" },
            { status: 403 }
        );
    }

    // If a specific resource school ID is provided, check against user's school ID
    if (resourceSchoolId && resourceSchoolId !== user.schoolId) {
        return NextResponse.json(
            { error: "Accès refusé : vous ne pouvez pas accéder aux données d'un autre établissement" },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Returns a Prisma filter object to restrict queries to the user's school.
 * 
 * @param session The user session
 * @returns Object to spreads into Prisma `where` clause
 */
export function getSchoolFilter(session: Session | null) {
    if (!session?.user) return {}; // Should ideally throw or return a "never match" filter if strict

    const user = session.user as AuthUser;

    if (user.role === "SUPER_ADMIN") {
        return {}; // No filter for super admin
    }

    if (!user.schoolId) {
        // If no school ID (and not super admin), arguably should return a filter that matches nothing 
        // or rely on ensureSchoolAccess to block the request first.
        // For safety, we return a filter that likely matches nothing or throws specific error logic upstream.
        // Here we return a condition that is impossible if we want to be safe, 
        // but usually ensuring schoolId exists is done before.
        return { schoolId: "NO_ACCESS" };
    }

    return { schoolId: user.schoolId };
}

/**
 * Helper to get the active school ID from session (supporting future multi-school switching)
 */
export function getActiveSchoolId(session: Session | null): string | null {
    if (!session?.user) return null;
    const user = session.user as AuthUser;

    // In Phase 3, we might look for a specific 'activeSchoolId' field if implemented.
    // For now, we default to the user's primary schoolId.
    return user.schoolId || null;
}
