import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { exportUserData } from "@/lib/security/rgpd";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * POST /api/compliance/data-requests/[id]/fulfill
 * Trigger the actual fulfillment of a data request (e.g., generate export)
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const { id } = await context.params;
        const session = context.session;

        const dataRequest = await prisma.dataAccessRequest.findUnique({
            where: { id: id },
            include: { user: true },
        });

        if (!dataRequest) {
            return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
        }

        if (roleSatisfies(session.user.role, ["SCHOOL_ADMIN"])) {
            if (!getActiveSchoolId(session)) {
                return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
            }
            if (dataRequest.user.schoolId !== getActiveSchoolId(session)) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
        }

        if (dataRequest.status === "COMPLETED") {
            return NextResponse.json({ error: "Demande déjà complétée" }, { status: 400 });
        }

        // Process based on type
        if (dataRequest.requestType === "EXPORT" || dataRequest.requestType === "PORTABILITY") {
            // 1. Generate Data
            const exportData = await exportUserData(dataRequest.userId);

            // 2. Update Request
            await prisma.dataAccessRequest.update({
                where: { id: id },
                data: {
                    status: "COMPLETED",
                    processedBy: session.user.id,
                    completedAt: new Date(),
                    downloadUrl: null,
                    notes: "Données exportées avec succès le " + new Date().toLocaleDateString(),
                }
            });

            return NextResponse.json({
                success: true,
                message: "Exportation générée avec succès",
                data: exportData,
            });
        }

        return NextResponse.json({ error: "Type de demande non supporté pour l'automatisation" }, { status: 400 });
    
    } catch (error) {
        logger.error("RGPD Fulfillment error:", error as Error);
        return NextResponse.json({ error: "Erreur lors du traitement de la demande" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
