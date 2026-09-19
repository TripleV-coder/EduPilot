import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission, roleSatisfies } from "@/lib/rbac/permissions";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { LOCKED_YEAR_STATUSES, isYearLocked } from "@/lib/academic/year-lock";

const statusSchema = z.discriminatedUnion("action", [
  // `force` : clôturer malgré des inscriptions encore actives (élèves non promus).
  z.object({ action: z.literal("close"), force: z.boolean().optional() }),
  z.object({ action: z.literal("reopen") }),
]);

/** Rouvrir une année figée défait une garantie : réservé à l'administration. */
const REOPEN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"];

/**
 * PATCH /api/academic-years/[id]/status
 * Clôture (CLOSED) ou réouverture (ACTIVE) d'une année scolaire (TD-018).
 * Une année clôturée refuse toute écriture de notes, d'évaluations et de présences.
 */
export const PATCH = createApiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = statusSchema.parse(await request.json());

    const year = await prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true, schoolId: true, status: true, isCurrent: true },
    });
    if (!year || !canAccessSchool(session, year.schoolId)) {
      return NextResponse.json({ error: "Année scolaire introuvable" }, { status: 404 });
    }

    if (body.action === "close") {
      if (isYearLocked(year.status)) {
        return NextResponse.json({ error: "Cette année scolaire est déjà clôturée." }, { status: 409 });
      }

      const activeEnrollments = await prisma.enrollment.count({
        where: { academicYearId: id, status: "ACTIVE", deletedAt: null },
      });
      if (activeEnrollments > 0 && !body.force) {
        return NextResponse.json(
          {
            error: `${activeEnrollments} inscription(s) sont encore actives sur cette année : effectuez la promotion avant de clôturer, ou confirmez la clôture.`,
            code: "ACTIVE_ENROLLMENTS",
            activeEnrollments,
          },
          { status: 409 }
        );
      }

      // Condition sur le statut : deux clôtures concurrentes n'écrivent qu'une fois.
      const { count } = await prisma.academicYear.updateMany({
        where: { id, status: { notIn: [...LOCKED_YEAR_STATUSES] } },
        data: { status: "CLOSED", isCurrent: false },
      });
      if (count === 0) {
        return NextResponse.json({ error: "Cette année scolaire est déjà clôturée." }, { status: 409 });
      }

      await createAuditLog({
        userId: session.user.id,
        action: "ACADEMIC_YEAR_CLOSED",
        entity: "AcademicYear",
        entityId: id,
        schoolId: year.schoolId,
        oldValues: { status: year.status, isCurrent: year.isCurrent },
        newValues: { status: "CLOSED", isCurrent: false, activeEnrollments },
        severity: "WARNING",
      });
    } else {
      if (!roleSatisfies(session.user.role, REOPEN_ROLES)) {
        return NextResponse.json(
          { error: "Seule l'administration de l'établissement peut rouvrir une année clôturée." },
          { status: 403 }
        );
      }
      if (year.status !== "CLOSED") {
        return NextResponse.json({ error: "Seule une année clôturée peut être rouverte." }, { status: 409 });
      }

      const { count } = await prisma.academicYear.updateMany({
        where: { id, status: "CLOSED" },
        data: { status: "ACTIVE" },
      });
      if (count === 0) {
        return NextResponse.json({ error: "Seule une année clôturée peut être rouverte." }, { status: 409 });
      }

      await createAuditLog({
        userId: session.user.id,
        action: "ACADEMIC_YEAR_REOPENED",
        entity: "AcademicYear",
        entityId: id,
        schoolId: year.schoolId,
        oldValues: { status: "CLOSED" },
        newValues: { status: "ACTIVE" },
        severity: "CRITICAL",
      });
    }

    await invalidateByPath("/api/academic-years");
    const updated = await prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, isCurrent: true },
    });
    return NextResponse.json(updated);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.ACADEMIC_YEAR_CLOSE],
  }
);
