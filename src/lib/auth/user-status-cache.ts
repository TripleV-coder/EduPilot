import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";

/**
 * État du compte relu à chaque requête authentifiée (callback `jwt`), avec un
 * cache mémoire court pour éviter une série de requêtes par appel.
 *
 * Les droits d'établissement (rattachements, cours, réseau, enfants) en font
 * partie : un retrait pendant une session ouverte s'applique au prochain
 * rafraîchissement, sans attendre l'expiration du jeton (audit MS-01).
 *
 * Plusieurs instances = plusieurs caches : la propagation est bornée par le
 * TTL ; l'instance qui opère le changement invalide aussitôt sa propre entrée.
 */
export const USER_STATUS_TTL_MS = 5_000;

export interface UserAccess {
  primarySchoolId: string | null;
  accessibleSchoolIds: string[];
  organizationIds: string[];
  primaryOrganizationId: string | null;
  isOrganizationManager: boolean;
}

export interface CachedUserStatus {
  passwordChangedAt: Date | null;
  roleChangedAt: Date | null;
  role: UserRole;
  isActive: boolean;
  school: { isActive: boolean } | null;
  access: UserAccess;
  fetchedAt: number;
}

const userStatusCache = new Map<string, CachedUserStatus>();

export async function getCachedUserStatus(userId: string): Promise<CachedUserStatus | null> {
  const cached = userStatusCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < USER_STATUS_TTL_MS) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordChangedAt: true,
      roleChangedAt: true,
      role: true,
      isActive: true,
      schoolId: true,
      school: { select: { isActive: true } },
    },
  });
  if (!user) return null;

  const [organizationAccess, accessibleSchoolIds] = await Promise.all([
    getOrganizationAccessForUser(userId),
    getAccessibleSchoolIdsForUser({ userId, role: user.role, primarySchoolId: user.schoolId }),
  ]);

  const { schoolId, ...status } = user;
  const entry: CachedUserStatus = {
    ...status,
    access: {
      primarySchoolId: schoolId,
      accessibleSchoolIds,
      organizationIds: organizationAccess.organizationIds,
      primaryOrganizationId: organizationAccess.primaryOrganizationId,
      isOrganizationManager: organizationAccess.isOrganizationManager,
    },
    fetchedAt: Date.now(),
  };
  userStatusCache.set(userId, entry);

  // Borne la taille de la table
  if (userStatusCache.size > 1000) {
    const now = Date.now();
    for (const [key, val] of userStatusCache) {
      if (now - val.fetchedAt > USER_STATUS_TTL_MS) userStatusCache.delete(key);
    }
  }

  return entry;
}

/** À appeler après tout changement de mot de passe, de rôle ou de droits d'établissement. */
export function invalidateUserStatusCache(userId: string): void {
  userStatusCache.delete(userId);
}
