import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { predictFailureRisk } from "@/lib/ai/n8n-client";
import { logger } from "@/lib/utils/logger";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const identifier = `${session.user.id}:${getClientIdentifier(request)}`;
        const rl = await checkRateLimit(strictLimiter, `ai:predict-failure:${identifier}`);
        if (!rl.success) {
            const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
            return NextResponse.json(
                { error: "Trop de requêtes", code: "RATE_LIMITED", retryAfter },
                { status: 429, headers: { "Retry-After": retryAfter.toString() } }
            );
        }

        const body = await request.json();
        const { studentId } = body;

        if (!studentId) {
            return NextResponse.json({ error: "studentId requis" }, { status: 400 });
        }

        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: { select: { schoolId: true } },
                grades: {
                    orderBy: { evaluation: { date: 'desc' } },
                    take: 50,
                    include: { evaluation: { include: { classSubject: { include: { subject: true } } } } }
                },
                attendances: { take: 50 },
                behaviorIncidents: { take: 10 }
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
        }

        const accessError = ensureSchoolAccess(session, student.schoolId);
        if (accessError) return accessError;

        // Only Teachers and Admins can predict failure risk (Privacy)
        const allowedRoles = ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        // Format data
        const predictionPayload = {
            grades: student.grades.map(g => ({
                subject: g.evaluation.classSubject.subject.name,
                value: g.value,
                date: g.evaluation.date
            })),
            absences: student.attendances.filter(a => a.status === "ABSENT").length,
            incidents: student.behaviorIncidents.length
        };

        const result = await predictFailureRisk(predictionPayload);
        return NextResponse.json(result);

    } catch (error) {
        logger.error("Error in AI prediction:", error as Error);
        return NextResponse.json({ error: "Erreur lors de la prédiction" }, { status: 500 });
    }
}
