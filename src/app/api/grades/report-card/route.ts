import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gradeService } from "@/lib/benin/grade-service";

// GET: Obtenir le bulletin d'un élève ou le classement d'une classe
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const periodId = searchParams.get("periodId");

    if (!periodId) {
        return NextResponse.json({ error: "periodId required" }, { status: 400 });
    }

    try {
        if (studentId) {
            // Bulletin individuel
            const reportCard = await gradeService.getStudentReportCard(studentId, periodId);
            if (!reportCard) {
                return NextResponse.json({ error: "Student not found or no grades" }, { status: 404 });
            }
            return NextResponse.json(reportCard);
        }

        if (classId) {
            // Classement de classe
            const ranking = await gradeService.getClassRanking(classId, periodId);
            return NextResponse.json(ranking);
        }

        return NextResponse.json({ error: "studentId or classId required" }, { status: 400 });
    } catch (error) {
        console.error("Report card error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
