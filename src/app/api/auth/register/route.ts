import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

// Simplified schema for Super Admin registration
const superAdminSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
  email: z.string().email("Email invalide").toLowerCase().trim(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ============================================
    // 🔒 SUPER ADMIN LOCKOUT STRATEGY
    // ============================================
    // This endpoint ONLY allows ONE user registration.
    // After the first user is created, it permanently locks.
    // ============================================

    const userCount = await prisma.user.count();

    if (userCount > 0) {
      // 🚨 LOCKOUT: Public registration is PERMANENTLY CLOSED
      logger.warn("Attempted public registration after lockout", {
        attemptedEmail: body.email
      });
      return NextResponse.json(
        {
          error: "L'inscription publique est désactivée. Seul l'administrateur peut créer des comptes via le tableau de bord."
        },
        { status: 403 }
      );
    }

    // Validate input
    const validatedData = superAdminSchema.parse(body);

    // Hash password with strong salt
    const hashedPassword = await hash(validatedData.password, 12);

    // Create the ONE AND ONLY Super Admin 👑
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        password: hashedPassword,
        role: "SUPER_ADMIN", // First user is ALWAYS Super Admin
        isActive: true,
      },
    });

    logger.info("Super Admin created - System initialized", {
      userId: user.id,
      email: user.email
    });

    return NextResponse.json(
      {
        message: "Système initialisé avec succès. Vous êtes le Super Administrateur.",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
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

    logger.error("Registration error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
