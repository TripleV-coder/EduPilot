/**
 * Helpers d'authentification pour les routes API
 */

import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@prisma/client';
import { unauthorized, forbidden } from './error-responses';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  firstName: string;
  lastName: string;
}

export interface AuthOptions {
  requiredRoles?: UserRole[];
  requireSchoolAccess?: boolean;
  allowSuperAdmin?: boolean;
}

/**
 * Authentifier une requête et retourner l'utilisateur
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<{ user: AuthenticatedUser } | { error: any }> {
  const {
    requiredRoles = [],
    requireSchoolAccess = false,
    allowSuperAdmin = true,
  } = options;

  // Récupérer le token JWT
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || !token.id) {
    return { error: unauthorized() };
  }

  const user: AuthenticatedUser = {
    id: token.id as string,
    email: token.email as string,
    role: token.role as UserRole,
    schoolId: token.schoolId as string | null,
    firstName: token.firstName as string,
    lastName: token.lastName as string,
  };

  // Vérifier les rôles requis
  if (requiredRoles.length > 0) {
    const hasRequiredRole =
      requiredRoles.includes(user.role) ||
      (allowSuperAdmin && user.role === 'SUPER_ADMIN');

    if (!hasRequiredRole) {
      return { error: forbidden('Permissions insuffisantes') };
    }
  }

  // Vérifier l'accès à l'établissement
  if (requireSchoolAccess && user.role !== 'SUPER_ADMIN') {
    if (!user.schoolId) {
      return { error: forbidden('Aucun établissement associé') };
    }
  }

  return { user };
}

/**
 * Helper pour vérifier si l'utilisateur peut accéder à une ressource d'un établissement
 */
export function canAccessSchool(
  user: AuthenticatedUser,
  targetSchoolId: string
): boolean {
  // Super admin peut accéder à tout
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }

  // Les autres doivent être du même établissement
  return user.schoolId === targetSchoolId;
}

/**
 * Helper pour obtenir le filtre schoolId pour les queries Prisma
 */
export function getSchoolFilter(user: AuthenticatedUser): { schoolId: string } | Record<string, never> {
  if (user.role === 'SUPER_ADMIN') {
    return {}; // Pas de filtre, accès à tous les établissements
  }

  if (!user.schoolId) {
    throw new Error('User has no school assigned');
  }

  return { schoolId: user.schoolId };
}

/**
 * Helpers de rôle simplifiés
 */
export function isSuperAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'SUPER_ADMIN';
}

export function isSchoolAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR';
}

export function isTeacher(user: AuthenticatedUser): boolean {
  return user.role === 'TEACHER';
}

export function isStudent(user: AuthenticatedUser): boolean {
  return user.role === 'STUDENT';
}

export function isParent(user: AuthenticatedUser): boolean {
  return user.role === 'PARENT';
}

/**
 * Vérifier si l'utilisateur peut gérer un autre utilisateur
 */
export function canManageUser(
  actor: AuthenticatedUser,
  targetRole: UserRole,
  targetSchoolId?: string
): boolean {
  // Super admin peut tout gérer
  if (actor.role === 'SUPER_ADMIN') {
    return true;
  }

  // Vérifier l'établissement
  if (targetSchoolId && !canAccessSchool(actor, targetSchoolId)) {
    return false;
  }

  // Hiérarchie de rôles
  const roleHierarchy: Record<UserRole, number> = {
    SUPER_ADMIN: 100,
    SCHOOL_ADMIN: 80,
    DIRECTOR: 80,
    ACCOUNTANT: 60,
    TEACHER: 50,
    PARENT: 20,
    STUDENT: 10,
  };

  return roleHierarchy[actor.role] > roleHierarchy[targetRole];
}
