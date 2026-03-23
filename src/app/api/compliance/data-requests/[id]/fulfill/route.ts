import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { exportUserData } from "@/lib/security/rgpd";

/**
 * POST /api/compliance/data-requests/[id]/fulfill
 * Trigger the actual fulfillment of a data request (e.g., generate export)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();

        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
        if (!session?.user || !allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const dataRequest = await prisma.dataAccessRequest.findUnique({
            where: { id: id },
            include: { user: true },
        });

        if (!dataRequest) {
            return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
        }

        if (session.user.role === "SCHOOL_ADMIN") {
            if (!session.user.schoolId) {
                return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
            }
            if (dataRequest.user.schoolId !== session.user.schoolId) {
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
}
