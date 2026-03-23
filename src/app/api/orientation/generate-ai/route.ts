import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { aiService } from "@/lib/ai/ai-service";
import { SubjectGroup } from "@prisma/client";

const SUBJECT_MAPPING: Record<string, SubjectGroup> = {
    "mathématiques": "SCIENTIFIQUE",
    "physique": "SCIENTIFIQUE",
    "chimie": "SCIENTIFIQUE",
    "svt": "SCIENTIFIQUE",
    "sciences": "SCIENTIFIQUE",
    "français": "LITTERAIRE",
    "philosophie": "LITTERAIRE",
    "lettres": "LITTERAIRE",
    "littérature": "LITTERAIRE",
    "histoire": "LITTERAIRE",
    "géographie": "LITTERAIRE",
    "économie": "ECONOMIQUE",
    "gestion": "ECONOMIQUE",
    "comptabilité": "ECONOMIQUE",
    "dessin technique": "TECHNIQUE",
    "mécanique": "TECHNIQUE",
    "électronique": "TECHNIQUE",
    "anglais": "LANGUES",
    "espagnol": "LANGUES",
    "allemand": "LANGUES",
};

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const body = await request.json();
        const { studentId, academicYearId } = body;

        if (!studentId || !academicYearId) {
            return NextResponse.json({ error: "studentId et academicYearId requis" }, { status: 400 });
        }

        const result = await aiService.executeGovernance({
            action: "recommend-orientation",
            userId: session.user.id,
            userRole: session.user.role,
            studentId,
            data: { academicYearId }
        });

        if (!result.success) {
            throw new Error("L'analyse IA a échoué");
        }

        return NextResponse.json({
            studentId,
            recommendations: [
                {
                    series: result.data.series,
                    justification: result.data.justification,
                    score: result.confidence * 100
                },
                ...(result.recommendations || []).map((alt: string) => ({
                    series: alt,
                    score: (result.confidence * 100) - 10,
                    justification: "Alternative suggérée par l'IA"
                }))
            ],
            engine: result.data.engine // optional flag
        });

    } catch (error) {
        logger.error("AI Orientation Generation:", error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : "Erreur lors de la génération de l'avis IA" 
        }, { status: 500 });
    }
}
