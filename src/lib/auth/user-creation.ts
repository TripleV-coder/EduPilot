/**
 * User Creation Service
 * Service centralisé pour créer des utilisateurs avec mot de passe temporaire
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateTempPassword, generateMatricule, generateEmployeeNumber } from './password-generator';

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  schoolId?: string;
  createdBy: string;

  // Données spécifiques enseignant
  teacherData?: {
    specialization?: string;
    subjectIds?: string[];
    employeeNumber?: string;
  };

  // Données spécifiques étudiant
  studentData?: {
    dateOfBirth: Date;
    gender: 'M' | 'F';
    matricule?: string;
    classId: string;
    academicYearId: string; // Correction: academicYearId au lieu de academicYear
  };

  // Données spécifiques parent
  parentData?: {
    studentIds?: string[];
  };
}

export interface CreateUserResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  tempPassword: string;
  loginToken: string;
  loginUrl: string;
}

/**
 * Service de création d'utilisateurs
 */
export class UserCreationService {
  /**
   * Créer un utilisateur avec mot de passe temporaire
   */
  async createUser(data: CreateUserData): Promise<CreateUserResult> {
    // 1. Validation des permissions
    await this.validateCreatorPermissions(data.createdBy, data.role, data.schoolId);

    // 2. Vérifier que l'email n'existe pas
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    // 3. Générer mot de passe temporaire aléatoire
    const tempPassword = generateTempPassword(); // Ex: "HKMP-4728"

    // 4. Hash du mot de passe
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // 5. Créer l'utilisateur en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer utilisateur
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          schoolId: data.schoolId,
          isActive: true,
        },
      });

      // Créer profil selon le rôle
      let profile = null;
      switch (data.role) {
        case 'TEACHER':
          profile = await this.createTeacherProfile(tx, user.id, data);
          break;
        case 'STUDENT':
          profile = await this.createStudentProfile(tx, user.id, data);
          break;
        case 'PARENT':
          profile = await this.createParentProfile(tx, user.id, data);
          break;
      }

      // Créer token de premier login
      const loginToken = crypto.randomUUID();
      // Hasher le mot de passe temporaire pour plus de sécurité
      const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
      await tx.firstLoginToken.create({
        data: {
          userId: user.id,
          token: loginToken,
          tempPassword: hashedTempPassword, // Stockage hashé
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: data.createdBy,
          action: 'USER_CREATED',
          entity: 'user',
          entityId: user.id,
        },
      });

      return { user, profile, tempPassword, loginToken };
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
   * Valider que le créateur peut créer ce rôle
   */
  private async validateCreatorPermissions(
    creatorId: string,
    targetRole: UserRole,
    targetSchoolId?: string
  ) {
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { role: true, schoolId: true },
    });

    if (!creator) {
      throw new Error('Créateur introuvable');
    }

    // Vérifier hiérarchie
    if (!this.canCreateRole(creator.role, targetRole)) {
      throw new Error(
        `Le rôle ${creator.role} ne peut pas créer un utilisateur ${targetRole}`
      );
    }

    // Vérifier isolation multi-tenant
    if (creator.role !== 'SUPER_ADMIN') {
      if (targetSchoolId && targetSchoolId !== creator.schoolId) {
        throw new Error("Vous ne pouvez créer des utilisateurs que dans votre établissement");
      }
    }
  }

  /**
   * Vérifier hiérarchie de création
   */
  private canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
    const hierarchy: Record<UserRole, UserRole[]> = {
      SUPER_ADMIN: ['SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'],
      SCHOOL_ADMIN: ['DIRECTOR', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'],
      DIRECTOR: ['TEACHER', 'STUDENT', 'PARENT'],
      TEACHER: ['PARENT'], // Via invitation uniquement
      STUDENT: [],
      PARENT: [],
      ACCOUNTANT: [],
    };

    return hierarchy[creatorRole]?.includes(targetRole) || false;
  }

  /**
   * Créer profil enseignant
   */
  private async createTeacherProfile(tx: any, userId: string, data: CreateUserData) {
    const profile = await tx.teacherProfile.create({
      data: {
        userId,
        schoolId: data.schoolId!,
        employeeNumber: data.teacherData?.employeeNumber || generateEmployeeNumber('T'),
        specialization: data.teacherData?.specialization,
        hireDate: new Date(),
      },
    });

    // Assigner matières via ClassSubject si fournies
    // Note: Les matières sont maintenant liées via ClassSubject.teacherId
    // Cette logique sera complétée lors de l'assignation à une classe
    // Pour l'instant, on sauvegarde juste le profil enseignant

    return profile;
  }

  /**
   * Créer profil étudiant
   */
  private async createStudentProfile(tx: any, userId: string, data: CreateUserData) {
    if (!data.studentData) {
      throw new Error('Données étudiant manquantes');
    }

    const profile = await tx.studentProfile.create({
      data: {
        userId,
        schoolId: data.schoolId!,
        matricule: data.studentData.matricule || generateMatricule(),
        dateOfBirth: data.studentData.dateOfBirth,
        gender: data.studentData.gender,
      },
    });

    // Créer inscription dans la classe
    await tx.enrollment.create({
      data: {
        studentId: profile.id,
        classId: data.studentData.classId,
        academicYearId: data.studentData.academicYearId, // Correction: academicYearId
        // enrolledAt est automatiquement défini par @default(now())
        status: 'ACTIVE',
      },
    });

    return profile;
  }

  /**
   * Créer profil parent
   */
  private async createParentProfile(tx: any, userId: string, data: CreateUserData) {
    const profile = await tx.parentProfile.create({
      data: {
        userId,
        schoolId: data.schoolId!,
      },
    });

    // Lier aux enfants si fournis
    if (data.parentData?.studentIds && data.parentData.studentIds.length > 0) {
      await tx.parentChild.createMany({
        data: data.parentData.studentIds.map((studentId) => ({
          parentId: profile.id,
          studentId,
          relationship: 'PARENT',
        })),
      });
    }

    return profile;
  }
}

/**
 * Instance singleton du service
 */
export const userCreationService = new UserCreationService();
