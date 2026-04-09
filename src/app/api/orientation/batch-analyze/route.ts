import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { aiService } from "@/lib/ai/ai-service";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const { academicYearId, classId } = await request.json();

        if (!academicYearId) {
            return NextResponse.json({ error: "academicYearId requis" }, { status: 400 });
        }

        // 1. Fetch students for the class/year who DON'T have a validated orientation yet
        const enrollments = await prisma.enrollment.findMany({
            where: {
                academicYearId,
                status: "ACTIVE",
                ...(classId ? { classId } : {}),
                student: {
                    schoolId: getActiveSchoolId(session) || undefined
                }
            },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        studentOrientations: {
                            where: { academicYearId }
                        }
                    }
                }
            }
        });

        // Filter students who either have no orientation or no validated recommendation
        const studentsToAnalyze = enrollments
            .filter(e => {
                const hasOrientation = e.student.studentOrientations.length > 0;
                // If it has orientation, check if it's already validated
                if (hasOrientation) {
                    return e.student.studentOrientations[0].status === "PENDING";
                }
                return true;
            })
            .map(e => e.student);

        if (studentsToAnalyze.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: "Tous les élèves ont déjà une orientation ou aucun élève trouvé.",
                results: [] 
            });
        }

        // Limit to 10 students per batch to avoid timeouts and rate limits
        const batchSize = 10;
        const analysisBatch = studentsToAnalyze.slice(0, batchSize);

        const results = [];
        for (const student of analysisBatch) {
            try {
                const recommendation = await aiService.executeGovernance({
                    action: "recommend-orientation",
                    userId: session.user.id,
                    userRole: session.user.role,
                    studentId: student.id,
                    data: { academicYearId }
                });

                results.push({
                    studentId: student.id,
                    studentName: `${student.user.firstName} ${student.user.lastName}`,
                    series: recommendation.data.series,
                    justification: recommendation.data.justification,
                    alternatives: recommendation.recommendations,
                    confidence: recommendation.confidence,
                    success: true
                });
            } catch (err) {
                logger.warn(`AI Analysis failed for student ${student.id}:`, (err as any).message);
                results.push({
                    studentId: student.id,
                    studentName: `${student.user.firstName} ${student.user.lastName}`,
                    error: "Échec de l'analyse",
                    success: false
                });
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            totalFound: studentsToAnalyze.length,
            results
        });

    } catch (error) {
        logger.error("Batch Orientation Analysis:", error);
        return NextResponse.json({ error: "Erreur lors de l'analyse globale" }, { status: 500 });
    }
}
