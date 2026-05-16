/**
 * E2E global setup — runs once before any test.
 * Resets passwords of known seeded accounts (one per role) so E2E tests have
 * deterministic credentials. Also exposes school IDs for tenant-isolation tests.
 *
 * Never runs in production (guarded by NODE_ENV).
 */
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";

export const E2E_PASSWORD = "E2eTestPass!2026";

export const E2E_USERS = {
    SUPER_ADMIN: "admin@edupilot.bj",
    SCHOOL_ADMIN_1: "admin@saintmichel.bj",
    SCHOOL_ADMIN_2: "admin@lycee-behanzin.bj",
    DIRECTOR_1: "directeur@saintmichel.bj",
    ACCOUNTANT_1: "comptable@saintmichel.bj",
    TEACHER_1: "m.agbossou@saintmichel.bj",
    STUDENT_1: "kate.agbossou0@eleve.saintmichel.bj",
    PARENT_1: "fabrice.agbossou0@gmail.com",
} as const;

// Public so tests can build URLs that touch foreign-school resources.
export const E2E_SCHOOLS = {
    SCHOOL_1_ID: "cmnvlut6l000244oftzzq7qci", // Collège Saint-Michel
    SCHOOL_2_ID: "cmnvlut6p000344ofqvnnksnu", // Lycée Béhanzin
    SCHOOL_1_CLASS_ID: "cmnvluu9u001w44ofqozu68ix", // 6e A — Saint-Michel
} as const;

// Keep backwards compat with existing auth.setup.ts imports.
export const E2E_ADMIN_EMAIL = E2E_USERS.SCHOOL_ADMIN_1;
export const E2E_ADMIN_PASSWORD = E2E_PASSWORD;

async function resetUser(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    if (!user) {
        throw new Error(`E2E user ${email} not found — run \`npm run db:seed\` first.`);
    }

    const hashed = await bcrypt.hash(E2E_PASSWORD, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashed,
            isActive: true,
            lockedUntil: null,
            failedLoginAttempts: 0,
            isTwoFactorEnabled: false,
            mustChangePassword: false,
        },
    });
}

export default async function globalSetup() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("E2E global setup must not run in production.");
    }

    for (const email of Object.values(E2E_USERS)) {
        await resetUser(email);
    }

    console.log(`[e2e] Reset passwords for ${Object.keys(E2E_USERS).length} users`);
    await prisma.$disconnect();
}
