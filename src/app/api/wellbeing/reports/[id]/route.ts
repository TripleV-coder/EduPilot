import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

const updateReportSchema = z.object({
    status: z.enum(["OPEN", "IN_REVIEW", "IN_FOLLOWUP", "CLOSED"]),
});

type RouteContext = { params: Promise<{ id: string }> };

function buildScopedWhere(id: string, role: string, schoolId: string | undefined) {
    // Anti-IDOR : le périmètre école fait partie du where
    return role === "SUPER_ADMIN" ? { id } : { id, schoolId };
}

/**
 * GET /api/wellbeing/reports/[id] — détail d'un dossier de signalement.
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

        const report = await prisma.wellbeingReport.findFirst({
            where: buildScopedWhere(id, session.user.role, getActiveSchoolId(session)),
            include: {
                reporter: { select: { firstName: true, lastName: true, role: true } },
                reportedAbout: { select: { firstName: true, lastName: true } },
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
        }

        return NextResponse.json(report);
    } catch (error) {
        logger.error("Error fetching wellbeing report", error as Error);
        return NextResponse.json({ error: "Erreur lors de la lecture du dossier" }, { status: 500 });
    }
}

/**
 * PATCH /api/wellbeing/reports/[id] — faire avancer le statut du dossier
 * (OPEN → IN_REVIEW → IN_FOLLOWUP → CLOSED). Audit systématique.
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
            select: { id: true, status: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
        }

        const body = await request.json();
        const data = updateReportSchema.parse(body);

        const updated = await prisma.wellbeingReport.update({
            where: { id: existing.id },
            data: { status: data.status },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "UPDATE_WELLBEING_REPORT_STATUS",
                entity: "WellbeingReport",
                entityId: id,
                oldValues: { status: existing.status },
                newValues: { status: data.status },
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
