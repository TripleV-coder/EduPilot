import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { examPrepService } from "@/lib/benin/exam-prep-service";

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
            // Analyse individuelle
            const readiness = await examPrepService.analyzeStudentReadiness(studentId, examType);
            if (!readiness) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }
            return NextResponse.json(readiness);
        }

        if (classId) {
            // Statistiques de classe
            const stats = await examPrepService.getClassExamStats(classId, examType);
            return NextResponse.json(stats);
        }

        return NextResponse.json({ error: "studentId or classId required" }, { status: 400 });
    } catch (error) {
        console.error("Exam prep error:", error);
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
}
