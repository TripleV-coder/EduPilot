import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gamificationService } from "@/lib/gamification/service";

export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const leaderboard = await gamificationService.getLeaderboard(session.user.schoolId);
        return NextResponse.json(leaderboard);
    } catch (error) {
        console.error("Leaderboard Error:", error);
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
