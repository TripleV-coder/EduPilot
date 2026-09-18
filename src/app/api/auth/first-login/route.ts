/**
 * First Login API
 * Gestion du premier login avec changement de mot de passe obligatoire
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { isZodError } from "@/lib/is-zod-error";
import { normalizeTempPassword } from '@/lib/auth/password-generator';
import { logger } from "@/lib/utils/logger";
import {
  checkRateLimitKey,
  releaseRateLimit,
  getClientIp,
  createRateLimitKey,
  LOGIN_FAILURE_RATE_LIMIT,
} from '@/lib/rate-limit';
import { createApiHandler } from "@/lib/api/api-helpers";
import { auth } from "@/lib/auth";
import { invalidateUserStatusCache } from "@/lib/auth/config";

/**
 * M1 — compte créé par un tiers, connecté avec son mot de passe provisoire :
 * le middleware le confine à /first-login, qui change le mot de passe depuis
 * la SESSION (la plupart des comptes importés ne reçoivent aucun lien).
 * `passwordChangedAt` invalide la session en cours : reconnexion avec le
 * nouveau mot de passe.
 */
async function changeProvisionalPasswordFromSession(
  currentPassword: string | undefined,
  newPassword: string,
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, mustChangePassword: true },
  });
  if (!user?.mustChangePassword) {
    return NextResponse.json(
      { error: "Aucun mot de passe provisoire à remplacer pour ce compte" },
      { status: 400 }
    );
  }
  if (!currentPassword) {
    return NextResponse.json({ error: 'Mot de passe temporaire requis' }, { status: 400 });
  }
  if (!(await bcrypt.compare(currentPassword, user.password ?? ""))) {
    return NextResponse.json({ error: 'Mot de passe temporaire incorrect' }, { status: 401 });
  }
  if (await bcrypt.compare(newPassword, user.password ?? "")) {
    return NextResponse.json(
      { error: 'Le nouveau mot de passe doit être différent du temporaire' },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, mustChangePassword: false, passwordChangedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { userId: user.id, action: 'PASSWORD_CHANGED_FIRST_LOGIN', entity: 'user', entityId: user.id },
    }),
  ]);
  invalidateUserStatusCache(user.id);

  return NextResponse.json({ success: true, message: 'Mot de passe changé avec succès' });
}

/**
 * GET - Valider le token et obtenir les infos utilisateur
 */
export const GET = createApiHandler(
  async (req) => {
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
  },
  { requireAuth: false },
);

/**
 * POST - Changer le mot de passe (avec ou sans MDP temporaire)
 *
 * N41 : seuls les ÉCHECS (mot de passe provisoire faux, 401) comptent dans la
 * limite par adresse. Une salle de formation, le NAT d'un établissement ou le
 * réseau d'un opérateur mobile activent de nombreux comptes depuis une même
 * adresse ; l'ancienne limite (3 tentatives / 15 min, réussites comprises)
 * bloquait l'activation au 4e compte. La tentative est comptée AVANT le
 * traitement (une rafale parallèle ne dépasse pas la limite), puis rendue si
 * elle n'est pas un échec de mot de passe — même principe que la connexion (H4).
 */
export const POST = createApiHandler(
  async (req) => {
    const rateLimitKey = createRateLimitKey('first-login-failures', getClientIp(req));
    const rateLimitResult = await checkRateLimitKey(rateLimitKey, LOGIN_FAILURE_RATE_LIMIT);

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000);
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

    const response = await changeFirstLoginPassword(req);
    if (response.status !== 401) await releaseRateLimit(rateLimitKey);
    return response;
  },
  { requireAuth: false },
);

async function changeFirstLoginPassword(req: Request): Promise<NextResponse> {
    try {
      const schema = z.object({
        // Sans jeton : changement depuis la session (M1).
        token: z.string().optional(),
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

      if (!validated.token) {
        return changeProvisionalPasswordFromSession(validated.currentPassword, validated.newPassword);
      }

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
            // M1 : l'obligation est levée et la session en cours invalidée.
            mustChangePassword: false,
            passwordChangedAt: new Date(),
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

      invalidateUserStatusCache(tokenRecord.userId);

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
