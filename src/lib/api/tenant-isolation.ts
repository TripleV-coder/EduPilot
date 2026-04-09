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

    const activeSchoolId = getActiveSchoolId(session);

    // User must be attached to an active school
    if (!activeSchoolId) {
        return NextResponse.json(
            { error: "Aucun établissement associé à ce compte" },
            { status: 403 }
        );
    }

    // If a specific resource school ID is provided, check against the accessible schools
    if (resourceSchoolId && !canAccessSchool(session, resourceSchoolId)) {
        return NextResponse.json(
            { error: "Accès refusé : vous ne pouvez pas accéder aux données d'un autre établissement" },
            { status: 403 }
        );
    }

    return null;
}

export function getAccessibleSchoolIds(session: Session | null): string[] {
    if (!session?.user) return [];

    const user = session.user as AuthUser;

    if (user.role === "SUPER_ADMIN") {
        return [];
    }

    const declaredSchoolIds = Array.isArray(user.accessibleSchoolIds)
        ? user.accessibleSchoolIds.filter((schoolId): schoolId is string => typeof schoolId === "string" && schoolId.length > 0)
        : [];

    if (declaredSchoolIds.length > 0) {
        return Array.from(new Set(declaredSchoolIds));
    }

    const activeSchoolId = getActiveSchoolId(session);
    return activeSchoolId ? [activeSchoolId] : [];
}

export function canAccessSchool(session: Session | null, targetSchoolId: string | null | undefined): boolean {
    if (!session?.user || !targetSchoolId) return false;

    const user = session.user as AuthUser;
    if (user.role === "SUPER_ADMIN") {
        return true;
    }

    return getAccessibleSchoolIds(session).includes(targetSchoolId);
}

export function ensureRequestedSchoolAccess(
    session: Session | null,
    requestedSchoolId?: string | null
): NextResponse | null {
    if (!requestedSchoolId || !session?.user) {
        return null;
    }

    const user = session.user as AuthUser;
    if (user.role === "SUPER_ADMIN") {
        return null;
    }

    if (!canAccessSchool(session, requestedSchoolId)) {
        return NextResponse.json(
            { error: "Accès refusé : établissement hors périmètre autorisé." },
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
    if (!session?.user) return { schoolId: "NO_ACCESS" }; // Return an impossible filter — no record has this schoolId

    const user = session.user as AuthUser;

    if (user.role === "SUPER_ADMIN") {
        return {}; // No filter for super admin
    }

    const activeSchoolId = getActiveSchoolId(session);

    if (!activeSchoolId) {
        // If no school ID (and not super admin), arguably should return a filter that matches nothing 
        // or rely on ensureSchoolAccess to block the request first.
        // For safety, we return a filter that likely matches nothing or throws specific error logic upstream.
        // Here we return a condition that is impossible if we want to be safe, 
        // but usually ensuring schoolId exists is done before.
        return { schoolId: "NO_ACCESS" };
    }

    return { schoolId: activeSchoolId };
}

/**
 * Helper to get the active school ID from session (supporting future multi-school switching)
 */
export function getActiveSchoolId(session: Session | null): string | undefined {
    if (!session?.user) return undefined;
    const user = session.user as AuthUser;

    // The active school is currently stored directly in session.user.schoolId.
    return user.schoolId || undefined;
}
