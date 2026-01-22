/**
 * Initial Setup API Route
 * Only accessible when no users exist in the system
 * Creates the first SUPER_ADMIN account
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { generateTempPassword } from "@/lib/auth/password-generator";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    // Check if users already exist
    const userCount = await prisma.user.count();

    if (userCount > 0) {
      return NextResponse.json(
        { error: "Le système a déjà été initialisé. Vous ne pouvez pas accéder à cette page." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, schoolName } = body;

    // Validate input
    if (!firstName || !lastName || !email || !schoolName) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Check if school already exists
    let school = await prisma.school.findFirst({
      where: {
        name: schoolName,
      },
    });

    // Create school if it doesn't exist
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: schoolName,
          code: schoolName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .substring(0, 20),
          level: "MIXED", // Default level
          type: "PRIVATE", // Default type
        },
      });
    }

    // Create default academic config for the school
    const existingConfig = await prisma.academicConfig.findUnique({
      where: { schoolId: school.id },
    });

    if (!existingConfig) {
      await prisma.academicConfig.create({
        data: {
          schoolId: school.id,
          periodType: "TRIMESTER",
          periodsCount: 3,
          maxGrade: 20,
          passingGrade: 10,
        },
      });
    }

    // Create the SUPER_ADMIN user
    // For initial setup, we bypass normal permission checks by using a special approach
    const result = await createInitialSuperAdmin(
      {
        email: email.toLowerCase().trim(),
        firstName,
        lastName,
        schoolId: school.id,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Compte administrateur créé avec succès",
        loginUrl: result.loginUrl,
        tempPassword: result.tempPassword,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error("Setup error", error as Error);

    return NextResponse.json(
      { error: "Erreur lors de l'initialisation du système", code: "SETUP_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Create the initial SUPER_ADMIN bypassing normal permission validation
 */
async function createInitialSuperAdmin(data: {
  email: string;
  firstName: string;
  lastName: string;
  schoolId: string;
}) {
  // Generate temp password
  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  // Create user in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create SUPER_ADMIN user
    const user = await tx.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "SUPER_ADMIN",
        schoolId: data.schoolId,
        isActive: true,
      },
    });

    // Create first-login token
    const loginToken = crypto.randomUUID();
    // Hasher le mot de passe temporaire pour plus de sécurité
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    await tx.firstLoginToken.create({
      data: {
        userId: user.id,
        token: loginToken,
        tempPassword: hashedTempPassword, // Stockage hashé
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Audit log for system initialization
    await tx.auditLog.create({
      data: {
        userId: "SYSTEM",
        action: "SYSTEM_INITIALIZED",
        entity: "system",
        entityId: user.id,
      },
    });

    return { user, tempPassword, loginToken };
  });

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/first-login?token=${result.loginToken}`;

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
    },
    tempPassword: result.tempPassword,
    loginToken: result.loginToken,
    loginUrl,
  };
}

/**
 * GET endpoint to check if setup is needed
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ setupNeeded: userCount === 0 });
  } catch (_error) {
    return NextResponse.json(
      { error: "Impossible de vérifier l'état du système" },
      { status: 500 }
    );
  }
}
