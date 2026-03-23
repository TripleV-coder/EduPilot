import prisma from "@/lib/prisma";

export interface QuotaStatus {
    allowed: boolean;
    current: number;
    limit: number;
    usagePercentage: number;
}

/**
 * Check if a school has reached its student quota according to its subscription plan
 */
export async function checkStudentQuota(schoolId: string): Promise<QuotaStatus> {
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        include: { plan: true }
    });

    if (!school) throw new Error("School not found");

    // Default limits for Schools without an explicit plan (Trial/Free)
    const limit = school.plan?.maxStudents ?? 50;

    const current = await prisma.studentProfile.count({
        where: { schoolId }
    });

    return {
        allowed: current < limit,
        current,
        limit,
        usagePercentage: (current / limit) * 100
    };
}

/**
 * Check if a school has reached its teacher quota
 */
export async function checkTeacherQuota(schoolId: string): Promise<QuotaStatus> {
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        include: { plan: true }
    });

    if (!school) throw new Error("School not found");

    const limit = school.plan?.maxTeachers ?? 5; // Default for trial

    const current = await prisma.teacherProfile.count({
        where: { schoolId }
    });

    return {
        allowed: current < limit,
        current,
        limit,
        usagePercentage: (current / limit) * 100
    };
}

/**
 * Centralized error for quota exceeded
 */
export class QuotaExceededError extends Error {
    constructor(public resource: string, public limit: number) {
        super(`Quota exceeded for ${resource}. Maximum allowed: ${limit}`);
        this.name = "QuotaExceededError";
    }
}
