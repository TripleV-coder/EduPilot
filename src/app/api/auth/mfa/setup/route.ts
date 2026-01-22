import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { generateSecret, generateQRCode, verifyToken, generateBackupCodes } from "@/lib/auth/two-factor";
import { z } from "zod";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/mfa/generate - Generate secret and QR code for setup
 * POST /api/auth/mfa/enable - specific verification enabling MFA
 * POST /api/auth/mfa/disable - Disable MFA
 * POST /api/auth/mfa/verify - Verify token
 */

const verifySchema = z.object({
    token: z.string().length(6, "Le code doit contenir 6 chiffres"),
    secret: z.string().optional(), // Used during setup only
});

const disableSchema = z.object({
    password: z.string().min(1, "Mot de passe requis"),
});

// Encryption helper (basic for now, should use a strong key in env)
// Ideally, secrets should be encrypted at rest if the DB is not encrypted
function encrypt(text: string) {
    // TODO: Implement strong encryption with ENV key
    // For MVP/Demo we store as is or base64. 
    // SECURITY NOTE: In production, use AES-256 with key management
    return text;
}

export const POST = createApiHandler(
    async (request, { session }, _t) => {
        const action = request.nextUrl.searchParams.get("action");
        const userId = session.user.id;

        if (!action) {
            return NextResponse.json({ success: false, message: "Action required" }, { status: 400 });
        }

        // 1. GENERATE SECRET
        if (action === "generate") {
            const { secret, otpauth } = generateSecret(session.user.email || "user");
            const qrCode = await generateQRCode(otpauth);

            return NextResponse.json({
                success: true,
                secret,
                qrCode,
            });
        }

        const body = await request.json();

        // 2. ENABLE MFA (Verify & Save)
        if (action === "enable") {
            const validated = verifySchema.safeParse(body);
            if (!validated.success) {
                return NextResponse.json({ success: false, message: "Code invalide" }, { status: 400 });
            }

            const { token, secret } = validated.data;
            if (!secret) return NextResponse.json({ success: false, message: "Secret manquant" }, { status: 400 });

            const isValid = verifyToken(token, secret);
            if (!isValid) {
                return NextResponse.json({ success: false, message: "Code incorrect" }, { status: 400 });
            }

            // Generate backup codes
            const backupCodes = generateBackupCodes();

            // Save to DB
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isTwoFactorEnabled: true,
                    twoFactorSecret: encrypt(secret),
                    twoFactorBackupCodes: backupCodes, // Ideally hashed too
                },
            });

            // Audit log
            await prisma.auditLog.create({
                data: {
                    userId,
                    action: "MFA_ENABLED",
                    entity: "user",
                    entityId: userId,
                },
            });

            return NextResponse.json({
                success: true,
                message: "Authentification à deux facteurs activée",
                backupCodes,
            });
        }

        // 3. DISABLE MFA
        if (action === "disable") {
            // Need to verify password first ideally, skipping for brevity in this step or assuming frontend did it?
            // Let's verify password for security
            // Import bcrypt effectively
            // bcrypt already imported
            const validated = disableSchema.safeParse(body);
            if (!validated.success) return NextResponse.json({ success: false, message: "Mot de passe requis" }, { status: 400 });

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

            const validPassword = await bcrypt.compare(validated.data.password, user.password);
            if (!validPassword) {
                return NextResponse.json({ success: false, message: "Mot de passe incorrect" }, { status: 403 });
            }

            await prisma.user.update({
                where: { id: userId },
                data: {
                    isTwoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorBackupCodes: [],
                },
            });

            await prisma.auditLog.create({
                data: {
                    userId,
                    action: "MFA_DISABLED",
                    entity: "user",
                    entityId: userId,
                },
            });

            return NextResponse.json({ success: true, message: "MFA désactivé" });
        }

        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
);
