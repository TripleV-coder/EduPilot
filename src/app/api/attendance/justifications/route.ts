import { guardAttendanceDateWritable } from "@/lib/academic/year-lock";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { createNotification } from "@/lib/services/notification.service";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { getOwnStudentIds } from "@/lib/auth/family-scope";

/** Personnel qui valide ou refuse un justificatif. */
const REVIEWER_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF", "TEACHER"] as const;
const FAMILY_ROLES = ["PARENT", "STUDENT"] as const;
const ABSENCE_STATUSES = ["ABSENT", "EXCUSED", "LATE"] as const;

/**
 * GET /api/attendance/justifications
 * Absences et retards avec l'état de leur justificatif.
 * - personnel : établissement actif (filtres classId, studentId, pending=true) ;
 * - parent / élève : uniquement leurs propres élèves (avant : aucune garde de
 *   rôle, toute l'école lisait les absences de tous les élèves).
 */
export const GET = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");
    const pendingOnly = searchParams.get("pending") === "true";

    const where: Prisma.AttendanceWhereInput = {};
    if (status) {
      if (!(ABSENCE_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
      }
      where.status = status as (typeof ABSENCE_STATUSES)[number];
    } else {
      where.status = { in: [...ABSENCE_STATUSES] };
    }
    if (pendingOnly) {
      where.status = { in: ["ABSENT", "LATE"] };
      where.justificationSubmittedAt = { not: null };
    }

    const ownStudentIds = await getOwnStudentIds(session.user.role, session.user.id);
    if (ownStudentIds) {
      if (studentId && !ownStudentIds.includes(studentId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      where.studentId = studentId ? studentId : { in: ownStudentIds };
    } else {
      if (classId) where.classId = classId;
      if (studentId) where.studentId = studentId;
      const activeSchoolId = getActiveSchoolId(session);
      if (session.user.role !== "SUPER_ADMIN" && activeSchoolId) {
        where.student = { schoolId: activeSchoolId };
      }
    }

    try {
      const absences = await prisma.attendance.findMany({
        where,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          class: { select: { name: true } },
          recordedBy: { select: { firstName: true, lastName: true } },
          justificationSubmittedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        take: 100,
      });

      const formatted = absences.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: `${a.student.user.lastName} ${a.student.user.firstName}`,
        className: a.class.name,
        date: a.date,
        status: a.status,
        reason: a.reason,
        hasJustification: !!a.justificationDocument || !!a.justificationSubmittedAt,
        justificationDocument: a.justificationDocument,
        /** Envoyé par la famille, pas encore traité par l'établissement. */
        pendingReview: Boolean(a.justificationSubmittedAt) && a.status !== "EXCUSED",
        submittedAt: a.justificationSubmittedAt,
        submittedBy: a.justificationSubmittedBy
          ? `${a.justificationSubmittedBy.firstName} ${a.justificationSubmittedBy.lastName}`
          : null,
        recordedBy: a.recordedBy ? `${a.recordedBy.firstName} ${a.recordedBy.lastName}` : null,
      }));

      return NextResponse.json({ justifications: formatted, total: formatted.length });
    } catch (error) {
      logger.error("Error fetching justifications", error instanceof Error ? error : new Error(String(error)), { module: "api/attendance/justifications" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  },
  { allowedRoles: [...REVIEWER_ROLES, "ACCOUNTANT", ...FAMILY_ROLES] }
);

const postSchema = z.object({
  attendanceId: z.string().min(1, "attendanceId est requis"),
  reason: z.string().trim().max(1_000).optional(),
  justificationDocument: z.string().trim().max(2_000).optional(),
  /** Personnel uniquement : REJECT refuse le justificatif envoyé par la famille. */
  decision: z.enum(["APPROVE", "REJECT"]).default("APPROVE"),
});

/**
 * POST /api/attendance/justifications
 * - famille (parent, élève) : envoie un justificatif — l'absence reste
 *   ABSENT/LATE, marquée « en attente » ;
 * - personnel : valide (→ EXCUSED) ou refuse (le justificatif est retiré et la
 *   famille prévenue).
 */
export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
    }
    const { attendanceId, reason, justificationDocument, decision } = parsed.data;

    const guard = await assertModelAccess(session, "attendance", attendanceId, "Absence introuvable");
    if (guard) return guard;

    const current = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        status: true,
        studentId: true,
        date: true,
        justificationSubmittedAt: true,
        justificationSubmittedById: true,
        class: { select: { schoolId: true } },
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!current) return NextResponse.json({ error: "Absence introuvable" }, { status: 404 });

    const yearLock = await guardAttendanceDateWritable(current.class.schoolId, current.date);
    if (yearLock) return yearLock;

    if (current.status === "PRESENT") {
      return NextResponse.json({ error: "Impossible de justifier un élève marqué comme présent." }, { status: 400 });
    }

    try {
      const ownStudentIds = await getOwnStudentIds(session.user.role, session.user.id);

      // ── Famille : envoi du justificatif, en attente de validation ──
      if (ownStudentIds) {
        if (!ownStudentIds.includes(current.studentId)) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        if (current.status === "EXCUSED") {
          return NextResponse.json({ error: "Cette absence est déjà justifiée." }, { status: 409 });
        }
        if (!reason) {
          return NextResponse.json({ error: "Expliquez le motif de l'absence." }, { status: 400 });
        }
        const updated = await prisma.attendance.update({
          where: { id: attendanceId },
          data: {
            reason,
            justificationDocument: justificationDocument || undefined,
            justificationSubmittedAt: new Date(),
            justificationSubmittedById: session.user.id,
          },
        });
        return NextResponse.json({ success: true, pendingReview: true, attendance: updated });
      }

      // ── Personnel ──
      if (!roleSatisfies(session.user.role, [...REVIEWER_ROLES])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      if (current.status === "EXCUSED" && !roleSatisfies(session.user.role, ["SUPER_ADMIN", "SCHOOL_ADMIN"])) {
        return NextResponse.json({ error: "Cette absence est déjà justifiée." }, { status: 400 });
      }

      const studentName = `${current.student.user.firstName} ${current.student.user.lastName}`;
      const day = current.date.toLocaleDateString("fr-FR");

      if (decision === "REJECT") {
        if (!current.justificationSubmittedAt) {
          return NextResponse.json({ error: "Aucun justificatif en attente pour cette absence." }, { status: 409 });
        }
        const updated = await prisma.attendance.update({
          where: { id: attendanceId },
          data: { justificationSubmittedAt: null, justificationSubmittedById: null },
        });
        if (current.justificationSubmittedById) {
          await createNotification({
            userId: current.justificationSubmittedById,
            type: "ATTENDANCE",
            title: "Justificatif refusé",
            message: `Le justificatif de l'absence de ${studentName} le ${day} n'a pas été accepté. Contactez la vie scolaire.`,
            link: "/dashboard/attendance",
          }).catch(() => undefined);
        }
        return NextResponse.json({ success: true, attendance: updated });
      }

      const updated = await prisma.attendance.update({
        where: { id: attendanceId },
        data: {
          status: "EXCUSED",
          reason: reason || undefined,
          justificationDocument: justificationDocument || undefined,
        },
      });
      if (current.justificationSubmittedById) {
        await createNotification({
          userId: current.justificationSubmittedById,
          type: "ATTENDANCE",
          title: "Justificatif accepté",
          message: `L'absence de ${studentName} le ${day} est désormais justifiée.`,
          link: "/dashboard/attendance",
        }).catch(() => undefined);
      }

      await syncAnalyticsAfterStudentActivityChange([updated.studentId], updated.date);
      await Promise.all([invalidateByPath("/api/analytics"), invalidateByPath("/api/attendance/stats")]);

      return NextResponse.json({ success: true, attendance: updated }, { status: 200 });
    } catch (error) {
      logger.error("Error submitting justification", error instanceof Error ? error : new Error(String(error)), { module: "api/attendance/justifications" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  },
  { allowedRoles: [...REVIEWER_ROLES, ...FAMILY_ROLES] }
);
