import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recommendationSchema } from "@/lib/validations/orientation";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const { id } = await context.params;
        const session = context.session;

        const body = await request.json();
        const data = recommendationSchema.parse({ ...body, orientationId: id });

        // Verify orientation exists
        const orientation = await prisma.studentOrientation.findUnique({
            where: { id },
            include: { student: { select: { schoolId: true } } },
        });

        if (!orientation) {
            return NextResponse.json({ error: "Dossier d'orientation introuvable" }, { status: 404 });
        }
        if (session.user.role !== "SUPER_ADMIN" && orientation.student.schoolId !== getActiveSchoolId(session)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const newRecommendation = await prisma.orientationRecommendation.create({
            data: {
                orientationId: data.orientationId,
                recommendedSeries: data.recommendedSeries,
                rank: data.rank,
                score: data.score,
                justification: data.justification,
                strengths: data.strengths,
                warnings: data.warnings,
                isValidated: false
            }
        });

        // Update orientation status to "RECOMMENDED" if it was "PENDING"
        if (orientation.status === "PENDING" || orientation.status === "ANALYZED") {
            await prisma.studentOrientation.update({
                where: { id },
                data: { status: "RECOMMENDED" }
            });
        }

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "ADD_RECOMMENDATION",
                entity: "OrientationRecommendation",
                entityId: newRecommendation.id,
                newValues: data
            }
        });

        return NextResponse.json(newRecommendation, { status: 201 });
    
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
        }
        logger.error(" adding orientation recommendation:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });
