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

const createReportSchema = z.object({
    tag: z.enum(["ANONYME", "PARENT", "ENSEIGNANT", "NOMINATIF"]),
    category: z.string().min(2).max(80),
    excerpt: z.string().min(10).max(500),
    severity: z.enum(["P0", "P1", "P2"]),
    /** Élève concerné (optionnel — jamais pour un signalement anonyme) */
    reportedUserId: z.string().cuid().optional(),
});

/**
 * POST /api/wellbeing/reports — ouvrir un dossier de signalement (P2.5).
 * Réservé à la cellule d'écoute (admins/direction, mêmes rôles que l'overview).
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const schoolId = getActiveSchoolId(session);
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 }
            );
        }

        const body = await request.json();
        const data = createReportSchema.parse(body);

        if (data.tag === "ANONYME" && data.reportedUserId) {
            return NextResponse.json(
                { error: "Un signalement anonyme ne peut pas désigner nominativement un élève." },
                { status: 400 }
            );
        }

        // L'élève désigné doit appartenir à l'école (anti cross-tenant)
        if (data.reportedUserId) {
            const reported = await prisma.user.findFirst({
                where: { id: data.reportedUserId, ...(schoolId ? { schoolId } : {}) },
                select: { id: true },
            });
            if (!reported) {
                return NextResponse.json({ error: "Élève concerné introuvable" }, { status: 404 });
            }
        }

        const report = await prisma.wellbeingReport.create({
            data: {
                schoolId: schoolId!,
                tag: data.tag,
                category: data.category,
                excerpt: data.excerpt,
                severity: data.severity,
                severityLabel: SEVERITY_LABELS[data.severity],
                status: "OPEN",
                // La source n'est tracée que pour les signalements non anonymes
                reporterUserId: data.tag === "ANONYME" ? null : session.user.id,
                reportedUserId: data.reportedUserId ?? null,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "CREATE_WELLBEING_REPORT",
                entity: "WellbeingReport",
                entityId: report.id,
            },
        });

        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        logger.error("Error creating wellbeing report", error as Error);
        return NextResponse.json({ error: "Erreur lors de la création du dossier" }, { status: 500 });
    }
}
