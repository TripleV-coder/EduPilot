import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email";

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 3; // Max 3 requests
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Rate limiting
    if (isRateLimited(email)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez réessayer dans 15 minutes." },
        { status: 429 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      // Add artificial delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
      return NextResponse.json({
        success: true,
        message: "Si un compte existe avec cet email, vous recevrez les instructions de réinitialisation.",
      });
    }

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Generate a secure token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store the token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    const emailSent = await sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      resetUrl,
    });

    if (!emailSent) {
      logger.warn(`Failed to send password reset email to ${email}`);
      // Don't expose email sending failure to prevent enumeration
    }

    return NextResponse.json({
      success: true,
      message: "Si un compte existe avec cet email, vous recevrez les instructions de réinitialisation.",
    });
  } catch (error: unknown) {
    logger.error(" in forgot-password:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Email invalide" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
