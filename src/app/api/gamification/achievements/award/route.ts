import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gamificationService } from "@/lib/gamification/service";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { userId, achievementCode } = body;

        if (!userId || !achievementCode) {
            return NextResponse.json({ error: "Missing userId or achievementCode" }, { status: 400 });
        }

        const userAchievement = await gamificationService.unlockAchievement(userId, achievementCode);

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "AWARD_ACHIEVEMENT",
                entity: "UserAchievement",
                entityId: userAchievement.id,
                newValues: { userId, achievementCode }
            }
        });

        return NextResponse.json(userAchievement);
    } catch (error) {
        logger.error("Award achievement failed", error);
        return NextResponse.json({ error: (error as any).message || "Failed to award achievement" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const achievements = await prisma.achievement.findMany({
            where: { isActive: true },
            orderBy: { points: "desc" }
        });
        return NextResponse.json(achievements);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
    }
}
