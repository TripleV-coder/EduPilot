import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

const SEVERITY_LABELS: Record<string, string> = {
    P0: "P0 · CPS prévenu",
    P1: "P1 · Suivi rapproché",
    P2: "P2 · Veille",
};

const updateReportSchema = z
    .object({
        status: z.enum(["OPEN", "IN_REVIEW", "IN_FOLLOWUP", "CLOSED"]).optional(),
        severity: z.enum(["P0", "P1", "P2"]).optional(),
    })
    .refine((data) => data.status !== undefined || data.severity !== undefined, {
        message: "Aucune modification fournie",
    });

type RouteContext = { params: Promise<{ id: string }> };

function buildScopedWhere(id: string, role: string, schoolId: string | undefined) {
    // Anti-IDOR : le périmètre école fait partie du where
    return role === "SUPER_ADMIN" ? { id } : { id, schoolId };
}

/**
 * GET /api/wellbeing/reports/[id] — dossier détaillé.
 * Inclut les RDV psy de l'élève concerné (si signalement nominatif).
 * Anonymat by design : reporterLabel null si signalement anonyme.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const schoolId = getActiveSchoolId(session);
        const report = await prisma.wellbeingReport.findFirst({
            where: buildScopedWhere(id, session.user.role, schoolId),
            include: {
                reporter: { select: { firstName: true, lastName: true, role: true } },
                reportedAbout: { select: { firstName: true, lastName: true } },
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
        }

        // Rendez-vous psy liés à l'élève concerné (si nominatif)
        const appointments = report.reportedUserId
            ? await prisma.psyAppointment.findMany({
                  where: {
                      studentUserId: report.reportedUserId,
                      ...(schoolId ? { schoolId } : {}),
                  },
                  orderBy: { startAt: "desc" },
                  take: 10,
              })
            : [];

        return NextResponse.json({
            id: report.id,
            tag: report.tag,
            category: report.category,
            excerpt: report.excerpt,
            severity: report.severity,
            severityLabel: report.severityLabel,
            status: report.status,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt.toISOString(),
            reporterLabel: report.reporter
                ? `${report.reporter.firstName ?? ""} ${report.reporter.lastName ?? ""}`.trim() || null
                : null,
            reporterRole: report.reporter?.role ?? null,
            reportedAboutLabel: report.reportedAbout
                ? `${report.reportedAbout.firstName ?? ""} ${report.reportedAbout.lastName ?? ""}`.trim() || null
                : null,
            appointments: appointments.map((a) => ({
                id: a.id,
                startAt: a.startAt.toISOString(),
                durationMinutes: a.durationMinutes,
                kind: a.kind,
                isUrgent: a.isUrgent,
            })),
        });
    } catch (error) {
        logger.error("Error fetching wellbeing report", error as Error);
        return NextResponse.json({ error: "Erreur lors de la lecture du dossier" }, { status: 500 });
    }
}

/**
 * PATCH /api/wellbeing/reports/[id] — avancer le statut
 * (OPEN → IN_REVIEW → IN_FOLLOWUP → CLOSED) et/ou requalifier la sévérité.
 * Audit systématique.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const existing = await prisma.wellbeingReport.findFirst({
            where: buildScopedWhere(id, session.user.role, getActiveSchoolId(session)),
            select: { id: true, status: true, severity: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
        }

        const body = await request.json();
        const data = updateReportSchema.parse(body);

        const updated = await prisma.wellbeingReport.update({
            where: { id: existing.id },
            data: {
                ...(data.status ? { status: data.status } : {}),
                ...(data.severity
                    ? { severity: data.severity, severityLabel: SEVERITY_LABELS[data.severity] }
                    : {}),
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "UPDATE_WELLBEING_REPORT_STATUS",
                entity: "WellbeingReport",
                entityId: id,
                oldValues: { status: existing.status, severity: existing.severity },
                newValues: { status: updated.status, severity: updated.severity },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        logger.error("Error updating wellbeing report", error as Error);
        return NextResponse.json({ error: "Erreur lors de la mise à jour du dossier" }, { status: 500 });
    }
}
