import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { sendWelcomeEmail } from "@/lib/email";
import crypto from "crypto";

// Validation schema for user invitation
const inviteUserSchema = z.object({
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
    email: z.string().email("Email invalide").toLowerCase().trim(),
    role: z.enum(["DIRECTOR", "SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"]),
    schoolId: z.string().optional(), // Required for non-SUPER_ADMIN roles
});

// Generate a secure temporary password
function generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(crypto.randomInt(chars.length));
    }
    return password;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Verify authenticated user
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: "Non autorisé. Veuillez vous connecter." },
                { status: 401 }
            );
        }

        // 2. Check permissions (only SUPER_ADMIN and DIRECTOR can invite)
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, schoolId: true }
        });

        if (!currentUser) {
            return NextResponse.json(
                { error: "Utilisateur non trouvé." },
                { status: 404 }
            );
        }

        const allowedRoles = ["SUPER_ADMIN", "DIRECTOR", "SCHOOL_ADMIN"];
        if (!allowedRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: "Vous n'avez pas la permission d'inviter des utilisateurs." },
                { status: 403 }
            );
        }

        // 3. Parse and validate request body
        const body = await request.json();
        const validatedData = inviteUserSchema.parse(body);

        // 4. Role-based constraints
        // SUPER_ADMIN can create anyone
        // DIRECTOR can only create within their own school
        if (currentUser.role !== "SUPER_ADMIN") {
            // Director can only invite Teachers, Students, Parents for their school
            if (validatedData.role === "SUPER_ADMIN" || validatedData.role === "DIRECTOR") {
                return NextResponse.json(
                    { error: "Vous ne pouvez pas créer un compte de ce niveau." },
                    { status: 403 }
                );
            }

            // Force the schoolId to the director's school
            validatedData.schoolId = currentUser.schoolId || undefined;
        }

        // 5. Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "Un utilisateur avec cet email existe déjà." },
                { status: 400 }
            );
        }

        // 6. Generate temporary password
        const tempPassword = generateTempPassword();
        const hashedPassword = await hash(tempPassword, 12);

        // 7. Create the user
        const newUser = await prisma.user.create({
            data: {
                email: validatedData.email,
                firstName: validatedData.firstName,
                lastName: validatedData.lastName,
                password: hashedPassword,
                role: validatedData.role,
                schoolId: validatedData.schoolId || null,
                isActive: true,
                // TODO: Add "mustChangePassword: true" field for forced password change
            },
        });

        // 8. Send welcome email with temporary password
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const loginUrl = `${baseUrl}/login`;

        await sendWelcomeEmail({
            email: validatedData.email,
            firstName: validatedData.firstName,
            loginUrl,
            tempPassword,
        });

        logger.info("User invited successfully", {
            invitedBy: session.user.id,
            newUserId: newUser.id,
            role: newUser.role,
        });

        return NextResponse.json(
            {
                message: "Utilisateur invité avec succès. Un email a été envoyé.",
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    role: newUser.role,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }

        logger.error("User invitation error:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'invitation de l'utilisateur." },
            { status: 500 }
        );
    }
}
