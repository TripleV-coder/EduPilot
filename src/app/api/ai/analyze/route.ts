import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { analyzeStudentPerformance } from "@/lib/ai/n8n-client";
import { studentAlias } from "@/lib/ai/pii";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const body = await request.json();
        const { studentId, periodId } = body;

        if (!studentId) {
            return NextResponse.json({ error: "studentId requis" }, { status: 400 });
        }

        // Protection Multi-Tenant
        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: { select: { firstName: true, lastName: true, schoolId: true } },
                grades: {
                    where: periodId ? { evaluation: { periodId } } : undefined,
                    include: { evaluation: { include: { classSubject: { include: { subject: true } } } } }
                },
                attendances: periodId ? { /* Need date filter logic here, simpler to just fetch recent */ take: 20 } : { take: 20 },
                behaviorIncidents: { take: 5 }
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
        }

        const accessError = ensureSchoolAccess(session, student.schoolId);
        if (accessError) return accessError;

        // Check role access (Parent/Student strict check)
        if (session.user.role === "STUDENT" && session.user.id !== student.userId) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        if (session.user.role === "PARENT") {
            const parentProfile = await prisma.parentProfile.findUnique({
                where: { userId: session.user.id },
                select: { id: true },
            });
            if (!parentProfile) {
                return NextResponse.json({ error: "Profil parent non trouvé" }, { status: 403 });
            }
            const isParentOf = await prisma.parentStudent.findUnique({
                where: { parentId_studentId: { parentId: parentProfile.id, studentId } },
            });
            if (!isParentOf) {
                return NextResponse.json({ error: "Accès refusé : vous n'êtes pas le parent de cet élève" }, { status: 403 });
            }
        }

        // Format data for AI — PII scrubbing : on n'envoie jamais le nom réel
        // de l'élève à n8n/LLM externe, seulement ses initiales (cf. lib/ai/pii)
        const analysisPayload = {
            studentName: studentAlias(student.user.firstName, student.user.lastName),
            grades: student.grades.map(g => ({
                subject: g.evaluation.classSubject.subject.name,
                grade: g.value,
                max: g.evaluation.maxGrade,
                date: g.evaluation.date
            })),
            attendance: {
                absences: student.attendances.filter(a => a.status === "ABSENT").length,
                lates: student.attendances.filter(a => a.status === "LATE").length
            },
            incidents: student.behaviorIncidents.length
        };

        const result = await analyzeStudentPerformance(analysisPayload);

        // Save analytics to DB? Optional (StudentAnalytics model)
        // await prisma.studentAnalytics.create({...})

        return NextResponse.json(result);

    
    } catch (error) {
        logger.error("Error in AI analysis:", error as Error);
        return NextResponse.json({ error: "Erreur lors de l'analyse IA" }, { status: 500 });
    }

});
