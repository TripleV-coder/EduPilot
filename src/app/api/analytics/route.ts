import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyticsService } from "@/lib/analytics/service";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "overview";

    try {
        switch (type) {
            case "overview":
                const [stats, userStats] = await Promise.all([
                    analyticsService.getSchoolStats(session.user.schoolId),
                    analyticsService.getUserStats(session.user.id)
                ]);
                return NextResponse.json({ ...stats, userStats });

            case "grades":
                const classId = searchParams.get("classId") || undefined;
                const grades = await analyticsService.getGradeDistribution(
                    session.user.schoolId,
                    classId
                );
                return NextResponse.json(grades);

            case "activity":
                const activity = await analyticsService.getRecentActivity(
                    session.user.schoolId
                );
                return NextResponse.json(activity);

            default:
                return NextResponse.json({ error: "Unknown type" }, { status: 400 });
        }
    } catch (error) {
        console.error("Analytics Error:", error);
        return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
    }
}
