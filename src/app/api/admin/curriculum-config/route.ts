/**
 * API Endpoint: Configuration des Matières et Coefficients
 *
 * Seul le SuperAdmin peut configurer ces paramètres.
 * Les données se synchronisent automatiquement aux directeurs et profs.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError, type TranslationFn } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { validateCoefficient, validateGrade } from "@/lib/benin-curriculum-system";

// ============================================
// SCHÉMAS DE VALIDATION
// ============================================

const createSubjectSchema = z.object({
  schoolId: z.string(),
  name: z.string().min(2, "Le nom de la matière doit faire au moins 2 caractères"),
  code: z.string().min(2, "Le code doit faire au moins 2 caractères"),
  category: z.string().optional(),
  description: z.string().optional(),
});

const assignSubjectSchema = z.object({
  classId: z.string(),
  subjectId: z.string(),
  coefficient: z.number().min(0.01).max(10),
});

const updateCoefficientSchema = z.object({
  classSubjectId: z.string(),
  coefficient: z.number().min(0.01).max(10),
});

const removeSubjectSchema = z.object({
  classSubjectId: z.string(),
});

// ============================================
// GET /api/admin/curriculum-config
// Lister les matières d'une classe
// ============================================

export const GET = createApiHandler(
  async (request: NextRequest, { session }, _t: TranslationFn) => {
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId obligatoire" },
        { status: 400 }
      );
    }

    const classSubjects = await prisma.classSubject.findMany({
      where: { classId },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    });

    // Calculer le total des coefficients
    const totalCoefficients = classSubjects.reduce((sum, cs) => sum + Number(cs.coefficient), 0);

    return NextResponse.json({
      subjects: classSubjects,
      totalCoefficients,
      count: classSubjects.length,
    });
  },
  { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }
);

// ============================================
// POST /api/admin/curriculum-config
// Créer une matière ou assigner une matière à une classe
// ============================================

export const POST = createApiHandler(
  async (request: NextRequest, { session }, _t: TranslationFn) => {
    // Seul SuperAdmin peut configurer
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le SuperAdmin peut configurer les matières" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "create-subject") {
      // Créer une matière
      const body = await request.json();
      const parsed = createSubjectSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { schoolId, name, code, category, description } = parsed.data;

      // Vérifier l'école existe
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
      });

      if (!school) {
        return NextResponse.json(
          { error: "École non trouvée" },
          { status: 404 }
        );
      }

      // Vérifier que le code est unique pour cette école
      const existingSubject = await prisma.subject.findFirst({
        where: {
          code: code.toUpperCase(),
          schoolId,
        },
      });

      if (existingSubject) {
        return NextResponse.json(
          { error: "Une matière avec ce code existe déjà pour cette école" },
          { status: 409 }
        );
      }

      const subject = await prisma.subject.create({
        data: {
          schoolId,
          name,
          code: code.toUpperCase(),
          category,
        },
      });

      logger.info("Matière créée", { subjectId: subject.id, schoolId });
      return NextResponse.json(subject);

    } else if (action === "assign-subject") {
      // Assigner une matière à une classe
      const body = await request.json();
      const parsed = assignSubjectSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { classId, subjectId, coefficient } = parsed.data;

      // Valider le coefficient selon les règles Bénin
      const coefficientValidation = validateCoefficient(coefficient);
      if (!coefficientValidation.valid) {
        return NextResponse.json(
          { error: coefficientValidation.error },
          { status: 400 }
        );
      }

      // Vérifier que la classe existe
      const classExists = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classExists) {
        return NextResponse.json(
          { error: "Classe non trouvée" },
          { status: 404 }
        );
      }

      // Vérifier que la matière existe et appartient à la même école
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { school: true },
      });

      if (!subject) {
        return NextResponse.json(
          { error: "Matière non trouvée" },
          { status: 404 }
        );
      }

      // Vérifier que la matière n'est pas déjà assignée à cette classe
      const existingAssignment = await prisma.classSubject.findUnique({
        where: {
          classId_subjectId: {
            classId,
            subjectId,
          },
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          { error: "Cette matière est déjà assignée à cette classe" },
          { status: 409 }
        );
      }

      const classSubject = await prisma.classSubject.create({
        data: {
          classId,
          subjectId,
          coefficient,
        },
        include: {
          subject: true,
          class: true,
        },
      });

      logger.info("Matière assignée à une classe", {
        classSubjectId: classSubject.id,
        classId,
        subjectId,
        coefficient
      });

      return NextResponse.json(classSubject);

    } else {
      return NextResponse.json(
        { error: "Action non spécifiée. Utilisez ?action=create-subject ou ?action=assign-subject" },
        { status: 400 }
      );
    }
  },
  { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }
);

// ============================================
// PATCH /api/admin/curriculum-config
// Mettre à jour un coefficient
// ============================================

export const PATCH = createApiHandler(
  async (request: NextRequest, { session }, _t: TranslationFn) => {
    // Seul SuperAdmin peut configurer
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le SuperAdmin peut configurer les coefficients" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateCoefficientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { classSubjectId, coefficient } = parsed.data;

    // Valider le coefficient selon les règles Bénin
    const coefficientValidation = validateCoefficient(coefficient);
    if (!coefficientValidation.valid) {
      return NextResponse.json(
        { error: coefficientValidation.error },
        { status: 400 }
      );
    }

    // Vérifier que l'assignation existe
    const existingAssignment = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { subject: true, class: true },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignation matière-classe non trouvée" },
        { status: 404 }
      );
    }

    const updatedAssignment = await prisma.classSubject.update({
      where: { id: classSubjectId },
      data: { coefficient },
      include: {
        subject: true,
        class: true,
      },
    });

    logger.info("Coefficient mis à jour", {
      classSubjectId,
      oldCoefficient: existingAssignment.coefficient,
      newCoefficient: coefficient
    });

    return NextResponse.json(updatedAssignment);
  },
  { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }
);

// ============================================
// DELETE /api/admin/curriculum-config
// Supprimer une matière d'une classe
// ============================================

export const DELETE = createApiHandler(
  async (request: NextRequest, { session }, _t: TranslationFn) => {
    // Seul SuperAdmin peut configurer
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le SuperAdmin peut supprimer des matières" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const classSubjectId = url.searchParams.get("classSubjectId");

    if (!classSubjectId) {
      return NextResponse.json(
        { error: "classSubjectId obligatoire" },
        { status: 400 }
      );
    }

    // Vérifier que l'assignation existe
    const existingAssignment = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { subject: true, class: true },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignation matière-classe non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier s'il y a des notes pour cette matière dans cette classe
    const hasGrades = await prisma.grade.findFirst({
      where: {
        evaluation: {
          classSubjectId,
        },
      },
    });

    if (hasGrades) {
      return NextResponse.json(
        {
          error: "Impossible de supprimer cette matière car elle contient des notes. Supprimez d'abord les notes."
        },
        { status: 409 }
      );
    }

    await prisma.classSubject.delete({
      where: { id: classSubjectId },
    });

    logger.info("Matière supprimée d'une classe", {
      classSubjectId,
      classId: existingAssignment.classId,
      subjectId: existingAssignment.subjectId
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }
);
