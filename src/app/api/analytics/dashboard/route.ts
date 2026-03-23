import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getAdminDashboardData,
  getGlobalDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getParentDashboardData,
  getAccountantDashboardData,
} from "@/lib/services/analytics-dashboard";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/dashboard
 * Tableau de bord analytique basé sur le rôle de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = session.user.role as string;
    let schoolId = session.user.schoolId;

    if (!schoolId && role === "SUPER_ADMIN" && searchParams.get("schoolId")) {
      schoolId = searchParams.get("schoolId") as string;
    }

    if (!schoolId && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Établissement (schoolId) requis pour les analytics" }, { status: 400 });
    }

    // Optional filters from query params
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const classId = searchParams.get("classId") || undefined;
    const periodId = searchParams.get("periodId") || undefined;
    const subjectId = searchParams.get("subjectId") || undefined;

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
    if (["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(role)) {
      const data = await getAdminDashboardData(schoolId as string, yearId, classId, periodId, subjectId);
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

    return NextResponse.json({ error: "Rôle non supporté" }, { status: 403 });
  } catch (error) {
    logger.error("fetching dashboard analytics:", error as Error);
    return NextResponse.json(
      { error: (error as Error).message || "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }
}
