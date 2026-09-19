import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAdminDashboardData,
  getGlobalDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getParentDashboardData,
  getAccountantDashboardData,
  getStaffDashboardData,
} from "@/lib/services/analytics-dashboard";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";

/**
 * GET /api/analytics/dashboard
 * Tableau de bord analytique basé sur le rôle de l'utilisateur
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { searchParams } = new URL(request.url);
    const role = session.user.role as string;
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    let schoolId = getActiveSchoolId(session);

    if (requestedSchoolId) {
      schoolId = requestedSchoolId;
    }

    if (!schoolId && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Établissement (schoolId) requis pour les analytics" }, { status: 400 });
    }

    // Optional filters from query params
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const classId = searchParams.get("classId") || undefined;
    const periodId = searchParams.get("periodId") || undefined;
    const subjectId = searchParams.get("subjectId") || undefined;

    /**
     * Perf (2026-09-18) : ce tableau de bord déclenche une trentaine de
     * requêtes (comparaison entre sites comprise) — 356 ms de médiane sur la
     * base de l'audit — et il était recalculé à chaque affichage. C'est
     * pourtant la première chose que voit une direction en arrivant.
     *
     * La clé inclut l'identifiant de la personne et tous les filtres : aucun
     * partage entre comptes ni entre établissements. Une minute de fenêtre :
     * ces indicateurs sont des agrégats de fin de journée, pas du temps réel.
     */
    /**
     * La clé doit couvrir TOUT ce dont la réponse dépend. L'identifiant de la
     * personne ne suffit pas : la comparaison entre sites est calculée sur les
     * établissements accessibles de la session, et l'établissement actif peut
     * changer sans changer l'URL. Sans eux, un compte multi-sites pouvait
     * recevoir la vue d'un autre périmètre — un test d'intégration l'a montré.
     */
    const scopeKey = [
      schoolId ?? "sans-ecole",
      ...(Array.isArray(session.user.accessibleSchoolIds) ? [...session.user.accessibleSchoolIds].sort() : []),
    ].join(",");
    const cacheKey = generateCacheKey(
      "/api/analytics/dashboard",
      searchParams,
      `${session.user.id}:${scopeKey}`,
    );

    const handler = async () => {
    if (!schoolId && role === "SUPER_ADMIN") {
      const data = await getGlobalDashboardData(academicYearId, classId, periodId, subjectId);
      return NextResponse.json(data);
    }

    // Get academic year: use provided ID or fall back to current year
    let resolvedYear;
    if (academicYearId) {
      resolvedYear = await prisma.academicYear.findFirst({
        where: { id: academicYearId as string, schoolId: schoolId as string },
        select: { id: true },
      });
    } else {
      resolvedYear = await prisma.academicYear.findFirst({
        where: { schoolId: schoolId as string, isCurrent: true },
        select: { id: true },
      });
    }

    if (!resolvedYear) {
      return NextResponse.json({ error: "Année académique requise" }, { status: 400 });
    }

    const yearId = resolvedYear.id;

    // ─── SUPER_ADMIN / SCHOOL_ADMIN / DIRECTOR ───
    if (roleSatisfies(role, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"])) {
      const comparisonSchoolIds =
        Array.isArray(session.user.accessibleSchoolIds) && session.user.accessibleSchoolIds.length > 0
          ? session.user.accessibleSchoolIds
          : await getAccessibleSchoolIdsForUser({
              userId: session.user.id,
              role: session.user.role,
              primarySchoolId: session.user.primarySchoolId ?? (schoolId as string | null),
            });
      const data = await getAdminDashboardData(
        schoolId as string,
        yearId,
        classId,
        periodId,
        subjectId,
        comparisonSchoolIds
      );
      return NextResponse.json(data);
    }

    // ─── TEACHER ───
    if (role === "TEACHER") {
      const data = await getTeacherDashboardData(session.user.id as string, schoolId as string, yearId);
      return NextResponse.json(data);
    }

    // ─── STUDENT ───
    if (role === "STUDENT") {
      const data = await getStudentDashboardData(session.user.id as string, yearId);
      return NextResponse.json(data);
    }

    // ─── PARENT ───
    if (role === "PARENT") {
      const data = await getParentDashboardData(session.user.id as string, yearId);
      return NextResponse.json(data);
    }

    // ─── ACCOUNTANT ───
    if (role === "ACCOUNTANT") {
      const data = await getAccountantDashboardData(schoolId as string);
      return NextResponse.json(data);
    }

    if (role === "STAFF") {
      const data = await getStaffDashboardData(schoolId as string, yearId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Rôle non supporté" }, { status: 403 });
    };

    // Formes de réponse multiples selon le rôle : même transtypage que /api/classes.
    // `await` indispensable : sans lui, un rejet échapperait au try/catch de la route.
    return await withCache(
      handler as () => Promise<NextResponse<Record<string, unknown>>>,
      { ttl: CACHE_TTL_SHORT, key: cacheKey },
    );

    } catch (error) {
    logger.error("fetching dashboard analytics:", error as Error);
    return NextResponse.json(
      { error: (error as Error).message || "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }

});
