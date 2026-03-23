import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { recommendationSchema } from "@/lib/validations/orientation";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

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
        if (session.user.role !== "SUPER_ADMIN" && orientation.student.schoolId !== session.user.schoolId) {
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
}
