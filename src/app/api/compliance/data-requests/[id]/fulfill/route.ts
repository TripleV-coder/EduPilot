import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { anonymizeUser, exportUserData } from "@/lib/security/rgpd";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * POST /api/compliance/data-requests/[id]/fulfill — traitement d'une demande.
 *
 * Les trois droits sont traités ici (Lot 6) :
 * - EXPORT / PORTABILITY : les données sont produites et renvoyées ;
 * - DELETION : le compte est anonymisé, **sauf** si l'élève est encore
 *   inscrit — l'établissement doit tenir son registre, et le droit à
 *   l'effacement ne prime pas sur cette obligation ; la demande reste alors
 *   en attente, avec l'explication ;
 * - RECTIFICATION : la correction est un geste humain. L'administration
 *   corrige la donnée puis clôt la demande **en décrivant la correction**
 *   (`notes` obligatoire), qui reste au dossier.
 *
 * Avant, seul l'export était traité : une demande de rectification ou
 * d'effacement recevait « type de demande non supporté » et ne pouvait jamais
 * être honorée.
 */

const bodySchema = z.object({ notes: z.string().trim().min(1).max(2000).optional() });

export const POST = createApiHandler(async (request, context) => {
    try {
        const { id } = await context.params;
        const session = context.session;
        const body = bodySchema.parse(await request.json().catch(() => ({})));

        const dataRequest = await prisma.dataAccessRequest.findUnique({
            where: { id },
            include: { user: { select: { id: true, schoolId: true } } },
        });

        if (!dataRequest) {
            return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
        }

        if (roleSatisfies(session.user.role, ["SCHOOL_ADMIN"])) {
            const activeSchoolId = getActiveSchoolId(session);
            if (!activeSchoolId) {
                return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
            }
            if (dataRequest.user.schoolId !== activeSchoolId) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
        }

        if (dataRequest.status === "COMPLETED") {
            return NextResponse.json({ error: "Demande déjà complétée" }, { status: 400 });
        }

        const close = (notes: string) =>
            prisma.dataAccessRequest.update({
                where: { id },
                data: {
                    status: "COMPLETED",
                    processedBy: session.user.id,
                    completedAt: new Date(),
                    downloadUrl: null,
                    notes,
                },
            });

        if (dataRequest.requestType === "EXPORT" || dataRequest.requestType === "PORTABILITY") {
            const exportData = await exportUserData(dataRequest.userId);
            await close(`Données exportées le ${new Date().toLocaleDateString("fr-FR")}.`);
            return NextResponse.json({
                success: true,
                message: "Exportation générée avec succès",
                data: exportData,
            });
        }

        if (dataRequest.requestType === "DELETION") {
            const stillEnrolled = await prisma.enrollment.count({
                where: {
                    student: { userId: dataRequest.userId },
                    status: { in: ["ACTIVE", "SUSPENDED"] },
                },
            });
            if (stillEnrolled > 0) {
                return NextResponse.json(
                    {
                        error:
                            "Cet élève est encore inscrit : son dossier scolaire doit être conservé. " +
                            "L'effacement sera possible après la clôture de son inscription, ou automatiquement " +
                            "à l'échéance des durées de conservation.",
                        code: "STUDENT_STILL_ENROLLED",
                    },
                    { status: 409 },
                );
            }

            const result = await anonymizeUser(dataRequest.userId, session.user.id, "REQUEST");
            await close(`Compte anonymisé le ${new Date().toLocaleDateString("fr-FR")}.`);
            return NextResponse.json({
                success: true,
                message: "Le compte a été anonymisé : les données personnelles ont été effacées.",
                anonymizedEmail: result.anonymizedEmail,
            });
        }

        if (dataRequest.requestType === "RECTIFICATION") {
            if (!body.notes) {
                return NextResponse.json(
                    {
                        error:
                            "Décrivez la correction apportée avant de clore cette demande : elle reste au dossier " +
                            "comme preuve du traitement.",
                        code: "RECTIFICATION_NOTES_REQUIRED",
                    },
                    { status: 400 },
                );
            }
            await close(body.notes);
            return NextResponse.json({ success: true, message: "Demande de rectification close." });
        }

        return NextResponse.json({ error: "Type de demande non supporté" }, { status: 400 });
    } catch (error) {
        logger.error("Traitement d'une demande RGPD impossible", error as Error, { module: "compliance/fulfill" });
        return NextResponse.json({ error: "Erreur lors du traitement de la demande" }, { status: 500 });
    }
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
