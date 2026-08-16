import { NextRequest, NextResponse } from "next/server";
import { gamificationService } from "@/lib/gamification/service";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
        const session = context.session;

    try {
        const body = await request.json();
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
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to award achievement",
            },
            { status: 500 }
        );
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });

export const GET = createApiHandler(async (request, context) => {
try {
        const achievements = await prisma.achievement.findMany({
            where: { isActive: true },
            orderBy: { points: "desc" }
        });
        return NextResponse.json(achievements);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
    }

});
