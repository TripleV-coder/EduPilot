import { prisma } from "@/lib/prisma";

const LOCKOUT_THRESHOLD = 5;       // Failed attempts before lockout
const LOCKOUT_DURATION_MS = 900000; // 15 minutes

export async function recordLoginAttempt(userId: string, success: boolean) {
    if (success) {
        // Reset failed attempts on successful login
        await prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        return { locked: false };
    }

    // Increment failed attempts
    const user = await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
    });

    // Check if should lock
    if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        await prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
        });
        return { locked: true, until: new Date(Date.now() + LOCKOUT_DURATION_MS) };
    }

    return { locked: false, attemptsRemaining: LOCKOUT_THRESHOLD - user.failedLoginAttempts };
}

export async function isAccountLocked(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lockedUntil: true },
    });

    if (!user?.lockedUntil) return false;
    if (new Date() > user.lockedUntil) {
        // Lockout expired, clear it
        await prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: null, failedLoginAttempts: 0 },
        });
        return false;
    }

    return true;
}

export async function isAccountLockedByEmail(email: string): Promise<{ locked: boolean; until?: Date }> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { lockedUntil: true },
    });

    if (!user?.lockedUntil) return { locked: false };
    if (new Date() > user.lockedUntil) return { locked: false };

    return { locked: true, until: user.lockedUntil };
}
