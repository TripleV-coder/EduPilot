import { NextResponse } from "next/server";
import { gamificationService } from "@/lib/gamification/service";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getAccessibleSchoolIds } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const awardSchema = z.object({
    userId: z.string().min(1).max(64),
    achievementCode: z.string().min(1).max(64),
});

export const POST = createApiHandler(async (request, context) => {
    const session = context.session;

    try {
        const parsed = awardSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Missing userId or achievementCode" }, { status: 400 });
        }
        const { userId, achievementCode } = parsed.data;

        // Le bénéficiaire doit appartenir à un établissement accessible : un
        // enseignant pouvait décorer n'importe quel compte de n'importe quelle école.
        const beneficiary = await prisma.user.findFirst({
            where: {
                id: userId,
                ...(session.user.role === "SUPER_ADMIN" ? {} : { schoolId: { in: getAccessibleSchoolIds(session) } }),
            },
            select: { id: true, schoolId: true },
        });
        if (!beneficiary) {
            return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
        }

        const userAchievement = await gamificationService.unlockAchievement(beneficiary.id, achievementCode);

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "AWARD_ACHIEVEMENT",
                entity: "UserAchievement",
                entityId: userAchievement.id,
                schoolId: beneficiary.schoolId ?? undefined,
                newValues: { userId, achievementCode }
            }
        });

        return NextResponse.json(userAchievement);
    } catch (error) {
        logger.error("Award achievement failed", error as Error);
        // Message générique : le détail (SQL, code inconnu) reste dans le journal.
        return NextResponse.json({ error: "Impossible d'attribuer ce badge" }, { status: 500 });
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
