import { prisma } from "@/lib/prisma";
import { auditLog } from "./audit-log";

/**
 * RGPD/GDPR Utilities
 * Implements right to access (data export) and right to erasure
 */

export async function exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            studentProfile: true,
            teacherProfile: true,
            parentProfile: true,
            notifications: { take: 100 },
            auditLogs: { take: 100 },
            userAchievements: { include: { achievement: true } },
            borrowingRecords: { include: { book: { select: { title: true } } } },
            mealTickets: true,
        },
    });

    if (!user) throw new Error("User not found");

    // Sanitize sensitive data
    const exportData = {
        personalInfo: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            createdAt: user.createdAt,
        },
        profiles: {
            student: user.studentProfile,
            teacher: user.teacherProfile,
            parent: user.parentProfile,
        },
        activity: {
            notifications: user.notifications.length,
            auditLogs: user.auditLogs.length,
        },
        achievements: user.userAchievements.map(ua => ({
            name: ua.achievement.name,
            unlockedAt: ua.unlockedAt,
        })),
        libraryHistory: user.borrowingRecords.map(br => ({
            book: br.book.title,
            borrowedAt: br.borrowedAt,
            returnedAt: br.returnedAt,
        })),
        canteenTickets: user.mealTickets.length,
        exportedAt: new Date().toISOString(),
    };

    await auditLog.dataAccess(userId, "USER", userId);

    return exportData;
}

export async function anonymizeUser(userId: string, requestedBy: string) {
    // Soft-anonymization: replace PII with anonymized values
    const anonymizedEmail = `deleted_${userId.slice(0, 8)}@anonymized.local`;

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: {
                email: anonymizedEmail,
                firstName: "Utilisateur",
                lastName: "Supprimé",
                phone: null,
                avatar: null,
                isActive: false,
                password: "ANONYMIZED", // Prevents login
            },
        }),
        // Clear sensitive profile data
        prisma.studentProfile.updateMany({
            where: { userId },
            data: { address: null },
        }),
    ]);

    await auditLog.securityEvent(requestedBy, "USER_ANONYMIZATION", { targetUserId: userId });

    return { success: true, anonymizedEmail };
}

export async function getDataRetentionStatus(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, isActive: true },
    });

    if (!user) return null;

    const dataAge = Date.now() - user.createdAt.getTime();
    const yearsOld = dataAge / (365.25 * 24 * 60 * 60 * 1000);

    return {
        accountCreated: user.createdAt,
        dataAgeYears: yearsOld.toFixed(1),
        isActive: user.isActive,
        retentionPolicy: "5 years after account deactivation",
    };
}
