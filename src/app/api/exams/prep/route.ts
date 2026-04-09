import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { examPrepService } from "@/lib/benin/exam-prep-service";
import { logger } from "@/lib/utils/logger";
import prisma from "@/lib/prisma";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

// GET: Analyser la préparation d'un élève ou d'une classe
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examType = (searchParams.get("exam") || "CEP") as "CEP" | "BEPC";
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");

    try {
        if (studentId) {
            if (session.user.role !== "SUPER_ADMIN") {
                const student = await prisma.studentProfile.findUnique({
                    where: { id: studentId },
                    select: { schoolId: true },
                });
                if (!student) {
                    return NextResponse.json({ error: "Student not found" }, { status: 404 });
                }
                if (!canAccessSchool(session, student.schoolId)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }
            // Analyse individuelle
            const readiness = await examPrepService.analyzeStudentReadiness(studentId, examType);
            if (!readiness) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }
            return NextResponse.json(readiness);
        }

        if (classId) {
            if (session.user.role !== "SUPER_ADMIN") {
                const classRecord = await prisma.class.findUnique({
                    where: { id: classId },
                    select: { schoolId: true },
                });
                if (!classRecord) {
                    return NextResponse.json({ error: "Class not found" }, { status: 404 });
                }
                if (!canAccessSchool(session, classRecord.schoolId)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }
            // Statistiques de classe
            const stats = await examPrepService.getClassExamStats(classId, examType);
            return NextResponse.json(stats);
        }

        return NextResponse.json({ error: "studentId or classId required" }, { status: 400 });
    } catch (error) {
        logger.error("Exam prep failed", error instanceof Error ? error : new Error(String(error)), { module: "api/exams/prep" });
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
}
