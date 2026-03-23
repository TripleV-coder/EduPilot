/**
 * Account Lockout Service
 * Gère le verrouillage automatique des comptes après plusieurs tentatives échouées
 */

import prisma from '@/lib/prisma';

const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Enregistrer une tentative de connexion échouée
 */
export async function recordFailedLoginAttempt(userId: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  remainingAttempts: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lockedUntil: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Vérifier si le compte est déjà verrouillé
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      isLocked: true,
      lockedUntil: user.lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Incrémenter le compteur d'échecs
  const newFailedAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
  const lockoutTime = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newFailedAttempts,
      lockedUntil: lockoutTime,
    },
  });

  // Créer audit log si verrouillage
  if (shouldLock) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ACCOUNT_LOCKED',
        entity: 'user',
        entityId: userId,
        newValues: { message: `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts` },
      },
    });
  }

  return {
    isLocked: shouldLock,
    lockedUntil: lockoutTime ?? undefined,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - newFailedAttempts),
  };
}

/**
 * Vérifier si un compte est verrouillé
 */
export async function isAccountLocked(userId: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });

  if (!user) {
    return { isLocked: false };
  }

  const now = new Date();
  const isLocked = user.lockedUntil ? user.lockedUntil > now : false;

  return {
    isLocked,
    lockedUntil: isLocked && user.lockedUntil ? user.lockedUntil : undefined,
  };
}

/**
 * Réinitialiser le compteur d'échecs après connexion réussie
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Déverrouiller manuellement un compte (admin action)
 */
export async function unlockAccount(
  userId: string,
  unlockedBy: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: unlockedBy,
      action: 'ACCOUNT_UNLOCKED',
      entity: 'user',
      entityId: userId,
      newValues: { message: 'Account manually unlocked by administrator' },
    },
  });
}

/**
 * Obtenir le temps restant avant déverrouillage automatique
 */
export function getRemainingLockoutTime(lockedUntil: Date): number {
  const now = new Date();
  const remaining = lockedUntil.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / 1000)); // en secondes
}
