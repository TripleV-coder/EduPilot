import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { assignedRoles } from "@/lib/rbac/permissions";
import { getSchoolAccessForAssignedRoles } from "@/lib/auth/school-access";

/**
 * État du compte relu à chaque requête authentifiée (callback `jwt`).
 *
 * - La ligne du compte (statut, rôle, école principale, marqueur de droits)
 *   est lue en base À CHAQUE requête, sans cache : un seul appel Prisma, qui
 *   émet 2 instructions SQL par clé primaire (le compte, puis son école ;
 *   mesuré par tests/integration-db/session-access-cost.test.ts).
 *   Désactivation, suspension et changement de rôle s'appliquent donc dès la
 *   requête suivante, sur toutes les instances.
 * - Le calcul des écoles accessibles (rattachements, réseau, enfants), plus
 *   coûteux, est mis en cache par instance. Il est refait dès que le marqueur
 *   `roleChangedAt`, le rôle ou l'école principale diffèrent de ceux du
 *   calcul. Le marqueur est posé par des triggers PostgreSQL sur toute
 *   écriture qui modifie des droits (migration 20261017090000) : une
 *   révocation faite sur une instance est vue par toutes les autres à leur
 *   requête suivante, sans bus d'invalidation ni Redis (audit MS-01).
 * - ACCESS_SAFETY_TTL_MS n'est qu'un filet pour une donnée que les triggers
 *   ne couvriraient pas ; ce n'est pas le mécanisme de révocation.
 */
export const ACCESS_SAFETY_TTL_MS = 60_000;

export interface UserAccess {
  primarySchoolId: string | null;
  accessibleSchoolIds: string[];
  schoolIdsByRole: Partial<Record<UserRole, string[]>>;
  organizationIds: string[];
  primaryOrganizationId: string | null;
  isOrganizationManager: boolean;
}

export interface UserStatus {
  passwordChangedAt: Date | null;
  role: UserRole;
  roles: UserRole[];
  isActive: boolean;
  /** Suivi par le jeton : activer/désactiver la 2FA s'applique sans reconnexion. */
  isTwoFactorEnabled: boolean;
  school: { isActive: boolean } | null;
  access: UserAccess;
}

interface CachedAccess {
  marker: number | null;
  role: UserRole;
  rolesKey: string;
  primarySchoolId: string | null;
  access: UserAccess;
  fetchedAt: number;
}

const accessCache = new Map<string, CachedAccess>();

export async function getUserStatus(userId: string): Promise<UserStatus | null> {
  // Lue AVANT le calcul des droits : un changement validé pendant le calcul
  // laisse un marqueur différent, donc un nouveau calcul à la requête suivante.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordChangedAt: true,
      roleChangedAt: true,
      role: true,
      roles: true,
      isActive: true,
      isTwoFactorEnabled: true,
      schoolId: true,
      school: { select: { isActive: true } },
    },
  });
  if (!user) return null;

  const marker = user.roleChangedAt ? user.roleChangedAt.getTime() : null;
  const roles = assignedRoles(user) as UserRole[];
  const rolesKey = [...roles].sort().join(",");
  const cached = accessCache.get(userId);
  const fresh =
    cached &&
    cached.marker === marker &&
    cached.role === user.role &&
    cached.rolesKey === rolesKey &&
    cached.primarySchoolId === user.schoolId &&
    Date.now() - cached.fetchedAt < ACCESS_SAFETY_TTL_MS;

  let access: UserAccess;
  if (fresh) {
    access = cached.access;
  } else {
    const [organizationAccess, schoolAccess] = await Promise.all([
      getOrganizationAccessForUser(userId),
      getSchoolAccessForAssignedRoles({ userId, roles, primarySchoolId: user.schoolId }),
    ]);
    access = {
      primarySchoolId: user.schoolId,
      accessibleSchoolIds: schoolAccess.accessibleSchoolIds,
      schoolIdsByRole: schoolAccess.schoolIdsByRole,
      organizationIds: organizationAccess.organizationIds,
      primaryOrganizationId: organizationAccess.primaryOrganizationId,
      isOrganizationManager: organizationAccess.isOrganizationManager,
    };
    accessCache.set(userId, { marker, role: user.role, rolesKey, primarySchoolId: user.schoolId, access, fetchedAt: Date.now() });

    // Borne la taille de la table
    if (accessCache.size > 1000) {
      const now = Date.now();
      for (const [key, val] of accessCache) {
        if (now - val.fetchedAt > ACCESS_SAFETY_TTL_MS) accessCache.delete(key);
      }
    }
  }

  return {
    passwordChangedAt: user.passwordChangedAt,
    role: user.role,
    roles: user.roles,
    isActive: user.isActive,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    school: user.school,
    access,
  };
}

/**
 * Oublie le calcul des droits de ce compte sur cette instance. Les autres
 * instances suivent par le marqueur en base ; cet appel n'est plus nécessaire
 * à la révocation et ne sert qu'à éviter un calcul périmé local.
 */
export function invalidateUserStatusCache(userId: string): void {
  accessCache.delete(userId);
}
