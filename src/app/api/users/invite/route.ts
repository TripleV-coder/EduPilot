import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { z } from "zod";
import { sendWelcomeEmail } from "@/lib/email";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";
import { canCreateRole } from "@/lib/rbac/permissions";
import { buildTeacherSchoolAssignments } from "@/lib/teachers/school-assignments";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

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
        const session = await auth();

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
        // SUPER_ADMIN can create anyone (but must provide schoolId for school-bound roles)
        // Others can only create within their own school
        if (!canCreateRole(currentUser.role as UserRole, validatedData.role)) {
            return NextResponse.json(
                { error: "Vous n'êtes pas autorisé à créer ce type de compte." },
                { status: 403 }
            );
        }

        if (currentUser.role !== "SUPER_ADMIN") {
            // Force the schoolId to the director's school
            validatedData.schoolId = currentUser.schoolId || undefined;
            if (!validatedData.schoolId) {
                return NextResponse.json(
                    { error: "Aucun établissement associé à ce compte." },
                    { status: 403 }
                );
            }
        }

        if (currentUser.role === "SUPER_ADMIN" && !validatedData.schoolId) {
            return NextResponse.json(
                { error: "Un établissement est requis pour ce rôle." },
                { status: 400 }
            );
        }

        if (validatedData.role === "SCHOOL_ADMIN" && !validatedData.schoolId) {
            return NextResponse.json(
                { error: "Veuillez fournir un établissement existant pour cet Admin. École." },
                { status: 400 }
            );
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

        // 7. Create the user and associated profile in a transaction
        const newUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: validatedData.email,
                    firstName: validatedData.firstName,
                    lastName: validatedData.lastName,
                    password: hashedPassword,
                    role: validatedData.role,
                    schoolId: validatedData.schoolId || null,
                    isActive: true,
                    mustChangePassword: true,
                },
            });

            // Create associated profile based on role
            const targetSchoolId = validatedData.schoolId || session.user.primarySchoolId || getActiveSchoolId(session);

            if (validatedData.role === "TEACHER" && targetSchoolId) {
                const teacherProfile = await tx.teacherProfile.create({
                    data: {
                        userId: user.id,
                        schoolId: targetSchoolId,
                    },
                });
                await tx.teacherSchoolAssignment.createMany({
                    data: buildTeacherSchoolAssignments({
                        teacherId: teacherProfile.id,
                        userId: user.id,
                        primarySchoolId: targetSchoolId,
                        schoolIds: [targetSchoolId],
                    }),
                });
            } else if (validatedData.role === "STUDENT" && targetSchoolId) {
                const matricule = `STU-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
                await tx.studentProfile.create({
                    data: {
                        userId: user.id,
                        schoolId: targetSchoolId,
                        matricule,
                    },
                });
            } else if (validatedData.role === "PARENT") {
                await tx.parentProfile.create({
                    data: {
                        userId: user.id,
                    },
                });
            }

            return user;
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

        await invalidateByPath(CACHE_PATHS.users);
        if (newUser.role === "TEACHER") await invalidateByPath(CACHE_PATHS.teachers);
        if (newUser.role === "STUDENT") await invalidateByPath(CACHE_PATHS.students);

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
        if (isZodError(error)) {
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
