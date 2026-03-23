/**
 * First Login API
 * Gestion du premier login avec changement de mot de passe obligatoire
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { isZodError } from "@/lib/is-zod-error";
import { normalizeTempPassword } from '@/lib/auth/password-generator';
import { logger } from "@/lib/utils/logger";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitKey,
  FORGOT_PASSWORD_RATE_LIMIT,
} from '@/lib/auth/rate-limiter';

/**
 * GET - Valider le token et obtenir les infos utilisateur
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }

    // Trouver le token
    const tokenRecord = await prisma.firstLoginToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 404 });
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expiré' }, { status: 410 });
    }

    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      user: tokenRecord.user,
      // Ne pas retourner le tempPassword hashé (inutile côté client)
    });
  } catch (error) {
    logger.error('[Validate Token Error]', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}

/**
 * POST - Changer le mot de passe (avec ou sans MDP temporaire)
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting par IP
    const ip = getClientIp(req);
    const rateLimitKey = createRateLimitKey('first-login', ip);
    const rateLimitResult = await checkRateLimit(rateLimitKey, FORGOT_PASSWORD_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Trop de tentatives. Veuillez réessayer plus tard.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    const schema = z.object({
      token: z.string(),
      currentPassword: z.string().optional(),
      newPassword: z
        .string()
        .min(8, 'Minimum 8 caractères')
        .regex(/[A-Z]/, 'Au moins une majuscule')
        .regex(/[a-z]/, 'Au moins une minuscule')
        .regex(/[0-9]/, 'Au moins un chiffre')
        .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial'),
    });

    const body = await req.json();
    const validated = schema.parse(body);

    // 1. Trouver le token
    const tokenRecord = await prisma.firstLoginToken.findUnique({
      where: { token: validated.token },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 400 }
      );
    }

    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé' },
        { status: 400 }
      );
    }

    // 2. Vérifier le mot de passe temporaire si le token en possède un
    // (Un token sans tempPassword est considéré comme un vrai Magic Link généré par l'admin via email)
    if (tokenRecord.tempPassword !== null) {
      if (!validated.currentPassword) {
        return NextResponse.json(
          { error: 'Mot de passe temporaire requis' },
          { status: 400 }
        );
      }

      // Le tempPassword est hashé dans la DB
      // Normaliser l'entrée utilisateur (enlever tiret et mettre en majuscules)
      const normalizedInput = normalizeTempPassword(validated.currentPassword);

      // Vérifier contre le hash stocké dans FirstLoginToken
      const isCorrectTemp = await bcrypt.compare(normalizedInput, tokenRecord.tempPassword);

      // Fallback: vérifier aussi contre le mot de passe actuel de l'utilisateur
      const isCorrectHash = await bcrypt.compare(
        validated.currentPassword,
        tokenRecord.user.password || ""
      );

      if (!isCorrectTemp && !isCorrectHash) {
        return NextResponse.json(
          { error: 'Mot de passe temporaire incorrect' },
          { status: 401 }
        );
      }
    }

    // 3. Vérifier que le nouveau MDP est différent de l'ancien
    const sameAsOld = await bcrypt.compare(
      validated.newPassword,
      tokenRecord.user.password
    );

    if (sameAsOld) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit être différent du temporaire' },
        { status: 400 }
      );
    }

    // 4. Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(validated.newPassword, 12);

    // 5. Mettre à jour l'utilisateur
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          password: hashedPassword,
          emailVerified: new Date(),
        },
      });

      // Marquer le token comme utilisé
      await tx.firstLoginToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: tokenRecord.userId,
          action: 'PASSWORD_CHANGED_FIRST_LOGIN',
          entity: 'user',
          entityId: tokenRecord.userId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Mot de passe changé avec succès',
    });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[First Login Error]', error);
    return NextResponse.json(
      { error: 'Erreur lors du changement de mot de passe' },
      { status: 500 }
    );
  }
}
